import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { getSystemSettings, updateSystemSettings } from '@/app/lib/systemSettings'

// Backs the Application Cycle Settings card. Super Admin only, same as
// the rest of the System & Activity panel.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    if (!session.isSuperAdmin) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })

    const settings = await getSystemSettings()
    return NextResponse.json({ success: true, settings })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    if (!session.isSuperAdmin) return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })

    const patch = await request.json()
    if (patch.applicant_slots != null && (!Number.isFinite(Number(patch.applicant_slots)) || Number(patch.applicant_slots) < 0)) {
      return NextResponse.json({ error: 'Applicant slots must be a positive number.' }, { status: 400 })
    }

    const settings = await updateSystemSettings(patch, session.name)

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Updated Application Cycle Settings (Applications ${settings.applications_open ? 'Open' : 'Closed'}, Document Uploads ${settings.document_uploads_enabled ? 'Enabled' : 'Disabled'})`,
          kind: 'done',
          category: 'System',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, settings })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
