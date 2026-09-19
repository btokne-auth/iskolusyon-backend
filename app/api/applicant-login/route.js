import { NextResponse } from 'next/server'
import { APPLICANT_COOKIE_NAME, createApplicantCookieValue } from '@/app/lib/applicantAuth'
import { verifyApplicantCredentials, sendLoginCode, verifyLoginCode } from '@/app/lib/applicantAccounts'
import { supabase } from '@/app/supabaseClient'

// Login is now two steps (login-time MFA, added Sept 19) instead of one.
// No `action` field (or any value other than 'verify') is treated as the
// credentials step, so nothing else calling this route with the old
// { email, password } body shape needs to change.
//
// action: (none)    { email, password }      -> { success, requiresOtp: true, accountId, email }
//                                                 (also used to resend the code — same body, same effect)
// action: 'verify'  { accountId, code }       -> { success, name, email } + sets session cookie
export async function POST(request) {
  try {
    const body = await request.json()

    if (body.action === 'verify') {
      if (!body.accountId || !body.code) {
        return NextResponse.json({ error: 'Missing accountId or code' }, { status: 400 })
      }

      const result = await verifyLoginCode(body.accountId, body.code)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

      const displayName = await lookUpDisplayName(result.account.id)

      const { value, maxAge } = await createApplicantCookieValue(result.account.id, result.account.email, displayName)
      const res = NextResponse.json({ success: true, name: displayName, email: result.account.email })
      res.cookies.set(APPLICANT_COOKIE_NAME, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge,
      })
      return res
    }

    const { email, password } = body

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

    const sendResult = await sendLoginCode(account.id, account.email)
    if (sendResult.error) {
      return NextResponse.json({ error: sendResult.error }, { status: 502 })
    }

    return NextResponse.json({ success: true, requiresOtp: true, accountId: account.id, email: account.email })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Look up their application (if any) just to get a display name for the
// welcome message — not required for login to succeed. Same query the
// credentials step used to run before MFA was added.
async function lookUpDisplayName(accountId) {
  const { data: app } = await supabase
    .from('applications')
    .select('applicant_name')
    .eq('applicant_user_id', accountId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return app?.applicant_name || ''
}
