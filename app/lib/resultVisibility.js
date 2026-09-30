import { getSystemSettings } from '@/app/lib/systemSettings'

// Sept 30 2026: makes the "Exam Results Visible to Applicants" switch
// (System & Activity > Application Cycle Settings) actually do something.
//
// An applicant only ever sees a result when BOTH are true:
//   1. the switch is ON, and
//   2. an admin has released that applicant's result (Send Result to
//      Applicant in Applicant Results, which sets result_notified_at).
// So turning the switch on never reveals anyone who hasn't been released,
// and turning it off hides every result again at once.

// Fails closed: if the settings can't be read, results stay hidden.
export async function resultsVisible() {
  try {
    const settings = await getSystemSettings()
    return !!settings.exam_results_visible
  } catch (err) {
    console.error('Could not read exam_results_visible (hiding results):', err)
    return false
  }
}

// Admin-only bookkeeping, never sent to an applicant.
const INTERNAL_FIELDS = [
  'exam_verified_by',
  'exam_verified_at',
  'scholar_status_reason',
  'scholar_status_set_by',
  'scholar_status_set_at',
  'distribution_status_updated_by',
  'distribution_status_updated_at',
  'result_notified_by',
  'result_email_sent',
]

// Hidden until the result is visible and released.
const RESULT_FIELDS = [
  'exam_score',
  'exam_result',
  'exam_date',
  'scholar_status',
  'distribution_status',
  'result_notified_status',
  'result_notified_at',
]

// Returns a copy of an applications row that is safe to hand to the
// applicant themself. When released, scholar_status is what was actually
// sent to them (result_notified_status), not whatever an admin may have
// changed it to since, so the portal never shows an unsent status.
export function applicantSafeRow(row, visible) {
  if (!row) return row
  const safe = { ...row }
  for (const key of INTERNAL_FIELDS) delete safe[key]
  const released = visible && !!row.result_notified_at && !!row.result_notified_status
  if (released) {
    safe.scholar_status = row.result_notified_status
  } else {
    for (const key of RESULT_FIELDS) delete safe[key]
  }
  return safe
}
