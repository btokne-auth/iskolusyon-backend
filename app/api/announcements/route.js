import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { serverError } from '@/app/lib/safeError'

// Backs the admin portal's Communications panel. Real and persisted (not a
// mockup shell) — any signed-in admin can post, any signed-in admin can
// read.
//
// Sept 22 2026: extended from public-announcements-only to also carry
// Ivy's private, targeted "Message" type (see docs/migrations/2026-09-22-
// communications-targeting.sql for the new columns and why they're
// shaped this way). The applicant-facing read side lives in
// /api/portal-messages, not here — this GET is the admin's own "everything
// I've ever posted" view and stays cookie-gated to admins only, same as
// before.
const VALID_CATEGORIES = new Set(['General', 'Exam', 'Deficiency', 'Result', 'Others'])
const VALID_ELIGIBILITY_CATEGORIES = new Set(['qualified', 'waitlisted', 'not_qualified', 'pending_exam', 'incomplete'])

// { [announcementId]: [{ name, at }] }, newest first. Empty if the
// Oct 16 migration hasn't run yet.
async function acknowledgmentsFor(ids) {
  const out = {}
  const { data: acks, error } = await supabase
    .from('message_acknowledgments')
    .select('announcement_id, applicant_user_id, acknowledged_at')
    .in('announcement_id', ids)
    .order('acknowledged_at', { ascending: false })
  if (error || !acks || acks.length === 0) return out
  const userIds = [...new Set(acks.map((a) => a.applicant_user_id))]
  const { data: apps } = await supabase.from('applications').select('applicant_user_id, applicant_name').in('applicant_user_id', userIds)
  const nameOf = new Map((apps || []).map((a) => [a.applicant_user_id, a.applicant_name]))
  for (const a of acks) {
    ;(out[a.announcement_id] = out[a.announcement_id] || []).push({ name: nameOf.get(a.applicant_user_id) || 'Applicant', at: a.acknowledged_at })
  }
  return out
}

export async function GET(request) {
  try {
    // Sept 30 2026: this used to hand EVERY row to anyone who asked, private
    // messages included (the public home page just hid them in the browser).
    // Now only a signed-in admin gets everything; anyone else, including
    // signed-in applicants, gets the public announcements only. Applicants
    // read their own private messages through /api/portal-messages.
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)

    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!session) query = query.eq('type', 'announcement')

    const { data, error } = await query

    if (error) return serverError(error, 'api/announcements')

    // Oct 16 2026: admins also see who confirmed reading each post (name and
    // time). Never sent to the public guest page.
    let acknowledgments = {}
    if (session && data && data.length) {
      acknowledgments = await acknowledgmentsFor(data.map((p) => p.id))
    }
    return NextResponse.json({ success: true, announcements: data, acknowledgments })
  } catch (err) {
    return serverError(err, 'api/announcements')
  }
}

export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const {
      title,
      body,
      category,
      type = 'announcement',
      targetType,
      targetApplicationId,
      targetCategory,
    } = await request.json()

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and message body are required.' }, { status: 400 })
    }
    if (type !== 'announcement' && type !== 'message') {
      return NextResponse.json({ error: 'Unknown post type.' }, { status: 400 })
    }
    if (category && !VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })
    }

    const row = {
      author: session.name,
      title: title.trim(),
      body: body.trim(),
      category: category || null,
      type,
      target_type: null,
      target_application_id: null,
      target_category: null,
    }

    let targetLabel = 'All Applicants'
    if (type === 'message') {
      if (targetType !== 'all' && targetType !== 'specific' && targetType !== 'category') {
        return NextResponse.json({ error: 'Unknown message target.' }, { status: 400 })
      }
      row.target_type = targetType
      if (targetType === 'specific') {
        if (!targetApplicationId) {
          return NextResponse.json({ error: 'Pick which applicant this message goes to.' }, { status: 400 })
        }
        const { data: applicant, error: applicantError } = await supabase
          .from('applications')
          .select('id, applicant_name')
          .eq('id', targetApplicationId)
          .maybeSingle()
        if (applicantError) return serverError(applicantError, 'api/announcements')
        if (!applicant) return NextResponse.json({ error: 'That applicant no longer exists.' }, { status: 400 })
        row.target_application_id = applicant.id
        targetLabel = applicant.applicant_name || 'an applicant'
      } else if (targetType === 'category') {
        if (!VALID_ELIGIBILITY_CATEGORIES.has(targetCategory)) {
          return NextResponse.json({ error: 'Unknown applicant category.' }, { status: 400 })
        }
        row.target_category = targetCategory
        targetLabel = targetCategory
      }
    }

    const { data, error } = await supabase.from('announcements').insert([row]).select().single()

    if (error) return serverError(error, 'api/announcements')

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action:
            type === 'message'
              ? `Sent a message to ${targetLabel}: "${title.trim()}"`
              : `Posted announcement: "${title.trim()}"`,
          kind: 'done',
          category: 'Communications',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, announcement: data })
  } catch (err) {
    return serverError(err, 'api/announcements')
  }
}

// Delete, matching Ivy's mockup's trash-icon-per-row (deleteAnnouncement()/
// deleteMessage() — same one row shape here, so one handler covers both).
export async function DELETE(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })

    const { data: existing, error: fetchError } = await supabase
      .from('announcements')
      .select('title, type')
      .eq('id', id)
      .maybeSingle()
    if (fetchError) return serverError(fetchError, 'api/announcements')
    if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return serverError(error, 'api/announcements')

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Removed ${existing.type === 'message' ? 'message' : 'announcement'}: "${existing.title}"`,
          kind: 'warn',
          category: 'Communications',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/announcements')
  }
}
