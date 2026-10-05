// Oct 5 2026: role checks for the routes built for the Office of the
// Registrar and the LGU (view only) accounts.
//
// Every older admin route uses verifyAdminCookieFull(), which refuses
// Registrar and LGU sessions outright (see app/lib/adminAuth.js). The routes
// that DO serve a limited role call requireConsoleRole() with the exact roles
// allowed. Unlike the older routes, this also re-reads the account from the
// database on every request, so a removed account, a changed role, or an LGU
// account whose access dates have passed stops working on its next click,
// not only when the 8-hour session runs out.

import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAnyAdminCookie } from '@/app/lib/adminAuth'
import { getAdminAccount, effectiveRole, accessRefusal } from '@/app/lib/adminAccounts'

// roles: e.g. ['registrar'] or ['admin', 'super_admin'].
// Returns { session } with session = { name, email, role, account } or
// { response } (a 401/403 to return as is).
export async function requireConsoleRole(request, roles) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const cookieSession = await verifyAnyAdminCookie(cookie)
  if (!cookieSession) {
    return { response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) }
  }

  let account
  try {
    account = await getAdminAccount(cookieSession.email)
  } catch (err) {
    return { response: NextResponse.json({ error: err.message }, { status: 500 }) }
  }
  if (!account) {
    return { response: NextResponse.json({ error: 'This account no longer exists.' }, { status: 401 }) }
  }

  const role = effectiveRole(account)
  if (role !== cookieSession.role && !(role === 'super_admin' && cookieSession.role === 'admin')) {
    // The account's role changed since sign-in: make them sign in again.
    return { response: NextResponse.json({ error: 'Your account changed. Please sign in again.' }, { status: 401 }) }
  }

  const refusal = accessRefusal(account)
  if (refusal) {
    return { response: NextResponse.json({ error: refusal, accessEnded: true }, { status: 401 }) }
  }

  if (!roles.includes(role)) {
    return { response: NextResponse.json({ error: 'Your account does not have access to this.' }, { status: 403 }) }
  }

  return { session: { name: account.name, email: account.email, role, account } }
}
