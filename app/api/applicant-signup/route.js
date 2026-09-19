import { NextResponse } from 'next/server'
import {
  startSignup,
  saveSignupProgress,
  sendVerificationCode,
  verifySignupCode,
} from '@/app/lib/applicantAccounts'
import { APPLICANT_COOKIE_NAME, createApplicantCookieValue } from '@/app/lib/applicantAuth'

// One endpoint, four actions — mirrors the action-in-body pattern already
// used by /api/application (save vs submit) rather than spawning four
// near-identical route files for a single 4-step wizard.
//
// action: 'start'      { email, password }                    -> { accountId }
//         'save'       { accountId, academicInfo, personalInfo } -> { success }
//         'send-code'  { accountId, email }                    -> { success } (also used to resend)
//         'verify'     { accountId, code }                     -> { success, name } + sets session cookie
export async function POST(request) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'start') {
      const result = await startSignup(body.email, body.password)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, accountId: result.accountId })
    }

    if (action === 'save') {
      if (!body.accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
      const result = await saveSignupProgress(body.accountId, {
        academicInfo: body.academicInfo,
        personalInfo: body.personalInfo,
      })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'send-code') {
      if (!body.accountId || !body.email) {
        return NextResponse.json({ error: 'Missing accountId or email' }, { status: 400 })
      }
      const result = await sendVerificationCode(body.accountId, body.email)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 502 })
      return NextResponse.json({ success: true })
    }

    if (action === 'verify') {
      if (!body.accountId || !body.code) {
        return NextResponse.json({ error: 'Missing accountId or code' }, { status: 400 })
      }
      const result = await verifySignupCode(body.accountId, body.code)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

      const { value, maxAge } = await createApplicantCookieValue(
        result.account.id,
        result.account.email,
        result.displayName
      )
      const res = NextResponse.json({ success: true, name: result.displayName, email: result.account.email })
      res.cookies.set(APPLICANT_COOKIE_NAME, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge,
      })
      return res
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
