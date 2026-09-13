// ---------- Placeholder "Collaborative Shared Account" auth ----------
//
// The whole team shares ONE passcode (ADMIN_ACCESS_CODE, set in .env.local).
// Logging in also asks for a display name, which rides along in the signed
// cookie below — so audit_log entries can say "Jhudiel" or "Ivy" instead of
// always saying "System". There is still only one real identity here, not
// individual accounts with individual permissions.
//
// THIS IS NOT REAL ACCESS CONTROL. It exists so /admin isn't wide open
// while the User Account Module doesn't exist yet. Once that module lands,
// this whole file (and middleware.js's use of it) should be replaced with
// real per-user auth, and the "Super Admin override" checks in
// app/api/documents/[id]/override/route.js should be re-scoped to actual
// roles instead of "anyone who knows the shared passcode."
//
// Written using the Web Crypto API (globalThis.crypto.subtle) instead of
// Node's `crypto` module so the exact same code works both in normal route
// handlers and in middleware.js (which can run on the Edge runtime, where
// Node's `crypto`/`Buffer` aren't available).

export const ADMIN_COOKIE_NAME = 'iskolusyon_admin'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8 // 8-hour session

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

// Builds a signed cookie value "<base64url(name)>.<hmac-hex>" so the browser
// can't just hand-edit the cookie to claim a different display name.
export async function createAdminCookieValue(name) {
  const secret = getSecret()
  const encodedName = toBase64Url(name)
  const signature = await hmacHex(encodedName, secret)
  return { value: `${encodedName}.${signature}`, maxAge: COOKIE_MAX_AGE_SECONDS }
}

// Verifies a cookie value and returns the admin's display name, or null if
// the cookie is missing, malformed, or doesn't match (tampered, expired
// secret rotation, etc).
export async function verifyAdminCookieValue(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null
  const [encodedName, signature] = cookieValue.split('.')
  if (!encodedName || !signature) return null

  try {
    const secret = getSecret()
    const expected = await hmacHex(encodedName, secret)
    if (expected.length !== signature.length) return null
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    if (mismatch !== 0) return null
    return fromBase64Url(encodedName)
  } catch {
    return null
  }
}