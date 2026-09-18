'use client'

// Sidebar navigation for the applicant portal shell. Structure (groups,
// section labels, sub-labels, item order) is ported 1:1 from Ivy's
// applicant.html sidebar markup (Overview / Admission / Scholarship
// Services groups) — this is the "approved shape" per the front-end repo,
// not our own layout choice. Panels that don't have real content built yet
// still get a working nav entry + a clearly-labeled placeholder panel, so
// the shell is honest about what's actually done vs. coming later.
//
// No login system exists yet (Ivy's User Account Module), so there's no
// real "Log Out" action to wire up — the button is present for visual
// parity with her design but is a no-op for now.

const NAV_GROUPS = [
  {
    section: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'messages', label: 'Messages', badgeKey: 'messages' },
    ],
  },
  {
    section: 'Admission',
    subgroups: [
      {
        label: 'My Profile (Softcopy)',
        items: [
          { key: 'personal', label: 'Personal Information' },
          { key: 'academic', label: 'Educational Background' },
          { key: 'financial', label: 'Family & Financial Information' },
        ],
      },
      {
        label: 'Application',
        items: [
          { key: 'status', label: 'Documents & Status', badgeKey: 'flagged' },
          { key: 'appeals', label: 'Appeals & Rescheduling' },
        ],
      },
    ],
  },
  {
    section: 'Scholarship Services',
    subgroups: [
      {
        label: 'During Enrollment',
        items: [{ key: 'health', label: 'Health & Wellness' }],
      },
      {
        label: 'Enrolled',
        items: [{ key: 'allowance', label: 'Allowance' }],
      },
    ],
  },
]

function NavButton({ item, active, onSelect, messagesCount, flaggedCount }) {
  const badgeCount =
    item.badgeKey === 'messages' ? messagesCount : item.badgeKey === 'flagged' ? flaggedCount : null

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

export default function PortalSidebar({
  activePanel,
  onSelectPanel,
  displayName,
  avatarInitials,
  messagesCount = 0,
  flaggedCount = 0,
}) {
  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border border-ccc-border rounded-2xl p-4 lg:sticky lg:top-6 h-fit space-y-5">
      {/* ---- Profile block ---- */}
      <div className="flex flex-col items-center text-center gap-1 pb-4 border-b border-ccc-border">
        <div className="w-14 h-14 rounded-full bg-ccc-navy text-white flex items-center justify-center text-lg font-bold">
          {avatarInitials || '—'}
        </div>
        <div className="text-sm font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          {displayName || 'Applicant'}
        </div>
        <div className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest">Applicant No.:</div>
        <div className="text-[10px] text-ccc-muted leading-snug">
          (Application Number will be provided once your documents are submitted and verified)
        </div>
      </div>

      {/* ---- Nav groups ---- */}
      <div className="space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ccc-muted mb-1.5 px-1">
              {group.section}
            </div>
            {group.items && (
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <NavButton
                    key={item.key}
                    item={item}
                    active={activePanel === item.key}
                    onSelect={onSelectPanel}
                    messagesCount={messagesCount}
                    flaggedCount={flaggedCount}
                  />
                ))}
              </ul>
            )}
            {group.subgroups &&
              group.subgroups.map((sub) => (
                <div key={sub.label} className="mb-2 last:mb-0">
                  <div className="text-[11px] font-bold text-ccc-navy mt-2 mb-1 px-1">{sub.label}</div>
                  <ul className="space-y-0.5">
                    {sub.items.map((item) => (
                      <NavButton
                        key={item.key}
                        item={item}
                        active={activePanel === item.key}
                        onSelect={onSelectPanel}
                        messagesCount={messagesCount}
                        flaggedCount={flaggedCount}
                      />
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* ---- Logout (no-op — no login system yet) ---- */}
      <div className="pt-3 border-t border-ccc-border">
        <button
          type="button"
          disabled
          title="Log in/out isn't wired up yet — no account system exists"
          className="w-full text-left rounded-lg px-3 py-2 text-[13px] font-semibold text-ccc-muted opacity-60 cursor-not-allowed"
        >
          Log Out
        </button>
      </div>
    </aside>
  )
}