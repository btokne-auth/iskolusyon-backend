'use client'

import { Fragment } from 'react'
import useMobileDrawer, { MobileNavBar, DrawerHead } from './MobileDrawer'

// Sidebar navigation for the applicant portal shell. Structure (groups,
// section labels, sub-labels, item order) is ported 1:1 from Ivy's
// applicant.html sidebar markup (Overview / Admission / Scholarship
// Services groups) — this is the "approved shape" per the front-end repo,
// not our own layout choice.
//
// Sept 19, 2026 (design-parity pass 4): rebuilt to use the .sidebar /
// .sidebar-group / .menu-btn / etc. classes from app/portal-theme.css
// instead of ad hoc Tailwind, so this is now a structural + visual match
// for applicant.html's sidebar (navy/blue gradient rail, translucent
// group pills, divider lines, active-item polarity), not just the same
// information in different styling.

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
        className={`menu-btn${active ? ' active' : ''}`}
      >
        <span className="menu-icon" aria-hidden="true" />
        <span style={{ flex: 1 }}>{item.label}</span>
        {badgeCount != null && badgeCount > 0 && (
          <span className={`menu-badge${badgeCount > 0 ? '' : ' is-empty'}`}>{badgeCount}</span>
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
  avatarUrl,
  messagesCount = 0,
  flaggedCount = 0,
  onLogout,
  applicationNumber = null,
  referenceNumber = null,
}) {
  // Oct 6 2026: on phones and tablets (960px and below) this sidebar becomes
  // a menu that slides in from the left, opened by the Menu button in the
  // slim bar above the page. Computers are unchanged. Same groups and items.
  const drawer = useMobileDrawer()
  const select = (key) => {
    drawer.close()
    onSelectPanel(key)
  }
  const avatar = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  ) : (
    avatarInitials || '?'
  )
  const who = displayName || 'Applicant'
  const sub = applicationNumber ? `Applicant No. ${applicationNumber}` : 'No application number yet'

  return (
    <>
    <MobileNavBar drawer={drawer} avatar={avatar} name={who} sub={sub} />
    {drawer.open && <div className="mnav-scrim" onClick={drawer.close} aria-hidden="true" />}
    <aside id={drawer.id} className={`sidebar sb-drawer${drawer.open ? ' is-open' : ''}`} aria-label="Main menu">
      <DrawerHead drawer={drawer} avatar={avatar} name={who} sub={sub} />
      {/* ---- Profile block ---- */}
      <div className="sidebar-profile">
        {/* Same photo as Card 1's "used across your application and
            account" promise — shows the uploaded profile picture once
            available, falls back to initials until then. */}
        <div className="avatar-wrap" title="Profile picture">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile picture"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
            />
          ) : (
            <span className="avatar-initials">{avatarInitials || '?'}</span>
          )}
        </div>

        <div className="profile-name-row">
          <span className="profile-name">{displayName || 'Applicant'}</span>
        </div>
        <div className="profile-role">Applicant No.:</div>
        <div className="profile-id">
          {/* Sept 20 2026: was always this placeholder text with nothing
              behind it — no application_number column existed anywhere.
              Now shows the real number once /api/application reports one
              assigned (see maybeAssignApplicationNumber() server-side),
              same placeholder copy until then. */}
          {applicationNumber || '(Your Application Number is given once you submit your application with complete requirements)'}
        </div>
        {/* Nov 2026 (panel revisions S4): reference number from sign-up. */}
        {referenceNumber && (
          <>
            <div className="profile-role" style={{ marginTop: 10 }}>Reference No.:</div>
            <div className="profile-id">{referenceNumber}</div>
          </>
        )}
      </div>

      {/* ---- Nav groups ---- */}
      <div className="sidebar-menu">
        {NAV_GROUPS.map((group) => (
          <ul key={group.section} className="sidebar-group">
            <li className="sidebar-section-label">{group.section}</li>
            <li className="sidebar-label-divider" aria-hidden="true" />
            {group.items &&
              group.items.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  active={activePanel === item.key}
                  onSelect={select}
                  messagesCount={messagesCount}
                  flaggedCount={flaggedCount}
                />
              ))}
            {group.subgroups &&
              group.subgroups.map((sub, subIndex) => (
                <Fragment key={sub.label}>
                  {subIndex > 0 && <li className="sidebar-subgroup-divider" aria-hidden="true" />}
                  <li className="sidebar-menu-label">{sub.label}</li>
                  {sub.items.map((item) => (
                    <NavButton
                      key={item.key}
                      item={item}
                      active={activePanel === item.key}
                      onSelect={select}
                      messagesCount={messagesCount}
                      flaggedCount={flaggedCount}
                    />
                  ))}
                </Fragment>
              ))}
          </ul>
        ))}
      </div>

      {/* ---- Logout ---- */}
      <div className="sidebar-logout">
        <button type="button" onClick={() => { drawer.close(); onLogout() }} className="logout-btn">
          <span className="menu-icon" aria-hidden="true" />
          Log Out
        </button>
      </div>
    </aside>
    </>
  )
}
