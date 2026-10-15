// Oct 5 2026: CHED Form 3, "Free Higher Education Billing Details"
// (admission fees, Section 7, Rule II of the IRR of RA 10931). Progress Table
// row 79, Exportable Reports for LGU.
//
// Columns follow CCC's own Form 3 (manuscript Appendix K) and Ivy's Patch 5
// export: Sequence Number, Last Name, Given Name, Middle Name, Sex at Birth
// (M/F), Birthdate (mm/dd/yyyy), Degree Program, Year Level, Email Address,
// Phone Number, Entrance/Admission Fees, Remarks. Like Appendix K, rows are
// sorted A to Z by last name with passed and failed rows mixed.
//
// Who is included: everyone with a pass/fail exam result, plus Qualified
// (Probationary) scholars. Remarks (Pau, Oct 5 2026): Passers and Qualified
// (Probationary) scholars count as passed; "passed-enrolled" once their
// Distribution Status reached Enrollment complete, otherwise "passed-did not
// enrol". Everyone else with a failing exam result is "failed". Applicants
// marked Absent or with no exam result yet are left out. Archived applicants
// are left out.

import { supabase } from '@/app/supabaseClient'
import { decryptText } from '@/app/lib/fieldCrypto'

export const ADMISSION_FEE = 200

const PASSED_STATUSES = new Set(['passer', 'qualified_probationary'])

function clean(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
}

// YYYY-MM-DD (or anything Date can read) -> mm/dd/yyyy.
export function formatBirthdate(value) {
  const v = clean(value)
  if (!v) return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[2]}/${m[3]}/${m[1]}`
  const d = new Date(v)
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  }
  return v
}

function sexLetter(value) {
  const v = clean(value).toLowerCase()
  if (v.startsWith('m')) return 'M'
  if (v.startsWith('f')) return 'F'
  return ''
}

function splitName(fullName) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export function remarkFor(app) {
  // Oct 6 2026: a passing score in a BSEd Math/Science 1st choice that rule a
  // closes (Appendix J p. 96) leaves the applicant Waitlisted until
  // re-evaluated, so it doesn't count as passed here.
  const passed =
    PASSED_STATUSES.has(app.scholar_status) || (app.exam_result === 'passed' && app.scholar_status !== 'waitlisted_probationary')
  if (!passed) return 'failed'
  return app.distribution_status === 'enrollment_complete' ? 'passed-enrolled' : 'passed-did not enrol'
}

// Oct 15 2026: the Activity Log text written on each Form 3 download
// (app/api/ched-form3). The end-of-cycle archive looks for it.
export const FORM3_DOWNLOAD_PREFIX = 'Downloaded CHED Form 3'

// Returns { rows, counts, leftOut }.
export async function buildForm3Rows() {
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, applicant_name, applicant_email, application_number, first_name, middle_name, last_name, suffix, sex, date_of_birth, contact_number, ' +
        'program_choice_1, admitted_program, exam_result, scholar_status, distribution_status'
    )
    .is('archived_at', null)
  if (error) throw new Error(error.message)

  const included = []
  let leftOut = 0
  for (const app of data || []) {
    const inList = app.exam_result === 'passed' || app.exam_result === 'failed' || PASSED_STATUSES.has(app.scholar_status)
    if (!inList) {
      leftOut += 1
      continue
    }
    const fallback = splitName(app.applicant_name)
    const last = clean(app.last_name) || fallback.last
    const suffix = clean(app.suffix)
    included.push({
      applicationNumber: clean(app.application_number),
      lastName: suffix ? `${last} ${suffix}` : last,
      givenName: clean(app.first_name) || fallback.first,
      middleName: clean(app.middle_name),
      sex: sexLetter(app.sex),
      birthdate: formatBirthdate(app.date_of_birth),
      // Oct 6 2026: Degree Program = the program admitted in (re-evaluated, Appendix J rule b), else the 1st choice.
      program: clean(app.admitted_program || app.program_choice_1),
      yearLevel: 'New',
      email: clean(app.applicant_email),
      phone: clean(decryptText(app.contact_number)), // Oct 7 2026: stored encrypted
      fee: ADMISSION_FEE,
      remarks: remarkFor(app),
    })
  }

  // Oct 15 2026 (client): rows follow the application number (the order
  // applicants submitted), not A-Z. Rows without a number go last, A-Z.
  included.sort((a, b) => {
    if (a.applicationNumber && b.applicationNumber) {
      return a.applicationNumber.localeCompare(b.applicationNumber, 'en', { numeric: true })
    }
    if (a.applicationNumber) return -1
    if (b.applicationNumber) return 1
    return (
      a.lastName.localeCompare(b.lastName, 'en', { sensitivity: 'base' }) ||
      a.givenName.localeCompare(b.givenName, 'en', { sensitivity: 'base' })
    )
  })
  const rows = included.map((r, i) => ({ seq: i + 1, ...r }))

  const counts = { 'passed-enrolled': 0, 'passed-did not enrol': 0, failed: 0 }
  for (const r of rows) counts[r.remarks] += 1
  return { rows, counts, leftOut }
}
