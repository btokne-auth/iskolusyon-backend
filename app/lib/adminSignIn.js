// Oct 7 2026: the shared second step of every console sign-in (manuscript
// Ch. 3, MFA). Used by /api/admin-login after the right password and by
// /api/admin-change-password after a new admin sets their own password, so
// nobody (not even the Super Admin who saw a temporary password) reaches
// the console without the code from the account's own inbox.

import { NextResponse } from 'next/server'
import { ADMIN_MFA_COOKIE_NAME, createMfaCookieValue } from '@/app/lib/adminAuth'
import { ADMIN_CODE_TTL_MINUTES, issueAdminLoginCode, maskEmail } from '@/app/lib/adminAccounts'
import { sendAdminLoginCodeEmail } from '@/app/lib/adminEmails'

export function mfaCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

// Emails a fresh code and returns the reply that moves the page to the
// code step (or an error reply if the email could not be sent).
export async function startCodeStep(account, extra = {}) {
  const code = await issueAdminLoginCode(account.email)
  const sent = await sendAdminLoginCodeEmail({
    name: account.name,
    email: account.email,
    code,
    minutes: ADMIN_CODE_TTL_MINUTES,
  })
  if (sent.error) return NextResponse.json({ error: sent.error }, { status: 502 })

  const mfa = await createMfaCookieValue(account.email)
  const res = NextResponse.json({
    success: true,
    requiresCode: true,
    sentTo: maskEmail(account.email),
    minutes: ADMIN_CODE_TTL_MINUTES,
    ...extra,
  })
  res.cookies.set(ADMIN_MFA_COOKIE_NAME, mfa.value, mfaCookieOptions(mfa.maxAge))
  return res
}
