'use client'

// Oct 5 2026: last-resort error page, used only if the root layout itself
// fails (app/error.js covers everything else). It replaces the whole
// document, so it brings its own <html>, <body> and styles.
import './globals.css'

export default function GlobalError({ error, retry, reset }) {
  const tryAgain = () => {
    const again = typeof retry === 'function' ? retry : reset
    if (typeof again === 'function') again()
    else window.location.reload()
  }
  return (
    <html lang="en">
      <body>
        <title>Something went wrong | Iskolusyon</title>
        <div className="sys-page">
          <main className="sys-main">
            <div className="sys-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/LOGO_CCC.png" alt="City College of Calamba logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
              <span className="sys-eyebrow warn">Something went wrong</span>
              <h1 className="sys-title">This page didn&apos;t load properly</h1>
              <p className="sys-lead">The problem is on our side, not something you did. Anything you already saved is safe.</p>
              <div className="sys-actions">
                <button type="button" className="sys-btn pri" onClick={tryAgain}>
                  Try again
                </button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="sys-btn sec">
                  Go to homepage
                </a>
              </div>
              {error?.digest && <span className="sys-ref sys-mono">Ref: {error.digest}</span>}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
