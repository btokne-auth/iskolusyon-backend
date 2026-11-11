import { docState } from './documentState'
import { TRANSFEREE_MAX_GWA, TRANSFEREE_MIN_UNITS } from './matching'

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

// Screening answers that lock once Educational Background is submitted.
// Corrections go through the Guidance Office (an admin can edit them).
export const SCREENING_LOCKED_COLUMNS = ['applying_as', 'shs_failing_grade', 'transferee_gwa', 'transferee_units_passed', 'transferee_failing_grade']

export const SCREENING_STAGE2_MESSAGE =
  'Please finish the eligibility screening first: submit your Educational Background and upload your report card (Form 138). The rest of the application opens once you pass it.'

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
    return { state: 'not_started', stage2Open: false, reasons: ['Submit your Educational Background to take the eligibility screening.'] }
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
  if (!card) return { state: 'pending', stage2Open: false, reasons: ['Upload your report card (Form 138 / proof of grades).'] }
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
