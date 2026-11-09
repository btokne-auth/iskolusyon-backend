import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'
import { ENDORSEMENT_STEPS, buildEndorsementDraft, sendResultEmail } from '@/app/lib/resultNotices'
import { resultsVisible } from '@/app/lib/resultVisibility'
import { serverError } from '@/app/lib/safeError'

// Sept 30 2026: endorsement notices (progress table row "Real-time Result
// Notifications (Pass/Fail/Endorsement)", Notifications Module). Same flow
// as /api/admin-result-release: one applicant at a time, a private portal
// message always, an email only if the applicant opted in, remembered in
// endorsement_notified_*, one Activity Log line.
//
// Only allowed once the applicant's result itself was sent and "Exam Results
// Visible to Applicants" is on, so an endorsement never reveals a result
// the applicant hasn't been told.
//
// GET  ?id=<application id>  -> draft subject/message
// POST { id, subject, message, resend? }

const STEP_LABELS = {
  endorsed_registrar: 'Endorsed to Registrar',
  endorsed_medical: 'Endorsed to Medical',
  endorsed_admissions: 'Endorsed to Admissions',
  enrollment_complete: 'Enrollment Complete',
}

async function loadApplication(id) {
  return supabase
    .from('applications')
    .select(
      'id, applicant_name, first_name, applicant_email, scholar_status, distribution_status, email_updates_opt_in, ' +
      'result_notified_at, endorsement_notified_status, endorsement_notified_at, endorsement_notified_by, endorsement_email_sent'
    )
    .eq('id', id)
    .maybeSingle()
}

function notReady(app) {
  if (!['passer', 'qualified_probationary'].includes(app.scholar_status)) {
    return 'Endorsements are only for Passers and Qualified (Probationary) applicants.'
  }
  if (!app.result_notified_at) return 'Send the applicant their result first.'
  if (!ENDORSEMENT_STEPS.has(app.distribution_status)) {
    return 'Move the applicant to an endorsement step in Distribution Status first.'
  }
  return null
}

export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

    const { data: app, error } = await loadApplication(id)
    if (error) return serverError(error, 'api/admin-endorsement-notice')
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

    const problem = notReady(app)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    const draft = buildEndorsementDraft({ step: app.distribution_status, name: app.first_name || app.applicant_name })
    return NextResponse.json({
      success: true,
      resultsVisible: await resultsVisible(),
      status: app.distribution_status,
      to: app.applicant_email || '',
      emailOptIn: !!app.email_updates_opt_in,
      subject: draft.subject,
      message: draft.message,
    })
  } catch (err) {
    return serverError(err, 'api/admin-endorsement-notice')
  }
}

export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { id, subject, message, resend } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

    // Oct 1 2026: Locked Applications for Review.
    const locked = await checkLock(request, id)
    if (locked) return locked
    const cleanSubject = (subject || '').trim()
    const cleanMessage = (message || '').trim()
    if (!cleanSubject || !cleanMessage) {
      return NextResponse.json({ error: 'Subject and message are both required.' }, { status: 400 })
    }
    if (cleanSubject.length > 150 || cleanMessage.length > 4000) {
      return NextResponse.json({ error: 'Subject or message is too long.' }, { status: 400 })
    }

    const { data: app, error: loadError } = await loadApplication(id)
    if (loadError) return serverError(loadError, 'api/admin-endorsement-notice')
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

    const problem = notReady(app)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })

    if (!(await resultsVisible())) {
      return NextResponse.json(
        { error: 'The Guidance Head needs to turn on "Exam Results Visible to Applicants" in Admission Cycle first.', resultsHidden: true },
        { status: 409 }
      )
    }

    if (!resend && app.endorsement_notified_at && app.endorsement_notified_status === app.distribution_status) {
      return NextResponse.json(
        { error: 'This endorsement was already sent to the applicant. Confirm to send it again.', alreadySent: true },
        { status: 409 }
      )
    }

    const { error: postError } = await supabase.from('announcements').insert([
      {
        author: adminName,
        title: cleanSubject,
        body: cleanMessage,
        category: 'Endorsement',
        type: 'message',
        target_type: 'specific',
        target_application_id: app.id,
        target_category: null,
      },
    ])
    if (postError) return serverError(postError, 'api/admin-endorsement-notice')

    let emailSent = false
    let emailNote = ''
    if (!app.email_updates_opt_in) {
      emailNote = 'The applicant did not opt in to email updates, so only the portal message was sent.'
    } else if (!app.applicant_email) {
      emailNote = 'No email address on file, so only the portal message was sent.'
    } else {
      const result = await sendResultEmail({ to: app.applicant_email, subject: cleanSubject, message: cleanMessage })
      if (result.success) emailSent = true
      else emailNote = `The email could not be sent (${result.error}). The portal message was still sent.`
    }

    const { error: updateError } = await supabase
      .from('applications')
      .update({
        endorsement_notified_status: app.distribution_status,
        endorsement_notified_at: new Date().toISOString(),
        endorsement_notified_by: adminName,
        endorsement_email_sent: emailSent,
      })
      .eq('id', app.id)
    if (updateError) console.error('Saving endorsement_notified_* failed:', updateError.message)

    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `${resend ? 'Re-sent' : 'Sent'} endorsement notice to ${app.applicant_name || 'applicant'}: ${STEP_LABELS[app.distribution_status] || app.distribution_status} (portal message sent, ${emailSent ? 'email sent' : 'no email'})`,
          kind: emailNote && app.email_updates_opt_in && !emailSent ? 'warn' : 'done',
          category: 'Results',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, emailSent, emailNote })
  } catch (err) {
    return serverError(err, 'api/admin-endorsement-notice')
  }
}
