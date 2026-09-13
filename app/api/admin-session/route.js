import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'

export async function GET(request) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const name = await verifyAdminCookieValue(cookie)

  if (!name) {
    return NextResponse.json({ loggedIn: false }, { status: 401 })
  }
  return NextResponse.json({ loggedIn: true, name })
}