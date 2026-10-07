import { NextResponse } from 'next/server'
import { requestPasswordReset, resetPasswordWithCode } from '@/app/lib/applicantAccounts'
import { MINUTE, getClientIp, normalizeKey, checkLimit, recordAttempt, waitMessage } from '@/app/lib/rateLimit'
import { serverError } from '@/app/lib/safeError'

// Sept 30 2026: a reset code can be requested once a minute per email and
// 10 times per 15 minutes per network address, so this endpoint can't be
// used to flood someone's inbox (or to keep re-arming the 5-guess limit on
// the code by requesting new ones over and over).
const EMAIL_COOLDOWN_MS = MINUTE
const IP_MAX_REQUESTS = 10
const IP_WINDOW_MS = 15 * MINUTE

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
      const emailKey = `forgot:email:${normalizeKey(body.email)}`
      const ipKey = `forgot:ip:${getClientIp(request)}`
      const emailCheck = await checkLimit(emailKey, 1, EMAIL_COOLDOWN_MS)
      const ipCheck = await checkLimit(ipKey, IP_MAX_REQUESTS, IP_WINDOW_MS)
      if (emailCheck.blocked || ipCheck.blocked) {
        const retryAfterSec = Math.max(emailCheck.retryAfterSec || 0, ipCheck.retryAfterSec || 0)
        return NextResponse.json(
          { error: waitMessage(retryAfterSec) },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
        )
      }
      await recordAttempt(emailKey)
      await recordAttempt(ipKey)
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
    return serverError(err, 'api/applicant-forgot-password')
  }
}
