import { supabase } from '@/app/supabaseClient'
import { computeEligibility, documentTypeTokens } from '@/app/lib/matching'

// Oct 21 2026: eligibility is saved on the application row, so when a
// Voter's ID changes state (the OCR + content check verifies or flags it,
// or an admin clicks Verify / Flag), that applicant's saved status is
// recalculated right away instead of waiting for their next save or the
// admin's "Recompute eligibility" button.
//
// Same document matching as app/api/application/route.js: documents linked
// to the account, plus older ones never linked to any account that match
// the applicant's email or name. Best-effort: errors are logged, never thrown.
export async function refreshEligibilityForUser(applicantUserId) {
  if (!applicantUserId) return
  try {
    const { data: rows, error } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_user_id', applicantUserId)
    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0) return

    const types = new Set()
    const add = async (builder) => {
      const { data, error: docsError } = await builder
      if (docsError) throw new Error(docsError.message)
      for (const d of data || []) for (const t of documentTypeTokens(d)) types.add(t)
    }
    const cols = 'document_type, needs_review, review_status, staff_confirmed_at'
    await add(supabase.from('documents').select(cols).eq('applicant_user_id', applicantUserId))
    const email = rows[0].applicant_email
    const name = rows[0].applicant_name
    if (email) await add(supabase.from('documents').select(cols).is('applicant_user_id', null).ilike('applicant_email', email))
    if (name) await add(supabase.from('documents').select(cols).is('applicant_user_id', null).ilike('applicant_name', name))

    for (const row of rows) {
      const { status, reasons } = computeEligibility(row, types)
      if (status === row.eligibility_status && JSON.stringify(reasons) === JSON.stringify(row.eligibility_reasons)) continue
      const { error: updateError } = await supabase
        .from('applications')
        .update({ eligibility_status: status, eligibility_reasons: reasons })
        .eq('id', row.id)
      if (updateError) console.error('Eligibility refresh failed:', updateError.message)
    }
  } catch (err) {
    console.error('Eligibility refresh skipped (non-blocking):', err)
  }
}

// Nov 2026 (panel revisions S2, Lock 2): the staff-confirmed report card /
// transcript also decides Eligible for Exam, so confirming it rechecks too.
export const ELIGIBILITY_DOC_TYPES = ['voterid', 'parentid', 'form138']
