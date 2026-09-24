import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, createAdminCookieValue } from '@/app/lib/adminAuth'
import { verifyAdminCredentials } from '@/app/lib/adminAccounts'
import { supabase } from '@/app/supabaseClient'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 })
    }

    const account = await verifyAdminCredentials(email, password)
    if (!account) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    const { value, maxAge } = await createAdminCookieValue(account.name, account.isSuperAdmin, account.email)

    // Sept 24 2026: real sign-in logging -- the admin login page's footer
    // used to claim "Access is logged" without this ever actually
    // happening (Ivy's mockup had the line, our build didn't back it), so
    // it was deliberately left off. Now that a successful sign-in writes
    // here, the footer copy can say that truthfully. Failed attempts are
    // deliberately not logged yet -- that's a separate, bigger call
    // (do we log the email that was tried, do we rate-limit, etc.) than
    // "a real admin actually got in."
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

    const res = NextResponse.json({ success: true, name: account.name, isSuperAdmin: account.isSuperAdmin })
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
