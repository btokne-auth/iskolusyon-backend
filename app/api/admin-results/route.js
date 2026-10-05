import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'
import { deriveScholarStatus, SCHOLAR_STATUS_VALUES, DISTRIBUTION_STATUS_VALUES } from '@/app/lib/matching'

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
        'endorsement_notified_status, endorsement_notified_at, endorsement_notified_by, endorsement_email_sent, updated_at'
      )
      .is('archived_at', null) // Oct 5 2026: archived applicants leave Applicant Results
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, applications: data || [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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
      .select('applicant_name, scholar_status')
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

      const { status: derivedStatus, reason: derivedReason } = deriveScholarStatus(examResult)

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
        })
        .eq('id', id)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

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
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

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
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
