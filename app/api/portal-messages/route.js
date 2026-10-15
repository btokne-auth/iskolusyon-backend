import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { resultsVisible } from '@/app/lib/resultVisibility'
import { logApplicantActivity, applicantLabel } from '@/app/lib/activityLog'
import { serverError } from '@/app/lib/safeError'

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
// Oct 16 2026: the post-finding logic is shared by GET (the Messages list
// and the read-acknowledgment pop-up) and POST (confirming one post), so an
// applicant can only acknowledge a post they can actually see.
async function postsFor(session) {
  // Find this applicant's own row, if they have one yet, for the
  // specific-applicant and category targeting checks below. Mirrors
  // app/api/application/route.js's own userId-first lookup -- an
  // applicant with no application row yet (brand new account) still
  // gets 'all'-targeted messages and announcements, just nothing from
  // the specific/category branches, which is correct: there's nothing
  // to target them by yet.
  const { data: rows, error: appError } = await supabase
    .from('applications')
    .select('id, eligibility_status, eligibility_override, scholar_status')
    .eq('applicant_user_id', session.id)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (appError) throw appError

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
  if (error) throw error

  // Sept 30 2026: result messages (Send Result to Applicant) only show
  // while "Exam Results Visible to Applicants" is on.
  // Also hidden while this applicant's result is reset to Pending Exam (for
  // example a retest), so an old "Passed" message doesn't stay on screen.
  const visible = await resultsVisible()
  const decided = !!myApplication?.scholar_status && myApplication.scholar_status !== 'pending_exam'
  // Endorsement notices follow the same rule as results (Sept 30 2026).
  return visible && decided ? data || [] : (data || []).filter((post) => post.category !== 'Result' && post.category !== 'Endorsement')
}

export async function GET(request) {
  try {
    const cookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const session = await verifyApplicantCookieValue(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const posts = await postsFor(session)

    // Oct 16 2026: when this applicant confirmed reading each post.
    // Before the migration runs, the table doesn't exist yet: no pop-ups
    // then (requires_ack is also missing), and the list still loads.
    const acknowledged = {}
    const ids = posts.map((p) => p.id)
    if (ids.length) {
      const { data: acks, error: ackError } = await supabase
        .from('message_acknowledgments')
        .select('announcement_id, acknowledged_at')
        .eq('applicant_user_id', session.id)
        .in('announcement_id', ids)
      if (!ackError) for (const a of acks || []) acknowledged[a.announcement_id] = a.acknowledged_at
    }
    return NextResponse.json({ success: true, posts, acknowledged })
  } catch (err) {
    return serverError(err, 'api/portal-messages')
  }
}

// Oct 16 2026 (client recommendation, Registrar interview of Oct 15):
// POST { id } records that the signed-in applicant ticked "I have read and
// understood this message" for that post. Only posts this applicant can see
// and that ask for it (requires_ack) can be acknowledged; doing it twice
// keeps the first time.
export async function POST(request) {
  try {
    const cookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const session = await verifyApplicantCookieValue(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Missing message.' }, { status: 400 })
    }

    const post = (await postsFor(session)).find((p) => p.id === id)
    if (!post || post.requires_ack !== true) {
      return NextResponse.json({ error: 'That message could not be found.' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('message_acknowledgments')
      .select('acknowledged_at')
      .eq('announcement_id', id)
      .eq('applicant_user_id', session.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ success: true, acknowledgedAt: existing.acknowledged_at })

    const { data: saved, error } = await supabase
      .from('message_acknowledgments')
      .insert([{ announcement_id: id, applicant_user_id: session.id }])
      .select('acknowledged_at')
      .single()
    if (error) return serverError(error, 'api/portal-messages')

    await logApplicantActivity(
      applicantLabel(session.name, session.email),
      `Applicant confirmed reading ${post.type === 'message' ? 'the message' : 'the announcement'} "${post.title}"`
    )
    return NextResponse.json({ success: true, acknowledgedAt: saved.acknowledged_at })
  } catch (err) {
    return serverError(err, 'api/portal-messages')
  }
}
