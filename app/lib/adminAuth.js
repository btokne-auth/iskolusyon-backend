// ---------- Placeholder "Collaborative Shared Account" auth ----------
//
// Individual per-admin login (email+password, see adminAccounts.js) has
// replaced the original shared passcode. There is still no real User
// Account Module / roles system — this file just signs a cookie so the
// browser can't hand-edit its own name or role.
//
// THIS IS NOT REAL ACCESS CONTROL. It exists so /admin isn't wide open
// while the User Account Module doesn't exist yet. Once that module lands,
// this whole file (and middleware.js's use of it) should be replaced with
// real per-user auth, and the "Super Admin override" checks in
// app/api/documents/[id]/override/route.js should be re-scoped to actual
// roles instead of "anyone who's signed in."
//
// Written using the Web Crypto API (globalThis.crypto.subtle) instead of
// Node's `crypto` module so the exact same code works both in normal route
// handlers and in middleware.js (which can run on the Edge runtime, where
// Node's `crypto`/`Buffer` aren't available).
//
// Sept 18, 2026 update: the cookie payload changed from a bare name to a
// small JSON object ({n: name, s: isSuperAdmin}) so the admin portal
// rebuild's sidebar can gate Super-Admin-only panels (Admin Accounts,
// System & Activity) without a second round-trip. Old cookies from before
// this change simply fail to parse and force a re-login — no migration
// needed, sessions are only 8 hours anyway.

import {
  ADMIN_IDLE_SECONDS,
  ADMIN_MAX_SECONDS,
  REFRESH_AFTER_SECONDS,
  nowSeconds,
  sessionTimeProblem,
} from './sessionPolicy'

export const ADMIN_COOKIE_NAME = 'iskolusyon_admin'
// Oct 7 2026: the 8-hour limit is now also checked on the server (payload
// `iat`), plus a 30-minute inactivity limit (payload `la`). Before this, the
// 8 hours only told the BROWSER when to drop the cookie; a copied cookie
// value kept working forever. See app/lib/sessionPolicy.js.
const COOKIE_MAX_AGE_SECONDS = ADMIN_MAX_SECONDS

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set in .env.local')
  }
  return secret
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64url) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (padded.length % 4)) % 4
  const binary = atob(padded + '='.repeat(padding))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toBase64Url(str) {
  return bytesToBase64Url(new TextEncoder().encode(str))
}

function fromBase64Url(str) {
  return new TextDecoder().decode(base64UrlToBytes(str))
}

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Builds a signed cookie value "<base64url(json)>.<hmac-hex>" so the
// browser can't just hand-edit the cookie to claim a different name or
// escalate to Super Admin.
//
// Sept 22, 2026: added the account's own email to the payload (was just
// n/s before) so the new Admin Accounts delete flow can tell "am I
// deleting my own currently-signed-in account" without a fragile
// name-based guess -- two admins could share a display name, emails are
// the actual unique key on admin_accounts. Same no-migration-needed
// story as the Sept 18 change: an old cookie without `e` just fails
// typeof-checking below and forces a re-login, and sessions are only
// 8 hours anyway.
//
// Oct 5 2026: limited roles. A Registrar or LGU (view only) session carries
// `r` in its payload. verifyAdminCookieFull() below REFUSES those sessions,
// so every existing admin page and /api route keeps working only for Admins
// and Super Admins without each route having to remember a new rule. The few
// routes built for the limited roles use verifyAnyAdminCookie() plus
// app/lib/adminRoles.js instead.
export const LIMITED_ROLES = new Set(['registrar', 'lgu'])

export async function createAdminCookieValue(name, isSuperAdmin, email, role) {
  const secret = getSecret()
  const now = nowSeconds()
  const payload = { n: name, s: !!isSuperAdmin, e: email, iat: now, la: now }
  if (LIMITED_ROLES.has(role)) {
    payload.s = false
    payload.r = role
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = await hmacHex(encodedPayload, secret)
  return { value: `${encodedPayload}.${signature}`, maxAge: COOKIE_MAX_AGE_SECONDS }
}

// Checks the signature and returns the raw payload, or null.
async function readSignedPayload(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null
  const [encodedPayload, signature] = cookieValue.split('.')
  if (!encodedPayload || !signature) return null

  try {
    const secret = getSecret()
    const expected = await hmacHex(encodedPayload, secret)
    if (expected.length !== signature.length) return null
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    if (mismatch !== 0) return null

    const payload = JSON.parse(fromBase64Url(encodedPayload))
    if (!payload || typeof payload.n !== 'string' || typeof payload.e !== 'string') return null
    // Oct 7 2026: signed in too long ago, or idle too long.
    if (sessionTimeProblem(payload, ADMIN_IDLE_SECONDS, ADMIN_MAX_SECONDS)) return null
    return payload
  } catch {
    return null
  }
}

// Oct 7 2026: called by proxy.js when the person is actually active. Returns
// a new cookie { value, maxAge } with "last active" moved to now, or null when
// the cookie is not valid or was refreshed less than a minute ago.
export async function refreshAdminCookieValue(cookieValue) {
  const payload = await readSignedPayload(cookieValue)
  if (!payload) return null
  const now = nowSeconds()
  if (now - payload.la < REFRESH_AFTER_SECONDS) return null
  const next = { ...payload, la: now }
  const encodedPayload = toBase64Url(JSON.stringify(next))
  const signature = await hmacHex(encodedPayload, getSecret())
  const maxAge = Math.max(0, payload.iat + ADMIN_MAX_SECONDS - now)
  return { value: `${encodedPayload}.${signature}`, maxAge }
}

// Verifies a cookie value and returns { name, isSuperAdmin, email }, or
// null if the cookie is missing, malformed, tampered, or from before the
// Sept 18 (role) / Sept 22 (email) payload-format changes.
// Oct 5 2026: also null for a Registrar or LGU session (see LIMITED_ROLES).
export async function verifyAdminCookieFull(cookieValue) {
  const payload = await readSignedPayload(cookieValue)
  if (!payload) return null
  if (payload.r !== undefined) return null
  return { name: payload.n, isSuperAdmin: !!payload.s, email: payload.e }
}

// Oct 5 2026: any signed-in console account, including the limited roles.
// Returns { name, isSuperAdmin, email, role } or null. Only the middleware,
// /api/admin-session and the routes built for the limited roles use this.
export async function verifyAnyAdminCookie(cookieValue) {
  const payload = await readSignedPayload(cookieValue)
  if (!payload) return null
  if (payload.r !== undefined && !LIMITED_ROLES.has(payload.r)) return null
  const role = payload.r || (payload.s ? 'super_admin' : 'admin')
  return { name: payload.n, isSuperAdmin: role === 'super_admin', email: payload.e, role }
}

// Back-compat convenience for callers (middleware.js, the override route)
// that only ever needed the display name, not the role.
export async function verifyAdminCookieValue(cookieValue) {
  const full = await verifyAdminCookieFull(cookieValue)
  return full ? full.name : null
}

// ---------- First sign-in on a temporary password (Sept 29, 2026) ----------
//
// An admin who signs in with a temporary password does NOT get the normal
// admin cookie. They get this short-lived cookie instead, which only
// allows one thing: choosing their own password at /admin/change-password.
// Its payload has no name (`n`), so verifyAdminCookieFull() rejects it and
// it can never open the admin console or any admin API.

export const ADMIN_PWCHANGE_COOKIE_NAME = 'iskolusyon_admin_pwchange'
const PWCHANGE_MAX_AGE_SECONDS = 60 * 15 // 15 minutes

export async function createPasswordChangeCookieValue(email, name) {
  const secret = getSecret()
  const encodedPayload = toBase64Url(JSON.stringify({ t: 'pwchange', e: email, d: name }))
  const signature = await hmacHex(encodedPayload, secret)
  return { value: `${encodedPayload}.${signature}`, maxAge: PWCHANGE_MAX_AGE_SECONDS }
}

// Returns { email, name } or null.
export async function verifyPasswordChangeCookie(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null
  const [encodedPayload, signature] = cookieValue.split('.')
  if (!encodedPayload || !signature) return null
  try {
    const secret = getSecret()
    const expected = await hmacHex(encodedPayload, secret)
    if (expected.length !== signature.length) return null
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    if (mismatch !== 0) return null
    const payload = JSON.parse(fromBase64Url(encodedPayload))
    if (!payload || payload.t !== 'pwchange' || typeof payload.e !== 'string') return null
    return { email: payload.e, name: typeof payload.d === 'string' ? payload.d : '' }
  } catch {
    return null
  }
}
