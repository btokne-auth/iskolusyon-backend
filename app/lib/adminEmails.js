// Emails for the admin invite flow (Sept 29, 2026). Same Resend setup as
// the applicant emails in applicantAccounts.js: iskolusyon.dev is a
// verified sending domain, so these can reach any inbox.

import { Resend } from 'resend'
import { TEMP_PASSWORD_DAYS } from '@/app/lib/adminAccounts'

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
export async function sendAdminTempPasswordEmail({ kind, name, email, role, tempPassword, loginUrl, invitedBy }) {
  const isReset = kind === 'reset'
  const subject = isReset
    ? 'Your Iskolusyon admin password was reset'
    : "You've been invited to the Iskolusyon Admin Console"

  const intro = isReset
    ? `${escapeHtml(invitedBy)} reset the password for your Iskolusyon admin account.`
    : `${escapeHtml(invitedBy)} added you to the Iskolusyon Admin Console as ${role === 'super_admin' ? 'a Super Admin' : 'an Admin'}.`

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>${intro}</p>
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
    return { error: err.message }
  }
}
