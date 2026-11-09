import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_MFA_COOKIE_NAME,
  ADMIN_PWCHANGE_COOKIE_NAME,
  createAdminCookieValue,
  createPasswordChangeCookieValue,
  verifyMfaCookie,
} from '@/app/lib/adminAuth'
import {
  verifyAdminCredentials,
  checkAdminLoginCode,
  getAdminAccount,
  effectiveRole,
  accessRefusal,
  maskEmail,
  ADMIN_CODE_TTL_MINUTES,
} from '@/app/lib/adminAccounts'
import { startCodeStep } from '@/app/lib/adminSignIn'
import { supabase } from '@/app/supabaseClient'
import { serverError } from '@/app/lib/safeError'
import {
  MINUTE,
  getClientIp,
  normalizeKey,
  checkLimit,
  recordAttempt,
  clearAttempts,
  waitMessage,
} from '@/app/lib/rateLimit'

// Sept 30 2026: 5 failed sign-ins per email per 15 minutes, and 20 per
// network address (higher, because a whole campus can share one address).
const EMAIL_MAX_FAILS = 5
const IP_MAX_FAILS = 20
const WINDOW_MS = 15 * MINUTE
// Oct 7 2026: a new code can be emailed once a minute per account.
const CODE_COOLDOWN_MS = MINUTE

async function audit(actor, action, kind = 'info') {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'System' }])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
}

// Oct 7 2026: sign-in is now two steps (manuscript Ch. 3, MFA):
//   POST { email, password }     -> right password: a 6-digit code is emailed,
//                                   reply { requiresCode, sentTo } + a 10-minute
//                                   step-2 cookie (no console access yet)
//   POST { action: 'verify', code } -> right code: the real session cookie
//   POST { action: 'resend' }       -> email a new code (once a minute)
//   POST { action: 'cancel' }       -> forget the step-2 cookie
//   GET                             -> { pending, sentTo } so the page can
//                                   reopen the code step after a refresh
export async function GET(request) {
  const pending = await verifyMfaCookie(request.cookies.get(ADMIN_MFA_COOKIE_NAME)?.value)
  if (!pending) return NextResponse.json({ pending: false })
  const secondsLeft = Math.max(0, pending.exp - Math.floor(Date.now() / 1000))
  return NextResponse.json({ pending: true, sentTo: maskEmail(pending.email), minutes: ADMIN_CODE_TTL_MINUTES, secondsLeft })
}

function clearMfa(res) {
  res.cookies.set(ADMIN_MFA_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}

async function handleCodeStep(request, body) {
  const pending = await verifyMfaCookie(request.cookies.get(ADMIN_MFA_COOKIE_NAME)?.value)

  if (body.action === 'cancel') return clearMfa(NextResponse.json({ success: true }))

  if (!pending) {
    return clearMfa(
      NextResponse.json({ error: 'Your sign-in step timed out. Please enter your password again.', restart: true }, { status: 401 })
    )
  }

  if (body.action === 'resend') {
    const bucket = `admin-code:email:${normalizeKey(pending.email)}`
    const cooldown = await checkLimit(bucket, 1, CODE_COOLDOWN_MS)
    if (cooldown.blocked) {
      return NextResponse.json(
        { error: waitMessage(cooldown.retryAfterSec) },
        { status: 429, headers: { 'Retry-After': String(cooldown.retryAfterSec) } }
      )
    }
    await recordAttempt(bucket)
    const account = await getAdminAccount(pending.email)
    if (!account) return clearMfa(NextResponse.json({ error: 'This account no longer exists.', restart: true }, { status: 401 }))
    return startCodeStep(account, { resent: true })
  }

  // action === 'verify'
  const result = await checkAdminLoginCode(pending.email, body.code)
  if (result.error) {
    await audit(pending.email, result.locked ? 'Sign-in code cancelled after 5 wrong tries' : 'Wrong sign-in code entered', 'warn')
    const res = NextResponse.json({ error: result.error, restart: !!result.restart }, { status: 401 })
    return result.restart ? clearMfa(res) : res
  }

  const account = result.account
  const refusal = accessRefusal(account)
  if (refusal) {
    await audit(account.name, 'Sign-in refused: outside the LGU account access dates', 'warn')
    return clearMfa(NextResponse.json({ error: refusal, accessEnded: true }, { status: 403 }))
  }

  const role = effectiveRole(account)
  const { value, maxAge } = await createAdminCookieValue(account.name, role === 'super_admin', account.email, role)

  // Sept 24 2026: real sign-in logging. Oct 7 2026: now written only after
  // both steps (password + emailed code) pass.
  await audit(account.name, 'Signed in to the Admin Console (password + email code)')

  const res = NextResponse.json({ success: true, name: account.name, isSuperAdmin: role === 'super_admin', role })
  res.cookies.set(ADMIN_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
  return clearMfa(res)
}

export async function POST(request) {
  try {
    const body = await request.json()
    if (body.action === 'verify' || body.action === 'resend' || body.action === 'cancel') {
      return await handleCodeStep(request, body)
    }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 })
    }

    const emailKey = `admin-login:email:${normalizeKey(email)}`
    const ipKey = `admin-login:ip:${getClientIp(request)}`

    const emailCheck = await checkLimit(emailKey, EMAIL_MAX_FAILS, WINDOW_MS)
    const ipCheck = await checkLimit(ipKey, IP_MAX_FAILS, WINDOW_MS)
    if (emailCheck.blocked || ipCheck.blocked) {
      const retryAfterSec = Math.max(emailCheck.retryAfterSec || 0, ipCheck.retryAfterSec || 0)
      return NextResponse.json(
        { error: waitMessage(retryAfterSec) },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }

    const account = await verifyAdminCredentials(email, password)
    if (!account) {
      await recordAttempt(emailKey)
      await recordAttempt(ipKey)
      // This failure is the one that reaches the limit: log the lockout once.
      if (emailCheck.count + 1 === EMAIL_MAX_FAILS) {
        try {
          await supabase.from('audit_log').insert([
            {
              actor: normalizeKey(email) || 'Unknown',
              action: `Sign-in locked for ${WINDOW_MS / MINUTE} minutes after ${EMAIL_MAX_FAILS} failed attempts`,
              kind: 'warn',
              category: 'System',
            },
          ])
        } catch (auditErr) {
          console.error('Audit log insert failed (non-blocking):', auditErr)
        }
      }
      // Sept 24 2026: logs the attempt so a Super Admin has visibility: if
      // the same email keeps showing up here, that's worth a look. (Sept 30
      // 2026: the lockout above now blocks the guessing itself.) Non-blocking,
      // same as every other audit_log write -- a logging hiccup should
      // never be the reason a real login fails.
      try {
        await supabase.from('audit_log').insert([
          {
            actor: (email || '').trim().toLowerCase() || 'Unknown',
            action: 'Failed sign-in attempt',
            kind: 'warn',
            category: 'System',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    // Correct password: forget this email's earlier failures.
    await clearAttempts(emailKey)

    // Oct 5 2026: an LGU (view only) account can only sign in between its
    // access dates. Checked only after the password matched, so the dates
    // are never shown to someone guessing.
    if (account.accessRefusal) {
      try {
        await supabase.from('audit_log').insert([
          {
            actor: account.name,
            action: 'Sign-in refused: outside the LGU account access dates',
            kind: 'warn',
            category: 'System',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ error: account.accessRefusal, accessEnded: true }, { status: 403 })
    }

    // Sept 29 2026: temporary password (new invite or Super Admin reset).
    // No console access yet: the admin gets a short-lived cookie that only
    // lets them choose their own password at /admin/change-password.
    if (account.mustChangePassword) {
      if (account.tempExpired) {
        return NextResponse.json(
          { error: 'Your temporary password has expired. Ask a System Admin to send you a new one.' },
          { status: 401 }
        )
      }
      const pending = await createPasswordChangeCookieValue(account.email, account.name)
      const res = NextResponse.json({ success: true, mustChangePassword: true })
      res.cookies.set(ADMIN_PWCHANGE_COOKIE_NAME, pending.value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: pending.maxAge,
      })
      return res
    }

    // Oct 7 2026: right password is only step 1. Email the code.
    await audit(account.name, 'Password accepted, sign-in code emailed')
    return await startCodeStep(account)
  } catch (err) {
    return serverError(err, 'api/admin-login')
  }
}
