import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { Resend } from 'resend'
import { personalInfoToColumns, academicInfoToColumns, healthInfoToColumns, familyInfoToColumns } from '@/app/lib/applicationColumns'

const resend = new Resend(process.env.RESEND_API_KEY)

// personalInfoToColumns() / academicInfoToColumns() moved to
// app/lib/applicationColumns.js on Sept 19, 2026 so the new signup flow
// (applicantAccounts.js) can build the first `applications` row from
// staged signup data using the exact same mapping, instead of duplicating
// it. See that file for the column-by-column mapping and the ad hoc SQL
// PATCH NOTES history at the bottom of this file.

// Sends a simple confirmation email when an application is submitted.
// Fire-and-log only — a failed email should never block the submission
// itself from succeeding.
async function sendSubmissionEmail(applicantName, applicantEmail) {
  if (!applicantEmail) return

  try {
    await resend.emails.send({
      from: 'Iskolusyon <onboarding@resend.dev>',
      to: applicantEmail,
      subject: 'Your Iskolusyon application has been submitted',
      html: `
        <p>Hi ${applicantName},</p>
        <p>We've received your scholarship application. Our team will review your
        submitted documents and get back to you with any updates.</p>
        <p>— City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    console.error('Failed to send submission email:', err.message)
  }
}

// GET /api/application?name=Juan+Dela+Cruz
// Looks up an existing draft/submitted application row for this applicant,
// matched the same way documents are matched elsewhere in the app —
// case-insensitive, trimmed name (no accounts module yet to key off of).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = (searchParams.get('name') || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .ilike('applicant_name', name)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, application: data || null })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/application
// body: { applicantName, applicantEmail, step, action, section? }
// action: 'save'           -> creates/updates a 'draft' row at the given step
//         'submit'         -> flips the WHOLE application to 'submitted'
//         'submit-section' -> marks one profile section (section: 'personal'
//                             | 'academic') as explicitly submitted, saving
//                             its current fields at the same time. Doesn't
//                             touch the application's overall status — this
//                             is the per-panel "Submit Section" button from
//                             applicant.html, not the final submission.
//
// Auto-save and the manual "Save progress"/"Save as Draft" buttons both
// call this with action: 'save' — the only difference is whether the
// applicant clicked a button or just moved to the next step.
export async function POST(request) {
  try {
    const body = await request.json()
    const applicantName = (body.applicantName || '').trim()
    const applicantEmail = (body.applicantEmail || '').trim()
    const step = Number(body.step) || 1
    const action = ['submit', 'submit-section'].includes(body.action) ? body.action : 'save'
    const section = ['academic', 'personal', 'health', 'financial'].includes(body.section) ? body.section : null
    const personalInfoColumns = personalInfoToColumns(body.personalInfo)
    const academicInfoColumns = academicInfoToColumns(body.academicInfo)
    const healthInfoColumns = healthInfoToColumns(body.healthInfo)
    const familyInfoColumns = familyInfoToColumns(body.familyInfo)

    if (!applicantName) {
      return NextResponse.json({ error: 'Missing applicant name' }, { status: 400 })
    }
    if (action === 'submit-section' && !section) {
      return NextResponse.json({ error: 'Missing or invalid section' }, { status: 400 })
    }

    // Find any existing row for this applicant first (draft or submitted).
    const { data: existing, error: findError } = await supabase
      .from('applications')
      .select('*')
      .ilike('applicant_name', applicantName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    const now = new Date().toISOString()

    if (existing) {
      const updates = {
        applicant_email: applicantEmail || existing.applicant_email,
        current_step: step,
        updated_at: now,
        ...personalInfoColumns,
        ...academicInfoColumns,
        ...healthInfoColumns,
        ...familyInfoColumns,
      }
      if (action === 'submit') {
        updates.status = 'submitted'
        updates.submitted_at = now
      }
      if (action === 'submit-section') {
        if (section === 'personal') updates.personal_info_submitted_at = now
        if (section === 'academic') updates.academic_submitted_at = now
        if (section === 'health') updates.health_submitted_at = now
        if (section === 'financial') updates.financial_submitted_at = now
      }

      const { data, error } = await supabase
        .from('applications')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (action === 'submit') {
        await sendSubmissionEmail(applicantName, data.applicant_email)
      }

      return NextResponse.json({ success: true, application: data })
    }

    // No existing row — create one.
    const insertPayload = {
      applicant_name: applicantName,
      applicant_email: applicantEmail || null,
      current_step: step,
      status: action === 'submit' ? 'submitted' : 'draft',
      submitted_at: action === 'submit' ? now : null,
      personal_info_submitted_at: action === 'submit-section' && section === 'personal' ? now : null,
      academic_submitted_at: action === 'submit-section' && section === 'academic' ? now : null,
      health_submitted_at: action === 'submit-section' && section === 'health' ? now : null,
      financial_submitted_at: action === 'submit-section' && section === 'financial' ? now : null,
      ...personalInfoColumns,
      ...academicInfoColumns,
      ...healthInfoColumns,
      ...familyInfoColumns,
    }

    const { data, error } = await supabase
      .from('applications')
      .insert([insertPayload])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (action === 'submit') {
      await sendSubmissionEmail(applicantName, data.applicant_email)
    }

    return NextResponse.json({ success: true, application: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ============================================================================
// PATCH NOTES — ad hoc SQL to run in Supabase's SQL editor (not committed as
// a migration file, matching how earlier column additions on this project
// were handled).
//
// Cards 1-3 (Profile Picture / Identity & Civil Status / Contact &
// Residency) columns are assumed already applied from the Sept 17 session.
// This adds cards 4-6:
//
// ALTER TABLE applications
//   ADD COLUMN IF NOT EXISTS lgbtqi_member text,
//   ADD COLUMN IF NOT EXISTS disability text,
//   ADD COLUMN IF NOT EXISTS hobbies text,
//   ADD COLUMN IF NOT EXISTS organizations jsonb DEFAULT '[]'::jsonb,
//   ADD COLUMN IF NOT EXISTS motivation text,
//   ADD COLUMN IF NOT EXISTS self_description text,
//   ADD COLUMN IF NOT EXISTS ten_years_plan text;
//
// Educational Background panel (Program Application, Preferred Program,
// 3-tier school table, Tech-Voc) — adds:
//
// ALTER TABLE applications
//   ADD COLUMN IF NOT EXISTS applying_as text,
//   ADD COLUMN IF NOT EXISTS term_applying text,
//   ADD COLUMN IF NOT EXISTS program_choice_1 text,
//   ADD COLUMN IF NOT EXISTS program_choice_2 text,
//   ADD COLUMN IF NOT EXISTS edu_prim_school text,
//   ADD COLUMN IF NOT EXISTS edu_prim_address text,
//   ADD COLUMN IF NOT EXISTS edu_prim_section text,
//   ADD COLUMN IF NOT EXISTS edu_prim_year text,
//   ADD COLUMN IF NOT EXISTS edu_prim_honors text,
//   ADD COLUMN IF NOT EXISTS edu_sec_school text,
//   ADD COLUMN IF NOT EXISTS edu_sec_address text,
//   ADD COLUMN IF NOT EXISTS edu_sec_section text,
//   ADD COLUMN IF NOT EXISTS edu_sec_year text,
//   ADD COLUMN IF NOT EXISTS edu_sec_honors text,
//   ADD COLUMN IF NOT EXISTS edu_tert_school text,
//   ADD COLUMN IF NOT EXISTS edu_tert_address text,
//   ADD COLUMN IF NOT EXISTS edu_tert_section text,
//   ADD COLUMN IF NOT EXISTS edu_tert_year text,
//   ADD COLUMN IF NOT EXISTS edu_tert_honors text,
//   ADD COLUMN IF NOT EXISTS tech_voc text,
//   ADD COLUMN IF NOT EXISTS tech_voc_school text,
//   ADD COLUMN IF NOT EXISTS tech_voc_course text,
//   ADD COLUMN IF NOT EXISTS tech_voc_address text;
//
// Health & Wellness panel (design-parity pass 6) — also committed as
// docs/migrations/2026-09-19-health-fields.sql, unlike the ad hoc blocks
// above:
//
// ALTER TABLE applications
//   ADD COLUMN IF NOT EXISTS health_condition text,
//   ADD COLUMN IF NOT EXISTS health_submitted_at timestamptz;
//
// Family & Financial Information panel (design-parity pass 7) — also
// committed as docs/migrations/2026-09-19-family-financial-fields.sql:
//
// ALTER TABLE applications
//   ADD COLUMN IF NOT EXISTS fam_mother_name text,
//   ADD COLUMN IF NOT EXISTS fam_mother_citizenship text,
//   ADD COLUMN IF NOT EXISTS fam_mother_dob text,
//   ADD COLUMN IF NOT EXISTS fam_mother_contact text,
//   ADD COLUMN IF NOT EXISTS fam_mother_education text,
//   ADD COLUMN IF NOT EXISTS fam_mother_employment text,
//   ADD COLUMN IF NOT EXISTS fam_father_name text,
//   ADD COLUMN IF NOT EXISTS fam_father_citizenship text,
//   ADD COLUMN IF NOT EXISTS fam_father_dob text,
//   ADD COLUMN IF NOT EXISTS fam_father_contact text,
//   ADD COLUMN IF NOT EXISTS fam_father_education text,
//   ADD COLUMN IF NOT EXISTS fam_father_employment text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_name text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_citizenship text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_dob text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_contact text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_education text,
//   ADD COLUMN IF NOT EXISTS fam_guardian_employment text,
//   ADD COLUMN IF NOT EXISTS fam_only_child text,
//   ADD COLUMN IF NOT EXISTS fam_num_siblings integer,
//   ADD COLUMN IF NOT EXISTS fam_sibling_currentstudent text,
//   ADD COLUMN IF NOT EXISTS fam_sibling_graduate text,
//   ADD COLUMN IF NOT EXISTS fam_emergency_contact text,
//   ADD COLUMN IF NOT EXISTS fam_emergency_contact_number text,
//   ADD COLUMN IF NOT EXISTS fam_working_student text,
//   ADD COLUMN IF NOT EXISTS fam_siblings jsonb DEFAULT '[]'::jsonb,
//   ADD COLUMN IF NOT EXISTS financial_submitted_at timestamptz;
// ============================================================================