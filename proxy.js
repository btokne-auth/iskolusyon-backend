import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  verifyAnyAdminCookie,
  refreshAdminCookieValue,
} from '@/app/lib/adminAuth'
import { APPLICANT_COOKIE_NAME, refreshApplicantCookieValue } from '@/app/lib/applicantAuth'
import { ACTIVITY_HEADER, CSRF_COOKIE_NAME, CSRF_HEADER, sameText } from '@/app/lib/sessionPolicy'

// Oct 7 2026: this file replaces middleware.js. Next.js 16 renamed
// "middleware" to "proxy" (the old name printed a deprecation warning on
// every build). It runs before every page and /api request and now does
// three jobs:
//
//  1. Anti-CSRF check (manuscript Ch. 3, CSRF Testing). Every POST, PUT,
//     PATCH or DELETE to /api must carry the x-csrf-token header matching the
//     iskolusyon_csrf cookie, and, when the browser says where the request
//     came from (Origin / Sec-Fetch-Site), it must be this same site.
//     The header is added automatically by app/components/SecurityGuard.js.
//  2. Admin page gate (unchanged from middleware.js): /admin pages need a
//     signed-in console account, except the login and change-password pages.
//     Oct 7: a session that ended from inactivity lands on the login page
//     with ?expired=1 so it can say why.
//  3. Inactivity timer (manuscript Ch. 3, Session Management Testing). When
//     the person is really active (a page load, or a request the browser
//     marks with x-user-active), the session's "last active" time is moved
//     to now. Background polling does not count.

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Returns a reason string when the request must be refused, else null.
function csrfProblem(request) {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return 'cross-site request'

  const origin = request.headers.get('origin')
  if (origin) {
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      return 'bad origin'
    }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    if (originHost !== host) return 'other origin'
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!sameText(cookieToken, headerToken)) return 'missing or wrong token'
  return null
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  // 1. Anti-CSRF.
  if (isApi && UNSAFE_METHODS.has(request.method)) {
    const problem = csrfProblem(request)
    if (problem) {
      console.warn(`CSRF check refused ${request.method} ${pathname}: ${problem}`)
      return NextResponse.json(
        { error: 'This request was blocked for your safety. Please refresh the page and try again.', csrf: true },
        { status: 403 }
      )
    }
  }

  // 2. Admin page gate.
  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const isAdminPage =
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login') &&
    !pathname.startsWith('/admin/change-password')

  if (isAdminPage) {
    const session = await verifyAnyAdminCookie(adminCookie)
    if (!session) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      if (adminCookie) loginUrl.searchParams.set('expired', '1')
      const redirect = NextResponse.redirect(loginUrl)
      if (adminCookie) redirect.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0 })
      return redirect
    }
  }

  const res = NextResponse.next()

  // 3. Inactivity timer: only real activity keeps a session alive.
  const isPageLoad = request.method === 'GET' && request.headers.get('sec-fetch-dest') === 'document'
  const isActive = isPageLoad || request.headers.get(ACTIVITY_HEADER) === '1'
  if (isActive) {
    if (adminCookie) {
      const fresh = await refreshAdminCookieValue(adminCookie)
      if (fresh) res.cookies.set(ADMIN_COOKIE_NAME, fresh.value, cookieOptions(fresh.maxAge))
    }
    const applicantCookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    if (applicantCookie) {
      const fresh = await refreshApplicantCookieValue(applicantCookie)
      if (fresh) res.cookies.set(APPLICANT_COOKIE_NAME, fresh.value, cookieOptions(fresh.maxAge))
    }
  }

  // Give every browser its anti-CSRF token. Not HttpOnly on purpose: our own
  // pages must read it to copy it into the header. SameSite=Strict keeps
  // other websites from ever sending it.
  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    res.cookies.set(CSRF_COOKIE_NAME, randomToken(), {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return res
}

export const config = {
  // Everything except Next.js's own static files and images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)'],
}
