import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'

// Admin side of the Rescheduling Request System (Notifications Module).
//
// Applicants submit requests through /api/reschedule, and any signed-in
// admin sees them here. Oct 1 2026: admins can also record the decision
// (PATCH below). CCC still reviews these in person (Appendix D), so the
// system doesn't decide anything itself; it records what the office decided,
// tells the applicant in their portal, and logs it.
//
// Ivy's admin.html has no reschedule screen, so there is no mockup to
// follow. The layout reuses the existing admin panel styling instead.
//
// Requires a signed-in admin (any role), same as /api/admin-results.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { data: requests, error } = await supabase
      .from('reschedule_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = requests || []

    // Look up each applicant's application number so an admin can find them
    // in the other panels. Best effort: older requests may have no
    // applicant_user_id, and a failed lookup should not hide the requests.
    const userIds = [...new Set(rows.map((r) => r.applicant_user_id).filter(Boolean))]
    const numberByUser = new Map()
    if (userIds.length > 0) {
      const { data: apps } = await supabase
        .from('applications')
        .select('applicant_user_id, application_number')
        .in('applicant_user_id', userIds)
      for (const app of apps || []) {
        if (app.application_number) numberByUser.set(app.applicant_user_id, app.application_number)
      }
    }

    // Oct 1 2026: a short-lived link to the attached supporting document.
    const linkByPath = new Map()
    await Promise.all(
      [...new Set(rows.map((r) => r.supporting_document_path).filter(Boolean))].map(async (path) => {
        const { data } = await supabase.storage.from('scholarship-documents').createSignedUrl(path, 3600)
        if (data?.signedUrl) linkByPath.set(path, data.signedUrl)
      })
    )

    const result = rows.map((r) => ({
      id: r.id,
      applicant_name: r.applicant_name,
      applicant_email: r.applicant_email,
      application_number: numberByUser.get(r.applicant_user_id) || null,
      request_type: r.request_type,
      details: r.details,
      status: r.status,
      created_at: r.created_at,
      decided_by: r.decided_by || null,
      decided_at: r.decided_at || null,
      decision_note: r.decision_note || null,
      supporting_document_url: r.supporting_document_path ? linkByPath.get(r.supporting_document_path) || null : null,
    }))

    return NextResponse.json({ success: true, requests: result })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


// PATCH /api/admin-reschedule
// body: { id, decision: 'approved' | 'declined', note? }
//
// Records the office's decision on one request. A decision is final: a
// request that was already decided can't be changed (409), so two admins
// can't overwrite each other and the applicant never sees it flip. If the
// applicant needs something else, they send a new request.
const DECISIONS = { approved: 'Approved', declined: 'Declined' }
const NOTE_MAX = 500

export async function PATCH(request) {
  try {
    const session = await verifyAdminCookieFull(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    const adminName = session.name || session.email

    const body = await request.json().catch(() => ({}))
    const id = body?.id
    const decision = typeof body?.decision === 'string' ? body.decision : ''
    const note = typeof body?.note === 'string' ? body.note.trim() : ''
    if (!id) return NextResponse.json({ error: 'Missing request id.' }, { status: 400 })
    if (!DECISIONS[decision]) return NextResponse.json({ error: 'Choose Approve or Decline.' }, { status: 400 })
    if (note.length > NOTE_MAX) {
      return NextResponse.json({ error: `The note is too long (${NOTE_MAX} characters at most).` }, { status: 400 })
    }

    const { data: current, error: loadError } = await supabase.from('reschedule_requests').select('*').eq('id', id).maybeSingle()
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    if (current.status !== 'submitted') {
      return NextResponse.json(
        { error: `This request was already marked ${DECISIONS[current.status] || current.status}${current.decided_by ? ` by ${current.decided_by}` : ''}. Refresh to see it.` },
        { status: 409 }
      )
    }

    // The applicant's application, for the portal message and the review lock.
    let application = null
    if (current.applicant_user_id) {
      const { data } = await supabase
        .from('applications')
        .select('id, applicant_name')
        .eq('applicant_user_id', current.applicant_user_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      application = data || null
    }

    // Locked Applications for Review: don't decide while another admin has
    // this applicant open.
    if (application) {
      const locked = await checkLock(request, application.id)
      if (locked) return locked
    }

    // Only update if it's still undecided, so a second admin clicking at the
    // same moment gets the 409 instead of overwriting.
    const { data: saved, error: saveError } = await supabase
      .from('reschedule_requests')
      .update({ status: decision, decided_by: adminName, decided_at: new Date().toISOString(), decision_note: note || null })
      .eq('id', id)
      .eq('status', 'submitted')
      .select()
      .maybeSingle()
    if (saveError) {
      const missing = /decided_by|decided_at|decision_note/.test(saveError.message || '')
      return NextResponse.json(
        { error: missing ? 'The database is missing the decision columns. Run docs/migrations/2026-10-01-reschedule-decisions.sql in Supabase first.' : saveError.message },
        { status: 500 }
      )
    }
    if (!saved) return NextResponse.json({ error: 'This request was just decided by another admin. Refresh to see it.' }, { status: 409 })

    const label = DECISIONS[decision]
    const isAppeal = /appeal/i.test(current.request_type || '')
    const isReschedule = /reschedule/i.test(current.request_type || '')

    // Applicant notice (portal only, same as Profile Update).
    if (application) {
      let nextSteps = 'If you have questions, please contact the Guidance Office or email admissions@ccc.edu.ph.'
      if (decision === 'approved' && isReschedule) {
        nextSteps = 'Your new exam schedule will appear on your Exam Schedule card once it is set. ' + nextSteps
      } else if (decision === 'approved' && isAppeal) {
        nextSteps = 'Your application status will be updated by the Guidance Office. ' + nextSteps
      }
      try {
        await supabase.from('announcements').insert([
          {
            author: adminName,
            title: `Your request was ${label.toLowerCase()}`,
            body:
              `Your ${current.request_type} request was ${label.toLowerCase()} by the Guidance Office.` +
              (note ? `\n\nNote from the Guidance Office:\n${note}` : '') +
              `\n\n${nextSteps}`,
            category: 'Request Update',
            type: 'message',
            target_type: 'specific',
            target_application_id: application.id,
            target_category: null,
          },
        ])
      } catch (noticeErr) {
        console.error('Request decision notice failed (non-blocking):', noticeErr)
      }
    }

    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `${label} ${current.applicant_name || 'an applicant'}'s ${current.request_type} request.${note ? ` Note: "${note.length > 120 ? `${note.slice(0, 117)}...` : note}"` : ''}`.slice(0, 1000),
          kind: decision === 'approved' ? 'done' : 'warn',
          category: 'Communications',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({
      success: true,
      request: { id: saved.id, status: saved.status, decided_by: saved.decided_by, decided_at: saved.decided_at, decision_note: saved.decision_note },
      notified: Boolean(application),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
