import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAnyAdminCookie } from '@/app/lib/adminAuth'

// Placeholder gate for the shared admin account — see app/lib/adminAuth.js
// for what this is and isn't. Protects every /admin page except the login
// page itself; unauthenticated visits get bounced to /admin/login with a
// `next` param so they land back where they were headed after signing in.
export async function middleware(request) {
  const { pathname } = request.nextUrl

  // /admin/change-password is where an admin on a temporary password picks
  // their own; it has no admin session yet, so it's open like the login
  // page (its API only works with the short-lived password-change cookie).
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/change-password')) {
    return NextResponse.next()
  }

  // Oct 5 2026: Registrar and LGU (view only) sessions may open /admin too;
  // the page shows them their own limited console, and every admin /api
  // route still refuses them on the server.
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAnyAdminCookie(cookie)

  if (!session) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}