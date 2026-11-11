// Raises this route's limit to 60s, the max Vercel Hobby allows. Uploads
// return right away, but the after() step below waits up to 55s for the
// OCR worker on Render to wake, and that runs within this same limit.
export const maxDuration = 60

import { archivedUserIds, isApplicantArchived, ARCHIVED_MESSAGE } from '@/app/lib/archive'
import { NextResponse, after } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'
import { VALID_DOCUMENT_TYPES, AUTOFILL_SCOPED_TYPES } from '@/app/lib/documentTypes'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { screeningResult, STAGE2_DOC_TYPES, SCREENING_STAGE2_MESSAGE } from '@/app/lib/screening'
import { wakeOcrWorker } from '@/app/lib/ocrWorker'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { getSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'
import { MINUTE, limitRequest } from '@/app/lib/rateLimit'
import { checkDocumentContent, CONTENT_CHECKED_TYPES, CONTENT_CHECK_FIELD, CONTENT_CHECK_START } from '@/app/lib/documentContentCheck'
import { isSignupCheckPath } from '@/app/lib/signupResidencyCheck'
import { refreshEligibilityForUser, ELIGIBILITY_DOC_TYPES } from '@/app/lib/eligibilityRefresh'
import { MAX_FILE_SIZE, ALLOWED_TYPES, CANONICAL_TYPE, detectFileType, RISKY_PDF_PARTS, safeStorageName, checkImageQuality } from '@/app/lib/uploadChecks'

// Oct 2026: the file checks below moved to app/lib/uploadChecks.js so the
// sign-up residency check (app/api/signup-residency-check) uses the same ones.

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

    // Nov 2026 (panel revisions, priority 4 / S4): Stage 2 documents
    // (birth certificate, profile picture, income/employment, medical, ...)
    // are only accepted after the eligibility screening is passed
    // (app/lib/screening.js).
    if (STAGE2_DOC_TYPES.includes(documentType)) {
      const { data: screenRow } = await supabase
        .from('applications')
        .select('*')
        .eq('applicant_user_id', applicantUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: screenDocs } = await supabase
        .from('documents')
        .select('document_type, created_at, needs_review, review_status, staff_confirmed_at')
        .eq('applicant_user_id', applicantUserId)
      if (!screeningResult(screenRow || {}, screenDocs || []).stage2Open) {
        return NextResponse.json({ error: SCREENING_STAGE2_MESSAGE, screening: true }, { status: 403 })
      }
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
    // Nov 2026: a sign-up residency check that never became an account (still
    // being read, or abandoned) isn't anyone's document yet, so it isn't listed.
    listDocs = listDocs.filter((doc) => doc.applicant_user_id || !isSignupCheckPath(doc.file_path))
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