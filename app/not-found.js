'use client'

// Oct 5 2026: the site-wide 404 page (any address that doesn't exist, on the
// applicant side or in the Admin Console). Before this, Next.js showed its
// plain black "404 | This page could not be found." The first button
// follows the address the person was on: Admin sign-in for admin addresses,
// Applicant sign-in for /portal addresses, otherwise the homepage. All
// three ways out are always on the page.
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import StatusPage, { addressContext, ADMIN_HREF, APPLICANT_HREF, HomeIcon, SignInIcon } from './components/StatusPage'

const noSubscribe = () => () => {}

export default function NotFound() {
  // Next.js prepares this page ahead of time (its own path is /_not-found),
  // so the address the person actually typed is only known in the browser.
  // Until then the buttons stay hidden, so the wrong one never flashes first.
  const address = useSyncExternalStore(
    noSubscribe,
    () => `${window.location.host}${window.location.pathname}`,
    () => null
  )
  const known = address !== null
  const host = known ? address.slice(0, address.indexOf('/')) : ''
  const pathname = known ? address.slice(address.indexOf('/')) : '/'
  const context = addressContext(pathname)

  const adminButton = (
    <Link href={ADMIN_HREF} className={`sys-btn ${context === 'admin' ? 'pri' : 'sec'}`}>
      <SignInIcon />
      Admin sign-in
    </Link>
  )
  const applicantButton = (
    <Link href={APPLICANT_HREF} className={`sys-btn ${context === 'portal' ? 'pri' : 'sec'}`}>
      <SignInIcon />
      Applicant sign-in
    </Link>
  )
  const homeButton = (
    <Link href="/" className={`sys-btn ${context === 'other' ? 'pri' : 'sec'}`}>
      <HomeIcon />
      Go to homepage
    </Link>
  )

  return (
    <StatusPage>
      <title>Page not found | Iskolusyon</title>
      <span className="sys-eyebrow">Error 404</span>
      <h1 className="sys-title">We couldn&apos;t find that page</h1>
      <p className="sys-lead">The link may be old or mistyped, or the page may have moved.</p>
      <div style={known ? undefined : { visibility: 'hidden' }} className="sys-tried">
        <span className="sys-tried-label">You tried</span>
        <span className="sys-tried-path sys-mono">{known ? address : ''}</span>
      </div>
      {!known && <div style={{ minHeight: 150 }} aria-hidden="true" />}

      {known && context === 'admin' && (
        <>
          <p className="sys-hint">
            Looking for the Admin Console? Sign in at <strong className="sys-mono">{host || 'iskolusyon.dev'}/admin/login</strong>.
          </p>
          <div className="sys-actions">
            {adminButton}
            {homeButton}
          </div>
          <div className="sys-foot">
            <p>
              Applying for the scholarship? <Link href={APPLICANT_HREF} className="sys-link">Applicant sign-in</Link>
            </p>
          </div>
        </>
      )}

      {known && context === 'portal' && (
        <>
          <p className="sys-hint">
            If you were working on your application, sign in to the Applicant Portal to pick up where you left off.
          </p>
          <div className="sys-actions">
            {applicantButton}
            {homeButton}
          </div>
          <div className="sys-foot">
            <p>
              CCC staff? <Link href={ADMIN_HREF} className="sys-link">Admin sign-in</Link>
            </p>
          </div>
        </>
      )}

      {known && context === 'other' && (
        <>
          <p className="sys-hint">Start from the homepage, or sign in if you already have an account.</p>
          <div className="sys-actions">
            {homeButton}
            {applicantButton}
          </div>
          <div className="sys-foot">
            <p>
              CCC staff? <Link href={ADMIN_HREF} className="sys-link">Admin sign-in</Link>
            </p>
          </div>
        </>
      )}
    </StatusPage>
  )
}
