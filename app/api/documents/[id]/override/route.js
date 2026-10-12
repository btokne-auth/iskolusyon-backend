import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { serverError } from '@/app/lib/safeError'
import { sendResultEmail } from '@/app/lib/resultNotices'
import { getDocTypeLabel } from '@/app/lib/documentTypes'

// Manual "Super Admin" override on a single document's review status.
// Scoped ONLY to this project's own document/verification records (the
// `documents` table) — it does NOT touch qualification or scholarship-
// matching data, which belongs to the Scholarship Matching module.
//
// Still gated behind the shared admin cookie from app/lib/adminAuth.js —
// see that file for why this is a placeholder, not real per-user
// permissions. Whoever is signed in with the shared passcode can override
// any document; there's no per-role restriction yet.
const VALID_ACTIONS = {
  verify: { needs_review: false, review_status: 'verified', label: 'manually marked Verified', kind: 'done' },
  flag: { needs_review: true, review_status: 'flagged', label: 'manually flagged for review', kind: 'warn' },
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params

    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { action, note } = await request.json()
    const change = VALID_ACTIONS[action]
    if (!change) {
      return NextResponse.json({ error: 'Unknown override action.' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('documents')
      .select('applicant_name, applicant_email, applicant_user_id, document_type')
      .eq('file_path', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        needs_review: change.needs_review,
        review_status: change.review_status,
      })
      .eq('file_path', id)

    if (updateError) {
      return serverError(updateError, 'api/documents/[id]/override')
    }

    // Oct 12 2026 (manuscript: "email alerts for ... document submission
    // outcomes"): when an admin flags a document, the applicant gets a
    // private portal message, plus an email if they opted in to email
    // updates (same rule as the result and allowance notices).
    let notice = ''
    if (action === 'flag') {
      notice = await tellApplicantDocumentFlagged(existing, adminName)
    }

    // Best-effort audit trail — same non-blocking pattern as
    // app/api/upload/route.js. Uses the existing 'done' / 'warn' kinds so
    // it renders correctly on the existing Global Audit Logs page without
    // needing any changes there.
    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `Document ${change.label}: ${existing.applicant_name || 'Unknown applicant'} \u00b7 ${existing.document_type || 'document'}${note ? ` (note: ${note})` : ''}${notice}`,
          kind: change.kind,
          category: 'Documents',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/documents/[id]/override')
  }
}

// Returns a short note for the Activity Log (". Applicant notified by email",
// etc.). Never throws: a failed notice never undoes the flag itself.
async function tellApplicantDocumentFlagged(doc, adminName) {
  try {
    let query = supabase
      .from('applications')
      .select('id, first_name, applicant_name, applicant_email, email_updates_opt_in')
      .order('updated_at', { ascending: false })
      .limit(1)
    query = doc.applicant_user_id
      ? query.eq('applicant_user_id', doc.applicant_user_id)
      : query.eq('applicant_name', doc.applicant_name || '')
    const { data: app } = await query.maybeSingle()
    if (!app) return ''

    const label = getDocTypeLabel(doc.document_type)
    const who = (app.first_name || app.applicant_name || 'Applicant').trim()
    const subject = `CCC Scholarship: Please check your ${label}`
    const message = [
      `Good day, ${who}. Your ${label} was flagged for review by the scholarship office.`,
      'Please open Documents & Status in the Iskolusyon portal to see its status, and upload a clearer or corrected copy if needed.',
      'For questions, please contact the Guidance, Counseling, Testing, and Career Development Office (GCTCDO).',
    ].join('\n\n')

    const { error: msgError } = await supabase.from('announcements').insert([
      {
        author: adminName,
        title: subject,
        body: message,
        category: 'Documents',
        type: 'message',
        target_type: 'specific',
        target_application_id: app.id,
        target_category: null,
      },
    ])
    if (msgError) console.error('Flag portal message failed (non-blocking):', msgError.message)

    const to = app.applicant_email || doc.applicant_email
    if (app.email_updates_opt_in && to) {
      const mail = await sendResultEmail({ to, subject, message })
      if (mail.error) {
        console.error('Flag email failed (non-blocking):', mail.error)
        return '. Portal message sent; email failed to send'
      }
      return '. Applicant notified by portal message and email'
    }
    return msgError ? '' : '. Applicant notified by portal message (email updates off)'
  } catch (err) {
    console.error('Flag notice failed (non-blocking):', err?.message)
    return ''
  }
}
