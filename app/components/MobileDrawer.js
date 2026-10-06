'use client'

// Oct 6 2026: phones and tablets (960px wide and below). The applicant
// portal and the admin console used to squeeze their sidebar into a block of
// scattered links above the page. Now a slim bar shows who is signed in and
// a Menu button; the button slides the same sidebar in from the left (see
// the .sb-drawer rules in app/globals.css). Computers are unchanged: the bar
// and the drawer header are hidden there and the sidebar stays put.
//
// Our manuscript's Chapter 3 plans compatibility testing "across desktop and
// mobile screen configurations", since applicants use their own devices.

import { useCallback, useEffect, useId, useState } from 'react'

export default function useMobileDrawer() {
  const [open, setOpen] = useState(false)
  const rawId = useId().replace(/:/g, '')
  const id = `menu-${rawId}`
  const buttonId = `menu-btn-${rawId}`
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Keep the page behind the menu from scrolling while it is open.
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
      // Put keyboard focus back on the Menu button.
      document.getElementById(buttonId)?.focus()
    }
  }, [open, buttonId])

  // If the window grows past the phone/tablet size while the menu is open,
  // close it so the page doesn't stay locked.
  useEffect(() => {
    if (!open) return undefined
    const mq = window.matchMedia('(min-width: 961px)')
    const onChange = (e) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [open])

  return { open, setOpen, close, id, buttonId }
}

function MenuIcon() {
  return (
    <span className="mnav-burger" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

export function MobileNavBar({ drawer, avatar, name, sub }) {
  return (
    <div className="mnav-bar">
      <span className="mnav-avatar" aria-hidden="true">{avatar}</span>
      <span className="mnav-who">
        <span className="mnav-name">{name}</span>
        {sub && <span className="mnav-sub">{sub}</span>}
      </span>
      <button
        type="button"
        id={drawer.buttonId}
        className="mnav-menu-btn"
        aria-expanded={drawer.open}
        aria-controls={drawer.id}
        onClick={() => drawer.setOpen(true)}
      >
        <MenuIcon />
        Menu
      </button>
    </div>
  )
}

export function DrawerHead({ drawer, avatar, name, sub }) {
  return (
    <div className="mnav-head">
      <span className="mnav-avatar" aria-hidden="true">{avatar}</span>
      <span className="mnav-who">
        <span className="mnav-name">{name}</span>
        {sub && <span className="mnav-sub">{sub}</span>}
      </span>
      <button type="button" className="mnav-close" aria-label="Close menu" onClick={drawer.close}>
        &#10005;
      </button>
    </div>
  )
}
