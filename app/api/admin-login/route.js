import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_PWCHANGE_COOKIE_NAME,
  createAdminCookieValue,
  createPasswordChangeCookieValue,
} from '@/app/lib/adminAuth'
import { verifyAdminCredentials } from '@/app/lib/adminAccounts'
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

// Sept 30 2026: 5 failed sign-ins per email per 15 minutes, and 20 per
// network address (higher, because a whole campus can share one address).
const EMAIL_MAX_FAILS = 5
const IP_MAX_FAILS = 20
const WINDOW_MS = 15 * MINUTE

export async function POST(request) {
  try {
    const { email, password } = await request.json()

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
          { error: 'Your temporary password has expired. Ask a Super Admin to send you a new one.' },
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

    const { value, maxAge } = await createAdminCookieValue(account.name, account.isSuperAdmin, account.email, account.role)

    // Sept 24 2026: real sign-in logging -- the admin login page's footer
    // used to claim "Access is logged" without this ever actually
    // happening (Ivy's mockup had the line, our build didn't back it), so
    // it was deliberately left off. Now that a successful sign-in writes
    // here, the footer copy can say that truthfully.
    try {
      await supabase.from('audit_log').insert([
        {
          actor: account.name,
          action: 'Signed in to the Admin Console',
          kind: 'info',
          category: 'System',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    const res = NextResponse.json({ success: true, name: account.name, isSuperAdmin: account.isSuperAdmin, role: account.role })
    res.cookies.set(ADMIN_COOKIE_NAME, value, {
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
