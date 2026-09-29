import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import {
  ADMIN_COOKIE_NAME,
  ADMIN_PWCHANGE_COOKIE_NAME,
  createAdminCookieValue,
  verifyPasswordChangeCookie,
} from '@/app/lib/adminAuth'
import { setOwnPasswordFromTemp } from '@/app/lib/adminAccounts'

// First sign-in on a temporary password (Sept 29, 2026). Only works with
// the short-lived cookie /api/admin-login sets for a temporary password;
// a normal admin session can't use this route, and this route never
// changes anyone else's password.

// GET: lets /admin/change-password greet the admin by name, or send them
// back to the login page if they didn't come from a temporary-password
// sign-in (or waited longer than 15 minutes).
export async function GET(request) {
  const pending = await verifyPasswordChangeCookie(request.cookies.get(ADMIN_PWCHANGE_COOKIE_NAME)?.value)
  if (!pending) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  return NextResponse.json({ success: true, name: pending.name, email: pending.email })
}

// POST { newPassword }: saves the admin's own password, then signs them in
// to the console for real.
export async function POST(request) {
  try {
    const pending = await verifyPasswordChangeCookie(request.cookies.get(ADMIN_PWCHANGE_COOKIE_NAME)?.value)
    if (!pending) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

    const body = await request.json()
    const result = await setOwnPasswordFromTemp(pending.email, body.newPassword)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    try {
      await supabase.from('audit_log').insert([
        {
          actor: result.account.name,
          action: 'Set their own password on first sign-in',
          kind: 'done',
          category: 'Admin Accounts',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    const { value, maxAge } = await createAdminCookieValue(result.account.name, result.account.isSuperAdmin, result.account.email)
    const res = NextResponse.json({ success: true })
    res.cookies.set(ADMIN_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    res.cookies.set(ADMIN_PWCHANGE_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
