// Oct 5 2026: the frame shared by the 404 page (app/not-found.js) and the
// "Something went wrong" page (app/error.js): the CCC header, one centered
// card, and a small footer. No site navigation on purpose, since these pages
// show on both the applicant side and the Admin Console.

import Link from 'next/link'

// Which sign-in fits the address someone was on. Any "admin" part of the
// address means the Admin Console (so a mistyped /login/admin still points
// staff to the right place); /portal means the Applicant Portal.
export function addressContext(pathname) {
  const parts = String(pathname || '')
    .toLowerCase()
    .split('/')
    .filter(Boolean)
  if (parts.some((p) => p.includes('admin'))) return 'admin'
  if (parts[0] === 'portal' || parts[0] === 'login' || parts[0] === 'history') return 'portal'
  return 'other'
}

// Signed-in admins land in the console; signed-out ones are sent to the
// Admin sign-in by middleware.js. Same for applicants and /portal.
export const ADMIN_HREF = '/admin'
export const APPLICANT_HREF = '/portal'

export function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

export function SignInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}

export function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
      <path d="M8.5 12.2l2.4 2.3 4.6-4.8" />
    </svg>
  )
}

export default function StatusPage({ children }) {
  return (
    <div className="sys-page">
      <header className="sys-header">
        <div className="sys-header-inner">
          <Link href="/" className="sys-brand">
            <span className="sys-brand-logos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LOGO_CCC.png" alt="City College of Calamba logo" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LOGO_CCC_Admissions.png" alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LOGO_CCC_Registrar.png" alt="" />
            </span>
            <span className="sys-brand-text">
              <span className="main">City College of Calamba</span>
              <span className="sub">Scholarship Portal</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="sys-main">
        <div className="sys-card">{children}</div>
      </main>
      <footer className="sys-footer">City College of Calamba &middot; Iskolusyon Scholarship Portal</footer>
    </div>
  )
}
