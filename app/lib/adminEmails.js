// Emails for the admin invite flow (Sept 29, 2026). Same Resend setup as
// the applicant emails in applicantAccounts.js: iskolusyon.dev is a
// verified sending domain, so these can reach any inbox.

import { Resend } from 'resend'
import { TEMP_PASSWORD_DAYS, formatAccessDate } from '@/app/lib/adminAccounts'
import { safeErrorText } from '@/app/lib/safeError'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Iskolusyon <noreply@iskolusyon.dev>'

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// kind: 'invite' for a new account, 'reset' when a Super Admin resets an
// existing admin's password. Returns { success } or { error }, never
// throws, so a failed email never undoes the account change itself.
// Oct 5 2026: role can also be 'registrar' or 'lgu'. LGU invites mention
// what the account is for and its access dates.
const ROLE_PHRASE = {
  super_admin: 'a Super Admin',
  admin: 'an Admin',
  registrar: 'the Office of the Registrar',
  lgu: 'a view-only LGU account',
}

export async function sendAdminTempPasswordEmail({ kind, name, email, role, accessFrom, accessUntil, tempPassword, loginUrl, invitedBy }) {
  const isReset = kind === 'reset'
  const subject = isReset
    ? 'Your Iskolusyon admin password was reset'
    : "You've been invited to the Iskolusyon Admin Console"

  const intro = isReset
    ? `${escapeHtml(invitedBy)} reset the password for your Iskolusyon admin account.`
    : `${escapeHtml(invitedBy)} added you to the Iskolusyon Admin Console as ${ROLE_PHRASE[role] || 'an Admin'}.`

  const lguNote =
    role === 'lgu' && accessFrom && accessUntil
      ? `<p>This account can view and download reports City College of Calamba releases to the LGU. You can sign in from ${escapeHtml(
          formatAccessDate(accessFrom)
        )} to ${escapeHtml(formatAccessDate(accessUntil))}.</p>`
      : ''

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>${intro}</p>
        ${lguNote}
        <p>Sign in with this temporary password:</p>
        <p style="font-size:22px;font-weight:800;letter-spacing:2px;font-family:monospace;">${escapeHtml(tempPassword)}</p>
        <p>
          Sign in at <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> using this email address.
          You'll be asked to choose your own password right away.
        </p>
        <p>This temporary password stops working in ${TEMP_PASSWORD_DAYS} days. If it expires, ask a Super Admin to send a new one.</p>
        <p>If you weren't expecting this email, you can ignore it.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
    // Resend reports most failures in the result instead of throwing.
    if (result?.error) return { error: result.error.message || 'Email could not be sent.' }
    return { success: true }
  } catch (err) {
    return { error: safeErrorText(err, 'adminEmails') }
  }
}

// Oct 7 2026: the emailed sign-in code (second step of the admin sign-in).
export async function sendAdminLoginCodeEmail({ name, email, code, minutes }) {
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your Iskolusyon Admin Console sign-in code',
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Your sign-in code for the Iskolusyon Admin Console is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${escapeHtml(code)}</p>
        <p>This code expires in ${minutes} minutes and works only once.</p>
        <p>If you didn't just try to sign in, someone may know your password. Sign in and ask a Super Admin to reset it.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
    if (result?.error) return { error: 'The sign-in code could not be emailed. Please try again in a moment.' }
    return { success: true }
  } catch (err) {
    return { error: safeErrorText(err, 'adminEmails login code') }
  }
}
