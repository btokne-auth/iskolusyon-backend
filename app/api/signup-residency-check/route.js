// The OCR worker is woken in after(), which can wait up to ~55s for a
// sleeping Render instance, the same as app/api/upload.
export const maxDuration = 60

import crypto from 'crypto'
import { NextResponse, after } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { wakeOcrWorker } from '@/app/lib/ocrWorker'
import { getSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'
import { MINUTE, getClientIp, limitRequest } from '@/app/lib/rateLimit'
import {
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  CANONICAL_TYPE,
  detectFileType,
  RISKY_PDF_PARTS,
  safeStorageName,
  checkImageQuality,
} from '@/app/lib/uploadChecks'
import {
  newCheckToken,
  isValidTokenShape,
  checkFolder,
  getCheckStatus,
  cleanUpOldChecks,
  discardCheck,
} from '@/app/lib/signupResidencyCheck'
import { signupScreening } from '@/app/lib/screening'

// Nov 2026 (panel revisions S3/S4): the residency check at the very start of
// sign-up, before any account exists. See app/lib/signupResidencyCheck.js.
//
// POST (multipart: file, token?) -> { token }   upload a Voter's ID to check
// GET  ?token=...                -> { status, reason?, prefill? }

export async function POST(request) {
  try {
    try {
      const settings = await getSystemSettings()
      if (!settings.applications_open) {
        return NextResponse.json({ error: 'Applications are currently closed. Please check back later.' }, { status: 403 })
      }
      if (!settings.document_uploads_enabled) {
        return NextResponse.json({ error: 'Document uploads are currently disabled. Please check back later.' }, { status: 403 })
      }
    } catch (settingsErr) {
      console.error('Failed to read system settings (allowing check):', settingsErr)
    }

    const limited = await limitRequest(`signup-residency:ip:${getClientIp(request)}`, 15, 60 * MINUTE,
      'Too many residency checks from this network. Please try again later.')
    if (limited) return limited

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
    const sentToken = formData.get('token')?.toString() || ''
    const token = isValidTokenShape(sentToken) ? sentToken : newCheckToken()

    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF, JPG, or PNG.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File is empty or larger than 10MB.' }, { status: 400 })
    }
    const claimedType = CANONICAL_TYPE[file.type] || file.type
    const realType = detectFileType(buffer)
    if (!realType || realType !== claimedType) {
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
    if (realType.startsWith('image/')) {
      let quality
      try {
        quality = await checkImageQuality(buffer, 'voterid')
      } catch {
        return NextResponse.json({ error: 'This image could not be opened. It may be damaged. Please upload it again.' }, { status: 400 })
      }
      if (!quality.passed) {
        return NextResponse.json({ success: false, rejected: true, reason: quality.reason, message: quality.message }, { status: 422 })
      }
    }

    // Only the newest upload for a token counts; earlier ones are removed.
    const folder = checkFolder(token)
    const { data: earlier } = await supabase.from('documents').select('file_path').like('file_path', `${folder}%`).is('applicant_user_id', null)
    for (const doc of earlier || []) {
      await supabase.from('extracted_fields').delete().eq('file_path', doc.file_path)
      await supabase.from('documents').delete().eq('file_path', doc.file_path)
      await supabase.storage.from('scholarship-documents').remove([doc.file_path])
    }

    const filePath = `${folder}${Date.now()}-${safeStorageName(file.name, realType)}`
    const { error: storageError } = await supabase.storage
      .from('scholarship-documents')
      .upload(filePath, buffer, { contentType: realType, upsert: false })
    if (storageError) return serverError(storageError, 'api/signup-residency-check')

    const { error: dbError } = await supabase.from('documents').insert([{
      file_path: filePath,
      sha256_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      extracted_text: '',
      ocr_confidence: 0,
      needs_review: false,
      review_status: 'processing',
      applicant_name: null,
      applicant_email: null,
      applicant_user_id: null,
      document_type: 'voterid',
    }])
    if (dbError) {
      await supabase.storage.from('scholarship-documents').remove([filePath])
      return serverError(dbError, 'api/signup-residency-check')
    }

    after(async () => {
      await wakeOcrWorker('(sign-up residency check)')
      await cleanUpOldChecks()
    })

    return NextResponse.json({ success: true, token })
  } catch (err) {
    return serverError(err, 'api/signup-residency-check')
  }
}

// DELETE { token, screening } -> the academic screening at sign-up was not
// passed; the checked Voter's ID is deleted now instead of after 24 hours.
// The answers are re-checked here so a passing applicant's file can't be
// deleted by mistake.
export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '')
    if (!isValidTokenShape(token)) return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 })
    const result = signupScreening(body.screening || {})
    if (!result.complete || result.passed) return NextResponse.json({ success: true, kept: true })
    await discardCheck(token, result.reasons.join(' '))
    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/signup-residency-check')
  }
}

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token') || ''
    if (!isValidTokenShape(token)) return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 })
    const limited = await limitRequest(`signup-residency-poll:ip:${getClientIp(request)}`, 240, 10 * MINUTE)
    if (limited) return limited
    const status = await getCheckStatus(token)
    return NextResponse.json({ success: true, ...status })
  } catch (err) {
    return serverError(err, 'api/signup-residency-check')
  }
}
