'use client'

// Shared dark footer for every public-facing page — extracted from
// app/page.js on Sept 23, 2026 so /login could carry the same footer
// instead of having none at all. Uses welcome-theme.css's .w-* classes.
//
// `onBeforeYouApplyClick` / `onFaqClick`: on the homepage these scroll +
// open the right accordion section in place; omitted anywhere else (e.g.
// /login), so the links just fall back to plain "/#id" hrefs back home.

function IconPhone(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}
function IconGlobe(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function IconMail(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}
function IconFacebook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

// Oct 12 2026: laid out like ccc.edu.ph's own footer (Ivy's Suggestions
// Log): CCC's name, address and contacts on the left, the CCC logo on the
// right. The Guidance and Registrar logos and the Resources column are gone;
// Privacy Statement and FAQs moved to the bottom bar so the data privacy
// notice (RA 10173) is still one click away on every public page.
const PRIVACY_STATEMENT_URL = 'https://ccc.edu.ph/public/upload/files/CCC-Privacy-Statement-June-2026.pdf'
const ICON_STYLE = { width: 20, height: 20, color: 'var(--ccc-gold)', flexShrink: 0 }

export default function WelcomeFooter({ onBeforeYouApplyClick, onFaqClick }) {
  return (
    <>
      <footer className="w-footer">
        <div className="w-footer-inner">
          <div className="w-footer-main w-footer-ccc">
            <div className="w-footer-info">
              <h4>City College of Calamba</h4>
              <p className="w-footer-line w-footer-addr">Old Municipal Site, Barreto St, Brgy. VII, Poblacion, Calamba City, Laguna, Philippines</p>
              <p className="w-footer-line">
                <IconPhone style={ICON_STYLE} /> (049) 559 8900
              </p>
              <p className="w-footer-line">
                <IconPhone style={ICON_STYLE} /> (02) 8 539 5170
              </p>
              <p className="w-footer-line">
                <IconMail style={ICON_STYLE} />
                <a href="mailto:info@ccc.edu.ph">info@ccc.edu.ph</a>
              </p>
              <p className="w-footer-line">
                <IconGlobe style={ICON_STYLE} />
                <a href="https://www.ccc.edu.ph" target="_blank" rel="noopener noreferrer">www.ccc.edu.ph</a>
              </p>
              <a
                href="https://www.facebook.com/citycollegeofcalamba"
                target="_blank"
                rel="noopener noreferrer"
                title="CCC Facebook Page"
                aria-label="CCC Facebook Page"
                className="w-footer-fb"
              >
                <IconFacebook style={{ width: 17, height: 17 }} />
              </a>
            </div>
            <div className="w-footer-logo-col">
              <img src="/LOGO_CCC-WHITE-TRANSPARENT.png" alt="City College of Calamba logo" />
            </div>
          </div>
        </div>
      </footer>
      <div className="w-footer-bar">
        &copy; 2026 Iskolusyon Scholarship Management System &nbsp;|&nbsp; Developed for the City College of Calamba
        <span className="w-footer-bar-links">
          <a href={PRIVACY_STATEMENT_URL} target="_blank" rel="noopener noreferrer">Privacy Statement</a>
          {onFaqClick ? (
            <a onClick={onFaqClick} style={{ cursor: 'pointer' }}>FAQs</a>
          ) : (
            <a href="/#faq">FAQs</a>
          )}
          {onBeforeYouApplyClick ? (
            <a onClick={() => onBeforeYouApplyClick(2)} style={{ cursor: 'pointer' }}>Admission Requirements</a>
          ) : (
            <a href="/#before-you-apply">Admission Requirements</a>
          )}
        </span>
      </div>
    </>
  )
}
