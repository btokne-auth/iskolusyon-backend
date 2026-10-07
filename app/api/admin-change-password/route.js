import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_PWCHANGE_COOKIE_NAME, verifyPasswordChangeCookie } from '@/app/lib/adminAuth'
import { startCodeStep } from '@/app/lib/adminSignIn'
import { setOwnPasswordFromTemp } from '@/app/lib/adminAccounts'
import { serverError } from '@/app/lib/safeError'

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

// POST { newPassword }: saves the admin's own password, then emails the
// sign-in code (Oct 7 2026; see below).
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

    // Oct 5 2026: an LGU account outside its access dates keeps its new
    // password but isn't signed in.
    if (result.account.accessRefusal) {
      const res = NextResponse.json({ error: result.account.accessRefusal, accessEnded: true }, { status: 403 })
      res.cookies.set(ADMIN_PWCHANGE_COOKIE_NAME, '', { path: '/', maxAge: 0 })
      return res
    }

    // Oct 7 2026: no direct sign-in any more. The new password is saved,
    // then the same emailed code as every sign-in is required (manuscript
    // Ch. 3, MFA). This also means a Super Admin who saw the temporary
    // password can't finish the first sign-in for someone else.
    const res = await startCodeStep({ name: result.account.name, email: result.account.email }, { passwordSaved: true })
    res.cookies.set(ADMIN_PWCHANGE_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  } catch (err) {
    return serverError(err, 'api/admin-change-password')
  }
}
