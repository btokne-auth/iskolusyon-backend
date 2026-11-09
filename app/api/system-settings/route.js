import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { getSystemSettings, updateSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'

// Backs the Application Cycle Settings card.
// Nov 2026 (panel revisions S8): Guidance Head only. Opening/closing
// applications, slots, dates and result release belong to the unit that
// runs admissions, not to the System Admin.
export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['guidance_head'])
    if (!session) return response

    const settings = await getSystemSettings()
    return NextResponse.json({ success: true, settings })
  } catch (err) {
    return serverError(err, 'api/system-settings')
  }
}

export async function PATCH(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['guidance_head'])
    if (!session) return response

    const patch = await request.json()
    if (patch.applicant_slots != null && (!Number.isFinite(Number(patch.applicant_slots)) || Number(patch.applicant_slots) < 0)) {
      return NextResponse.json({ error: 'Applicant slots must be a positive number.' }, { status: 400 })
    }
    const isDate = (v) => v == null || v === '' || /^\d{4}-\d{2}-\d{2}$/.test(String(v))
    if (!isDate(patch.acceptance_start_date) || !isDate(patch.acceptance_end_date)) {
      return NextResponse.json({ error: 'Pick the acceptance dates with the date picker.' }, { status: 400 })
    }
    if (patch.acceptance_start_date && patch.acceptance_end_date && patch.acceptance_end_date < patch.acceptance_start_date) {
      return NextResponse.json({ error: 'The acceptance end date has to be on or after the start date.' }, { status: 400 })
    }

    const settings = await updateSystemSettings(patch, session.name)

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Updated Application Cycle Settings (Applications ${settings.applications_open ? 'Open' : 'Closed'}, Document Uploads ${settings.document_uploads_enabled ? 'Enabled' : 'Disabled'}, Exam Results ${settings.exam_results_visible ? 'Visible' : 'Hidden'}${settings.acceptance_start_date || settings.acceptance_end_date ? `, Accepting ${settings.acceptance_start_date || 'any date'} to ${settings.acceptance_end_date || 'any date'}` : ''}${settings.applicant_slots != null ? `, ${settings.applicant_slots} slots` : ''})`,
          kind: 'done',
          category: 'System',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, settings })
  } catch (err) {
    return serverError(err, 'api/system-settings')
  }
}
