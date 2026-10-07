import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { serverError } from '@/app/lib/safeError'

// Oct 5 2026: the signed-in applicant's own allowance distributions, for the
// portal's Allowance page (Progress Table row 78). Read-only. Removed posts
// are left out. Posts stay listed even if the applicant's status changes
// later, since the distribution already happened.
export async function GET(request) {
  try {
    const session = await verifyApplicantCookieValue(request.cookies.get(APPLICANT_COOKIE_NAME)?.value)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { data: rows, error: appError } = await supabase
      .from('applications')
      .select('id, scholar_status')
      .eq('applicant_user_id', session.id)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (appError) return serverError(appError, 'api/allowance')
    const app = rows && rows[0]
    if (!app) return NextResponse.json({ success: true, isScholar: false, posts: [] })

    const { data: posts, error } = await supabase
      .from('allowance_posts')
      .select('id, distribution_date, allowance_type, description')
      .eq('application_id', app.id)
      .is('removed_at', null)
      .order('distribution_date', { ascending: false })
      .order('posted_at', { ascending: false })
    if (error) return serverError(error, 'api/allowance')

    return NextResponse.json({
      success: true,
      isScholar: ['passer', 'qualified_probationary'].includes(app.scholar_status),
      posts: posts || [],
    })
  } catch (err) {
    return serverError(err, 'api/allowance')
  }
}
