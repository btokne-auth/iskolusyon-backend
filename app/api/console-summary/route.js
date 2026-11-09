import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { serverError } from '@/app/lib/safeError'

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
      .select('applicant_user_id, eligibility_status, eligibility_override')
      .is('archived_at', null)
    if (error) return serverError(error, 'api/console-summary')

    const counts = { all: 0, incomplete: 0, qualified: 0, not_qualified: 0, waitlisted: 0, appealed: 0 }
    for (const app of apps || []) {
      counts.all += 1
      const status = app.eligibility_override || app.eligibility_status || 'incomplete'
      if (status in counts && status !== 'all' && status !== 'appealed') counts[status] += 1
    }
    const { data: requests } = await supabase.from('reschedule_requests').select('request_type, applicant_user_id, applicant_email, applicant_name')
    const activeUsers = new Set((apps || []).map((app) => app.applicant_user_id).filter(Boolean))
    counts.appealed = new Set(
      (requests || [])
        .filter((r) => (r.request_type || '').startsWith('Appeal'))
        .filter((r) => !r.applicant_user_id || activeUsers.has(r.applicant_user_id))
        .map((r) => r.applicant_user_id || r.applicant_email || r.applicant_name)
    ).size

    return NextResponse.json({ success: true, counts })
  } catch (err) {
    return serverError(err, 'api/console-summary')
  }
}
