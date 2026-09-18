import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { listAdminAccounts } from '@/app/lib/adminAccounts'

// Read-only for now — matches admin.html's "Admin Accounts" panel showing
// the roster, but there's no invite/remove flow wired up yet (no real User
// Account Module to hang it on). Gated to Super Admins only, same as the
// nav item itself.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })
    }

    const accounts = await listAdminAccounts()
    return NextResponse.json({ success: true, accounts })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
