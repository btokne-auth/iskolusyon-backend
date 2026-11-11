import { docState } from './documentState'
import { TRANSFEREE_MAX_GWA, TRANSFEREE_MIN_UNITS } from './matching'

// The most units a transferee can realistically have passed (a full
// bachelor's program is usually 150 to 200 units). Stops typos like 999.
export const TRANSFEREE_MAX_UNITS = 250

// Appendix J, Transferees, rule 4.
export const TRANSFEREE_EXCEPTION_NOTE = 'Exceptional cases (grades of 5.0, dropped, INC) are decided case by case by the Program Director (Appendix J, Transferees). Visit the GCTCDO, 1st Floor, Admin Building.'

// Nov 2026 (panel revisions, priority 4 / S4 / S2 / S3): a two-stage
// application. Eligibility is screened FIRST, and the lengthy personal,
// family and financial details are only asked for once it is passed:
//
//   Stage 1, eligibility screening
//     - residency + Voter's ID: already proven at sign-up
//       (app/api/signup-residency-check)
//     - Educational Background: applying as, programs, and academic standing
//         First Year:  "Any grade below 75 in your latest SHS report card?"
//                      (client interview, Appendix B: "Hindi natanggap ng
//                      bagsak")
//         Transferee:  GWA 2.25 or better, 26+ units, no failing grade
//                      (Appendix J, Transferees)
//         Old Curriculum / ALS completer: no grade question; staff check
//                      the proof of grades
//     - the Form 138 / proof of grades uploaded and through the system check
//   Stage 2, full application (opens only after Stage 1 is passed)
//     - Personal Information, Family & Financial Information, and their
//       documents
//
// Applications that were already further along before this change
// (Personal Information or Family & Financial submitted, or the whole
// application submitted) are not locked out.
//
// Shared by the portal (what is shown/locked), /api/application (what is
// saved) and /api/upload (which documents are accepted), so all three agree.

// Documents that belong to Stage 2.
export const STAGE2_DOC_TYPES = ['profilepic', 'birthcert', 'employmentcert', 'indigency', 'supportdoc', 'medcert']

// Screening answers, given at sign-up, that can't be changed afterwards
// (an answer never given, e.g. on an older application, can be filled in
// once). Corrections go through the Guidance Office (an admin can edit them).
export const SCREENING_LOCKED_COLUMNS = ['applying_as', 'shs_failing_grade', 'transferee_gwa', 'transferee_units_passed', 'transferee_failing_grade']

export const SCREENING_STAGE2_MESSAGE =
  'Please finish the eligibility screening first: submit your Educational Background and upload your report card (Form 138). The rest of the application opens once you pass it.'

// Nov 2026: the academic screening at SIGN-UP, next to the residency check
// (panel revisions S3 "a quick eligibility check before sign-up", S4 "do not
// create a permanent database account just to apply"). Runs in the browser
// and again on the server before the account is created.
// a: { applyingAs, shsFailingGrade, transfereeGwa, transfereeUnitsPassed, transfereeFailingGrade }
// Returns { complete, passed, reasons }.
export const SCREENING_ANSWER_KEYS = ['applyingAs', 'shsFailingGrade', 'transfereeGwa', 'transfereeUnitsPassed', 'transfereeFailingGrade']
export function signupScreening(a = {}) {
  const as = String(a.applyingAs || '')
  if (!['First Year', 'Transferee', 'Old Curriculum and ALS Completer'].includes(as)) return { complete: false, passed: false, reasons: [] }
  const reasons = []
  if (as === 'First Year') {
    if (!['Yes', 'No'].includes(a.shsFailingGrade)) return { complete: false, passed: false, reasons: [] }
    if (a.shsFailingGrade === 'Yes') reasons.push('Applicants with a grade below 75 in their Senior High report card are not accepted.')
  }
  if (as === 'Transferee') {
    const gwaText = String(a.transfereeGwa ?? '').trim()
    const unitsText = String(a.transfereeUnitsPassed ?? '').trim()
    const gwa = Number(gwaText)
    const units = Number(unitsText)
    if (!gwaText || !unitsText || !['Yes', 'No'].includes(a.transfereeFailingGrade)) return { complete: false, passed: false, reasons: [] }
    if (!/^\d(\.\d{1,2})?$/.test(gwaText) || gwa < 1 || gwa > 5) return { complete: false, passed: false, reasons: [], invalid: 'GWA must be between 1.00 and 5.00 (e.g. 1.75).' }
    if (!/^\d{1,3}$/.test(unitsText) || units > TRANSFEREE_MAX_UNITS) return { complete: false, passed: false, reasons: [], invalid: `Units passed must be a whole number from 0 to ${TRANSFEREE_MAX_UNITS}.` }
    if (gwa > TRANSFEREE_MAX_GWA) reasons.push(`A GWA of ${gwaText} does not meet the required 2.25 or better (Appendix J, Transferees).`)
    if (units < TRANSFEREE_MIN_UNITS) reasons.push(`${units} units passed; at least 26 are required (Appendix J, Transferees).`)
    if (a.transfereeFailingGrade === 'Yes') reasons.push('Transferees with a failing grade in a previous semester are not accepted (Appendix J, Transferees).')
    if (reasons.length) reasons.push(TRANSFEREE_EXCEPTION_NOTE)
  }
  return { complete: true, passed: reasons.length === 0, reasons }
}

export function isGrandfathered(row) {
  return !!(row?.personal_info_submitted_at || row?.fam_financial_submitted_at || row?.status === 'submitted')
}

function latestOfType(docs, type) {
  return (docs || [])
    .filter((d) => d?.document_type === type)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
}

// row: the application row (or the same fields from the portal's state).
// docs: the applicant's documents (document_type, created_at, needs_review,
// review_status, staff_confirmed_at).
// Returns { state, stage2Open, reasons }:
//   state 'not_started' | 'pending' | 'failed' | 'passed'
export function screeningResult(row, docs) {
  if (isGrandfathered(row)) return { state: 'passed', stage2Open: true, grandfathered: true, reasons: [] }
  if (!row?.academic_submitted_at) {
    return { state: 'not_started', stage2Open: false, reasons: ['Upload your report card (Form 138) and submit your Educational Background to confirm your eligibility.'] }
  }

  const reasons = []
  if (row.applying_as === 'Transferee') {
    const gwa = row.transferee_gwa
    const units = row.transferee_units_passed
    if (gwa != null && gwa !== '' && Number(gwa) > TRANSFEREE_MAX_GWA) {
      reasons.push(`Your GWA of ${gwa} does not meet the required 2.25 or better (Appendix J, Transferees).`)
    }
    if (units != null && units !== '' && Number(units) < TRANSFEREE_MIN_UNITS) {
      reasons.push(`You have passed ${units} units; at least 26 are required (Appendix J, Transferees).`)
    }
    if (row.transferee_failing_grade === 'Yes') {
      reasons.push('You reported a failing grade in a previous semester (Appendix J, Transferees).')
    }
  } else if (row.applying_as === 'First Year' && row.shs_failing_grade === 'Yes') {
    reasons.push('You reported a grade below 75 in your Senior High report card. Applicants with a failing grade are not accepted.')
  }
  if (reasons.length) return { state: 'failed', stage2Open: false, reasons }

  const card = latestOfType(docs, 'form138')
  if (!card) {
    const what = row.applying_as === 'Transferee' ? 'transcript of records or certificate of grades' : 'report card (Form 138 / proof of grades)'
    return { state: 'pending', stage2Open: false, reasons: [`Upload your ${what}.`] }
  }
  const s = docState(card)
  if (s === 'processing') return { state: 'pending', stage2Open: false, reasons: ['Your report card is still being read. This usually takes a minute.'] }
  if (s === 'flagged') {
    return {
      state: 'pending',
      stage2Open: false,
      reasons: ['Your report card needs review. Upload a clearer copy, or wait for the Guidance Office to check it.'],
    }
  }
  return { state: 'passed', stage2Open: true, reasons: [] }
}
