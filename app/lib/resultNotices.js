// Wording and sending for the exam result notice (Sept 30 2026, item 5,
// "Real-time Result Notifications").
//
// The drafts below are only STARTING TEXT: the admin sees them in a confirm
// box and can edit the subject and message before anything is sent. They
// follow CCC's own Appendix J (Admission Procedures steps 5 to 7, Section
// VI.b, Section V.g) and the Appendix D interviews. Wording still needs the
// client's approval before it goes to real applicants.
//
// Two rules on purpose:
//  - The disqualified notice never states a reason. Appendix J step 6 ties
//    disqualification to drug-test and medical results, which must never be
//    written into an email or portal message.
//  - pending_exam has no notice: nothing has been decided yet.

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Iskolusyon <noreply@iskolusyon.dev>'

export const RELEASABLE_STATUSES = new Set([
  'passer',
  'waitlisted_probationary',
  'qualified_probationary',
  'forfeited',
  'disqualified',
])

const OFFICE_LINE = 'For questions, you may email admissions@ccc.edu.ph.'
const WATCH_LINE = 'Please also watch the CCC Official Facebook Page and the Messages tab of the Iskolusyon portal for updates.'

export function buildResultDraft({ status, name, program }) {
  const who = (name || 'Applicant').trim()
  const prog = (program || 'your chosen program').trim()

  switch (status) {
    case 'passer':
      return {
        subject: 'CCC Scholarship Application Result: Passed',
        message: [
          `Good news, ${who}. Based on your entrance examination result, you have PASSED for ${prog}.`,
          'What to do next:',
          '1. You will be endorsed for the medical examination at CCC Health Services.',
          '2. After that, fill out the pre-registration link and submit the requirements of the Office of the College Registrar within the given deadline. Unjustified delays may cause your slot to be given to the next qualified candidate on the waiting list.',
          `${WATCH_LINE} ${OFFICE_LINE}`,
        ].join('\n\n'),
      }
    case 'waitlisted_probationary':
      return {
        subject: 'CCC Scholarship Application Result: Waitlisted (Probationary)',
        message: [
          `Hello ${who}. Thank you for taking the entrance examination. You are currently WAITLISTED (PROBATIONARY) for ${prog}.`,
          'This is not a rejection. Waitlisted applicants are ranked by entrance examination score, and you will be moved up if a slot becomes available. We will message you here if that happens. CCC may also consider you for another program based on your examination result.',
          `${WATCH_LINE} ${OFFICE_LINE}`,
        ].join('\n\n'),
      }
    case 'qualified_probationary':
      return {
        subject: 'CCC Scholarship Application Result: Qualified (Probationary)',
        message: [
          `Hello ${who}. You are QUALIFIED (PROBATIONARY) for ${prog}.`,
          'Please go to the CCC office to sign the probationary contract. The terms will be explained to you there.',
          `${WATCH_LINE} ${OFFICE_LINE}`,
        ].join('\n\n'),
      }
    case 'forfeited':
      return {
        subject: 'CCC Scholarship Application Update: Forfeited',
        message: [
          `Hello ${who}. Our records show that you did not attend your scheduled entrance examination, so your application has been marked FORFEITED.`,
          'If you had a valid reason for being absent, please contact the CCC Guidance Office and bring your supporting documents.',
          OFFICE_LINE,
        ].join('\n\n'),
      }
    case 'disqualified':
      return {
        subject: 'CCC Scholarship Application Update: Disqualified',
        message: [
          `Hello ${who}. After review, you no longer qualify for the CCC scholarship program, so your application has been marked DISQUALIFIED.`,
          `If you have questions about this result, please contact the CCC Guidance Office. ${OFFICE_LINE}`,
        ].join('\n\n'),
      }
    default:
      return null
  }
}

// Sept 30 2026: endorsement notices, sent as an applicant moves through
// Distribution Status (Appendix D: Registrar, Medical, Admissions, then
// enrollment; Appendix J steps 6 and 7). Starting text only, editable by the
// admin, and still needs the client's approval. Like the disqualified
// result notice, none of these ever mention medical or drug-test findings.
export const ENDORSEMENT_STEPS = new Set(['endorsed_registrar', 'endorsed_medical', 'endorsed_admissions', 'enrollment_complete'])

export function buildEndorsementDraft({ step, name }) {
  const who = (name || 'Applicant').trim()
  const closing = `${WATCH_LINE} ${OFFICE_LINE}`
  switch (step) {
    case 'endorsed_registrar':
      return {
        subject: 'CCC Scholarship: Endorsed to the Office of the College Registrar',
        message: [
          `Good day, ${who}. You have been endorsed to the Office of the College Registrar.`,
          'Please fill out the pre-registration link and submit the requirements of the Office of the College Registrar within the given deadline. Unjustified delays may cause your slot to be given to the next qualified candidate on the waiting list.',
          closing,
        ].join('\n\n'),
      }
    case 'endorsed_medical':
      return {
        subject: 'CCC Scholarship: Endorsed for Medical Examination',
        message: [
          `Good day, ${who}. You have been endorsed to CCC Health Services for your medical examination.`,
          'Please follow the instructions and schedule given by CCC Health Services.',
          closing,
        ].join('\n\n'),
      }
    case 'endorsed_admissions':
      return {
        subject: 'CCC Scholarship: Endorsed to the Admissions Office',
        message: [
          `Good day, ${who}. You have been endorsed to the Admissions Office for the next step of your enrollment.`,
          'Please follow the instructions of the Admissions Office within the given deadline.',
          closing,
        ].join('\n\n'),
      }
    case 'enrollment_complete':
      return {
        subject: 'CCC Scholarship: Enrollment Complete',
        message: [
          `Congratulations, ${who}! Your enrollment as a CCC scholar is complete.`,
          'Welcome to City College of Calamba.',
          closing,
        ].join('\n\n'),
      }
    default:
      return null
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Returns { success: true } or { error }, never throws, so a failed email
// never undoes the private portal message that was already posted.
export async function sendResultEmail({ to, subject, message }) {
  const paragraphs = String(message)
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: `${paragraphs}<p>City College of Calamba, Iskolusyon Scholarship System</p>`,
    })
    if (result?.error) return { error: result.error.message || 'Email could not be sent.' }
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}
