import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'

// Placeholder gate for the shared admin account — see app/lib/adminAuth.js
// for what this is and isn't. Protects every /admin page except the login
// page itself; unauthenticated visits get bounced to /admin/login with a
// `next` param so they land back where they were headed after signing in.
export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const adminName = await verifyAdminCookieValue(cookie)

  if (!adminName) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}