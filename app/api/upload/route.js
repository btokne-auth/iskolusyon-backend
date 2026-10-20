// Raises this route's limit to 60s, the max Vercel Hobby allows. Uploads
// return right away, but the after() step below waits up to 55s for the
// OCR worker on Render to wake, and that runs within this same limit.
export const maxDuration = 60

import sharp from 'sharp'
import { archivedUserIds, isApplicantArchived, ARCHIVED_MESSAGE } from '@/app/lib/archive'
import { NextResponse, after } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'
import { VALID_DOCUMENT_TYPES, AUTOFILL_SCOPED_TYPES } from '@/app/lib/documentTypes'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { wakeOcrWorker } from '@/app/lib/ocrWorker'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { getSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'
import { MINUTE, limitRequest } from '@/app/lib/rateLimit'
import { checkDocumentContent, CONTENT_CHECKED_TYPES, CONTENT_CHECK_FIELD, CONTENT_CHECK_START } from '@/app/lib/documentContentCheck'
import { refreshEligibilityForUser, ELIGIBILITY_DOC_TYPES } from '@/app/lib/eligibilityRefresh'

// ---------- Validation limits ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// ---------- File content check (Oct 7 2026) ----------
// Manuscript Ch. 3, File Upload Security Testing: "validates file type, file
// size, and file content ... rejection of disguised executable files ... and
// path traversal through manipulated filenames".
// Before this, the type check trusted the type the BROWSER claimed, so a
// program renamed to "birthcert.png" (and sent as image/png) passed. Now the
// first bytes of the file itself must be a real PDF, PNG or JPEG, and must
// match the claimed type. PDFs that carry scripts, launch actions or hidden
// attached files are refused too (a scanned document never needs those).
const CANONICAL_TYPE = { 'image/jpg': 'image/jpeg' }
const EXTENSION_FOR = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }

function detectFileType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  return null
}

const RISKY_PDF_PARTS = /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/

// Keeps only letters, numbers, dot, dash and underscore, drops any folder
// parts ("../../x" can't climb out of the bucket), shortens long names and
// always ends with the extension of the REAL file type ("cv.pdf.exe" that is
// really a PDF is saved as "cv.pdf_exe.pdf").
function safeStorageName(originalName, realType) {
  const base = String(originalName || 'document')
    .split(/[\\/]/)
    .pop()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/\.+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-]+|[_\-]+$/g, '')
    .slice(0, 60) || 'document'
  return `${base}.${EXTENSION_FOR[realType]}`
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
// a single tunable constant, not a scattered
// magic number, meant to be revisited against a larger sample set.
const MIN_CONTRAST_STDEV = 10

// Oct 21 2026 (panel, Oct 20 defense): the profile picture must be a
// 1x1-style ID photo on a plain white background. Two checks:
//   - shape: a real 2x2 photo, which is square. Width and height must be
//     equal (2% leeway for a slightly uneven crop) and at least 600px,
//     which is 2 inches at the standard 300 dpi print/scan resolution;
//   - background: the top, left and right edges (where the background
//     shows around the head) must be mostly white or very light grey.
// Thresholds are constants so they can be tuned after more tests.
const PROFILE_MIN_RATIO = 0.98
const PROFILE_MAX_RATIO = 1.02
const PROFILE_MIN_PIXELS = 600 // 2 inches x 300 dpi
const WHITE_MIN_BRIGHTNESS = 200 // 0-255, each channel's average
const WHITE_MAX_SATURATION = 40 // max(r,g,b) - min(r,g,b)
const WHITE_MIN_SHARE = 0.6 // 60% of the edge pixels

async function checkProfilePhoto(buffer, width, height) {
  const ratio = width / height
  if (ratio < PROFILE_MIN_RATIO || ratio > PROFILE_MAX_RATIO) {
    return {
      passed: false,
      reason: 'not_square',
      message: `Your photo is ${width}×${height}px, which is not square. Please upload a 2x2 ID photo (same width and height, e.g. 600×600px), not a stretched, wide or tall picture.`
    }
  }
  if (width < PROFILE_MIN_PIXELS || height < PROFILE_MIN_PIXELS) {
    return {
      passed: false,
      reason: 'too_small_for_2x2',
      message: `Your photo is only ${width}×${height}px. A 2x2 ID photo needs at least ${PROFILE_MIN_PIXELS}×${PROFILE_MIN_PIXELS}px (2 inches at 300 dpi). Please upload a clearer scan or the original file from the photo studio.`
    }
  }

  // Shrink to 100x100 first: fast, and enough to judge the background.
  const size = 100
  const { data } = await sharp(buffer).rotate().resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const band = 12 // edge band, in pixels of the 100x100 copy
  let total = 0
  let white = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTop = y < band
      const inSide = (x < band || x >= size - band) && y < size * 0.6
      if (!inTop && !inSide) continue
      const i = (y * size + x) * 3
      const r = data[i], g = data[i + 1], b = data[i + 2]
      total++
      if (Math.min(r, g, b) >= WHITE_MIN_BRIGHTNESS && Math.max(r, g, b) - Math.min(r, g, b) <= WHITE_MAX_SATURATION) white++
    }
  }
  if (total === 0 || white / total < WHITE_MIN_SHARE) {
    return {
      passed: false,
      reason: 'not_white_background',
      message: 'The background of your photo does not look plain white. Please upload an ID photo taken against a plain white wall or background, with no frames, borders or other objects behind you.'
    }
  }

  return { passed: true }
}

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
    return checkProfilePhoto(buffer, width, height)
  }

  const stats = await sharp(buffer).grayscale().stats()
  const stdev = stats.channels[0]?.stdev ?? 0

  if (stdev < MIN_CONTRAST_STDEV) {
    return {
      passed: false,
      reason: 'low_contrast',
      message: 'This photo appears blank, extremely blurry, or washed out by glare, so no readable detail could be detected. Please retake it on a flat surface, with even lighting and no glare, holding the camera steady.'
    }
  }

  return { passed: true }
}

// Oct 1 2026: the OCR helpers that used to live here (orientation fix,
// deskew, Tesseract and pdf-parse text extraction) were removed. Reading
// documents now happens in the separate iskolusyon-ocr-worker on Render
// (see the after() step in POST below).

// VALID_DOCUMENT_TYPES moved to app/lib/documentTypes.js (Sept 16 Patch 2
// port) — was its own fourth copy of this list, values-only. See that
// file's header comment for what changed.

export async function POST(request) {
  try {
    // Sept 22 2026: Application Cycle Settings gate. This route is
    // applicant-facing upload only (the admin console's document actions
    // go through different routes), so this blocks every call here when
    // Document Uploads Enabled is off, no action-type check needed.
    try {
      const settings = await getSystemSettings()
      if (!settings.document_uploads_enabled) {
        return NextResponse.json(
          { error: 'Document uploads are currently disabled. Please check back later.' },
          { status: 403 }
        )
      }
    } catch (settingsErr) {
      console.error('Failed to read system settings (allowing upload):', settingsErr)
    }

    // Oct 7 2026: refuse an oversized upload before reading it (an 11MB
    // request used to end in a server error instead of a clear message).
    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (declaredLength > MAX_FILE_SIZE + 512 * 1024) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 10MB.' }, { status: 413 })
    }
    let formData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'The upload could not be read. The file may be too large or damaged.' }, { status: 400 })
    }
    const file = formData.get('file')

    // applicant_name/applicant_email stay as the display/fallback identity
    // (still what the form actually collects, and still needed to match
    // pre-login-module rows). applicantUserId is the real link now that
    // the User Account Module exists — resolved from the session cookie,
    // not trusted from the form body, so it can't be spoofed to attach an
    // upload to someone else's account.
    let applicantName = formData.get('applicantName')?.toString().trim() || null
    let applicantEmail = formData.get('applicantEmail')?.toString().trim() || null
    const documentType = formData.get('documentType')?.toString().trim() || null

    const applicantCookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const applicantSession = await verifyApplicantCookieValue(applicantCookie)
    // Sept 30 2026: uploads used to be accepted from anyone, signed in or
    // not, filed under whatever name/email the form sent. Only the signed-in
    // applicant can upload now, always under their own account and email,
    // and under their own application's name when they already have one.
    if (!applicantSession) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    const applicantUserId = applicantSession.id
    applicantEmail = applicantSession.email
    // Oct 7 2026: at most 30 uploads per applicant in 10 minutes.
    const limited = await limitRequest(`upload:user:${applicantUserId}`, 30, 10 * MINUTE,
      'You uploaded many files in a short time. Please wait a few minutes and try again.')
    if (limited) return limited
    // Oct 5 2026: an archived application is read-only.
    if (await isApplicantArchived(applicantUserId)) {
      return NextResponse.json({ error: ARCHIVED_MESSAGE, archived: true }, { status: 403 })
    }
    const { data: ownApplicationRow } = await supabase
      .from('applications')
      .select('applicant_name')
      .eq('applicant_user_id', applicantSession.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ownApplicationRow?.applicant_name) applicantName = ownApplicationRow.applicant_name.trim()

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

    // Oct 7 2026: check the real size and the real content, not just what
    // the browser says.
    if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File is empty or larger than 10MB.' }, { status: 400 })
    }
    const claimedType = CANONICAL_TYPE[file.type] || file.type
    const realType = detectFileType(buffer)
    if (!realType || realType !== claimedType) {
      try {
        await supabase.from('audit_log').insert([{
          actor: applicantName || applicantEmail || 'Applicant',
          action: `Upload refused: file content is not a real ${claimedType === 'application/pdf' ? 'PDF' : 'JPG/PNG'} (${documentType || 'document'})`,
          kind: 'warn',
          category: 'Documents',
        }])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json(
        { error: 'This file is not a real PDF, JPG or PNG (its contents do not match its type). Please upload the original scan or photo.' },
        { status: 400 }
      )
    }
    if (realType === 'application/pdf' && RISKY_PDF_PARTS.test(buffer.toString('latin1'))) {
      return NextResponse.json(
        { error: 'This PDF contains scripts or attached files, which are not allowed. Please upload a plain scanned PDF or a photo.' },
        { status: 400 }
      )
    }

    // Image-quality precheck — images only (see checkImageQuality above for
    // why PDFs are excluded). Runs before hashing/storage/OCR: an obviously
    // unusable photo is rejected outright rather than stored as a flagged
    // record, so the applicant fixes it at the point of capture instead of
    // it becoming something an admin has to triage later.
    if (documentType === 'profilepic' && !realType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, rejected: true, reason: 'not_image', message: 'Please upload your profile picture as a JPG or PNG photo, not a PDF.' },
        { status: 422 }
      )
    }
    if (realType.startsWith('image/')) {
      let quality
      try {
        quality = await checkImageQuality(buffer, documentType)
      } catch {
        return NextResponse.json({ error: 'This image could not be opened. It may be damaged. Please upload it again.' }, { status: 400 })
      }
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

    // Define unique file name for the storage bucket (Oct 7 2026: see
    // safeStorageName above).
    const safeName = safeStorageName(file.name, realType)
    const fileName = `${Date.now()}-${safeName}`

    // Upload directly to your Supabase bucket using the service role client
    const { data, error } = await supabase.storage
      .from('scholarship-documents')
      .upload(fileName, buffer, {
        contentType: realType,
        upsert: false
      })

    if (error) {
      return serverError(error, 'api/upload')
    }

    // Sept 25, 2026: OCR (orientation + deskew + Tesseract) is what was
    // pushing this route past Vercel's 60s Hobby-plan FUNCTION_INVOCATION_TIMEOUT
    // -- a single phone photo can legitimately take longer than that to
    // recognize, no matter how much the OCR pipeline itself gets trimmed.
    // So the document row is saved with placeholder OCR fields right away,
    // the applicant gets a success response immediately below, and OCR
    // actually runs AFTER that response is sent (via after(), further
    // down) -- it updates this same row once it finishes, however long
    // that takes. The applicant never sees a timeout again. profilepic
    // never ran OCR in the first place, so it's saved as already verified.
    const isProfilePic = documentType === 'profilepic'

    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          file_path: data.path,
          sha256_hash: fileHash,
          extracted_text: '',
          ocr_confidence: 0,
          needs_review: false,
          review_status: isProfilePic ? 'verified' : 'processing',
          applicant_name: applicantName,
          applicant_email: applicantEmail,
          applicant_user_id: applicantUserId,
          document_type: documentType
        }
      ])

    if (dbError) {
      return serverError(dbError, 'api/upload')
    }

    // profilepic has nothing async left to do, so its audit-log entry can
    // happen right away, same as before.
    if (isProfilePic) {
      try {
        await supabase.from('audit_log').insert([
          {
            actor: 'System',
            action: `Document auto-verified: ${applicantName} · ${documentType}`,
            kind: 'done',
            category: 'Documents',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
    }

    // Generate a secure signed URL valid for 1 hour (3600 seconds)
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from('scholarship-documents')
      .createSignedUrl(fileName, 3600)

    if (signError) {
      return serverError(signError, 'api/upload')
    }

    // Sept 2026: OCR no longer runs on Vercel. It kept hitting the 60s Hobby
    // ceiling, and the native Tesseract/WASM files don't survive Vercel's
    // serverless bundling reliably (see the unmerged ocr-perf-fix branch).
    // It now runs in a separate always-on service, iskolusyon-ocr-worker
    // (Render). This route saves the row as 'processing' (above), then just
    // tells the worker there's work. The worker finds every 'processing' row
    // in Supabase and writes the same results this block used to write:
    // documents, extracted_fields and audit_log.
    //
    // Nothing waits on OCR. If the wake-up fails (worker asleep for too
    // long, misconfigured, down), the row stays 'processing' and the worker
    // picks it up the next time it wakes, since it also sweeps on startup.
    if (!isProfilePic) {
      // Oct 6 2026: wakeOcrWorker (app/lib/ocrWorker.js) also sends a GET
      // when the POST isn't answered, since a sleeping free Render service
      // only wakes for a GET now.
      after(async () => {
        await wakeOcrWorker(`(upload ${data.path})`)
      })
    }

    return NextResponse.json({
      success: true,
      filePath: data.path,
      publicUrl: signedUrlData.signedUrl,
      sha256Hash: fileHash,
      extractedText: '',
      extractionMethod: isProfilePic ? 'none' : 'pending',
      extractionConfidence: 0,
      needsReview: false,
      reviewStatus: isProfilePic ? 'verified' : 'processing',
      applicantName,
      applicantEmail,
      documentType
    })

  } catch (err) {
    return serverError(err, 'api/upload')
  }
}

// Oct 21 2026: stricter auto-verify (see app/lib/documentContentCheck.js).
// Runs once per document, the first time the list is loaded after the OCR
// worker marked it verified. A document whose words don't match its type,
// or that lacks the applicant's last name, is moved to "flagged" with the
// reason saved, so an admin checks it. Errors here never break the list.
async function applyContentChecks(docs) {
  const candidates = docs.filter((d) =>
    d.review_status === 'verified' &&
    !d.needs_review &&
    CONTENT_CHECKED_TYPES.includes(d.document_type) &&
    d.created_at && new Date(d.created_at) >= new Date(CONTENT_CHECK_START)
  )
  const reasons = new Map()
  const paths = docs.filter((d) => CONTENT_CHECKED_TYPES.includes(d.document_type)).map((d) => d.file_path)
  if (paths.length === 0) return reasons

  const { data: markers, error } = await supabase
    .from('extracted_fields')
    .select('file_path, extracted_value')
    .eq('field_name', CONTENT_CHECK_FIELD)
    .in('file_path', paths)
  if (error) throw new Error(error.message)
  const checked = new Set()
  for (const m of markers || []) {
    checked.add(m.file_path)
    const value = String(m.extracted_value || '')
    if (value.startsWith('flagged: ')) reasons.set(m.file_path, value.slice('flagged: '.length))
  }

  const refreshAfter = new Set()
  for (const doc of candidates) {
    if (checked.has(doc.file_path)) continue
    const result = checkDocumentContent({
      documentType: doc.document_type,
      extractedText: doc.extracted_text,
      applicantName: doc.applicant_name,
    })
    const { error: markError } = await supabase.from('extracted_fields').insert({
      file_path: doc.file_path,
      document_type: doc.document_type,
      field_name: CONTENT_CHECK_FIELD,
      extracted_value: result.passed ? 'passed' : `flagged: ${result.reason}`,
      needs_review: !result.passed,
    })
    if (markError) { console.error('Content check marker failed:', markError.message); continue }
    // Oct 21 2026: a Voter's ID that just finished (verified or flagged)
    // updates the applicant's saved eligibility right away.
    if (ELIGIBILITY_DOC_TYPES.includes(doc.document_type)) refreshAfter.add(doc.applicant_user_id)
    if (result.passed) continue

    const { error: flagError } = await supabase
      .from('documents')
      .update({ needs_review: true, review_status: 'flagged' })
      .eq('file_path', doc.file_path)
    if (flagError) { console.error('Content check flag failed:', flagError.message); continue }
    doc.needs_review = true
    doc.review_status = 'flagged'
    reasons.set(doc.file_path, result.reason)
    try {
      await supabase.from('audit_log').insert([{
        actor: 'System',
        action: `Document auto-flagged by content check: ${doc.applicant_name || 'Unknown applicant'} \u00b7 ${doc.document_type} (${result.reason})`,
        kind: 'warn',
        category: 'Documents',
      }])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }
  }
  for (const userId of refreshAfter) await refreshEligibilityForUser(userId)
  return reasons
}

export async function GET(request) {
  try {
    // Three callers share this route: the admin document-review page
    // (needs every applicant's documents), the applicant portal (should
    // only ever see its own), and app/history/page.js (a pre-login
    // stand-in — still unscoped, see that file's own header comment; not
    // touched here since it's a separate open question, not part of this
    // re-key).
    //
    // Only scope down to one applicant when there's a valid applicant
    // session AND no admin session — an admin browsing with both cookies
    // present (e.g. testing in the same browser) still gets the full list,
    // matching how the admin page has always behaved.
    const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(adminCookie)
    const applicantCookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const applicantSession = adminName ? null : await verifyApplicantCookieValue(applicantCookie)

    // Sept 29 security fix: with neither session, this used to fall
    // through with an unfiltered query and hand back every applicant's
    // documents (extracted text + fresh signed download URLs) to anyone.
    // All three callers above always have a session, so refusing here
    // only blocks logged-out requests.
    if (!adminName && !applicantSession) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    let query = supabase.from('documents').select('*')

    if (applicantSession) {
      // Legacy rows (uploaded before this account existed, or before this
      // re-key) have no applicant_user_id — fall back to matching this
      // applicant's own name from their applications row so a returning
      // applicant doesn't lose visibility into documents they already
      // uploaded. New uploads always carry applicant_user_id going
      // forward (see the POST handler above).
      const { data: ownApplication } = await supabase
        .from('applications')
        .select('applicant_name')
        .eq('applicant_user_id', applicantSession.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Sept 30 2026: the name fallback only picks up older rows that were
      // never linked to any account, so a different applicant who happens
      // to share the name never shows up here.
      // Oct 7 2026: also drops % _ * and backslash, which ilike would treat
      // as wildcards (a name like "%" would otherwise match every old row).
      const ownName = ownApplication?.applicant_name?.trim().replace(/["\\%_*]/g, '')
      query = ownName
        ? query.or(`applicant_user_id.eq.${applicantSession.id},and(applicant_user_id.is.null,applicant_name.ilike."${ownName}")`)
        : query.eq('applicant_user_id', applicantSession.id)
    }

    // Newest first — matters now that a document type (profilepic
    // especially) can have more than one row for the same applicant after
    // a re-upload/replace; consumers that want "the current one" (e.g. the
    // Live Name Sync / sidebar avatar preview) rely on this order to pick
    // the first match instead of an arbitrary or stale one.
    const { data: docs, error: dbError } = await query.order('created_at', { ascending: false })

    if (dbError) {
      return serverError(dbError, 'api/upload')
    }

    // Oct 5 2026: in the admin console, archived applicants' documents are
    // left out (the applicant still sees their own).
    let listDocs = docs || []
    if (adminName) {
      const archivedUsers = await archivedUserIds()
      if (archivedUsers.size > 0) listDocs = listDocs.filter((doc) => !doc.applicant_user_id || !archivedUsers.has(doc.applicant_user_id))
    }

    let contentIssues = new Map()
    try {
      contentIssues = await applyContentChecks(listDocs)
    } catch (checkErr) {
      console.error('Content check skipped (non-blocking):', checkErr)
    }

    // 2. Loop through the records and generate fresh signed URLs for each
    const docsWithUrls = await Promise.all(listDocs.map(async (doc) => {
      const { data } = await supabase.storage
        .from('scholarship-documents')
        .createSignedUrl(doc.file_path, 3600)

      return {
        ...doc,
        content_issue: doc.needs_review ? contentIssues.get(doc.file_path) || null : null,
        publicUrl: data?.signedUrl
      }
    }))

    return NextResponse.json({ success: true, documents: docsWithUrls })
  } catch (err) {
    return serverError(err, 'api/upload')
  }
}