import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'

// Admin side of the Rescheduling Request System (Notifications Module).
//
// Read-only for now: applicants submit requests through /api/reschedule,
// and this lets any signed-in admin see them. Approve / deny is a later
// step (it needs a decision on what the applicant is told), so nothing
// here writes to the table.
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
      supporting_document_url: r.supporting_document_path ? linkByPath.get(r.supporting_document_path) || null : null,
    }))

    return NextResponse.json({ success: true, requests: result })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
