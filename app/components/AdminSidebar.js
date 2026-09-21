'use client'

// Sidebar navigation for the admin console shell. Structure (groups,
// section labels, item order) is ported 1:1 from Ivy's admin.html sidebar
// markup (Overview / Communications / Super Admin) — this is the confirmed-
// merged Patch 2 version, not the still-Draft Patch 3 (PR #8) redesign.
// Same "approved shape, real logic behind it" treatment as
// PortalSidebar.js on the applicant side.
//
// admin.html gates "Admin Accounts" and "System & Activity" behind a
// Super Admin role — see app/lib/adminAuth.js and the Sept 18 migration
// for how that's now real (is_super_admin on admin_accounts), not faked.

const NAV_GROUPS = [
  {
    section: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', badgeKey: 'flagged' }],
  },
  {
    section: 'Communications',
    items: [{ key: 'communications', label: 'Announcements' }],
  },
  // Applicant Information & Results + Statistical Data & Reporting --
  // Ivy's former modules, built Sept 21 2026 (see ISKOLUSYON_HANDOFF.md §2,
  // items 8-9). Not gated behind Super Admin -- nothing in the Roles PDF
  // ties either module to that role, same as Scholarship Matching &
  // Filtering living on the plain Dashboard.
  {
    section: 'Results & Reporting',
    items: [
      { key: 'results', label: 'Applicant Results' },
      { key: 'analytics', label: 'Statistics' },
    ],
  },
]

const SUPER_ADMIN_GROUP = {
  section: 'Super Admin',
  items: [
    { key: 'admins', label: 'Admin Accounts' },
    { key: 'system', label: 'System & Activity' },
  ],
}

function NavButton({ item, active, onSelect, flaggedCount }) {
  const badgeCount = item.badgeKey === 'flagged' ? flaggedCount : null

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.key)}
        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
          active ? 'bg-ccc-blue text-white' : 'text-ccc-text hover:bg-ccc-off'
        }`}
      >
        <span className="flex-1">{item.label}</span>
        {badgeCount != null && badgeCount > 0 && (
          <span
            className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
              active ? 'bg-white text-ccc-blue' : 'bg-ccc-gold text-ccc-navy'
            }`}
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
  isSuperAdmin,
  flaggedCount = 0,
  onLogout,
}) {
  const groups = isSuperAdmin ? [...NAV_GROUPS, SUPER_ADMIN_GROUP] : NAV_GROUPS

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border border-ccc-border rounded-2xl p-4 lg:sticky lg:top-6 h-fit space-y-5">
      {/* ---- Profile block ---- */}
      <div className="flex flex-col items-center text-center gap-1 pb-4 border-b border-ccc-border">
        <div className="w-14 h-14 rounded-full bg-ccc-navy text-white flex items-center justify-center text-lg font-bold">
          {displayName ? displayName.charAt(0).toUpperCase() : '—'}
        </div>
        <div className="text-sm font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          {displayName || 'Admin'}
        </div>
        <div className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest">
          {isSuperAdmin ? 'Super Admin' : 'Admin'}
        </div>
      </div>

      {/* ---- Nav groups ---- */}
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.section}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ccc-muted mb-1.5 px-1">
              {group.section}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  active={activePanel === item.key}
                  onSelect={onSelectPanel}
                  flaggedCount={flaggedCount}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ---- Log out (real — the admin login system exists) ---- */}
      <div className="pt-3 border-t border-ccc-border">
        <button
          type="button"
          onClick={onLogout}
          className="w-full text-left rounded-lg px-3 py-2 text-[13px] font-semibold text-ccc-blue hover:text-ccc-navy hover:bg-ccc-off transition-colors"
        >
          Log Out
        </button>
      </div>
    </aside>
  )
}
