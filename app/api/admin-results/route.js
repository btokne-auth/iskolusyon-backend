import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'
import { deriveScholarStatus, SCHOLAR_STATUS_VALUES, DISTRIBUTION_STATUS_VALUES, bsedGradeBelow, eligibleProgramsForScore, reachedFirstChoice } from '@/app/lib/matching'
import { serverError } from '@/app/lib/safeError'

// Applicant Information & Results Module -- admin-facing read + the three
// admin actions the Roles PDF describes for it: Exam Score Entry and
// Verification, Distribution Status Tracking, and Disqualification/
// Forfeiture Handling. Individual Applicant Profile View is the client-side
// list this feeds (app/admin/page.js ResultsPanel), same "one GET, group by
// applicant" shape as /api/admin-eligibility.
//
// See docs/migrations/2026-09-21-applicant-results.sql and app/lib/matching.js
// for the Appendix D grounding behind every status value used here.

const EXAM_RESULT_VALUES = new Set(['passed', 'failed', 'absent'])

export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, applicant_name, applicant_email, applying_as, program_choice_1, program_choice_2, application_number, ' +
        'exam_score, exam_result, exam_date, exam_verified_by, exam_verified_at, ' +
        'scholar_status, scholar_status_reason, scholar_status_set_by, scholar_status_set_at, ' +
        'distribution_status, distribution_status_updated_by, distribution_status_updated_at, ' +
        'result_notified_status, result_notified_at, result_notified_by, result_email_sent, email_updates_opt_in, ' +
        'endorsement_notified_status, endorsement_notified_at, endorsement_notified_by, endorsement_email_sent, updated_at, ' +
        // Oct 6 2026: re-evaluation into another program (Appendix J rule b)
        // and the BSEd Math/Science grade (rule a).
        'admitted_program, admitted_program_set_by, admitted_program_set_at, shs_math_science_lowest'
      )
      .is('archived_at', null) // Oct 5 2026: archived applicants leave Applicant Results
      .order('updated_at', { ascending: false })

    if (error) {
      return serverError(error, 'api/admin-results')
    }

    return NextResponse.json({ success: true, applications: data || [] })
  } catch (err) {
    return serverError(err, 'api/admin-results')
  }
}

// One PATCH endpoint, dispatched by `field` -- same shape choice as
// /api/admin-eligibility (single override field) but this module has three
// independent pieces of state, so `field` picks which one this call updates.
// Each branch is its own audit_log entry so the trail reads like the actual
// action taken ("Recorded exam result...", "Advanced distribution status
// to...", "Marked ... as disqualified...") rather than one generic
// "updated application" line -- this IS the "Statement of Subsequent
// Actions" the Roles PDF asks for; there's no separate notes table because
// audit_log already gives every action a who/what/when.
export async function PATCH(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, field } = body
    if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

    // Oct 1 2026: Locked Applications for Review.
    const locked = await checkLock(request, id)
    if (locked) return locked

    const { data: existing, error: fetchError } = await supabase
      .from('applications')
      .select('applicant_name, scholar_status, exam_score, exam_result, program_choice_1, program_choice_2, shs_math_science_lowest, admitted_program')
      .eq('id', id)
      .single()
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }
    const applicantLabel = existing.applicant_name || 'Unknown applicant'
    const now = new Date().toISOString()

    if (field === 'exam') {
      const { examScore, examResult, examDate } = body
      // Sept 21 fix: the Result dropdown's blank option ("Not yet
      // recorded") sends an empty string, not null/undefined -- the old
      // `examResult != null` check treated '' as a real, unrecognized
      // value and rejected every attempt to clear a result back to blank
      // ("Unknown exam result value."). A plain truthy check lets '' (and
      // null/undefined) through as "no result", while still rejecting an
      // actual garbage string.
      if (examResult && !EXAM_RESULT_VALUES.has(examResult)) {
        return NextResponse.json({ error: 'Unknown exam result value.' }, { status: 400 })
      }
      const score = examScore === '' || examScore == null ? null : Number(examScore)
      if (score != null && Number.isNaN(score)) {
        return NextResponse.json({ error: 'Exam score must be a number.' }, { status: 400 })
      }

      let { status: derivedStatus, reason: derivedReason } = deriveScholarStatus(examResult)
      // Oct 6 2026, Appendix J p. 96 rule a: a BSEd Mathematics / Science
      // 1st choice is closed when the lowest SHS Math/Science grade is below
      // 85, whatever the score. The applicant then waits for re-evaluation
      // in another program (rule b), which an admin does in section 1.
      if (derivedStatus === 'passer' && bsedGradeBelow(existing.program_choice_1, existing)) {
        derivedStatus = 'waitlisted_probationary'
        derivedReason = `Passing score, but ${existing.program_choice_1} needs 85 or higher in every SHS Mathematics and Science subject (Appendix J, rule a). Re-evaluate in another program.`
      }

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          exam_score: score,
          exam_result: examResult || null,
          exam_date: examDate || null,
          exam_verified_by: adminName,
          exam_verified_at: now,
          scholar_status: derivedStatus,
          scholar_status_reason: derivedReason,
          scholar_status_set_by: adminName,
          scholar_status_set_at: now,
          // A new exam entry starts over: any earlier re-evaluation is cleared.
          admitted_program: null,
          admitted_program_set_by: null,
          admitted_program_set_at: null,
        })
        .eq('id', id)
      if (updateError) return serverError(updateError, 'api/admin-results')

      try {
        await supabase.from('audit_log').insert([
          {
            actor: adminName,
            action: `Recorded entrance exam result for ${applicantLabel}: ${examResult || 'no result'}${score != null ? ` (score ${score})` : ''} -> ${derivedStatus}`,
            kind: examResult === 'absent' || examResult === 'failed' ? 'warn' : 'done',
            category: 'Results',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ success: true })
    }

    // Oct 6 2026: Appendix J p. 96 rule b. "In cases that the applicant did
    // not qualify in his/her priority program based on the set qualifying
    // grade, he/she will be re-evaluated in another program based on his/her
    // exam result." The admin picks the program (CCC decides in person); the
    // server only allows a program whose passing grade the score meets and
    // that rule a doesn't close. The recorded exam result stays as entered.
    // program: null undoes it (back to what the exam result gives).
    if (field === 'reevaluate') {
      const program = body.program ?? null
      if (program === null) {
        if (!existing.admitted_program) return NextResponse.json({ success: true })
        const { status: backStatus, reason: backReason } = deriveScholarStatus(existing.exam_result)
        const { error: undoError } = await supabase
          .from('applications')
          .update({
            admitted_program: null,
            admitted_program_set_by: null,
            admitted_program_set_at: null,
            scholar_status: backStatus,
            scholar_status_reason: backReason,
            scholar_status_set_by: adminName,
            scholar_status_set_at: now,
          })
          .eq('id', id)
        if (undoError) {
          console.error('reevaluate undo failed:', undoError)
          return NextResponse.json({ error: 'Could not undo. Please try again.' }, { status: 500 })
        }
        try {
          await supabase.from('audit_log').insert([
            { actor: adminName, action: `Undid the re-evaluation of ${applicantLabel} (was accepted in ${existing.admitted_program})`, kind: 'warn', category: 'Results' },
          ])
        } catch (auditErr) {
          console.error('Audit log insert failed (non-blocking):', auditErr)
        }
        return NextResponse.json({ success: true })
      }

      if (typeof program !== 'string') return NextResponse.json({ error: 'Pick a program.' }, { status: 400 })
      if (existing.exam_result === 'absent' || existing.exam_score === null || existing.exam_score === undefined) {
        return NextResponse.json({ error: 'Record the exam score first.' }, { status: 400 })
      }
      if (reachedFirstChoice(existing) === true) {
        return NextResponse.json({ error: 'This score already meets the 1st choice, so no re-evaluation is needed.' }, { status: 400 })
      }
      const option = eligibleProgramsForScore(existing.exam_score, existing).find((p) => p.program === program)
      if (!option) return NextResponse.json({ error: 'This score does not meet that program\'s passing grade.' }, { status: 400 })
      if (option.blockedReason) return NextResponse.json({ error: `${program} is closed: ${option.blockedReason}.` }, { status: 400 })

      const { error: reError } = await supabase
        .from('applications')
        .update({
          admitted_program: program,
          admitted_program_set_by: adminName,
          admitted_program_set_at: now,
          scholar_status: 'passer',
          scholar_status_reason: `Re-evaluated from ${existing.program_choice_1 || 'the 1st choice'} to ${program} (score ${existing.exam_score}, passing grade ${option.grade}; Appendix J, rule b)`,
          scholar_status_set_by: adminName,
          scholar_status_set_at: now,
        })
        .eq('id', id)
      if (reError) {
        console.error('reevaluate failed:', reError)
        return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
      }
      try {
        await supabase.from('audit_log').insert([
          {
            actor: adminName,
            action: `Re-evaluated ${applicantLabel}: accepted in ${program} (score ${existing.exam_score}, passing grade ${option.grade}) instead of ${existing.program_choice_1 || 'the 1st choice'} (Appendix J, rule b)`,
            kind: 'done',
            category: 'Results',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ success: true })
    }

    if (field === 'scholar_status') {
      const { scholarStatus, reason } = body
      if (!SCHOLAR_STATUS_VALUES.has(scholarStatus)) {
        return NextResponse.json({ error: 'Unknown scholar status value.' }, { status: 400 })
      }
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          scholar_status: scholarStatus,
          scholar_status_reason: reason || null,
          scholar_status_set_by: adminName,
          scholar_status_set_at: now,
        })
        .eq('id', id)
      if (updateError) return serverError(updateError, 'api/admin-results')

      try {
        await supabase.from('audit_log').insert([
          {
            actor: adminName,
            action: `Manually set scholar status to "${scholarStatus}" for ${applicantLabel}${reason ? ` -- ${reason}` : ''}`,
            kind: scholarStatus === 'disqualified' || scholarStatus === 'forfeited' ? 'warn' : 'done',
            category: 'Results',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ success: true })
    }

    if (field === 'distribution_status') {
      const { distributionStatus } = body
      if (!DISTRIBUTION_STATUS_VALUES.has(distributionStatus)) {
        return NextResponse.json({ error: 'Unknown distribution status value.' }, { status: 400 })
      }
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          distribution_status: distributionStatus,
          distribution_status_updated_by: adminName,
          distribution_status_updated_at: now,
        })
        .eq('id', id)
      if (updateError) return serverError(updateError, 'api/admin-results')

      try {
        await supabase.from('audit_log').insert([
          {
            actor: adminName,
            action: `Advanced distribution status to "${distributionStatus}" for ${applicantLabel}`,
            kind: 'done',
            category: 'Results',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown field.' }, { status: 400 })
  } catch (err) {
    return serverError(err, 'api/admin-results')
  }
}
