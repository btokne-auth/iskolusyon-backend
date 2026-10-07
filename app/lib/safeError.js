// Oct 7 2026 (manuscript Ch. 3, Security Misconfiguration Testing: "overly
// verbose error messages that reveal system internals").
//
// Before this, most API routes answered a server failure with the raw
// database or library message, e.g. 'duplicate key value violates unique
// constraint "applications_pkey"' or 'relation "x" does not exist'. Those
// tell an attacker table names, column names and which libraries we run.
//
// Now the full error is written to the server log (Vercel > Logs) for us,
// and the browser only gets a plain message plus a short reference code that
// matches the log line, so a real problem can still be traced.

import { NextResponse } from 'next/server'

export const GENERIC_ERROR = 'Something went wrong on our side. Please try again in a moment.'

function refCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// Logs the real error and returns the reference code.
export function logServerError(err, where = 'api') {
  const ref = refCode()
  console.error(`[${where}] ref ${ref}:`, err)
  return ref
}

// A 500 reply that never includes the internal message.
export function serverError(err, where = 'api', extra = {}) {
  const ref = logServerError(err, where)
  return NextResponse.json({ error: `${GENERIC_ERROR} (Ref: ${ref})`, ...extra }, { status: 500 })
}

// For library helpers that return { error } instead of throwing.
export function safeErrorText(err, where = 'lib') {
  const ref = logServerError(err, where)
  return `${GENERIC_ERROR} (Ref: ${ref})`
}
