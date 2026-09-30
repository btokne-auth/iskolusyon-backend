import { NextResponse } from 'next/server'
import { APPLICANT_COOKIE_NAME, createApplicantCookieValue } from '@/app/lib/applicantAuth'
import { verifyApplicantCredentials, sendLoginCode, verifyLoginCode } from '@/app/lib/applicantAccounts'
import { supabase } from '@/app/supabaseClient'
import {
  MINUTE,
  getClientIp,
  normalizeKey,
  checkLimit,
  recordAttempt,
  clearAttempts,
  waitMessage,
} from '@/app/lib/rateLimit'

// Sept 30 2026: 5 wrong passwords per email per 15 minutes (20 per network
// address, since a campus can share one), and a login code can only be
// requested once a minute per account so nobody can flood an inbox.
const EMAIL_MAX_FAILS = 5
const IP_MAX_FAILS = 20
const WINDOW_MS = 15 * MINUTE
const CODE_COOLDOWN_MS = MINUTE

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

      const displayName = await lookUpDisplayName(result.account.id, result.account.email)

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

    const emailKey = `applicant-login:email:${normalizeKey(email)}`
    const ipKey = `applicant-login:ip:${getClientIp(request)}`

    const emailCheck = await checkLimit(emailKey, EMAIL_MAX_FAILS, WINDOW_MS)
    const ipCheck = await checkLimit(ipKey, IP_MAX_FAILS, WINDOW_MS)
    if (emailCheck.blocked || ipCheck.blocked) {
      const retryAfterSec = Math.max(emailCheck.retryAfterSec || 0, ipCheck.retryAfterSec || 0)
      return NextResponse.json(
        { error: waitMessage(retryAfterSec) },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }

    const account = await verifyApplicantCredentials(email, password)

    if (!account) {
      await recordAttempt(emailKey)
      await recordAttempt(ipKey)
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }
    if (account.unverified) {
      return NextResponse.json(
        { error: 'This account has not finished email verification yet. Please sign up again to receive a new code.' },
        { status: 403 }
      )
    }

    // Correct password: forget earlier failures, then enforce the
    // one-code-per-minute cooldown before emailing anything.
    await clearAttempts(emailKey)
    const codeKey = `applicant-code:${account.id}`
    const codeCheck = await checkLimit(codeKey, 1, CODE_COOLDOWN_MS)
    if (codeCheck.blocked) {
      return NextResponse.json(
        { error: `A login code was just sent. Please wait ${codeCheck.retryAfterSec} seconds before requesting another one.` },
        { status: 429, headers: { 'Retry-After': String(codeCheck.retryAfterSec) } }
      )
    }
    await recordAttempt(codeKey)

    const sendResult = await sendLoginCode(account.id, account.email)
    if (sendResult.error) {
      return NextResponse.json({ error: sendResult.error }, { status: 502 })
    }

    return NextResponse.json({ success: true, requiresOtp: true, accountId: account.id, email: account.email })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Look up their application (if any) to get a display name for the
// welcome message, and — much more importantly — to seed `applicantName`
// on the client so the portal's own load effect can find this account's
// saved data again after a refresh (see the Sept 19 2026 comment in
// /api/application's POST handler; this is the other half of that fix).
//
// Matches by `applicant_user_id` first. Falls back to the account's own
// email when that finds nothing — covers every row saved before that
// column started being stamped on every save (any row created by typing
// straight into the portal rather than via the pre-filled-at-signup path
// in applicantAccounts.js). When the fallback is what finds it, this also
// backfills `applicant_user_id` on that row so the fast path works next
// time and this account never has to fall back again.
async function lookUpDisplayName(accountId, email) {
  const { data: byUserId } = await supabase
    .from('applications')
    .select('applicant_name')
    .eq('applicant_user_id', accountId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byUserId?.applicant_name) return byUserId.applicant_name

  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail) return ''

  const { data: byEmail } = await supabase
    .from('applications')
    .select('id, applicant_name')
    .ilike('applicant_email', normalizedEmail)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!byEmail?.applicant_name) return ''

  await supabase.from('applications').update({ applicant_user_id: accountId }).eq('id', byEmail.id)

  return byEmail.applicant_name
}
