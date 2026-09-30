import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { resultsVisible } from '@/app/lib/resultVisibility'

// Applicant-facing read side of the Communications feature (see
// app/api/announcements/route.js for the admin side, and docs/migrations/
// 2026-09-22-communications-targeting.sql for the columns this depends
// on). Wires the already-built "Messages" panel shell on the applicant
// portal (app/page.js, activePanel === 'messages') to real data for the
// first time -- that panel previously always showed its honest empty
// state because there was no admin-side authoring tool yet.
//
// Returns everything this signed-in applicant should see:
//   - every 'announcement' row (public, everyone gets these)
//   - every 'message' row targeted at 'all'
//   - every 'message' row targeted at this applicant specifically
//     (target_application_id = their own applications.id)
//   - every 'message' row targeted at the applicant category
//     (target_category) that matches their own current effective
//     eligibility status -- eligibility_override if set, else
//     eligibility_status, else 'incomplete', same fallback chain the
//     admin/applicant portals already use everywhere else.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const session = await verifyApplicantCookieValue(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    // Find this applicant's own row, if they have one yet, for the
    // specific-applicant and category targeting checks below. Mirrors
    // app/api/application/route.js's own userId-first lookup -- an
    // applicant with no application row yet (brand new account) still
    // gets 'all'-targeted messages and announcements, just nothing from
    // the specific/category branches, which is correct: there's nothing
    // to target them by yet.
    const { data: rows, error: appError } = await supabase
      .from('applications')
      .select('id, eligibility_status, eligibility_override')
      .eq('applicant_user_id', session.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (appError) return NextResponse.json({ error: appError.message }, { status: 500 })

    const myApplication = rows && rows[0] ? rows[0] : null
    const myApplicationId = myApplication?.id ?? null
    const myEligibilityCategory = myApplication
      ? myApplication.eligibility_override || myApplication.eligibility_status || 'incomplete'
      : null

    const orClauses = ['type.eq.announcement', 'and(type.eq.message,target_type.eq.all)']
    if (myApplicationId) {
      orClauses.push(`and(type.eq.message,target_type.eq.specific,target_application_id.eq.${myApplicationId})`)
    }
    if (myEligibilityCategory) {
      orClauses.push(`and(type.eq.message,target_type.eq.category,target_category.eq.${myEligibilityCategory})`)
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .or(orClauses.join(','))
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sept 30 2026: result messages (Send Result to Applicant) only show
    // while "Exam Results Visible to Applicants" is on.
    const visible = await resultsVisible()
    const posts = visible ? data : (data || []).filter((post) => post.category !== 'Result')
    return NextResponse.json({ success: true, posts })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
