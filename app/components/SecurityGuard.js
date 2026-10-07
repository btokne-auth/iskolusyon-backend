'use client'

// Oct 7 2026 (manuscript Ch. 3: CSRF Testing and Session Management Testing).
//
// Loaded once by app/layout.tsx on every page. It does three things:
//  1. Adds the anti-CSRF token (x-csrf-token, copied from the iskolusyon_csrf
//     cookie) to every POST/PUT/PATCH/DELETE this site sends to itself, so
//     none of the existing fetch() calls had to change. proxy.js refuses
//     those requests without it.
//  2. Marks requests made while the person is really using the page
//     (clicked, typed or scrolled in the last minute) with x-user-active, so
//     only real activity keeps a session alive. While someone types a long
//     answer without saving, a light check-in every few minutes keeps the
//     session alive too.
//  3. On the admin console (30 minutes) and the applicant portal (60
//     minutes), shows a warning one minute before the inactivity limit, then
//     signs the person out and sends them to the sign-in page with a note.
//     Activity in another tab of the same browser counts too.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ACTIVITY_HEADER,
  ACTIVITY_WINDOW_SECONDS,
  ADMIN_IDLE_SECONDS,
  APPLICANT_IDLE_SECONDS,
  CSRF_COOKIE_NAME,
  CSRF_HEADER,
} from '@/app/lib/sessionPolicy'

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SHARED_KEY = 'iskolusyon_last_activity'
const WARN_SECONDS = 60
const CHECK_IN_EVERY_MS = 4 * 60 * 1000

let lastActivity = Date.now()
let lastCheckIn = Date.now()

function readCookie(name) {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.split('; ').find((part) => part.startsWith(name + '='))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

// Normally proxy.js has already given the browser a token. If not (very
// first request), make one here; it works the same way.
function csrfToken() {
  let token = readCookie(CSRF_COOKIE_NAME)
  if (!token) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CSRF_COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; SameSite=Strict${secure}`
  }
  return token
}

function sharedLastActivity() {
  try {
    const v = Number(localStorage.getItem(SHARED_KEY))
    return Number.isFinite(v) && v > lastActivity ? v : lastActivity
  } catch {
    return lastActivity
  }
}

function noteActivity() {
  lastActivity = Date.now()
  try {
    localStorage.setItem(SHARED_KEY, String(lastActivity))
  } catch {}
}

function isActiveNow() {
  return Date.now() - sharedLastActivity() < ACTIVITY_WINDOW_SECONDS * 1000
}

function isSameOrigin(input) {
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
    if (!url) return false
    return new URL(url, location.href).origin === location.origin
  } catch {
    return false
  }
}

// Patch fetch once, as early as possible.
if (typeof window !== 'undefined' && !window.__iskolusyonFetchPatched) {
  window.__iskolusyonFetchPatched = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    if (!isSameOrigin(input)) return originalFetch(input, init)
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
    if (UNSAFE.has(method) && !headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, csrfToken())
    if (isActiveNow()) {
      headers.set(ACTIVITY_HEADER, '1')
      lastCheckIn = Date.now()
    }
    return originalFetch(input, { ...init, headers })
  }
}

function areaFor(pathname) {
  if (!pathname) return null
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/change-password')) return null
  if (pathname.startsWith('/admin')) {
    return {
      idle: ADMIN_IDLE_SECONDS,
      logout: '/api/admin-logout',
      session: '/api/admin-session',
      login: '/admin/login?expired=1',
    }
  }
  if (pathname.startsWith('/portal')) {
    return {
      idle: APPLICANT_IDLE_SECONDS,
      logout: '/api/applicant-logout',
      session: '/api/applicant-session',
      login: '/login?expired=1',
    }
  }
  return null
}

export default function SecurityGuard() {
  const pathname = usePathname()
  const area = areaFor(pathname)
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
    let lastNoted = 0
    const onActivity = () => {
      // At most a few times a second; scrolling fires very often.
      const now = Date.now()
      if (now - lastNoted < 2000) return
      lastNoted = now
      noteActivity()
    }
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }))
    return () => events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }))
  }, [])

  useEffect(() => {
    if (!area) {
      setSecondsLeft(null)
      return
    }
    noteActivity()
    let signingOut = false
    const tick = async () => {
      const idleFor = (Date.now() - sharedLastActivity()) / 1000
      const left = Math.ceil(area.idle - idleFor)

      if (left <= 0 && !signingOut) {
        signingOut = true
        try {
          await fetch(area.logout, { method: 'POST' })
        } catch {}
        window.location.href = area.login
        return
      }
      setSecondsLeft(left <= WARN_SECONDS ? left : null)

      // Typing a long answer without saving: tell the server we're still here.
      if (isActiveNow() && Date.now() - lastCheckIn > CHECK_IN_EVERY_MS) {
        lastCheckIn = Date.now()
        fetch(area.session, { cache: 'no-store' }).catch(() => {})
      }
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [area?.idle, area?.logout, area?.session, area?.login]) // eslint-disable-line react-hooks/exhaustive-deps

  if (secondsLeft === null) return null

  const staySignedIn = () => {
    noteActivity()
    lastCheckIn = Date.now()
    if (area) fetch(area.session, { cache: 'no-store' }).catch(() => {})
    setSecondsLeft(null)
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Session about to end"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(420px, calc(100vw - 32px))',
        background: '#fff',
        border: '1px solid #E0E6F0',
        borderLeft: '4px solid #E0A800',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(13,47,110,.18)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        fontFamily: 'var(--font-open-sans), sans-serif',
        color: '#2C3E50',
      }}
    >
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
        <strong style={{ display: 'block', color: '#0D2F6E', marginBottom: 2 }}>Still there?</strong>
        For your security you&apos;ll be signed out in {secondsLeft} second{secondsLeft === 1 ? '' : 's'} because
        there was no activity.
      </div>
      <button
        type="button"
        onClick={staySignedIn}
        style={{
          background: '#003CD0',
          color: '#fff',
          border: 0,
          borderRadius: 8,
          padding: '9px 14px',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Stay signed in
      </button>
    </div>
  )
}
