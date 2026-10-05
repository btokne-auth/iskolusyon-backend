import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, LIMITED_ROLES, verifyAnyAdminCookie } from '@/app/lib/adminAuth'
import { getAdminAccount, effectiveRole, accessRefusal } from '@/app/lib/adminAccounts'

// Who is signed in. Oct 5 2026: also answers for the Office of the
// Registrar and LGU (view only) sessions, with their `role`, so /admin can
// show them their own limited console. For those two roles the account is
// re-read, so a removed account or an LGU account past its access dates is
// treated as signed out.
export async function GET(request) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAnyAdminCookie(cookie)

  if (!session) {
    return NextResponse.json({ loggedIn: false }, { status: 401 })
  }

  if (LIMITED_ROLES.has(session.role)) {
    let account = null
    try {
      account = await getAdminAccount(session.email)
    } catch (err) {
      return NextResponse.json({ loggedIn: false, error: err.message }, { status: 500 })
    }
    if (!account || effectiveRole(account) !== session.role) {
      return NextResponse.json({ loggedIn: false }, { status: 401 })
    }
    const refusal = accessRefusal(account)
    if (refusal) {
      return NextResponse.json({ loggedIn: false, accessEnded: true, error: refusal }, { status: 401 })
    }
    return NextResponse.json({
      loggedIn: true,
      name: account.name,
      isSuperAdmin: false,
      email: account.email,
      role: session.role,
      accessFrom: account.access_from || null,
      accessUntil: account.access_until || null,
    })
  }

  return NextResponse.json({
    loggedIn: true,
    name: session.name,
    isSuperAdmin: session.isSuperAdmin,
    email: session.email,
    role: session.role,
  })
}
