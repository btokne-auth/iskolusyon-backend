import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { serverError } from '@/app/lib/safeError'
import { dashboardCounts } from '@/app/lib/dashboardCounts'

// Nov 2026 (panel revisions S8): the System Admin's Dashboard. Counts only,
// the same six cards the Registrar sees. No names, no documents, no
// applicant details: the System Admin runs the system, not admissions
// (least privilege; Data Privacy Act, need-to-know). The counts let it see
// that the system is in use and working.
export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['super_admin'])
    if (!session) return response

    const { data: apps, error } = await supabase
      .from('applications')
      .select('applicant_user_id, scholar_status, eligibility_status, eligibility_override')
      .is('archived_at', null)
    if (error) return serverError(error, 'api/console-summary')

    const { data: requests } = await supabase.from('reschedule_requests').select('request_type, applicant_user_id, applicant_email, applicant_name')
    const counts = dashboardCounts(apps, requests)

    return NextResponse.json({ success: true, counts })
  } catch (err) {
    return serverError(err, 'api/console-summary')
  }
}
