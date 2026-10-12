import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { Resend } from 'resend'
import { personalInfoToColumns, academicInfoToColumns, healthInfoToColumns, familyInfoToColumns } from '@/app/lib/applicationColumns'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { computeEligibility, needsShsMathScienceGrade } from '@/app/lib/matching'
import { getSystemSettings, submitBlockedReason } from '@/app/lib/systemSettings'
import { resultsVisible, applicantSafeRow } from '@/app/lib/resultVisibility'
import { isApplicantArchived, ARCHIVED_MESSAGE } from '@/app/lib/archive'
import { serverError } from '@/app/lib/safeError'
import { MINUTE, limitRequest } from '@/app/lib/rateLimit'
import { encryptApplicationFields, decryptApplicationFields } from '@/app/lib/fieldCrypto'
import { logApplicantActivity, applicantLabel } from '@/app/lib/activityLog'

const resend = new Resend(process.env.RESEND_API_KEY)

// Sept 23, 2026: iskolusyon.dev is now verified on Resend, so this no
// longer has to be the onboarding@resend.dev sandbox address (which could
// only ever deliver to the developer's own inbox). Configurable via env
// so a future domain change doesn't need another code patch.
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Iskolusyon <noreply@iskolusyon.dev>'

// personalInfoToColumns() / academicInfoToColumns() moved to
// app/lib/applicationColumns.js on Sept 19, 2026 so the new signup flow
// (applicantAccounts.js) can build the first `applications` row from
// staged signup data using the exact same mapping, instead of duplicating
// it. See that file for the column-by-column mapping and the ad hoc SQL
// PATCH NOTES history at the bottom of this file.

// Sends a simple confirmation email when an application is submitted.
// Fire-and-log only — a failed email should never block the submission
// itself from succeeding.
// Oct 7 2026 (Input Validation / XSS): the name is typed by the applicant,
// so it is escaped before going into the email's HTML.
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendSubmissionEmail(applicantName, applicantEmail) {
  if (!applicantEmail) return

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: applicantEmail,
      subject: 'Your Iskolusyon application has been submitted',
      html: `
        <p>Hi ${escapeHtml(applicantName)},</p>
        <p>We've received your scholarship application. Our team will review your
        submitted documents and get back to you with any updates.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    console.error('Failed to send submission email:', err.message)
  }
}

// True for a value that carries no real data — null/undefined, a blank
// string, or an empty array (the shape `fam_siblings`/`organizations`
// default to). Used below to decide whether an older duplicate row still
// has something worth merging in.
function isEmptyValue(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

// Sept 19 2026, second pass: name-only matching turned out to be fragile
// on its own — see the long comment on POST below for the chain of bugs
// that let a logged-in applicant's name and their actual saved row drift
// apart. Rather than keep patching that chain one link at a time, every
// lookup in this file now checks THREE signals and merges whatever any of
// them find: the logged-in account's id (from the verified session
// cookie — most reliable, immune to the name ever changing), the
// account's own email (stable, always known once logged in), and the
// typed name (kept last for backward compatibility / any flow that isn't
// logged in). Whichever signals are available get checked; results are
// deduplicated by row id and merged the same "newest wins, older rows
// fill gaps" way multiple matches have been merged since the first pass
// of this fix.
async function findApplicationRows({ userId, email, name }) {
  const rowsById = new Map()

  async function addMatches(builder) {
    const { data, error } = await builder
    if (error) throw new Error(error.message)
    // Oct 7 2026: unlock the encrypted fields (app/lib/fieldCrypto.js).
    for (const row of data || []) rowsById.set(row.id, decryptApplicationFields(row))
  }

  if (userId) {
    await addMatches(
      supabase.from('applications').select('*').eq('applicant_user_id', userId).order('updated_at', { ascending: false })
    )
  }
  if (email) {
    await addMatches(
      supabase.from('applications').select('*').ilike('applicant_email', email).order('updated_at', { ascending: false })
    )
  }
  if (name) {
    await addMatches(
      supabase.from('applications').select('*').ilike('applicant_name', name).order('updated_at', { ascending: false })
    )
  }

  return Array.from(rowsById.values()).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
}

// Sept 30 2026: a row belongs to the signed-in applicant if it is linked to
// their account, or (for an older row saved before rows were linked) if it
// carries their account email and no other account. Used by GET and POST so
// neither ever reads or writes someone else's application.
function ownsRow(row, session) {
  if (!row || !session) return false
  if (row.applicant_user_id) return row.applicant_user_id === session.id
  return (row.applicant_email || '').trim().toLowerCase() === (session.email || '').trim().toLowerCase()
}

async function findOwnRows(session) {
  const rows = await findApplicationRows({ userId: session.id, email: session.email })
  return rows.filter((row) => ownsRow(row, session))
}

function mergeApplicationRows(rows) {
  let merged = null
  for (const row of rows) {
    if (!merged) {
      merged = { ...row }
      continue
    }
    for (const key of Object.keys(row)) {
      if (isEmptyValue(merged[key]) && !isEmptyValue(row[key])) {
        merged[key] = row[key]
      }
    }
  }
  return merged
}

// Sept 20 2026: the sidebar has always shown "Application Number will be
// provided once your documents are submitted and verified" (matches the
// "2026A-____" numbering on CCC's actual sample application form,
// Appendix I of the manuscript), but no application_number column or
// completeness check existed anywhere — that copy was decorative, not
// backed by real logic. This closes that gap: once every REQUIRED
// document type is on file for this applicant, they get a number, once,
// and keep it from then on.
//
// The required set here is the real one, matched against actual uploaded
// document_type rows — not the UI's own "requiredXComplete" booleans
// further up in page.js, which also gate on unrelated filled-in text
// fields. profilepic, birthcert, voterid, parentid, and form138 are always
// required; employmentcert only when fam_working_student === 'Yes'
// (matches the already-built conditional logic in page.js). form138 was
// previously left optional in the UI, which didn't match Appendix J
// (a Grade 11/12 report card is required for freshmen) — Sept 20 2026:
// made required in both the UI (page.js) and here, closing that gap.
// indigency, supportdoc, and medcert remain genuinely optional by design
// (proof of income is optional per Appendix J; supportdoc is evidence for
// a rescheduling request, not an admission document; medcert is gated by
// the exam/medical-exam step, not collected up front).
//
// Deliberately one-way: once application_number is set, a later edit that
// makes the application incomplete again (e.g. clearing Working Student)
// never revokes or reassigns it — matches how a real registrar wouldn't
// pull back a number already issued. Only runs against a row that already
// has a real id (the two update paths below), not the brand-new-insert
// path — a document being uploaded before that applicant's very first
// application row exists is an edge case not worth handling here; it's
// picked up on their very next save regardless.
// Shared by maybeAssignApplicationNumber() and the Scholarship Matching
// eligibility check below — both need "which document_type rows exist for
// this applicant", just for different purposes, so this is fetched once per
// request rather than duplicating the same three queries twice.
async function fetchUploadedDocumentTypes({ userId, email, name }) {
  const uploadedTypes = new Set()
  async function addTypes(builder) {
    const { data, error } = await builder
    if (error) throw new Error(error.message)
    for (const d of data || []) uploadedTypes.add(d.document_type)
  }
  if (userId) await addTypes(supabase.from('documents').select('document_type').eq('applicant_user_id', userId))
  // Sept 30 2026: email/name matches only count older documents that were
  // never linked to an account, so another applicant's upload with the same
  // name can never count toward this applicant's requirements.
  if (email) await addTypes(supabase.from('documents').select('document_type').is('applicant_user_id', null).ilike('applicant_email', email))
  if (name) await addTypes(supabase.from('documents').select('document_type').is('applicant_user_id', null).ilike('applicant_name', name))
  return uploadedTypes
}

// The documents an applicant must have uploaded: the ones each section's
// Submit Section already asks for, plus Grades (CCC's Appendix J lists the
// report card for freshmen). Proof of Employment only for a working student.
function requiredDocumentTypes(workingStudent) {
  const requiredTypes = ['profilepic', 'birthcert', 'voterid', 'parentid', 'form138']
  if (workingStudent === 'Yes') requiredTypes.push('employmentcert')
  return requiredTypes
}

const REQUIRED_DOC_LABELS = {
  profilepic: 'Profile Picture',
  birthcert: 'Birth Certificate',
  voterid: "Voter's ID",
  parentid: "Parent/Guardian's Voter's ID",
  form138: 'Grades (Form 138)',
  employmentcert: 'Proof of Employment',
}

// Oct 6 2026: what is still missing before the final Submit Application.
// CCC only counts an application as submitted once its requirements are
// complete (Appendix D, interview #2: "If kumpleto ang requirements may
// application number. If kulang... wala"), so the final Submit now waits
// for Personal Information, Educational Background and Family & Financial
// Information to be submitted, plus the required documents. Health &
// Wellness is completed during enrollment, so it isn't needed here.
function missingForFinalSubmit(row, uploadedTypes) {
  const missing = []
  if (!row?.personal_info_submitted_at) missing.push('submit Personal Information')
  if (!row?.academic_submitted_at) missing.push('submit Educational Background')
  if (!row?.fam_financial_submitted_at) missing.push('submit Family & Financial Information')
  for (const t of requiredDocumentTypes(row?.fam_working_student)) {
    if (!uploadedTypes.has(t)) missing.push(`upload your ${REQUIRED_DOC_LABELS[t]}`)
  }
  return missing
}

// Oct 6 2026: once the final Submit is done, the three profile sections
// that were reviewed (Personal, Educational, Family & Financial) can't be
// changed by the applicant any more. Changes go through the Guidance
// Office, where an admin can edit the submitted data (PR #18, logged and
// the applicant is notified). Health & Wellness stays open because it is
// completed during enrollment, and the email update choice stays open
// too. Before the final Submit every section stays editable, including
// Educational Background (its old lock after Submit Section only greyed
// out the screen and came from the HTML mockup).
const PROFILE_LOCKED_SECTIONS = ['personal', 'academic', 'financial']
const PROFILE_LOCKED_MESSAGE =
  'Your application has been submitted, so this section can no longer be changed here. If something needs to change, please contact the CCC Guidance Office.'

async function countSubmittedThisCycle() {
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .is('archived_at', null) // Oct 5 2026: only this cycle's applicants take a slot
  if (error) throw new Error(error.message)
  return count || 0
}

// Oct 6 2026: the application number is now given at the final Submit, not
// as soon as the documents are uploaded. CCC (Appendix D, interview #2):
// "Sino lang nag submit sila lang may application number. Dapat ganoon den
// sa system." and "If kumpleto ang requirements may application number."
// The final Submit already requires the sections and documents, so both
// hold. Numbers already given before this change are kept.
function maybeAssignApplicationNumber(existingRow, updates, uploadedTypes) {
  if (existingRow.application_number) return {}
  const submittedNow = updates.status === 'submitted' || existingRow.status === 'submitted'
  if (!submittedNow) return {}

  const workingStudent = updates.fam_working_student ?? existingRow.fam_working_student
  const requiredTypes = requiredDocumentTypes(workingStudent)

  const isComplete = requiredTypes.every((t) => uploadedTypes.has(t))
  if (!isComplete) return {}

  const year = new Date().getFullYear()
  return { application_number: `${year}A-${String(existingRow.id).padStart(4, '0')}` }
}

// Scholarship Matching & Filtering (Ivy's former module — see the long
// grounding comment at the top of app/lib/matching.js for what is and
// isn't encoded and why). Recomputed on every save, unlike
// application_number above: nothing here is ever finalized automatically
// (see that file — 'qualified' is never auto-set), so there's no "one-way"
// concern with refreshing it as the applicant edits their profile. An
// admin's manual eligibility_override is a separate column and is left
// alone here — this only ever touches eligibility_status/eligibility_reasons.
function computeEligibilityUpdate(mergedRow, uploadedTypes) {
  const { status, reasons } = computeEligibility(mergedRow, uploadedTypes)
  return { eligibility_status: status, eligibility_reasons: reasons }
}

// GET /api/application?name=Juan+Dela+Cruz&email=juan@example.com
// Looks up an existing draft/submitted application row for this applicant.
// See findApplicationRows() above for how "this applicant" is matched —
// by logged-in account id, email, and/or name, whichever are available —
// and mergeApplicationRows() for how multiple matches (e.g. duplicate
// rows left over from before the Sept 19 2026 race fix below) are
// combined so nothing already saved reads back as blank.
export async function GET(request) {
  try {
    // Sept 30 2026: this used to look an application up by whatever ?name=
    // or ?email= was in the address, signed in or not, and return the whole
    // row, so anyone could read any applicant's application by typing their
    // name. Now it needs the applicant's own sign-in and only ever returns
    // their own application; the ?name/?email the portal still sends are
    // ignored.
    const cookieValue = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const session = await verifyApplicantCookieValue(cookieValue)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const rows = await findOwnRows(session)

    // Oct 6 2026: whether the final Submit is open right now (Applications
    // Open, the acceptance dates, applicant slots), so the portal can say so
    // before the applicant presses it. Same check the submit itself uses.
    let submitBlocked = null
    try {
      submitBlocked = await submitBlockedReason(await getSystemSettings(), {
        alreadySubmitted: rows.some((r) => r.status === 'submitted'),
        countSubmitted: countSubmittedThisCycle,
      })
    } catch (gateErr) {
      console.error('Could not read the submit gate (showing it as open):', gateErr)
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: true, application: null, submitBlocked })
    }

    if (rows.length > 1) {
      console.warn(
        `/api/application: found ${rows.length} rows for this applicant (ids: ${rows.map((r) => r.id).join(', ')}) — merged for this read. Run docs/migrations/2026-09-19-dedupe-applications.sql to clean these up for good.`
      )
    }

    const visible = await resultsVisible()
    const application = applicantSafeRow(mergeApplicationRows(rows), visible)
    // Oct 5 2026: end-of-cycle archive. The portal shows a read-only notice.
    application.archived = rows.some((r) => !!r.archived_at)
    delete application.archived_at
    delete application.archived_by
    delete application.archive_cycle

    // Sept 30 2026: Exam Schedule Alerts. The applicant sees their exam
    // schedule only once an admin has sent it (sent_at set).
    delete application.exam_schedule_id
    const scheduleId = rows.map((r) => r.exam_schedule_id).find(Boolean)
    if (scheduleId) {
      const { data: schedule } = await supabase
        .from('exam_schedules')
        .select('batch_label, exam_date, exam_time, venue, sent_at')
        .eq('id', scheduleId)
        .maybeSingle()
      if (schedule?.sent_at) {
        application.exam_schedule = {
          batch_label: schedule.batch_label,
          exam_date: schedule.exam_date,
          exam_time: schedule.exam_time,
          venue: schedule.venue,
        }
      }
    }

    return NextResponse.json({ success: true, application, submitBlocked })
  } catch (err) {
    return serverError(err, 'api/application')
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
    // Sept 30 2026: saving now needs the applicant's own sign-in too, and
    // the email always comes from that sign-in rather than from the request,
    // so a save can only ever land on the signed-in applicant's own row.
    const cookieValue = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
    const session = await verifyApplicantCookieValue(cookieValue)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    // Oct 5 2026: an archived application is read-only.
    if (await isApplicantArchived(session.id)) {
      return NextResponse.json({ error: ARCHIVED_MESSAGE, archived: true }, { status: 403 })
    }

    // Oct 7 2026: at most 60 saves/submits per applicant in 10 minutes
    // (real use is a few per section).
    const limited = await limitRequest(`application-save:user:${session.id}`, 60, 10 * MINUTE,
      'You are saving very quickly. Please wait a minute and try again.')
    if (limited) return limited

    const body = await request.json()
    const applicantName = (body.applicantName || '').trim()
    const applicantEmail = session.email.trim()
    const step = Number(body.step) || 1
    const action = ['submit', 'submit-section'].includes(body.action) ? body.action : 'save'
    const section = ['academic', 'personal', 'health', 'financial'].includes(body.section) ? body.section : null

    // Sept 22 2026: Application Cycle Settings gate. Only the final
    // submit is blocked when applications are closed -- an autosave
    // ('save') or a section-level submit ('submit-section') for an
    // applicant who already started a draft is left alone, since closing
    // new applications shouldn't strand someone mid-draft.
    // Oct 1 2026: also enforces the Acceptance Start/End dates and Applicant
    // Slots (see submitBlockedReason in app/lib/systemSettings.js).
    if (action === 'submit') {
      try {
        const settings = await getSystemSettings()
        const ownRows = await findOwnRows(session)
        const blocked = await submitBlockedReason(settings, {
          alreadySubmitted: ownRows.some((r) => r.status === 'submitted'),
          countSubmitted: countSubmittedThisCycle,
        })
        if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })
      } catch (settingsErr) {
        console.error('Failed to read system settings (allowing submit):', settingsErr)
      }

      // Oct 6 2026: the final Submit needs the required sections and
      // documents first (see missingForFinalSubmit above). Checked here on
      // the server too, not only by the portal's button.
      const ownRows = await findOwnRows(session)
      if (!ownRows.some((r) => r.status === 'submitted')) {
        const merged = ownRows.length ? mergeApplicationRows(ownRows) : null
        const uploadedTypes = await fetchUploadedDocumentTypes({ userId: session.id, email: session.email, name: merged?.applicant_name })
        const missing = missingForFinalSubmit(merged, uploadedTypes)
        if (missing.length) {
          return NextResponse.json(
            { error: `Before submitting your application, please ${missing.join(', ')}.`, missing },
            { status: 400 }
          )
        }
      }
    }
    // Oct 6 2026: after the final Submit, Personal, Educational and
    // Family & Financial are locked on the server too (see
    // PROFILE_LOCKED_SECTIONS above). A save from the portal sends every
    // section at once, so the locked sections' fields are simply left out
    // of the update and Health & Wellness still saves; re-submitting a
    // locked section is refused.
    let profileLocked = false
    try {
      profileLocked = (await findOwnRows(session)).some((r) => r.status === 'submitted')
    } catch (lockErr) {
      return serverError(lockErr, 'api/application')
    }
    if (profileLocked && action === 'submit-section' && PROFILE_LOCKED_SECTIONS.includes(section)) {
      return NextResponse.json({ error: PROFILE_LOCKED_MESSAGE, locked: true }, { status: 409 })
    }

    // The email update choice is a notification setting, not reviewed
    // answers, so they can still be changed after the final Submit.
    const allPersonalColumns = personalInfoToColumns(body.personalInfo)
    const personalInfoColumns = profileLocked
      ? { email_updates_opt_in: allPersonalColumns.email_updates_opt_in }
      : allPersonalColumns
    const academicInfoColumns = profileLocked ? {} : academicInfoToColumns(body.academicInfo)
    const healthInfoColumns = healthInfoToColumns(body.healthInfo)
    const familyInfoColumns = profileLocked ? {} : familyInfoToColumns(body.familyInfo)

    // Sept 19 2026 fix: every save used to go through purely on the typed
    // applicant name, never stamping `applicant_user_id` — so a row saved
    // this way (rather than one pre-created at signup from staged Personal
    // Information, see applicantAccounts.js's activateApplicantAccount())
    // stayed unlinked from the account forever. Login's own display-name
    // lookup matches on `applicant_user_id`, so with it never set, every
    // login rendered a blank display name, `applicantName` on the client
    // initialized to '', and the portal's own auto-load effect (which
    // bails out on an empty name) never fetched anything back — the
    // applicant's saved data was sitting safely in Supabase the whole
    // time, it just could never be found again after a refresh/re-login.
    // Reading the session cookie here (same verified way
    // /api/applicant-session does) and stamping it on every save closes
    // that gap going forward.
    const applicantUserId = session.id

    if (!applicantName) {
      return NextResponse.json({ error: 'Missing applicant name' }, { status: 400 })
    }
    if (action === 'submit-section' && !section) {
      return NextResponse.json({ error: 'Missing or invalid section' }, { status: 400 })
    }
    // Oct 6 2026: Appendix J p. 96 rule a. Educational Background can't be
    // submitted with a BSEd Mathematics / Science choice and no SHS grade.
    if (
      action === 'submit-section' &&
      section === 'academic' &&
      !profileLocked &&
      (academicInfoColumns.program_choice_1 || academicInfoColumns.program_choice_2) &&
      needsShsMathScienceGrade(academicInfoColumns) &&
      academicInfoColumns.shs_math_science_lowest === null
    ) {
      return NextResponse.json(
        { error: 'Please type the lowest Senior High grade in your Mathematics and Science subjects (60 to 100). It is needed for BSEd Mathematics and BSEd Science.' },
        { status: 400 }
      )
    }

    // Find any existing row for this applicant first (draft or submitted)
    // — matched by account id/email/name the same way GET does (see
    // findApplicationRows() above), not name alone, so a save can never
    // land on the wrong row (or a brand new duplicate row) just because
    // the typed name and the row's saved name happen to differ.
    let existing
    try {
      const rows = await findOwnRows(session)
      existing = rows[0] || null
    } catch (findError) {
      return serverError(findError, 'api/application')
    }

    const now = new Date().toISOString()

    if (existing) {
      const updates = {
        // Sept 19 2026 fix: this never included applicant_name, so
        // renaming yourself in Personal Information (typing a new
        // First/Last Name) correctly updated first_name/last_name but
        // left the row's own applicant_name column stuck on whatever it
        // was first saved as — findApplicationRows() above still finds
        // the right row afterward (it matches by account id/email
        // first), so saves kept working, but the row's applicant_name
        // silently drifted out of sync with what the applicant actually
        // typed, and any lookup that keys off applicant_name (a direct
        // SQL check, or a document upload matched by name) would miss it.
        applicant_name: (!profileLocked && applicantName) || existing.applicant_name,
        applicant_email: applicantEmail || existing.applicant_email,
        applicant_user_id: applicantUserId || existing.applicant_user_id,
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
        if (section === 'financial') updates.fam_financial_submitted_at = now
      }

      const uploadedTypes = await fetchUploadedDocumentTypes({
        userId: applicantUserId || existing.applicant_user_id,
        email: applicantEmail || existing.applicant_email,
        name: applicantName || existing.applicant_name,
      })
      Object.assign(updates, maybeAssignApplicationNumber(existing, updates, uploadedTypes))
      Object.assign(updates, computeEligibilityUpdate({ ...existing, ...updates }, uploadedTypes))

      const { data, error } = await supabase
        .from('applications')
        .update(encryptApplicationFields(updates))
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return serverError(error, 'api/application')
      }

      if (action === 'submit') {
        await sendSubmissionEmail(applicantName, data.applicant_email)
      }
      await logSubmission(action, section, data, applicantName, applicantEmail)

      return NextResponse.json({ success: true, application: applicantSafeRow(decryptApplicationFields(data), await resultsVisible()) })
    }

    // No existing row — create one.
    const insertPayload = {
      applicant_name: applicantName,
      applicant_email: applicantEmail || null,
      applicant_user_id: applicantUserId,
      current_step: step,
      status: action === 'submit' ? 'submitted' : 'draft',
      submitted_at: action === 'submit' ? now : null,
      personal_info_submitted_at: action === 'submit-section' && section === 'personal' ? now : null,
      academic_submitted_at: action === 'submit-section' && section === 'academic' ? now : null,
      health_submitted_at: action === 'submit-section' && section === 'health' ? now : null,
      fam_financial_submitted_at: action === 'submit-section' && section === 'financial' ? now : null,
      ...personalInfoColumns,
      ...academicInfoColumns,
      ...healthInfoColumns,
      ...familyInfoColumns,
    }

    // No application id yet on a brand-new row (unlike
    // maybeAssignApplicationNumber, which needs the row's real id and so
    // only ever runs on the two update paths), but eligibility doesn't need
    // one — documents are looked up by account id/email/name, not by
    // application row id — so this can run here too, giving a first-time
    // applicant an accurate eligibility_status from their very first save.
    Object.assign(
      insertPayload,
      computeEligibilityUpdate(
        insertPayload,
        await fetchUploadedDocumentTypes({ userId: applicantUserId, email: applicantEmail, name: applicantName })
      )
    )

    let { data, error } = await supabase
      .from('applications')
      .insert([encryptApplicationFields(insertPayload)])
      .select()
      .single()

    // Race fallback: another save for the same applicant landed its own
    // INSERT between our "does a row exist?" check above and this one
    // (see the GET handler's comment above for how that used to produce
    // duplicate rows). Once docs/migrations/2026-09-19-dedupe-applications.sql
    // has been run, `applicant_name` is unique and Postgres reports that
    // as error code 23505 instead of silently letting a second row
    // through — so instead of failing the save, just update the row the
    // other request created.
    if (error && error.code === '23505') {
      const { data: raceExisting, error: raceFindError } = await supabase
        .from('applications')
        .select('*')
        .ilike('applicant_name', applicantName)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (raceFindError || !raceExisting) {
        return serverError(raceFindError || new Error('Save failed after a duplicate-name conflict'), 'application')
      }
      // Sept 30 2026: the name belongs to someone else's application. Never
      // write over it; the applicant has to sort it out with the office.
      if (!ownsRow(raceExisting, session)) {
        return NextResponse.json(
          { error: 'An application under this name already exists. Please contact the Guidance Office.' },
          { status: 409 }
        )
      }

      const updates = {
        applicant_name: (!profileLocked && applicantName) || raceExisting.applicant_name,
        applicant_email: applicantEmail || raceExisting.applicant_email,
        applicant_user_id: applicantUserId || raceExisting.applicant_user_id,
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
        if (section === 'financial') updates.fam_financial_submitted_at = now
      }

      const raceUploadedTypes = await fetchUploadedDocumentTypes({
        userId: applicantUserId || raceExisting.applicant_user_id,
        email: applicantEmail || raceExisting.applicant_email,
        name: applicantName || raceExisting.applicant_name,
      })
      Object.assign(updates, maybeAssignApplicationNumber(raceExisting, updates, raceUploadedTypes))
      Object.assign(updates, computeEligibilityUpdate({ ...raceExisting, ...updates }, raceUploadedTypes))

      const retried = await supabase
        .from('applications')
        .update(encryptApplicationFields(updates))
        .eq('id', raceExisting.id)
        .select()
        .single()
      data = retried.data
      error = retried.error
    }

    if (error) {
      return serverError(error, 'api/application')
    }

    if (action === 'submit') {
      await sendSubmissionEmail(applicantName, data.applicant_email)
    }
    await logSubmission(action, section, data, applicantName, applicantEmail)

    return NextResponse.json({ success: true, application: applicantSafeRow(decryptApplicationFields(data), await resultsVisible()) })
  } catch (err) {
    return serverError(err, 'api/application')
  }
}

// Oct 12 2026: section and final submissions go to the Activity Log
// (autosaves don't).
async function logSubmission(action, section, data, applicantName, applicantEmail) {
  if (action !== 'submit' && action !== 'submit-section') return
  const sectionLabel = {
    personal: 'Personal Information',
    academic: 'Educational Background',
    health: 'Health & Wellness',
    financial: 'Family & Financial Information',
  }[section]
  await logApplicantActivity(
    applicantLabel(data?.applicant_name || applicantName, data?.applicant_email || applicantEmail),
    action === 'submit'
      ? `Applicant submitted their application${data?.application_number ? ` (${data.application_number})` : ''}`
      : `Applicant submitted ${sectionLabel || 'a section'}`
  )
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
//   ADD COLUMN IF NOT EXISTS fam_financial_submitted_at timestamptz;
//
// Renamed from financial_submitted_at (design-parity/naming-clarity pass,
// Sept 20 2026) — also committed as
// docs/migrations/2026-09-20-rename-financial-submitted-at.sql:
//
// ALTER TABLE applications
//   RENAME COLUMN financial_submitted_at TO fam_financial_submitted_at;
//
// Scholarship Matching & Filtering (Sept 20 2026) — transferee academic
// fields (Educational Background panel) and the computed eligibility
// result (see app/lib/matching.js) — also committed as
// docs/migrations/2026-09-20-scholarship-matching.sql:
//
// ALTER TABLE applications
//   ADD COLUMN IF NOT EXISTS transferee_gwa numeric,
//   ADD COLUMN IF NOT EXISTS transferee_units_passed integer,
//   ADD COLUMN IF NOT EXISTS transferee_failing_grade text,
//   ADD COLUMN IF NOT EXISTS eligibility_status text,
//   ADD COLUMN IF NOT EXISTS eligibility_reasons jsonb DEFAULT '[]'::jsonb,
//   ADD COLUMN IF NOT EXISTS eligibility_override text,
//   ADD COLUMN IF NOT EXISTS eligibility_override_by text,
//   ADD COLUMN IF NOT EXISTS eligibility_override_at timestamptz;
// ============================================================================