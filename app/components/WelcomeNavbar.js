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

export const WELCOME_NAV_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'how-to-apply', label: 'How to Apply' },
  { id: 'before-you-apply', label: 'Before You Apply' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

export default function WelcomeNavbar({ activeId, onLinkClick }) {
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
          <nav className="w-nav-links">
            {WELCOME_NAV_LINKS.map((link) =>
              onLinkClick ? (
                <a
                  key={link.id}
                  onClick={(e) => {
                    e.preventDefault()
                    onLinkClick(link.id)
                  }}
                  className={activeId === link.id ? 'active' : ''}
                >
                  {link.label}
                </a>
              ) : (
                <a key={link.id} href={`/#${link.id}`}>
                  {link.label}
                </a>
              )
            )}
          </nav>
          <div className="w-nav-actions">
            <a href="/login" className="w-btn-login">Log In</a>
            <a href="/login?mode=signup" className="w-btn-signup">Sign Up</a>
          </div>
        </div>
      </nav>
    </>
  )
}
