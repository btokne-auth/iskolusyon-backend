import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { computeEligibility } from '@/app/lib/matching'

// One-off / on-demand backfill for Scholarship Matching & Filtering.
//
// eligibility_status is normally recomputed automatically on every
// application save (see computeEligibilityUpdate() in
// app/api/application/route.js) — but an applicant who had ALREADY
// submitted their whole application before this feature existed has no
// reason to ever save again (every section shows "Submitted — Locked"),
// so their eligibility_status/eligibility_reasons would otherwise sit
// permanently null/"Incomplete" even though their actual data qualifies
// them to be evaluated. This endpoint recomputes it for every applications
// row in one pass, using the exact same rule engine as a normal save, so
// admins aren't stuck waiting on an applicant to edit something before the
// dashboard reflects reality.
//
// Safe to re-run any time — it only ever touches eligibility_status /
// eligibility_reasons, never eligibility_override (an admin's manual
// override is left completely alone here).
export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    // Oct 5 2026: archived applications are left as they were.
    const { data: rows, error: rowsError } = await supabase.from('applications').select('*').is('archived_at', null)
    if (rowsError) return NextResponse.json({ error: rowsError.message }, { status: 500 })

    // One query for every document instead of three queries per applicant
    // (which is what a per-row fetchUploadedDocumentTypes-style lookup
    // would cost at this scale) — grouped the same three ways
    // (user id / email / name) that /api/application's own lookups use,
    // so an applicant matches this exactly the way their own saves do.
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('applicant_user_id, applicant_email, applicant_name, document_type')
    if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 })

    const byUserId = new Map()
    const byEmail = new Map()
    const byName = new Map()
    const addTo = (map, key, type) => {
      if (!key) return
      if (!map.has(key)) map.set(key, new Set())
      map.get(key).add(type)
    }
    for (const d of docs || []) {
      addTo(byUserId, d.applicant_user_id, d.document_type)
      addTo(byEmail, (d.applicant_email || '').trim().toLowerCase(), d.document_type)
      addTo(byName, (d.applicant_name || '').trim().toLowerCase(), d.document_type)
    }

    let updated = 0
    for (const row of rows || []) {
      const types = new Set()
      for (const t of byUserId.get(row.applicant_user_id) || []) types.add(t)
      for (const t of byEmail.get((row.applicant_email || '').trim().toLowerCase()) || []) types.add(t)
      for (const t of byName.get((row.applicant_name || '').trim().toLowerCase()) || []) types.add(t)

      const { status, reasons } = computeEligibility(row, types)
      const { error: updateError } = await supabase
        .from('applications')
        .update({ eligibility_status: status, eligibility_reasons: reasons })
        .eq('id', row.id)
      if (!updateError) updated += 1
    }

    try {
      await supabase.from('audit_log').insert([
        { actor: adminName, action: `Recomputed Scholarship Matching eligibility for ${updated} application(s)`, kind: 'done', category: 'Eligibility' },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, updated, total: (rows || []).length })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
