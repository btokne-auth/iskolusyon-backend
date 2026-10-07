// Exam Schedule Alerts (Sept 30 2026, Notifications Module).
//
// Rules, from the client interview (Appendix D, interview #2):
//  - the first 100 submissions form the first batch; past 100, another
//    batch opens on a different day,
//  - CCC also posts the schedule on its Facebook page,
//  - an applicant who does not attend forfeits.
// The draft text below is only starting text: the admin can edit it before
// sending, and it still needs the client's approval before real use.

import { Resend } from 'resend'
import { safeErrorText } from '@/app/lib/safeError'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Iskolusyon <noreply@iskolusyon.dev>'

export const BATCH_SIZE = 100

// Who can be put in an exam batch: submitted, passes every eligibility rule
// the system can check (pending_exam), no result yet, not in a batch.
export function isSchedulable(app) {
  const eligibility = app.eligibility_override || app.eligibility_status || 'incomplete'
  return (
    app.status === 'submitted' &&
    eligibility === 'pending_exam' &&
    (!app.scholar_status || app.scholar_status === 'pending_exam') &&
    !app.exam_schedule_id
  )
}

export function formatExamDate(isoDate) {
  if (!isoDate) return ''
  try {
    return new Date(`${isoDate}T00:00:00+08:00`).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    })
  } catch {
    return isoDate
  }
}

export function buildScheduleDraft(schedule) {
  const lines = [
    `Good day! Your CCC scholarship entrance examination (${schedule.batch_label}) is scheduled as follows:`,
    [
      `Date: ${formatExamDate(schedule.exam_date)}`,
      schedule.exam_time ? `Time: ${schedule.exam_time}` : null,
      schedule.venue ? `Venue: ${schedule.venue}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  ]
  if (schedule.notes) lines.push(schedule.notes)
  lines.push(
    'Applicants who do not attend their scheduled examination forfeit their application. If you cannot attend for a valid reason, send a rescheduling request from the Appeals & Rescheduling tab of the Iskolusyon portal and contact the Guidance Office with your supporting documents.'
  )
  lines.push(
    'Please also watch the CCC Official Facebook Page and the Messages tab of the Iskolusyon portal for updates. For questions, you may email admissions@ccc.edu.ph.'
  )
  return {
    subject: `CCC Scholarship Entrance Examination Schedule (${schedule.batch_label})`,
    message: lines.join('\n\n'),
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toHtml(message) {
  const paragraphs = String(message)
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
  return `${paragraphs}<p>City College of Calamba, Iskolusyon Scholarship System</p>`
}

// Sends one email per address using Resend's batch endpoint (up to 100 per
// call), so a whole batch goes out in one request instead of 100 slow ones.
// Never throws. Returns { sent, failed, error? }.
export async function sendScheduleEmails(addresses, { subject, message }) {
  if (addresses.length === 0) return { sent: 0, failed: 0 }
  const html = toHtml(message)
  try {
    const result = await resend.batch.send(
      addresses.map((to) => ({ from: EMAIL_FROM, to, subject, html }))
    )
    if (result?.error) {
      return { sent: 0, failed: addresses.length, error: result.error.message || 'Emails could not be sent.' }
    }
    return { sent: addresses.length, failed: 0 }
  } catch (err) {
    return { sent: 0, failed: addresses.length, error: safeErrorText(err, 'examSchedules email') }
  }
}
