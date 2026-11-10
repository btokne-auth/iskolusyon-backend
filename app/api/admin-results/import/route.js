import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'
import { serverError } from '@/app/lib/safeError'
import { buildExamUpdate, parseCsv, csvDate, csvResult } from '@/app/lib/examResults'
import { MINUTE, limitRequest } from '@/app/lib/rateLimit'

// Nov 2026 (panel revisions S7): exam scores from a CSV file instead of
// typing them one by one. The exam itself stays face-to-face, pen and
// paper; this only records the results.
//
// POST { csv, apply }  apply=false -> preview only (nothing is saved)
//                      apply=true  -> saves the rows marked "ok"
// Columns (header row, any order, case-insensitive):
//   application_number  (required; or name, matched only if unique)
//   score               (number)
//   result              (optional: passed / failed / absent; blank = from
//                        the 1st-choice program's passing grade)
//   exam_date           (optional: YYYY-MM-DD or MM/DD/YYYY)
// Each saved row goes through the same rules as the manual entry
// (app/lib/examResults.js), and each one is written to the Activity Log.

const MAX_ROWS = 3000

function header(cells) {
  const keys = cells.map((c) => c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  const find = (...names) => keys.findIndex((k) => names.includes(k))
  return {
    number: find('application_number', 'application_no', 'app_no', 'application', 'student_number', 'student_no'),
    name: find('name', 'applicant_name', 'full_name', 'applicant'),
    score: find('score', 'exam_score'),
    result: find('result', 'exam_result'),
    date: find('exam_date', 'date'),
  }
}

export async function POST(request) {
  try {
    const adminName = await verifyAdminCookieValue(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    const limited = await limitRequest(`exam-import:${adminName}`, 30, 10 * MINUTE, 'Too many imports. Please wait a few minutes.')
    if (limited) return limited

    const { csv, apply } = await request.json()
    const table = parseCsv(csv)
    if (table.length < 2) return NextResponse.json({ error: 'The file has no rows under the header.' }, { status: 400 })
    if (table.length - 1 > MAX_ROWS) return NextResponse.json({ error: `At most ${MAX_ROWS} rows per file.` }, { status: 400 })
    const col = header(table[0])
    if (col.number < 0 && col.name < 0) {
      return NextResponse.json({ error: 'The header needs an application_number column (or a name column).' }, { status: 400 })
    }
    if (col.score < 0 && col.result < 0) {
      return NextResponse.json({ error: 'The header needs a score column (and optionally result).' }, { status: 400 })
    }

    const { data: apps, error } = await supabase
      .from('applications')
      .select('id, applicant_name, application_number, program_choice_1, program_choice_2, shs_math_science_lowest, eligibility_status, eligibility_override, scholar_status, exam_result, exam_score')
      .is('archived_at', null)
    if (error) return serverError(error, 'api/admin-results/import')
    const byNumber = new Map()
    const byName = new Map()
    for (const a of apps || []) {
      if (a.application_number) byNumber.set(String(a.application_number).trim().toUpperCase(), a)
      const key = (a.applicant_name || '').trim().toLowerCase()
      if (key) byName.set(key, byName.has(key) ? null : a) // null = more than one
    }

    const seen = new Set()
    const rows = []
    for (let i = 1; i < table.length; i++) {
      const cells = table[i]
      const cell = (idx) => (idx >= 0 ? String(cells[idx] ?? '').trim() : '')
      const out = { line: i + 1, number: cell(col.number), name: cell(col.name) }
      const skip = (reason) => rows.push({ ...out, ok: false, reason })

      let app = out.number ? byNumber.get(out.number.toUpperCase()) : undefined
      if (!app && !out.number && out.name) {
        const hit = byName.get(out.name.toLowerCase())
        if (hit === null) { skip('More than one applicant has this name. Use the application number.'); continue }
        app = hit
      }
      if (!app) { skip(out.number ? 'No applicant with this application number.' : 'No applicant with this name.'); continue }
      if (seen.has(app.id)) { skip('This applicant appears twice in the file.'); continue }
      seen.add(app.id)
      out.id = app.id
      out.name = app.applicant_name
      out.number = app.application_number || out.number
      out.program = app.program_choice_1

      const eligibility = app.eligibility_override || app.eligibility_status
      if (eligibility !== 'pending_exam' && !app.exam_result) {
        skip('Not Eligible for Exam yet (incomplete or not qualified), so no score can be recorded.')
        continue
      }

      const scoreText = cell(col.score)
      const score = scoreText === '' ? null : Number(scoreText)
      if (score != null && (!Number.isFinite(score) || score < 0)) { skip('Score is not a valid number.'); continue }
      const result = csvResult(cell(col.result), score, app.program_choice_1)
      if (result === undefined) { skip('Result must be passed, failed or absent.'); continue }
      if (!result) { skip('No result: add a score (or write the result) for this row.'); continue }
      if (result !== 'absent' && score == null) { skip('A passed or failed result needs a score.'); continue }
      const examDate = csvDate(cell(col.date))
      if (examDate === undefined) { skip('Exam date must be YYYY-MM-DD or MM/DD/YYYY.'); continue }

      rows.push({ ...out, ok: true, score: result === 'absent' ? null : score, result, examDate, existing: app })
    }

    const okRows = rows.filter((r) => r.ok)
    if (!apply) {
      return NextResponse.json({
        success: true,
        preview: rows.map(({ existing, ...r }) => {
          if (!r.ok) return r
          const { status } = buildExamUpdate(existing, { score: r.score, examResult: r.result, examDate: r.examDate, adminName, now: '' })
          return { ...r, status, replaces: existing.exam_result ? `${existing.exam_result}${existing.exam_score != null ? ` (${existing.exam_score})` : ''}` : null }
        }),
      })
    }

    let saved = 0
    const failed = []
    for (const r of okRows) {
      const locked = await checkLock(request, r.id)
      if (locked) { failed.push({ line: r.line, name: r.name, reason: 'Another admin has this applicant open.' }); continue }
      const now = new Date().toISOString()
      const { status, update } = buildExamUpdate(r.existing, { score: r.score, examResult: r.result, examDate: r.examDate, adminName, now })
      const { error: updateError } = await supabase.from('applications').update(update).eq('id', r.id)
      if (updateError) { failed.push({ line: r.line, name: r.name, reason: 'Could not save this row.' }); continue }
      saved++
      try {
        await supabase.from('audit_log').insert([{
          actor: adminName,
          action: `Recorded entrance exam result for ${r.name || 'Unknown applicant'} (CSV import): ${r.result}${r.score != null ? ` (score ${r.score})` : ''} -> ${status}`,
          kind: r.result === 'passed' ? 'done' : 'warn',
          category: 'Results',
        }])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
    }
    return NextResponse.json({ success: true, saved, failed, skipped: rows.length - okRows.length })
  } catch (err) {
    return serverError(err, 'api/admin-results/import')
  }
}
