import { supabase } from '@/app/supabaseClient'

// Nov 2026 (panel revisions S4): applicant data is temporary; only applicants
// accepted as students stay as a permanent record. After a cycle is archived
// (which already needs Applications Open off and CHED Form 3 exported), the
// Guidance Head can remove the data of everyone who was not accepted.
//
// Kept: the same results CHED Form 3 counts as passed (Passer, Qualified
// Probationary). Removed: everyone else in that archived cycle (Waitlisted,
// Not Qualified, Disqualified, Forfeited, never finished), with their
// uploaded files, requests, private messages and sign-in account.
export const KEPT_STATUSES = ['passer', 'qualified_probationary']
export const RETENTION_CONFIRM_PREFIX = 'REMOVE'

export function isKept(row) {
  return KEPT_STATUSES.includes(row.scholar_status)
}

async function removeFile(path) {
  if (!path) return
  try {
    await supabase.storage.from('scholarship-documents').remove([path])
  } catch (err) {
    console.error('File removal failed (non-blocking):', err)
  }
}

// Removes one applicant's data. Throws on a database error so the caller can
// stop and report it; storage clean-up is best-effort.
async function removeApplicant(app) {
  const uid = app.applicant_user_id
  const email = app.applicant_email || null

  // Uploaded documents (and the text read from them).
  let docs = []
  if (uid) {
    const { data, error } = await supabase.from('documents').select('file_path').eq('applicant_user_id', uid)
    if (error) throw new Error(error.message)
    docs = data || []
  }
  if (email) {
    const { data } = await supabase.from('documents').select('file_path').is('applicant_user_id', null).ilike('applicant_email', email)
    docs = docs.concat(data || [])
  }
  for (const d of docs) {
    await supabase.from('extracted_fields').delete().eq('file_path', d.file_path)
    const { error } = await supabase.from('documents').delete().eq('file_path', d.file_path)
    if (error) throw new Error(error.message)
    await removeFile(d.file_path)
  }

  // Reschedule / appeal requests (and their supporting files).
  if (uid) {
    const { data: reqs } = await supabase.from('reschedule_requests').select('id, supporting_document_path').eq('applicant_user_id', uid)
    for (const r of reqs || []) await removeFile(r.supporting_document_path)
    const { error } = await supabase.from('reschedule_requests').delete().eq('applicant_user_id', uid)
    if (error) throw new Error(error.message)
    await supabase.from('message_acknowledgments').delete().eq('applicant_user_id', uid)
  }

  // Private messages sent only to this applicant.
  await supabase.from('announcements').delete().eq('target_type', 'specific').eq('target_application_id', app.id)

  // The application itself (review locks, allowance posts and conflict
  // checks go with it).
  const { error: appError } = await supabase.from('applications').delete().eq('id', app.id)
  if (appError) throw new Error(appError.message)

  // The sign-in account, unless another application still uses it.
  if (uid) {
    const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('applicant_user_id', uid)
    if (!count) await supabase.from('applicant_accounts').delete().eq('id', uid)
  }
}

// Non-accepted applicants of one archived cycle.
export async function removableInCycle(cycle) {
  const { data, error } = await supabase
    .from('applications')
    .select('id, applicant_user_id, applicant_email, scholar_status')
    .eq('archive_cycle', cycle)
    .not('archived_at', 'is', null)
  if (error) throw new Error(error.message)
  return (data || []).filter((row) => !isKept(row))
}

export async function removeNonAccepted(cycle) {
  const rows = await removableInCycle(cycle)
  let removed = 0
  for (const app of rows) {
    await removeApplicant(app)
    removed += 1
  }
  return removed
}
