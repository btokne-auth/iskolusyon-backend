import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { RELEASABLE_STATUSES, buildResultDraft, sendResultEmail } from '@/app/lib/resultNotices'

// Sept 30 2026, item 5 ("Real-time Result Notifications"): an admin releases
// an applicant's result. One applicant at a time, on purpose: there is no
// "send to everyone" action, so a whole batch can never go out in one click
// (also keeps the free Resend plan's daily limit safe).
//
// What a release does:
//   1. posts a private message to that applicant's Messages tab (this always
//      happens and never depends on the email),
//   2. emails them, but only if they ticked "I want to receive email updates",
//   3. remembers what was sent (result_notified_* columns),
//   4. writes one Activity Log line.
//
// GET  ?id=<application id>  -> the draft subject/message the admin can edit
// POST { id, subject, message, resend? }

async function loadApplication(id) {
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, applicant_name, first_name, applicant_email, program_choice_1, scholar_status, email_updates_opt_in, ' +
      'result_notified_status, result_notified_at, result_notified_by, result_email_sent'
    )
    .eq('id', id)
    .maybeSingle()
  return { data, error }
}

export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

    const { data: app, error } = await loadApplication(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

    if (!RELEASABLE_STATUSES.has(app.scholar_status)) {
      return NextResponse.json({ error: 'There is no result to send yet. Record the exam result first.' }, { status: 400 })
    }

    const draft = buildResultDraft({
      status: app.scholar_status,
      name: app.first_name || app.applicant_name,
      program: app.program_choice_1,
    })

    return NextResponse.json({
      success: true,
      status: app.scholar_status,
      to: app.applicant_email || '',
      emailOptIn: !!app.email_updates_opt_in,
      subject: draft.subject,
      message: draft.message,
      lastSent: app.result_notified_at
        ? {
            status: app.result_notified_status,
            at: app.result_notified_at,
            by: app.result_notified_by,
            emailSent: app.result_email_sent,
          }
        : null,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { id, subject, message, resend } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

    const cleanSubject = (subject || '').trim()
    const cleanMessage = (message || '').trim()
    if (!cleanSubject || !cleanMessage) {
      return NextResponse.json({ error: 'Subject and message are both required.' }, { status: 400 })
    }
    if (cleanSubject.length > 150 || cleanMessage.length > 4000) {
      return NextResponse.json({ error: 'Subject or message is too long.' }, { status: 400 })
    }

    const { data: app, error: loadError } = await loadApplication(id)
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })

    if (!RELEASABLE_STATUSES.has(app.scholar_status)) {
      return NextResponse.json({ error: 'There is no result to send yet. Record the exam result first.' }, { status: 400 })
    }

    // Same result already sent: only go ahead when the admin confirmed it.
    if (!resend && app.result_notified_at && app.result_notified_status === app.scholar_status) {
      return NextResponse.json(
        { error: 'This result was already sent to the applicant. Confirm to send it again.', alreadySent: true },
        { status: 409 }
      )
    }

    // 1. Private message in the applicant's Messages tab. Always posted.
    const { error: postError } = await supabase.from('announcements').insert([
      {
        author: adminName,
        title: cleanSubject,
        body: cleanMessage,
        category: 'Result',
        type: 'message',
        target_type: 'specific',
        target_application_id: app.id,
        target_category: null,
      },
    ])
    if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

    // 2. Email, only for applicants who opted in.
    let emailSent = false
    let emailNote = ''
    if (!app.email_updates_opt_in) {
      emailNote = 'The applicant did not opt in to email updates, so only the portal message was sent.'
    } else if (!app.applicant_email) {
      emailNote = 'No email address on file, so only the portal message was sent.'
    } else {
      const result = await sendResultEmail({
        to: app.applicant_email,
        subject: cleanSubject,
        message: cleanMessage,
      })
      if (result.success) {
        emailSent = true
      } else {
        emailNote = `The email could not be sent (${result.error}). The portal message was still sent.`
      }
    }

    // 3. Remember what was sent.
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        result_notified_status: app.scholar_status,
        result_notified_at: now,
        result_notified_by: adminName,
        result_email_sent: emailSent,
      })
      .eq('id', app.id)
    if (updateError) console.error('Saving result_notified_* failed:', updateError.message)

    // 4. Activity Log.
    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `${resend ? 'Re-sent' : 'Released'} result to ${app.applicant_name || 'applicant'}: ${app.scholar_status} (portal message sent, ${emailSent ? 'email sent' : 'no email'})`,
          kind: emailNote && app.email_updates_opt_in && !emailSent ? 'warn' : 'done',
          category: 'Results',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, emailSent, emailNote })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
