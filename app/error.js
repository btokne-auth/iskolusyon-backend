'use client'

// Oct 5 2026: the "Something went wrong" page, shown when a page crashes
// while loading or rendering. It never shows the technical error. It says
// the problem is on our side, that anything already saved is safe (drafts
// and submitted sections live on the server), and offers Try again, the
// homepage and the right sign-in.
//
// The small "Ref" code is Next.js's error.digest: for errors on the server
// the same code appears next to the full details in the Vercel logs, so
// staff can look it up if an applicant shows them a screenshot. Errors that
// happen in the browser have no digest, so no code shows for those.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import StatusPage, { addressContext, ADMIN_HREF, APPLICANT_HREF, HomeIcon, RetryIcon, ShieldIcon } from './components/StatusPage'

export default function ErrorPage({ error, retry, reset }) {
  const pathname = usePathname() || '/'
  const [trying, setTrying] = useState(false)

  useEffect(() => {
    // Shows up in the browser console for whoever is debugging; the
    // applicant never sees it on the page.
    console.error(error)
  }, [error])

  const tryAgain = () => {
    setTrying(true)
    const again = typeof retry === 'function' ? retry : reset
    try {
      if (typeof again === 'function') again()
      else window.location.reload()
    } finally {
      // If it fails again, this page simply stays; let them try once more.
      setTimeout(() => setTrying(false), 1200)
    }
  }

  const admin = addressContext(pathname) === 'admin'

  return (
    <StatusPage>
      <title>Something went wrong | Iskolusyon</title>
      <span className="sys-eyebrow warn">Something went wrong</span>
      <h1 className="sys-title">This page didn&apos;t load properly</h1>
      <p className="sys-lead">The problem is on our side, not something you did. Please try again in a moment.</p>
      <div className="sys-safe">
        <ShieldIcon />
        <span>Anything you already saved is safe.</span>
      </div>
      <div className="sys-actions">
        <button type="button" className="sys-btn pri" onClick={tryAgain} disabled={trying}>
          <RetryIcon />
          {trying ? 'Trying again...' : 'Try again'}
        </button>
        {/* Full page loads on purpose: after a crash, a fresh load is the
            surest way out. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="sys-btn sec">
          <HomeIcon />
          Go to homepage
        </a>
      </div>
      <div className="sys-foot">
        <p>
          Still having trouble? See{' '}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#contact" className="sys-link">
            Contact
          </a>{' '}
          on the homepage.
        </p>
        <p>
          Signed out?{' '}
          <a href={admin ? ADMIN_HREF : APPLICANT_HREF} className="sys-link">
            {admin ? 'Admin sign-in' : 'Applicant sign-in'}
          </a>
        </p>
        {error?.digest && <span className="sys-ref sys-mono">Ref: {error.digest}</span>}
      </div>
    </StatusPage>
  )
}
