import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { checkLock } from '@/app/lib/applicantLocks'
import { loadConflicts } from '@/app/lib/conflicts'

// Qualification Conflict Detection (Oct 6 2026). See app/lib/conflicts.js.
//
// GET  -> { success, conflicts: { [applicationId]: [ ...conflict, checked ] } }
// POST { applicationId, key, note } -> marks one conflict as checked.
//
// Admin and Super Admin only (verifyAdminCookieValue refuses the Registrar
// and LGU roles, same as every other Dashboard route). New routes reply
// with plain messages and log the details on the server.

export async function GET(request) {
  try {
    const adminName = await verifyAdminCookieValue(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    const conflicts = await loadConflicts({ onlyId: id || null })
    return NextResponse.json({ success: true, conflicts })
  } catch (err) {
    console.error('admin-conflicts GET failed:', err)
    return NextResponse.json({ error: 'Could not check for conflicts right now.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const adminName = await verifyAdminCookieValue(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const applicationId = body?.applicationId
    const key = typeof body?.key === 'string' ? body.key : ''
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''
    if (!applicationId || !key) return NextResponse.json({ error: 'Missing applicant or conflict.' }, { status: 400 })

    const locked = await checkLock(request, applicationId)
    if (locked) return locked

    // Only a conflict that really exists right now can be marked.
    const current = await loadConflicts({ onlyId: applicationId })
    const item = (current[applicationId] || []).find((c) => c.key === key)
    if (!item) {
      return NextResponse.json({ error: 'This conflict is no longer there. Refresh to see the latest.' }, { status: 409 })
    }
    if (item.checked) return NextResponse.json({ success: true, alreadyChecked: true })

    const { error: insertError } = await supabase
      .from('conflict_checks')
      .insert([{ application_id: applicationId, conflict_key: key, note: note || null, checked_by: adminName }])
    if (insertError) {
      if (insertError.code === '23505') return NextResponse.json({ success: true, alreadyChecked: true })
      console.error('conflict_checks insert failed:', insertError)
      return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
    }

    const { data: app } = await supabase.from('applications').select('applicant_name').eq('id', applicationId).maybeSingle()
    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `Checked a conflict for ${app?.applicant_name || 'an applicant'}: ${item.what} (profile "${item.typed}", document "${item.read}")${note ? `. Note: ${note}` : ''}`,
          kind: 'done',
          category: 'Eligibility',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin-conflicts POST failed:', err)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
