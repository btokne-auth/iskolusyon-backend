import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Maps the camelCase personalInfo object sent from the Step 1 Personal
// Information cards — Profile Picture / Identity & Civil Status / Contact &
// Residency (cards 1-3), Additional Information (card 4), Organizational
// Involvement (card 5), Motivation and Aspirations Questions (card 6) — to
// the snake_case columns added on `applications` for them. Run against an
// ad hoc migration in Supabase's SQL editor (not committed as a repo file,
// matching how earlier column additions on this project were handled) —
// see PATCH NOTES at the bottom of this file for the SQL.
// Every field is optional at the DB level; required-ness is enforced in
// the UI (app/page.js) before the applicant can leave Step 1.
function personalInfoToColumns(personalInfo) {
  const pi = personalInfo && typeof personalInfo === 'object' ? personalInfo : {}
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    first_name: text(pi.firstName),
    middle_name: text(pi.middleName),
    last_name: text(pi.lastName),
    suffix: text(pi.suffix),
    date_of_birth: text(pi.dateOfBirth),
    place_of_birth: text(pi.placeOfBirth),
    sex: text(pi.sex),
    citizenship: text(pi.citizenship),
    religion: text(pi.religion),
    civil_status: text(pi.civilStatus),
    spouse_name: text(pi.spouseName),
    spouse_occupation: text(pi.spouseOccupation),
    spouse_contact: text(pi.spouseContact),
    contact_number: text(pi.contactNumber),
    address: text(pi.address),
    voter_precinct: text(pi.voterPrecinct),
    email_updates_opt_in: !!pi.emailUpdatesOptIn,
    sms_updates_opt_in: !!pi.smsUpdatesOptIn,
    // ---- Card 4 (Additional Information) ----
    lgbtqi_member: text(pi.lgbtqi),
    disability: text(pi.disability),
    hobbies: text(pi.hobbies),
    // ---- Card 5 (Organizational Involvement) ---- stored as jsonb; blank
    // rows (every field empty) are dropped before saving since the section
    // is optional and the UI always keeps at least one blank seed row.
    organizations: Array.isArray(pi.organizations)
      ? pi.organizations
          .map((o) => ({
            name: text(o && o.name),
            position: text(o && o.position),
            nature: text(o && o.nature),
            year: text(o && o.year),
          }))
          .filter((o) => o.name || o.position || o.nature || o.year)
      : [],
    // ---- Card 6 (Motivation and Aspirations Questions) ----
    motivation: text(pi.motivation),
    self_description: text(pi.selfDescription),
    ten_years_plan: text(pi.tenYears),
  }
}

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
// body: { applicantName, applicantEmail, step, action }
// action: 'save'   -> creates/updates a 'draft' row at the given step
//         'submit' -> flips the row to 'submitted' with a timestamp
//
// Auto-save and the manual "Save progress" button both call this with
// action: 'save' — the only difference is whether the applicant clicked
// a button or just moved to the next step.
export async function POST(request) {
  try {
    const body = await request.json()
    const applicantName = (body.applicantName || '').trim()
    const applicantEmail = (body.applicantEmail || '').trim()
    const step = Number(body.step) || 1
    const action = body.action === 'submit' ? 'submit' : 'save'
    const personalInfoColumns = personalInfoToColumns(body.personalInfo)

    if (!applicantName) {
      return NextResponse.json({ error: 'Missing applicant name' }, { status: 400 })
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
      }
      if (action === 'submit') {
        updates.status = 'submitted'
        updates.submitted_at = now
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
      ...personalInfoColumns,
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
// ============================================================================