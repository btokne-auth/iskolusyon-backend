import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'

export async function GET(request) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAdminCookieFull(cookie)

  if (!session) {
    return NextResponse.json({ loggedIn: false }, { status: 401 })
  }
  return NextResponse.json({
    loggedIn: true,
    name: session.name,
    isSuperAdmin: session.isSuperAdmin,
    email: session.email,
  })
}
