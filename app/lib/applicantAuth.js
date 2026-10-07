// ---------- Applicant session cookie ----------
//
// Real User Account Module auth (was Ivy's scope, per the roles doc —
// building it now since she isn't). Mirrors app/lib/adminAuth.js exactly:
// same signed-cookie approach (HMAC over a base64url JSON payload) written
// with the Web Crypto API so this file works both in normal Node route
// handlers and, if a middleware gate gets added later, on the Edge runtime.
//
// Deliberately scoped to email+password only for now — no per-login OTP
// (that's deferred until the .dev domain is claimed; Resend's free tier
// can't reach real applicant inboxes yet). Signup itself still requires a
// one-time email-verification code — see applicantAccounts.js.

import {
  APPLICANT_IDLE_SECONDS,
  APPLICANT_MAX_SECONDS,
  REFRESH_AFTER_SECONDS,
  nowSeconds,
  sessionTimeProblem,
} from './sessionPolicy'

export const APPLICANT_COOKIE_NAME = 'iskolusyon_applicant'
// Oct 7 2026: was a 7-day session that only the browser enforced. Now the
// server checks it too: 60 minutes of inactivity or 12 hours in total ends
// the session (Pau's choice; see app/lib/sessionPolicy.js). Saved sections
// stay saved, so signing in again just continues the form.
const COOKIE_MAX_AGE_SECONDS = APPLICANT_MAX_SECONDS

function getSecret() {
  const secret = process.env.APPLICANT_SESSION_SECRET
  if (!secret) {
    throw new Error('APPLICANT_SESSION_SECRET is not set in .env.local')
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

// Builds a signed cookie value "<base64url(json)>.<hmac-hex>" carrying the
// applicant's id, email, and display name (first + last, once known) so
// the portal can render "Welcome back, Juan" without a round trip.
export async function createApplicantCookieValue(accountId, email, displayName) {
  const secret = getSecret()
  const now = nowSeconds()
  const encodedPayload = toBase64Url(JSON.stringify({ id: accountId, e: email, n: displayName || '', iat: now, la: now }))
  const signature = await hmacHex(encodedPayload, secret)
  return { value: `${encodedPayload}.${signature}`, maxAge: COOKIE_MAX_AGE_SECONDS }
}

// Verifies a cookie value and returns { id, email, name }, or null if
// missing, malformed, or tampered.
export async function verifyApplicantCookieValue(cookieValue) {
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
    if (!payload || typeof payload.id !== 'string' || typeof payload.e !== 'string') return null
    if (sessionTimeProblem(payload, APPLICANT_IDLE_SECONDS, APPLICANT_MAX_SECONDS)) return null
    return { id: payload.id, email: payload.e, name: payload.n || '', _payload: payload }
  } catch {
    return null
  }
}

// Oct 7 2026: see refreshAdminCookieValue() in adminAuth.js.
export async function refreshApplicantCookieValue(cookieValue) {
  const session = await verifyApplicantCookieValue(cookieValue)
  if (!session) return null
  const payload = session._payload
  const now = nowSeconds()
  if (now - payload.la < REFRESH_AFTER_SECONDS) return null
  const encodedPayload = toBase64Url(JSON.stringify({ ...payload, la: now }))
  const signature = await hmacHex(encodedPayload, getSecret())
  const maxAge = Math.max(0, payload.iat + APPLICANT_MAX_SECONDS - now)
  return { value: `${encodedPayload}.${signature}`, maxAge }
}
