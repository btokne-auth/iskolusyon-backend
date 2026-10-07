// Oct 7 2026 (manuscript Ch. 3: Session Management Testing, CSRF Testing,
// Cybersecurity Principles: "token expiration and secure cookie handling",
// "protections against cross-site request forgery ... on all state-changing
// actions").
//
// One place for the session and CSRF rules, shared by the server (proxy.js,
// adminAuth.js, applicantAuth.js) and the browser (SecurityGuard.js). No
// Node-only imports here, so both sides can use it.

// How long a signed-in person may stay idle before the session ends, and the
// longest a session can last even while active. Chosen by Pau, Oct 7 2026.
export const ADMIN_IDLE_SECONDS = 30 * 60 // 30 minutes
export const ADMIN_MAX_SECONDS = 8 * 60 * 60 // 8 hours (unchanged)
export const APPLICANT_IDLE_SECONDS = 60 * 60 // 60 minutes
export const APPLICANT_MAX_SECONDS = 12 * 60 * 60 // 12 hours (was 7 days)

// The server re-stamps "last active" at most once a minute.
export const REFRESH_AFTER_SECONDS = 60

// The browser sends this header only when the person actually clicked,
// typed or scrolled within the last minute. Background refreshes (the 5
// second lock check, the live Activity Log) don't send it, so they can't
// keep an abandoned session alive forever.
export const ACTIVITY_HEADER = 'x-user-active'
export const ACTIVITY_WINDOW_SECONDS = 60

// Anti-CSRF token ("double submit"): a random value kept in a cookie that
// only pages on iskolusyon.dev can read. Every POST/PUT/PATCH/DELETE must
// repeat it in this header. Another website can make a browser SEND our
// cookies, but it can never READ them, so it can't copy the value into the
// header, and its forged request is refused.
export const CSRF_COOKIE_NAME = 'iskolusyon_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

// payload.iat = when the person signed in, payload.la = last activity.
// Both in seconds. Sessions from before Oct 7 2026 have neither, so they
// fail here and the person signs in once more.
export function sessionTimeProblem(payload, idleSeconds, maxSeconds, now = nowSeconds()) {
  if (!payload || typeof payload.iat !== 'number' || typeof payload.la !== 'number') return 'old'
  if (now - payload.iat > maxSeconds) return 'max'
  if (now - payload.la > idleSeconds) return 'idle'
  return null
}

// Constant-time string comparison (does not stop early on the first
// different character, so timing can't reveal how much of a token matched).
export function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
