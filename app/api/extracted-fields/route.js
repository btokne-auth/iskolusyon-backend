import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { serverError } from '@/app/lib/safeError'

// GET /api/extracted-fields?file=<file_path>
//
// Auto-fill for the applicant portal (Sept 29). After a Birth Certificate or
// Voter's ID is uploaded, the OCR worker on Render reads it (~20s, up to
// ~1.5 min if it was asleep) and saves the fields it found in
// `extracted_fields`. The portal polls this route until the document is no
// longer 'processing', then fills only the inputs the applicant left empty
// (Ivy's applicant.html behavior contract: never overwrite typed values).
//
// Applicant session required, and the document must belong to that
// applicant, so nobody can read another applicant's extracted details.

const FORM_AUTOFILL_TYPES = ['birthcert', 'voterid']

export async function GET(request) {
  try {
    const applicantCookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const applicantSession = await verifyApplicantCookieValue(applicantCookie)
    if (!applicantSession) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = (searchParams.get('file') || '').trim()
    if (!filePath) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('file_path, document_type, review_status')
      .eq('file_path', filePath)
      .eq('applicant_user_id', applicantSession.id)
      .maybeSingle()

    if (docError) {
      return serverError(docError, 'api/extracted-fields')
    }
    if (!doc || !FORM_AUTOFILL_TYPES.includes(doc.document_type)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (doc.review_status === 'processing') {
      return NextResponse.json({ success: true, status: 'processing', fields: {} })
    }

    const { data: rows, error: fieldsError } = await supabase
      .from('extracted_fields')
      .select('field_name, extracted_value')
      .eq('file_path', filePath)

    if (fieldsError) {
      return serverError(fieldsError, 'api/extracted-fields')
    }

    const fields = {}
    for (const row of rows || []) {
      const value = typeof row.extracted_value === 'string' ? row.extracted_value.trim() : row.extracted_value
      if (value) fields[row.field_name] = value
    }

    return NextResponse.json({ success: true, status: doc.review_status, documentType: doc.document_type, fields })
  } catch (err) {
    return serverError(err, 'api/extracted-fields')
  }
}
