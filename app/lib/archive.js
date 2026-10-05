// Oct 5 2026: end-of-cycle archive (Progress Table row 74, archive part).
// Archived applications stay in the database with archived_at set. They
// leave every admin list and count, admins can't change them, and the
// applicant keeps read-only access to their portal.

import { supabase } from '@/app/supabaseClient'

export const ARCHIVED_MESSAGE =
  'This application cycle has closed and your application was archived. You can still view it, but it can no longer be changed.'

// applicant_user_id values of archived applications (to leave their
// documents and requests out of admin lists).
// These checks fail open (log and carry on) so a hiccup never blocks normal
// work; the archive itself is only ever set by /api/archive-cycle.
export async function archivedUserIds() {
  const { data, error } = await supabase
    .from('applications')
    .select('applicant_user_id')
    .not('archived_at', 'is', null)
  if (error) {
    console.error('Archived applicants lookup failed (showing everyone):', error.message)
    return new Set()
  }
  return new Set((data || []).map((r) => r.applicant_user_id).filter(Boolean))
}

export async function isApplicationArchived(applicationId) {
  if (!applicationId) return false
  const { data, error } = await supabase
    .from('applications')
    .select('archived_at')
    .eq('id', applicationId)
    .maybeSingle()
  if (error) {
    console.error('Archive check failed (allowing):', error.message)
    return false
  }
  return !!data?.archived_at
}

// Does this signed-in applicant's application belong to an archived cycle?
export async function isApplicantArchived(applicantUserId) {
  if (!applicantUserId) return false
  const { data, error } = await supabase
    .from('applications')
    .select('archived_at')
    .eq('applicant_user_id', applicantUserId)
    .not('archived_at', 'is', null)
    .limit(1)
  if (error) {
    console.error('Archive check failed (allowing):', error.message)
    return false
  }
  return (data || []).length > 0
}
