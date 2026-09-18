// Shared header (topbar + navbar) matching the approved CCC mockup design
// (same look used in admin.html / applicant.html from last term's defense).
// Used by both the applicant page and the admin page so the whole app feels
// like one system, not two different projects.

export default function SiteHeader({ topbarLabel, portalBadge, rightSlot }) {
  return (
    <>
      {/* Topbar */}
      <div className="bg-ccc-navy text-white text-xs py-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex justify-between items-center gap-4">
          <span>{topbarLabel}</span>
        </div>
      </div>

      {/* Navbar */}
      <nav className="bg-white border-b-[3px] border-ccc-gold sticky top-0 z-30 shadow-sm">
        <div className="w-full px-4 md:px-10 flex items-center justify-between h-[72px] gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <img src="/LOGO_CCC.png" alt="City College of Calamba Logo" className="h-11 w-auto object-contain" />
              <img src="/LOGO_CCC_Admissions.png" alt="CCC Admissions Logo" className="h-11 w-auto object-contain" />
            </div>
            <div
              className="pl-2.5 ml-1 border-l-2 border-ccc-border"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              <div className="text-[15px] font-extrabold text-ccc-navy leading-tight">
                City College of Calamba
              </div>
              <div className="text-[11px] text-ccc-muted leading-tight">
                Scholarship Application Portal
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
