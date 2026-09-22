// Shared header (topbar + navbar) matching the approved CCC mockup design
// (same look used in admin.html / applicant.html from last term's defense).
// Used by both the applicant page and the admin page so the whole app feels
// like one system, not two different projects.

// logos: defaults to the 2-logo cluster already used everywhere except the
// applicant portal (applicant.html's own navbar has a 3rd, Registrar, logo).
// subtitle: applicant.html/index.html say "Scholarship Portal"; signup.html
// (and therefore the shared login/signup/forgot-password screens) says
// "Scholarship Application Portal" — kept as the default so those callers
// don't need to change.
// topbarLink: applicant.html's topbar pairs the phone numbers on the left
// with a www.ccc.edu.ph link on the right; optional so other callers that
// just pass a plain topbarLabel are unaffected.
// topbarRight: admin.html's own topbar is laid out differently from
// applicant.html's -- space-between (label on the left, a role/session
// badge on the right, e.g. "Super Admin Session"), not applicant.html's
// justify-end pairing of label+link at the right edge. Optional, and only
// switches the row to space-between when a caller actually passes it, so
// applicant.html/login/signup's existing topbarLink-only usage is unaffected.
const DEFAULT_LOGOS = [
  { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
  { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
]

export default function SiteHeader({
  topbarLabel,
  topbarLink,
  topbarRight,
  portalBadge,
  rightSlot,
  logos = DEFAULT_LOGOS,
  subtitle = 'Scholarship Application Portal',
}) {
  return (
    <>
      {/* Topbar — spec's .topbar is var(--ccc-blue) (bright blue), not navy,
          and both the label and link sit together at the right edge
          (justify-end, spec's own .inner{justify-content:flex-end}), not
          spread apart. Fixed as part of design-parity pass 5, Sept 19 2026.
          admin.html's own topbar is space-between instead (see topbarRight
          above) -- only switches when a caller passes it. */}
      <div className="bg-ccc-blue text-white text-xs py-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
        <div className={`max-w-[1400px] mx-auto px-4 md:px-8 flex items-center gap-6 ${topbarRight ? 'justify-between' : 'justify-end'}`}>
          <span className="font-bold">{topbarLabel}</span>
          {(topbarLink || topbarRight) && (
            <div className="flex items-center gap-6">
              {topbarLink && (
                <a
                  href={topbarLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold hover:opacity-80"
                >
                  {topbarLink.label}
                </a>
              )}
              {topbarRight}
            </div>
          )}
        </div>
      </div>

      {/* Navbar */}
      <nav className="bg-white border-b-[3px] border-ccc-gold sticky top-0 z-30 shadow-sm">
        <div className="w-full px-4 md:px-10 flex items-center justify-between h-[72px] gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {logos.map((logo) => (
                <img
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  className="h-11 w-auto object-contain"
                />
              ))}
            </div>
            <div
              className="pl-2.5 ml-1 border-l-2 border-ccc-border"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              <div className="text-[15px] font-extrabold text-ccc-navy leading-tight">
                City College of Calamba
              </div>
              <div className="text-[11px] text-ccc-muted leading-tight">
                {subtitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {portalBadge && (
              <div className="text-xs font-bold uppercase tracking-wide text-white bg-ccc-blue px-3 py-1.5 rounded-full">
                {portalBadge}
              </div>
            )}
            {rightSlot}
          </div>
        </div>
      </nav>
    </>
  )
}
