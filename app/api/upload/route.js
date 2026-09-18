import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'
import { PDFParse } from 'pdf-parse'
import { createWorker, PSM } from 'tesseract.js'
import { VALID_DOCUMENT_TYPES, AUTOFILL_SCOPED_TYPES } from '@/app/lib/documentTypes'

// ---------- Validation limits ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// Below this many characters of embedded PDF text, we assume the PDF has no
// real text layer (i.e. it's a scanned/photographed document) and fall back
// to rasterizing pages + running OCR on them instead.
const MIN_DIGITAL_TEXT_LENGTH = 40

// Below this mean OCR confidence (0-100, from Tesseract), we flag the
// document as needing manual review / re-upload instead of trusting the
// detected text outright. This is the threshold that feeds the
// "Deficiency Alerts" / "Re-upload Requests" flow described in the module
// scope — low-confidence OCR isn't hidden, it's surfaced as an actionable
// status instead of silently returning garbled text.
const LOW_CONFIDENCE_THRESHOLD = 60

// Tesseract can report a deceptively high confidence score even when it
// detected essentially no real text — e.g. a page rotated too far for it to
// segment into text lines at all. That score is meaningless when it's
// attached to almost nothing, so below this many characters we treat OCR as
// having found nothing, flag it for review regardless of the confidence
// number, and zero that number out rather than show a contradictory
// "95% confident, no text detected" result.
const MIN_OCR_TEXT_LENGTH = 3

// pdf-parse's own page-joiner default ("-- 1 of 3 --") gets silently baked
// into its params object the first time it parses a page, even though we
// never pass a pageJoiner option ourselves. That means a fully-scanned,
// zero-text PDF still comes back from getText() with a few of these
// separator lines glued together — which is easily >= MIN_DIGITAL_TEXT_LENGTH
// even though not one of those characters came from the document itself.
// Strip them before we ever measure "how much real text is here".
const PDF_PAGE_SEPARATOR = /--\s*\d+\s+of\s+\d+\s*--/g

function stripPdfPageSeparators(text) {
  return text.replace(PDF_PAGE_SEPARATOR, '').trim()
}

// ---------- Image-quality precheck ----------
// Runs BEFORE OCR, on raw image uploads only (JPG/PNG straight from a phone
// camera — the actual source of blurry/glare/blank photos in practice; PDFs
// either have a real text layer or get rasterized by us at a controlled
// scale, so they don't need this). The goal is prevention, not correction:
// catch an obviously unusable photo immediately and send the applicant back
// to retake it, before spending time on a full OCR pass and before it ever
// becomes a "needs review" record someone has to triage later.
//
// This is a deliberately cheap, coarse check — a handful of pixel statistics
// via sharp, not a real blur/quality model. It's meant to catch the extreme,
// obvious cases (a blank page, a thumbnail-sized image, a photo washed out
// by glare or so out-of-focus it has almost no edges) — not to replace the
// OCR-confidence-based needsReview flag, which still catches everything more
// subtle than this.

// If either dimension is smaller than this, the image is treated as too
// low-resolution to reliably OCR (e.g. a thumbnail, a screenshot of a
// screenshot, or a heavily-downscaled photo).
const MIN_IMAGE_DIMENSION = 300

// Standard deviation of pixel brightness across the whole (grayscale) image.
// A real document photo — even a bad one — has edges: text, borders, a
// visible page against a background. A blank page, a glare-washed photo, or
// an image blurred past readability collapses toward one flat brightness
// value, which shows up as a very low stdev. Real scholarship-document test
// photos in this project ran well above this; deliberately conservative so
// this only catches the extreme cases and doesn't reject legitimate but
// low-contrast documents. Named and isolated the same way as
// LOW_CONFIDENCE_THRESHOLD above — a single tunable constant, not a scattered
// magic number, meant to be revisited against a larger sample set.
const MIN_CONTRAST_STDEV = 10

async function checkImageQuality(buffer, documentType) {
  const metadata = await sharp(buffer).metadata()
  const { width = 0, height = 0 } = metadata

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return {
      passed: false,
      reason: 'too_small',
      message: `This image is only ${width}×${height}px, too low-resolution to read reliably. Please upload a higher-resolution photo or scan (at least ${MIN_IMAGE_DIMENSION}px on each side).`
    }
  }

  // The contrast/readability check below exists to catch document photos
  // (PSA, Form 138, IDs) that are too blank/blurry/glared-over for OCR to
  // read. A profile picture is never OCR'd — checking "text readability"
  // on a person's face photo is testing the wrong thing and rejects
  // perfectly good photos (e.g. a plain, evenly-lit headshot can have low
  // grayscale variance without being blurry at all). Skip it for that type
  // only; the resolution check above still applies to everything.
  if (documentType === 'profilepic') {
    return { passed: true }
  }

  const stats = await sharp(buffer).grayscale().stats()
  const stdev = stats.channels[0]?.stdev ?? 0

  if (stdev < MIN_CONTRAST_STDEV) {
    return {
      passed: false,
      reason: 'low_contrast',
      message: 'This photo appears blank, extremely blurry, or washed out by glare — no readable detail could be detected. Please retake it on a flat surface, with even lighting and no glare, holding the camera steady.'
    }
  }

  return { passed: true }
}

// ---------- OCR / text extraction helpers ----------

// Detects whether a page is sideways or upside-down (a 90/180/270-degree
// misorientation — the kind you get from a phone photo taken in the wrong
// orientation, or an image whose EXIF rotation got stripped somewhere along
// the way) and rotates it upright before recognition runs.
//
// IMPORTANT LIMITATION: this only corrects cardinal, 90-degree-increment
// misorientation. It does NOT fix continuous skew — a photo taken at a
// slight or moderate tilt, like a document photographed at an angle rather
// than dead-on. True deskewing needs the actual skew angle measured off the
// text lines themselves (e.g. via a Hough-transform line-angle detector),
// which is a meaningfully bigger feature than this capstone's OCR module
// scope covers. A badly-skewed document that this step can't fix is still
// caught downstream by the empty-text safety net below instead of silently
// passing.
//
// Also unverified end-to-end in this environment (Tesseract's OSD needs
// network access to fetch its own data, which isn't available in this
// sandbox) — test it against a genuinely sideways photo after deploying.
// If the correction rotates the image the wrong way, the fix is flipping
// the sign: change `360 - degrees` below to just `degrees`.
async function correctOrientation(worker, buffer) {
  try {
    const { data } = await worker.detect(buffer)
    const degrees = data?.orientation_degrees ?? 0
    const confidence = data?.orientation_confidence ?? 0

    // Only act on a confident, cardinal reading — acting on a low-confidence
    // guess for an already-upright document would do more harm than good.
    if (confidence > 5 && [90, 180, 270].includes(degrees)) {
      return await sharp(buffer).rotate(360 - degrees).toBuffer()
    }
  } catch (e) {
    // Orientation detection is a best-effort improvement, not a required
    // step — if it fails (e.g. OSD data unavailable), fall through and OCR
    // the image as-is rather than failing the whole upload over it.
    console.error('Orientation detection failed:', e)
  }
  return buffer
}

// ---------- Deskew (continuous-angle skew correction) ----------
// correctOrientation() above only fixes 90/180/270-degree misorientation.
// This handles the far more common real-world case: a document
// photographed at a moderate tilt rather than fully sideways -- the exact
// failure mode that made a legible Voter's Certification photo OCR as
// completely empty during Sept 18 testing. Runs inside the same
// ocrImageBuffer() every image document type already goes through, so
// this benefits every type (Birth Cert, Voter's ID, Employment Cert,
// etc.), not just the one that surfaced the bug.
//
// Approach: projection-profile skew detection, a classic dependency-free
// technique (no OpenCV/native bindings needed). For a spread of candidate
// rotation angles, rotate a small binarized copy of the image and score
// how "line-like" the result is -- well-aligned text rows create sharp
// peaks/troughs in row-by-row dark-pixel counts (a text line has many
// dark pixels, the gap above/below it has few), so the angle whose
// row-darkness profile has the highest variance is the best guess at the
// document's true skew. Not perfect on sparse or non-text-heavy images,
// but a meaningful improvement over applying no correction at all for
// the common "photographed at a slight-to-moderate angle" case.
//
// Range is deliberately capped at +/-25 degrees: accidental handheld-
// photo tilt rarely exceeds this, and searching wider both costs more
// compute per upload and risks a false "improvement" that rotates an
// already-fine document further from upright.
const DESKEW_MAX_ANGLE = 25
const DESKEW_STEP = 2 // degrees -- coarse pass, tuned for handheld-photo
                       // tilt rather than hunting a precise angle

async function estimateSkewAngle(buffer) {
  // Small, fast working copy -- precision doesn't matter for the score,
  // only relative comparison between candidate angles.
  const small = await sharp(buffer)
    .resize({ width: 400, withoutEnlargement: false })
    .grayscale()
    .threshold(180) // rough binarization: text -> black (0), background -> white (255)
    .toBuffer()

  let bestAngle = 0
  let bestScore = -1

  for (let angle = -DESKEW_MAX_ANGLE; angle <= DESKEW_MAX_ANGLE; angle += DESKEW_STEP) {
    let rotated
    try {
      rotated = await sharp(small)
        .rotate(angle, { background: '#ffffff' })
        .raw()
        .toBuffer({ resolveWithObject: true })
    } catch (e) {
      continue
    }
    const { data, info } = rotated
    const { width, height, channels } = info
    const rowSums = new Array(height)
    for (let y = 0; y < height; y++) {
      let sum = 0
      const rowStart = y * width * channels
      for (let x = 0; x < width; x++) {
        if (data[rowStart + x * channels] < 128) sum++ // count dark (text) pixels
      }
      rowSums[y] = sum
    }
    const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length
    const variance = rowSums.reduce((a, b) => a + (b - mean) ** 2, 0) / rowSums.length

    if (variance > bestScore) {
      bestScore = variance
      bestAngle = angle
    }
  }

  return bestAngle
}

async function correctSkew(buffer) {
  try {
    const angle = await estimateSkewAngle(buffer)
    if (angle === 0) return buffer
    return await sharp(buffer).rotate(angle, { background: '#ffffff' }).toBuffer()
  } catch (e) {
    // Best-effort improvement, not a required step -- if scoring fails for
    // any reason, OCR the image as originally oriented rather than fail
    // the whole upload over it.
    console.error('Skew correction failed (non-blocking):', e)
    return buffer
  }
}

async function preprocessForOCR(buffer) {
  return sharp(buffer)
    .resize({ width: 2000, withoutEnlargement: false })  // upscale small/low-res photos
    .grayscale()
    .median(3)          // knocks out camera-sensor speckle/JPEG noise before
                         // contrast stretching amplifies it — cheap and only
                         // helps on real photos, doesn't hurt clean scans
    .normalize()
    .sharpen()
    .toBuffer()
    // no .threshold() — let Tesseract binarize internally, it's better at it than a flat cutoff
}

// A single photographed/scanned page can defeat Tesseract's automatic page
// segmentation in ways that are specific to that page's layout — e.g. two
// logos side by side in a header get read as one interleaved line instead of
// two separate ones. There's no single PSM that's safe for every scholarship
// document (forms, letters, IDs, certificates all lay out differently), so
// instead of guessing one, we run the two segmentation strategies that cover
// most real documents — full-page auto layout, and single uniform block —
// and keep whichever one Tesseract itself is more confident about. This is
// the single biggest lever we have on the "OCR falls apart on anything that
// isn't a clean, born-digital PDF" problem, without adding new dependencies.
async function ocrWithBestSegmentation(worker, buffer) {
  const candidates = [PSM.AUTO, PSM.SINGLE_BLOCK]
  let best = null

  for (const psm of candidates) {
    await worker.setParameters({ tessedit_pageseg_mode: psm })
    const { data } = await worker.recognize(buffer)
    if (!best || data.confidence > best.confidence) {
      best = { text: data.text, confidence: data.confidence }
    }
  }

  return best
}

// Runs Tesseract OCR on a single image buffer using an already-started worker.
async function ocrImageBuffer(worker, buffer) {
  const oriented = await correctOrientation(worker, buffer)
  const deskewed = await correctSkew(oriented)
  const cleaned = await preprocessForOCR(deskewed)
  const { text, confidence } = await ocrWithBestSegmentation(worker, cleaned)
  return { text: text.trim(), confidence }
}

// Decides how to pull text out of the uploaded file:
// - images -> straight to Tesseract OCR
// - PDFs   -> try the embedded text layer first (fast, exact); if the PDF
//             turns out to be a scan with no real text layer, rasterize each
//             page to an image and OCR those instead.
async function extractText(buffer, mimeType) {
  if (mimeType.startsWith('image/')) {
    const worker = await createWorker('eng')
    try {
      const { text, confidence } = await ocrImageBuffer(worker, buffer)
      return { text, method: 'ocr-image', confidence }
    } finally {
      await worker.terminate()
    }
  }

  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      // Strip pdf-parse's own "-- N of M --" page-separator boilerplate
      // before deciding whether this PDF actually has a text layer — see
      // the comment on PDF_PAGE_SEPARATOR above for why this matters.
      const digitalText = stripPdfPageSeparators((result.text || '').trim())

      if (digitalText.length >= MIN_DIGITAL_TEXT_LENGTH) {
        // Born-digital text layer — exact, no OCR involved, so confidence
        // is a non-issue (treated as maximum).
        return { text: digitalText, method: 'pdf-embedded-text', confidence: 100 }
      }

      // No usable text layer found — treat as a scanned PDF and OCR each page.
      const screenshot = await parser.getScreenshot({ scale: 2 })
      const worker = await createWorker('eng')
      try {
        let ocrText = ''
        let confidenceSum = 0
        for (const page of screenshot.pages) {
          const result = await ocrImageBuffer(worker, page.data)
          ocrText += result.text + '\n'
          confidenceSum += result.confidence
        }
        return {
          text: ocrText.trim(),
          method: 'ocr-scanned-pdf',
          confidence: confidenceSum / screenshot.pages.length
        }
      } finally {
        await worker.terminate()
      }
    } finally {
      await parser.destroy()
    }
  }

  return { text: '', method: 'unsupported', confidence: 0 }
}

// VALID_DOCUMENT_TYPES moved to app/lib/documentTypes.js (Sept 16 Patch 2
// port) — was its own fourth copy of this list, values-only. See that
// file's header comment for what changed.

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    // Placeholder applicant identity, filled in on the form itself — see
    // add_applicant_and_doctype_columns.sql for why this isn't a real
    // applicant_id foreign key yet (no accounts/login module exists).
    const applicantName = formData.get('applicantName')?.toString().trim() || null
    const applicantEmail = formData.get('applicantEmail')?.toString().trim() || null
    const documentType = formData.get('documentType')?.toString().trim() || null

    if (documentType && !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json(
        { error: `Unknown document type. Must be one of: ${VALID_DOCUMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Server-side validation: never trust the client's file picker alone
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, JPG, or PNG.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file into a Buffer for processing
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Image-quality precheck — images only (see checkImageQuality above for
    // why PDFs are excluded). Runs before hashing/storage/OCR: an obviously
    // unusable photo is rejected outright rather than stored as a flagged
    // record, so the applicant fixes it at the point of capture instead of
    // it becoming something an admin has to triage later.
    if (file.type.startsWith('image/')) {
      const quality = await checkImageQuality(buffer, documentType)
      if (!quality.passed) {
        return NextResponse.json(
          { success: false, rejected: true, reason: quality.reason, message: quality.message },
          { status: 422 }
        )
      }
    }

    // Generate SHA-256 hash for document integrity verification
    const hashSum = crypto.createHash('sha256')
    hashSum.update(buffer)
    const fileHash = hashSum.digest('hex')

    // Run text detection/OCR before upload so extraction failures don't
    // corrupt a half-finished storage/DB write. A failure here still lets
    // the document upload succeed — it just comes back with empty text.
    //
    // Skipped entirely for 'profilepic': a face photo is never meant to
    // have OCR-readable text (same reasoning as the Sept 17 exemption in
    // checkImageQuality above, which only covered the pre-upload contrast
    // check, not this post-upload safety net) — running OCR on it just
    // returns near-zero confidence/text every time, which the logic below
    // would then flag as "needs review" on every single profile picture,
    // real or not. Leaving extractionMethod at its 'none' default here
    // means needsReview naturally comes out false for this type, the same
    // way it already does for a genuine extraction failure.
    let extractedText = ''
    let extractionMethod = 'none'
    let extractionConfidence = 0
    if (documentType !== 'profilepic') {
      try {
        const result = await extractText(buffer, file.type)
        extractedText = result.text
        extractionMethod = result.method
        extractionConfidence = result.confidence
      } catch (ocrError) {
        console.error('Text extraction failed:', ocrError)
      }
    }

    // OCR reporting high confidence about almost no text is a meaningless
    // (and misleading) combination — see MIN_OCR_TEXT_LENGTH above. Catch it
    // before deciding needsReview, and zero the displayed confidence out so
    // an admin never sees a contradictory "95% confident / no text detected"
    // result.
    const ocrFoundNothing = extractionMethod !== 'pdf-embedded-text'
      && extractionMethod !== 'none'
      && extractedText.trim().length < MIN_OCR_TEXT_LENGTH

    if (ocrFoundNothing) {
      extractionConfidence = 0
    }

    const needsReview = extractionMethod !== 'pdf-embedded-text'
      && extractionMethod !== 'none'
      && (ocrFoundNothing || extractionConfidence < LOW_CONFIDENCE_THRESHOLD)

    // Define unique file name for the storage bucket
    const safeName = file.name
    .normalize('NFKD')                 // splits accented chars from their marks
    .replace(/[\u0300-\u036f]/g, '')   // strips the accent marks
    .replace(/[^\w.\-]+/g, '_')        // anything not a letter/number/./- becomes _
    .replace(/_+/g, '_')               // collapse repeated underscores
    const fileName = `${Date.now()}-${safeName}`

    // Upload directly to your Supabase bucket using the service role client
    const { data, error } = await supabase.storage
      .from('scholarship-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Save the file path, SHA-256 hash, and extracted text to your PostgreSQL table
    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        { 
          file_path: data.path, 
          sha256_hash: fileHash,
          extracted_text: extractedText,
          ocr_confidence: extractionConfidence,
          needs_review: needsReview,
          review_status: needsReview ? 'flagged' : 'verified',
          applicant_name: applicantName,
          applicant_email: applicantEmail,
          document_type: documentType
        }
      ])

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

        // Auto-Fill Text Extraction — runs only for document types we've scoped
    // OCR-based field extraction for so far (PSA, Form 138).
    try {
      const { extractPSAFields, extractGradesFields } = require('@/app/lib/textExtraction')
      let extraction = null

      if (AUTOFILL_SCOPED_TYPES.includes(documentType)) {
        if (documentType === 'birthcert') {
          extraction = extractPSAFields(extractedText)
        } else if (documentType === 'form138') {
          extraction = extractGradesFields(extractedText)
        }
      }

      if (extraction) {
        for (const [fieldName, value] of Object.entries(extraction.fields)) {
          await supabase.from('extracted_fields').upsert({
            file_path: data.path,
            document_type: documentType,
            field_name: fieldName,
            extracted_value: value,
            needs_review: extraction.needsReview,
          })
        }
      }
    } catch (extractionErr) {
      // Same pattern as the audit log below — never block the upload response.
      console.error('Auto-fill extraction failed (non-blocking):', extractionErr)
    }

    // Global Audit Log entry — best-effort, never blocks the response the
    // applicant is waiting on. Every upload becomes a timeline entry,
    // matching the "Recent Activity Log" from the approved admin mockup.
    try {
      await supabase.from('audit_log').insert([
        {
          actor: 'System',
          action: needsReview
            ? `Document flagged for review — ${applicantName} \u00b7 ${documentType} (${Math.round(extractionConfidence)}% confidence)`
            : `Document auto-verified — ${applicantName} \u00b7 ${documentType} (${Math.round(extractionConfidence)}% confidence)`,
          kind: needsReview ? 'warn' : 'done',
        },
      ])
    } catch (auditErr) {
      // Logging failure should never break the actual upload flow.
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }
 

    // Generate a secure signed URL valid for 1 hour (3600 seconds)
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from('scholarship-documents')
      .createSignedUrl(fileName, 3600)

    if (signError) {
      return NextResponse.json({ error: signError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      filePath: data.path,
      publicUrl: signedUrlData.signedUrl, 
      sha256Hash: fileHash,
      extractedText,
      extractionMethod,
      extractionConfidence,
      needsReview,
      applicantName,
      applicantEmail,
      documentType
    })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    // 1. Fetch all records from your documents table
    const { data: docs, error: dbError } = await supabase
      .from('documents')
      .select('*') // grabs id, file_path, sha256_hash, and extracted_text

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 2. Loop through the records and generate fresh signed URLs for each
    const docsWithUrls = await Promise.all(docs.map(async (doc) => {
      const { data } = await supabase.storage
        .from('scholarship-documents')
        .createSignedUrl(doc.file_path, 3600)

      return {
        ...doc,
        publicUrl: data?.signedUrl
      }
    }))

    return NextResponse.json({ success: true, documents: docsWithUrls })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}