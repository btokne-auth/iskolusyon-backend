import { deriveScholarStatus, bsedGradeBelow, suggestExamResult } from '@/app/lib/matching'

// Nov 2026 (panel revisions S7): one place that turns an exam entry into the
// database update, used by the one-by-one entry (PATCH /api/admin-results,
// field 'exam') and the CSV import (/api/admin-results/import), so both
// apply exactly the same rules.
export const EXAM_RESULT_VALUES = new Set(['passed', 'failed', 'absent'])

export function buildExamUpdate(existing, { score, examResult, examDate, adminName, now }) {
  let { status, reason } = deriveScholarStatus(examResult)
  // Appendix J p. 96 rule a: BSEd Mathematics / Science needs 85+ in every
  // SHS Mathematics and Science subject, whatever the score.
  if (status === 'passer' && bsedGradeBelow(existing.program_choice_1, existing)) {
    status = 'waitlisted_probationary'
    reason = `Passing score, but ${existing.program_choice_1} needs 85 or higher in every SHS Mathematics and Science subject (Appendix J, rule a). Re-evaluate in another program.`
  }
  return {
    status,
    update: {
      exam_score: score,
      exam_result: examResult || null,
      exam_date: examDate || null,
      exam_verified_by: adminName,
      exam_verified_at: now,
      scholar_status: status,
      scholar_status_reason: reason,
      scholar_status_set_by: adminName,
      scholar_status_set_at: now,
      // A new exam entry starts over: any earlier re-evaluation is cleared.
      admitted_program: null,
      admitted_program_set_by: null,
      admitted_program_set_at: null,
    },
  }
}

// Small CSV reader: commas, quoted values ("Dela Cruz, Juan"), "" inside
// quotes, CRLF or LF line ends. Returns an array of rows (arrays of strings).
export function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  const s = String(text || '').replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { value += '"'; i++ }
      else if (ch === '"') quoted = false
      else value += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(value); value = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(value); value = ''
      if (row.some((v) => v.trim() !== '')) rows.push(row)
      row = []
    } else value += ch
  }
  row.push(value)
  if (row.some((v) => v.trim() !== '')) rows.push(row)
  return rows
}

// "2026-11-21", "11/21/2026" -> "2026-11-21"; '' -> null; bad -> undefined.
export function csvDate(value) {
  const v = String(value || '').trim()
  if (!v) return null
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return undefined
}

// The result for a row: what the sheet says, or (score only) the result the
// 1st-choice program's passing grade gives, the same hint the manual entry
// shows.
export function csvResult(resultCell, score, programChoice) {
  const r = String(resultCell || '').trim().toLowerCase()
  if (r) {
    if (['passed', 'pass', 'p'].includes(r)) return 'passed'
    if (['failed', 'fail', 'f'].includes(r)) return 'failed'
    if (['absent', 'a', 'did not attend'].includes(r)) return 'absent'
    return undefined
  }
  if (score == null) return null
  return suggestExamResult(score, programChoice).suggested
}
