'use client'

// Shared topbar + navbar for every public-facing page (the "/" welcome page
// and /login) — extracted from app/page.js on Sept 23, 2026 so /login could
// get the same site chrome instead of the bare SiteHeader it had before.
// Uses welcome-theme.css's .w-* classes, same as app/page.js.
//
// On the homepage, links scroll-spy and jump to an in-page anchor (pass
// `onLinkClick` + `activeId`). On any other page (e.g. /login), omit those
// props and links become plain hrefs back to "/#id" — clicking "FAQ" from
// the login screen takes you home to that section instead of doing nothing.

import { useEffect, useState } from 'react'

export const WELCOME_NAV_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'how-to-apply', label: 'How to Apply' },
  { id: 'before-you-apply', label: 'Before You Apply' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

export default function WelcomeNavbar({ activeId, onLinkClick }) {
  // Oct 6 2026: on phones and tablets (960px and below) the links and the
  // Log In / Sign Up buttons move behind a Menu button that opens a panel
  // under the navbar, so nothing overlaps the logos or the page title.
  // Computers are unchanged.
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const mq = window.matchMedia('(min-width: 961px)')
    const onWide = (e) => {
      if (e.matches) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onWide)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onWide)
    }
  }, [menuOpen])

  const renderLinks = (afterClick) =>
    WELCOME_NAV_LINKS.map((link) =>
      onLinkClick ? (
        <a
          key={link.id}
          href={`#${link.id}`}
          onClick={(e) => {
            e.preventDefault()
            afterClick()
            onLinkClick(link.id)
          }}
          className={activeId === link.id ? 'active' : ''}
        >
          {link.label}
        </a>
      ) : (
        <a key={link.id} href={`/#${link.id}`} onClick={afterClick}>
          {link.label}
        </a>
      )
    )

  return (
    <>
      <div className="w-topbar">
        <div className="inner">
          <span>(049) 559-8900 to 8907 / (02) 8-539-5170 to 5171</span>
          <a href="https://www.ccc.edu.ph" target="_blank" rel="noopener noreferrer">www.ccc.edu.ph</a>
        </div>
      </div>

      <nav className="w-navbar">
        <div className="w-nav-inner">
          <a href="/" className="w-brand">
            <div className="w-brand-logos">
              <img src="/LOGO_CCC.png" alt="City College of Calamba Logo" />
              <img src="/LOGO_CCC_Admissions.png" alt="CCC Admissions Logo" />
              <img src="/LOGO_CCC_Registrar.png" alt="CCC Registrar Logo" />
            </div>
            <div className="w-brand-text">
              <span className="main">City College of Calamba</span>
              <span className="sub">Scholarship Portal</span>
            </div>
          </a>
          <nav className="w-nav-links">{renderLinks(() => {})}</nav>
          <div className="w-nav-actions">
            <a href="/login" className="w-btn-login">Log In</a>
            <a href="/login?mode=signup" className="w-btn-signup">Sign Up</a>
          </div>
          <button
            type="button"
            className="w-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="w-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="w-burger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        {menuOpen && (
          <div id="w-mobile-menu" className="w-mobile-menu">
            <nav className="w-mobile-links">{renderLinks(() => setMenuOpen(false))}</nav>
            <div className="w-mobile-actions">
              <a href="/login" className="w-btn-login">Log In</a>
              <a href="/login?mode=signup" className="w-btn-signup">Sign Up</a>
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
