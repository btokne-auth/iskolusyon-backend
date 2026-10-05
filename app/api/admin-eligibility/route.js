import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'

// Scholarship Matching & Filtering — admin-facing read + manual override.
//
// GET returns every application row's automated eligibility_status (see
// app/lib/matching.js for how it's computed) alongside any admin
// eligibility_override, so the admin dashboard can show a real, automated
// Qualified/Not Qualified/Pending breakdown instead of the fully manual
// per-applicant buttons Ivy's admin.html mockup had (requestStatusChange())
// — replacing manual evaluation with automation is literally this
// capstone's second specific objective (see Chapter 1).
//
// PATCH sets/clears a manual override for one application — the one
// deliberate escape hatch, for a real edge case the automated rules can't
// (or shouldn't) decide on their own: e.g. a genuine Program Director
// exception under Appendix J's Transferees rule (d), or once real entrance
// exam results exist and someone needs to mark a final "Qualified" (the
// engine itself never sets that automatically — see app/lib/matching.js).
const VALID_OVERRIDES = new Set(['qualified', 'waitlisted', 'not_qualified'])

export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    // personal_info_submitted_at / academic_submitted_at /
    // fam_financial_submitted_at / health_submitted_at added Sept 22 2026 —
    // the applicant-side profile's 4 real sections (app/page.js), needed so
    // the Dashboard's applicant detail modal can show a real "X of 4
    // sections done" the way Ivy's mockup's Profile Completion mini-summary
    // does, instead of a fabricated number.
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, applicant_name, applicant_email, applying_as, program_choice_1, program_choice_2, application_number, eligibility_status, eligibility_reasons, eligibility_override, eligibility_override_by, eligibility_override_at, updated_at, personal_info_submitted_at, academic_submitted_at, fam_financial_submitted_at, health_submitted_at'
      )
      .is('archived_at', null) // Oct 5 2026: archived applicants leave the Dashboard
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, applications: data || [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { id, override } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })
    }

    // Oct 1 2026: Locked Applications for Review.
    const locked = await checkLock(request, id)
    if (locked) return locked
    if (override !== null && !VALID_OVERRIDES.has(override)) {
      return NextResponse.json({ error: 'Unknown override value.' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('applications')
      .select('applicant_name')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        eligibility_override: override,
        eligibility_override_by: override ? adminName : null,
        eligibility_override_at: override ? now : null,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: override
            ? `Manually set eligibility to "${override}" for ${existing.applicant_name || 'Unknown applicant'} (Scholarship Matching override)`
            : `Cleared manual eligibility override for ${existing.applicant_name || 'Unknown applicant'} (back to automated result)`,
          kind: override === 'not_qualified' ? 'warn' : 'done',
          category: 'Eligibility',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
