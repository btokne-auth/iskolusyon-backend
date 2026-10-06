'use client'

import useMobileDrawer, { MobileNavBar, DrawerHead } from './MobileDrawer'

// Sidebar navigation for the admin console shell. Structure (groups,
// section labels, icons, item order) is now ported to match Ivy's live
// admin.html sidebar markup on the front-end repo's `main` branch as of
// Patch 5 (Sept 19 2026) -- classes (.sidebar, .sidebar-menu-label,
// .menu-btn, etc.) come from app/admin-theme.css, the design-parity CSS
// pass, same "approved shape, real logic behind it" treatment as
// PortalSidebar.js on the applicant side.
//
// Oct 5 2026: Patch 5's "Office of the Registrar" role and its Allowance
// nav item (.registrar-only in the mockup) are now built, plus an LGU (view
// only) role. Each limited role sees only its own items (`role` prop).
//
// admin.html gates "Admin Accounts" and "System & Activity" behind a
// Super Admin role -- see app/lib/adminAuth.js and the Sept 18 migration
// for how that's real (is_super_admin on admin_accounts), not faked.
// "Results & Reporting" (Applicant Results, Statistics) isn't part of
// Ivy's original mockup at all -- it's Pau's own addition for the two
// modules built Sept 21 -- so it keeps its own icons/section here rather
// than inventing a fake mockup source for it.

function IconOverview() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconDashboard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <rect x="3" y="12" width="4" height="8" />
      <rect x="10" y="7" width="4" height="13" />
      <rect x="17" y="3" width="4" height="17" />
    </svg>
  )
}
function IconComms() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconAnnouncements() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5l-4 4H5a2 2 0 0 0-2 2z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
      <path d="M19 5a8 8 0 0 1 0 14" />
    </svg>
  )
}
function IconReschedule() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconSuperAdmin() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function IconResults() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function IconApplicantResults() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function IconStatistics() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <rect x="3" y="12" width="4" height="8" />
      <rect x="10" y="7" width="4" height="13" />
      <rect x="17" y="3" width="4" height="17" />
    </svg>
  )
}

// Oct 3 2026 redesign: own icons for Exam Schedules, Admin Accounts and
// System & Activity (the last two were emoji; Exam Schedules shared the
// Appeals calendar icon).
function IconExamCalendar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h6" />
    </svg>
  )
}
function IconRequests() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  )
}
function IconAccounts() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  )
}

const NAV_GROUPS = [
  {
    section: 'Overview',
    labelIcon: <IconOverview />,
    items: [{ key: 'dashboard', label: 'Dashboard', icon: <IconDashboard />, badgeKey: 'flagged', badgeId: 'dashNewBadge' }],
  },
  {
    section: 'Communications',
    labelIcon: <IconComms />,
    items: [
      { key: 'communications', label: 'Communications', icon: <IconAnnouncements /> },
      // Sept 30 2026: admin side of the applicants' Rescheduling Request
      // form. Not in Ivy's admin.html (she has no such screen), so it has
      // no mockup source; it reuses the console's existing list styling.
      { key: 'reschedule', label: 'Appeals & Reschedules', icon: <IconRequests /> },
      // Sept 30 2026: Exam Schedule Alerts (Notifications Module).
      { key: 'exams', label: 'Exam Schedules', icon: <IconExamCalendar /> },
    ],
  },
  // Applicant Information & Results + Statistical Data & Reporting --
  // Ivy's former modules, built Sept 21 2026 (see ISKOLUSYON_HANDOFF.md §2,
  // items 8-9). Not gated behind Super Admin -- nothing in the Roles PDF
  // ties either module to that role, same as Scholarship Matching &
  // Filtering living on the plain Dashboard.
  {
    section: 'Results & Reporting',
    labelIcon: <IconResults />,
    items: [
      { key: 'results', label: 'Applicant Results', icon: <IconApplicantResults /> },
      { key: 'analytics', label: 'Statistics', icon: <IconStatistics /> },
    ],
  },
]

function IconAllowance() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px' }}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  )
}

// Oct 5 2026: limited roles.
const REGISTRAR_GROUPS = [
  { section: 'Overview', labelIcon: <IconOverview />, items: [{ key: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> }] },
  {
    section: 'Office of the Registrar',
    labelIcon: <IconResults />,
    items: [{ key: 'allowance', label: 'Allowance Distribution', icon: <IconAllowance /> }],
  },
]
const LGU_GROUPS = [
  { section: 'Reports', labelIcon: <IconResults />, items: [{ key: 'reports', label: 'Released reports', icon: <IconRequests /> }] },
]
const ROLE_TEXT = { super_admin: 'Super Admin', admin: 'Admin', registrar: 'Registrar', lgu: 'LGU (view only)' }

const SUPER_ADMIN_GROUP = {
  section: 'Super Admin',
  labelIcon: <IconSuperAdmin />,
  items: [
    { key: 'admins', label: 'Admin Accounts', icon: <IconAccounts /> },
    { key: 'system', label: 'System & Activity', icon: <IconSettings /> },
  ],
}

function NavButton({ item, active, onSelect, flaggedCount }) {
  const badgeCount = item.badgeKey === 'flagged' ? flaggedCount : null

  return (
    <li>
      <button
        type="button"
        className={`menu-btn${active ? ' active' : ''}`}
        data-panel={item.key}
        onClick={() => onSelect(item.key)}
      >
        <span className="menu-icon">{item.icon}</span>
        {' '}{item.label}{' '}
        {badgeCount != null && (
          <span
            className={`menu-badge${badgeCount > 0 ? '' : ' is-empty'}`}
            title={`${badgeCount} flagged document${badgeCount === 1 ? '' : 's'} to check`}
          >
            {badgeCount}
          </span>
        )}
      </button>
    </li>
  )
}

export default function AdminSidebar({
  activePanel,
  onSelectPanel,
  displayName,
  email = '',
  isSuperAdmin,
  role,
  flaggedCount = 0,
  onLogout,
  portalLink = false,
}) {
  const groups =
    role === 'registrar'
      ? REGISTRAR_GROUPS
      : role === 'lgu'
        ? LGU_GROUPS
        : isSuperAdmin
          ? [...NAV_GROUPS, SUPER_ADMIN_GROUP]
          : NAV_GROUPS
  const roleText = ROLE_TEXT[role] || (isSuperAdmin ? 'Super Admin' : 'Admin')
  const initials = (displayName || 'A')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, a) => (i === 0 || i === a.length - 1 ? w.charAt(0) : ''))
    .join('')
    .toUpperCase()
  // Oct 6 2026: on phones and tablets (960px and below) this sidebar becomes
  // a menu that slides in from the left, opened by the Menu button in the
  // slim bar above the page. Computers are unchanged. Same items and rules.
  const drawer = useMobileDrawer()
  const select = (key) => {
    drawer.close()
    onSelectPanel(key)
  }

  return (
    <>
    <MobileNavBar drawer={drawer} avatar={initials} name={displayName || 'Admin'} sub={roleText} />
    {drawer.open && <div className="mnav-scrim" onClick={drawer.close} aria-hidden="true" />}
    <aside id={drawer.id} className={`sidebar sb-drawer${drawer.open ? ' is-open' : ''}`} aria-label="Main menu">
      <DrawerHead drawer={drawer} avatar={initials} name={displayName || 'Admin'} sub={roleText} />
      {/* ---- Profile block ----
          Oct 3 2026 redesign: initials beside the name, role as plain text.
          Admin and Super Admin look the same on purpose (no color coding). */}
      <div className="sidebar-profile sb-profile">
        <div className="sb-avatar" title={displayName || 'Admin'} aria-hidden="true">
          {initials}
        </div>
        <div className="sb-who">
          <div className="sb-name">{displayName || 'Admin'}</div>
          <div className="sb-role">{roleText}</div>
        </div>
      </div>

      {/* ---- Nav groups ---- */}
      <ul className="sidebar-menu">
        {groups.map((group) => (
          <li className="sidebar-menu-group" key={group.section}>
            <div className="sidebar-menu-label">
              <span className="sml-icon">{group.labelIcon}</span>
              {group.section}
            </div>
            <ul className="sidebar-menu-sub">
              {group.items.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  active={activePanel === item.key}
                  onSelect={select}
                  flaggedCount={flaggedCount}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* ---- Log out (real -- the admin login system exists). Oct 3 2026:
          asks first (the confirm pop-up lives in app/admin/page.js). ---- */}
      <div className="sidebar-logout">
        {email && <div className="sb-signed-in">Signed in as {email}</div>}
        {portalLink && (
          // Phones and tablets only: the header's "Back to applicant portal"
          // link is hidden there to keep the header from overlapping.
          <a href="/portal" className="logout-btn mnav-only" style={{ color: '#c9d6ee' }}>
            Back to applicant portal
          </a>
        )}
        <button type="button" className="logout-btn" onClick={() => { drawer.close(); onLogout() }}>
          <span className="menu-icon"><IconLogout /></span> Log out
        </button>
      </div>
    </aside>
    </>
  )
}
