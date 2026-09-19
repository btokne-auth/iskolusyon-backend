import { NextResponse } from 'next/server'
import { APPLICANT_COOKIE_NAME, createApplicantCookieValue } from '@/app/lib/applicantAuth'
import { verifyApplicantCredentials } from '@/app/lib/applicantAccounts'
import { supabase } from '@/app/supabaseClient'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 })
    }

    const account = await verifyApplicantCredentials(email, password)

    if (!account) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }
    if (account.unverified) {
      return NextResponse.json(
        { error: 'This account has not finished email verification yet. Please sign up again to receive a new code.' },
        { status: 403 }
      )
    }

    // Look up their application (if any) just to get a display name for
    // the welcome message — not required for login to succeed.
    const { data: app } = await supabase
      .from('applications')
      .select('applicant_name')
      .eq('applicant_user_id', account.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const displayName = app?.applicant_name || ''

    const { value, maxAge } = await createApplicantCookieValue(account.id, account.email, displayName)
    const res = NextResponse.json({ success: true, name: displayName, email: account.email })
    res.cookies.set(APPLICANT_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
