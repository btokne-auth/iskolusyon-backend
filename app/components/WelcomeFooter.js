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

export default function WelcomeFooter({ onBeforeYouApplyClick, onFaqClick }) {
  return (
    <>
      <footer className="w-footer">
        <div className="w-footer-inner">
          <div className="w-footer-main">
            <div className="w-footer-logo-col">
              <img src="/LOGO_CCC-WHITE-ONLY.png" alt="City College of Calamba White Logo" />
              <img src="/LOGO_CCC-WHITE_GUIDANCE.png" alt="CCC Guidance White Logo" />
              <img src="/LOGO_CCC-WHITE_REGISTRAR.png" alt="CCC Registrar White Logo" />
            </div>
            <div className="w-footer-content-col">
              <div className="w-footer-content-row">
                <div>
                  <h4>Connect Directly with CCC</h4>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '.8rem', color: 'rgba(255,255,255,.5)' }}>
                    <IconPhone style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} /> (049) 559 8900
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '.8rem', color: 'rgba(255,255,255,.5)' }}>
                    <IconPhone style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} /> (02) 8 539 5170
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <IconGlobe style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} />
                    <a href="https://www.ccc.edu.ph" target="_blank" rel="noopener noreferrer">www.ccc.edu.ph</a>
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <IconMail style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} />
                    <a href="mailto:info@ccc.edu.ph">info@ccc.edu.ph</a>
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <a
                      href="https://www.facebook.com/citycollegeofcalamba"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="CCC Facebook Page"
                      style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginBottom: 0 }}
                    >
                      <IconFacebook style={{ width: 17, height: 17 }} />
                    </a>
                  </div>
                </div>
                <div>
                  <h4>Resources</h4>
                  {onBeforeYouApplyClick ? (
                    <a onClick={() => onBeforeYouApplyClick(2)} style={{ cursor: 'pointer' }}>Admission Requirements</a>
                  ) : (
                    <a href="/#before-you-apply">Admission Requirements</a>
                  )}
                  {onFaqClick ? (
                    <a onClick={onFaqClick} style={{ cursor: 'pointer' }}>FAQs</a>
                  ) : (
                    <a href="/#faq">FAQs</a>
                  )}
                  <a href="https://ccc.edu.ph/public/upload/files/CCC-Privacy-Statement-June-2026.pdf" target="_blank" rel="noopener noreferrer">Privacy Statement</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <div className="w-footer-bar">&copy; 2026 Iskolusyon Scholarship Management System &nbsp;|&nbsp; Developed for the City College of Calamba</div>
    </>
  )
}
