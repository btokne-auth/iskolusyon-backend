import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'

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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, announcements: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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
        if (applicantError) return NextResponse.json({ error: applicantError.message }, { status: 500 })
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action:
            type === 'message'
              ? `Sent a message to ${targetLabel} — "${title.trim()}"`
              : `Posted announcement — "${title.trim()}"`,
          kind: 'done',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, announcement: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Removed ${existing.type === 'message' ? 'message' : 'announcement'} — "${existing.title}"`,
          kind: 'warn',
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
