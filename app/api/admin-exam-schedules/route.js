import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { BATCH_SIZE, isSchedulable, buildScheduleDraft, sendScheduleEmails } from '@/app/lib/examSchedules'

// Sept 30 2026: Exam Schedule Alerts (Notifications Module).
//
// Any signed-in admin can create an exam batch, which is filled
// automatically with the next applicants in submission order (first 100
// submissions = first batch, per the client interview), review/remove
// people, then send the schedule. Sending posts a private portal message to
// everyone in the batch and emails only those who ticked "I want to receive
// email updates". Members can only change before the batch is sent.
//
// GET                -> all batches with their applicants, and how many
//                       applicants are still waiting for a batch
// GET ?draft=<id>    -> the starting subject/message for that batch
// POST { action: 'create', batchLabel, examDate, examTime, venue, notes }
// POST { action: 'fill', scheduleId }
// POST { action: 'remove', scheduleId, applicationId }
// POST { action: 'delete', scheduleId }
// POST { action: 'send', scheduleId, subject, message, resend? }

const APP_FIELDS =
  'id, applicant_name, applicant_email, application_number, email_updates_opt_in, submitted_at, ' +
  'status, eligibility_status, eligibility_override, scholar_status, exam_schedule_id'

async function requireAdmin(request) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminCookieValue(cookie)
}

async function loadSchedule(id) {
  const { data, error } = await supabase.from('exam_schedules').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function loadMembers(scheduleId) {
  const { data, error } = await supabase.from('applications').select(APP_FIELDS).eq('exam_schedule_id', scheduleId)
  if (error) throw new Error(error.message)
  return (data || []).sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
}

async function waitingApplicants() {
  const { data, error } = await supabase.from('applications').select(APP_FIELDS).eq('status', 'submitted')
  if (error) throw new Error(error.message)
  return (data || [])
    .filter(isSchedulable)
    .sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
}

async function audit(actor, action, kind = 'done') {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'Communications' }])
  } catch (err) {
    console.error('Audit log insert failed (non-blocking):', err)
  }
}

// Adds the next waiting applicants (by submission time) until the batch has
// BATCH_SIZE people. The .is(null) guard stops two admins from putting the
// same applicant in two batches at once.
async function fillSchedule(scheduleId) {
  const members = await loadMembers(scheduleId)
  const room = BATCH_SIZE - members.length
  if (room <= 0) return 0
  const next = (await waitingApplicants()).slice(0, room)
  if (next.length === 0) return 0
  const { error } = await supabase
    .from('applications')
    .update({ exam_schedule_id: scheduleId })
    .in('id', next.map((a) => a.id))
    .is('exam_schedule_id', null)
  if (error) throw new Error(error.message)
  return next.length
}

export async function GET(request) {
  try {
    const adminName = await requireAdmin(request)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const draftId = new URL(request.url).searchParams.get('draft')
    if (draftId) {
      const schedule = await loadSchedule(draftId)
      if (!schedule) return NextResponse.json({ error: 'Exam batch not found.' }, { status: 404 })
      return NextResponse.json({ success: true, ...buildScheduleDraft(schedule) })
    }

    const { data: schedules, error } = await supabase
      .from('exam_schedules')
      .select('*')
      .order('exam_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: assigned, error: appsError } = await supabase
      .from('applications')
      .select(APP_FIELDS)
      .not('exam_schedule_id', 'is', null)
    if (appsError) return NextResponse.json({ error: appsError.message }, { status: 500 })

    const bySchedule = new Map()
    for (const app of assigned || []) {
      if (!bySchedule.has(app.exam_schedule_id)) bySchedule.set(app.exam_schedule_id, [])
      bySchedule.get(app.exam_schedule_id).push({
        id: app.id,
        applicant_name: app.applicant_name,
        applicant_email: app.applicant_email,
        application_number: app.application_number,
        email_updates_opt_in: !!app.email_updates_opt_in,
        submitted_at: app.submitted_at,
      })
    }
    for (const list of bySchedule.values()) {
      list.sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
    }

    const waiting = await waitingApplicants()

    return NextResponse.json({
      success: true,
      batchSize: BATCH_SIZE,
      waitingCount: waiting.length,
      schedules: (schedules || []).map((s) => ({ ...s, applicants: bySchedule.get(s.id) || [] })),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function cleanText(value, max) {
  const text = (value || '').toString().trim()
  return text.length > max ? null : text
}

export async function POST(request) {
  try {
    const adminName = await requireAdmin(request)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const body = await request.json()
    const action = body.action

    if (action === 'create') {
      const batchLabel = cleanText(body.batchLabel, 80)
      const examTime = cleanText(body.examTime, 40)
      const venue = cleanText(body.venue, 150)
      const notes = cleanText(body.notes, 1000)
      const examDate = (body.examDate || '').toString()
      if (!batchLabel) return NextResponse.json({ error: 'Give the batch a name (up to 80 characters).' }, { status: 400 })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return NextResponse.json({ error: 'Pick the exam date.' }, { status: 400 })
      // Sept 30 2026: the admin screen now uses time pickers; this also
      // rejects free text sent some other way.
      const TIME = '(1[0-2]|[1-9]):[0-5]\\d (AM|PM)'
      if (examTime && !new RegExp(`^${TIME}( to ${TIME})?$`).test(examTime)) {
        return NextResponse.json({ error: 'Pick the exam time with the time picker.' }, { status: 400 })
      }
      if (examTime === null || venue === null || notes === null) {
        return NextResponse.json({ error: 'Time, venue or notes is too long.' }, { status: 400 })
      }

      const { data: schedule, error } = await supabase
        .from('exam_schedules')
        .insert([{ batch_label: batchLabel, exam_date: examDate, exam_time: examTime || null, venue: venue || null, notes: notes || null, created_by: adminName }])
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const added = await fillSchedule(schedule.id)
      await audit(adminName, `Created exam batch "${batchLabel}" (${examDate}) with ${added} applicant(s)`)
      return NextResponse.json({ success: true, scheduleId: schedule.id, added })
    }

    const scheduleId = body.scheduleId
    if (!scheduleId) return NextResponse.json({ error: 'Missing exam batch.' }, { status: 400 })
    const schedule = await loadSchedule(scheduleId)
    if (!schedule) return NextResponse.json({ error: 'Exam batch not found.' }, { status: 404 })

    const locked = !!schedule.sent_at
    const lockedResponse = NextResponse.json(
      { error: 'This batch was already sent, so its applicants can no longer be changed.' },
      { status: 409 }
    )

    if (action === 'fill') {
      if (locked) return lockedResponse
      const added = await fillSchedule(schedule.id)
      if (added > 0) await audit(adminName, `Added ${added} applicant(s) to exam batch "${schedule.batch_label}"`)
      return NextResponse.json({ success: true, added })
    }

    if (action === 'remove') {
      if (locked) return lockedResponse
      const { data: app } = await supabase
        .from('applications')
        .select('id, applicant_name')
        .eq('id', body.applicationId)
        .eq('exam_schedule_id', schedule.id)
        .maybeSingle()
      if (!app) return NextResponse.json({ error: 'That applicant is not in this batch.' }, { status: 404 })
      const { error } = await supabase.from('applications').update({ exam_schedule_id: null }).eq('id', app.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit(adminName, `Removed ${app.applicant_name || 'an applicant'} from exam batch "${schedule.batch_label}"`)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      if (locked) return lockedResponse
      const { error: clearError } = await supabase
        .from('applications')
        .update({ exam_schedule_id: null })
        .eq('exam_schedule_id', schedule.id)
      if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })
      const { error } = await supabase.from('exam_schedules').delete().eq('id', schedule.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await audit(adminName, `Deleted exam batch "${schedule.batch_label}" before sending`, 'warn')
      return NextResponse.json({ success: true })
    }

    if (action === 'send') {
      const subject = (body.subject || '').trim()
      const message = (body.message || '').trim()
      if (!subject || !message) return NextResponse.json({ error: 'Subject and message are both required.' }, { status: 400 })
      if (subject.length > 150 || message.length > 4000) {
        return NextResponse.json({ error: 'Subject or message is too long.' }, { status: 400 })
      }
      if (locked && !body.resend) {
        return NextResponse.json(
          { error: 'This batch was already sent. Confirm to send it again.', alreadySent: true },
          { status: 409 }
        )
      }

      const members = await loadMembers(schedule.id)
      if (members.length === 0) return NextResponse.json({ error: 'This batch has no applicants yet.' }, { status: 400 })

      // 1. Private portal message for everyone in the batch.
      const { error: postError } = await supabase.from('announcements').insert(
        members.map((app) => ({
          author: adminName,
          title: subject,
          body: message,
          category: 'Examination',
          type: 'message',
          target_type: 'specific',
          target_application_id: app.id,
          target_category: null,
        }))
      )
      if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

      // 2. Email only the applicants who opted in.
      const addresses = members.filter((a) => a.email_updates_opt_in && a.applicant_email).map((a) => a.applicant_email)
      const email = await sendScheduleEmails(addresses, { subject, message })

      // 3. Remember that it was sent (this also locks the member list).
      const { error: updateError } = await supabase
        .from('exam_schedules')
        .update({ sent_at: new Date().toISOString(), sent_by: adminName })
        .eq('id', schedule.id)
      if (updateError) console.error('Saving exam_schedules.sent_at failed:', updateError.message)

      await audit(
        adminName,
        `${locked ? 'Re-sent' : 'Sent'} exam schedule "${schedule.batch_label}" to ${members.length} applicant(s) (${email.sent} email(s) sent${email.failed ? `, ${email.failed} failed` : ''})`,
        email.failed ? 'warn' : 'done'
      )

      let note = `Sent to ${members.length} applicant(s) in the portal.`
      if (addresses.length === 0) note += ' Nobody in this batch opted in to email.'
      else if (email.failed) note += ` The emails could not be sent (${email.error}). The portal messages still went out.`
      else note += ` ${email.sent} email(s) sent to applicants who opted in.`

      return NextResponse.json({ success: true, portal: members.length, emailed: email.sent, emailFailed: email.failed, note })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
