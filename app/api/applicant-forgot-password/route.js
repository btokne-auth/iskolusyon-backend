import { NextResponse } from 'next/server'
import { requestPasswordReset, resetPasswordWithCode } from '@/app/lib/applicantAccounts'

// One endpoint, two actions — same action-in-body pattern as
// /api/applicant-signup, sized for a 2-step Forgot Password flow.
//
// action: 'request' { email }                          -> { success }
//         'reset'   { email, code, newPassword }        -> { success }
export async function POST(request) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'request') {
      if (!body.email) {
        return NextResponse.json({ error: 'Missing email' }, { status: 400 })
      }
      const result = await requestPasswordReset(body.email)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'reset') {
      if (!body.email || !body.code || !body.newPassword) {
        return NextResponse.json({ error: 'Missing email, code, or newPassword' }, { status: 400 })
      }
      const result = await resetPasswordWithCode(body.email, body.code, body.newPassword)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
