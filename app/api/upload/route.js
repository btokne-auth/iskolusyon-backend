// Raises this route's limit to 60s, the max Vercel Hobby allows. Uploads
// return right away, but the after() step below waits up to 55s for the
// OCR worker on Render to wake, and that runs within this same limit.
export const maxDuration = 60

import sharp from 'sharp'
import { NextResponse, after } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'
import { VALID_DOCUMENT_TYPES, AUTOFILL_SCOPED_TYPES } from '@/app/lib/documentTypes'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { getSystemSettings } from '@/app/lib/systemSettings'

// ---------- Validation limits ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

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

    const formData = await request.formData()
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

    // Define unique file name for the storage bucket
    const safeName = file.name
    .normalize('NFKD')                 // splits accented chars from their marks
    .replace(/[̀-ͯ]/g, '')   // strips the accent marks
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
      return NextResponse.json({ error: dbError.message }, { status: 500 })
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
      return NextResponse.json({ error: signError.message }, { status: 500 })
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
      after(async () => {
        const workerUrl = process.env.OCR_WORKER_URL
        const workerSecret = process.env.OCR_WORKER_SECRET
        if (!workerUrl || !workerSecret) {
          console.error('OCR worker not configured (OCR_WORKER_URL / OCR_WORKER_SECRET missing); document left in processing:', data.path)
          return
        }
        try {
          const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/wake`, {
            method: 'POST',
            headers: { 'x-ocr-worker-secret': workerSecret },
            // A sleeping free Render instance can take about a minute to
            // wake; give up just before this route's own 60s limit. The
            // worker still processes the row once it's up.
            signal: AbortSignal.timeout(55000),
          })
          if (!res.ok) {
            console.error(`OCR worker wake-up returned ${res.status}; document left in processing:`, data.path)
          }
        } catch (wakeErr) {
          console.error('OCR worker wake-up failed (worker will catch up on next wake):', wakeErr.message)
        }
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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
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
      const ownName = ownApplication?.applicant_name?.trim().replace(/"/g, '')
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