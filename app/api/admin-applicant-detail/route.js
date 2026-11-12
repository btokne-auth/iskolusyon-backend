import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { EDITABLE_FIELDS, PRIVATE_LOG_FIELDS, cleanValue } from '@/app/lib/profileEditRules'
import { computeEligibility, documentTypeTokens, adminEligibilityChecklist } from '@/app/lib/matching'
import { checkLock } from '@/app/lib/applicantLocks'
import { serverError } from '@/app/lib/safeError'
import { encryptApplicationFields, decryptApplicationFields, ENCRYPTED_FIELDS } from '@/app/lib/fieldCrypto'

// Full per-applicant profile read, for the Dashboard applicant modal's
// General Information grid + tabbed "Submitted Documents & Profile Data"
// panel (Sept 22 2026 — following up on the click-to-open-modal work).
//
// admin-eligibility's GET stays a lean column list because it's fetched for
// EVERY row on every Dashboard load (List of All Applications). This is the
// opposite: one full row (select('*') — an internal admin-only read, not
// exposed to applicants), fetched lazily only once an admin actually opens
// an applicant's modal. Keeps the list-view fetch cheap and this one
// complete, rather than bloating every row of the list with ~70 columns
// nobody's looking at yet.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
    }

    const { data, error } = await supabase.from('applications').select('*').eq('id', id).maybeSingle()

    if (error) {
      return serverError(error, 'api/admin-applicant-detail')
    }
    if (!data) {
      return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 })
    }

    // Nov 2026 (panel revisions S2): the rules checklist for this applicant.
    const types = new Set()
    const addDocTypes = async (builder) => {
      const { data: docs } = await builder
      for (const d of docs || []) for (const t of documentTypeTokens(d)) types.add(t)
    }
    if (data.applicant_user_id) {
      await addDocTypes(supabase.from('documents').select('document_type, needs_review, review_status, staff_confirmed_at').eq('applicant_user_id', data.applicant_user_id))
    }
    if (data.applicant_email) {
      await addDocTypes(supabase.from('documents').select('document_type, needs_review, review_status, staff_confirmed_at').is('applicant_user_id', null).ilike('applicant_email', data.applicant_email))
    }
    const application = decryptApplicationFields(data)
    return NextResponse.json({ success: true, application, checklist: adminEligibilityChecklist(application, types) })
  } catch (err) {
    return serverError(err, 'api/admin-applicant-detail')
  }
}

// ---------- Oct 1 2026: admin edit of submitted profile data ----------
// Progress table rows "Applicant Profile Edit & Save Controls" and
// "Applicant Detail with Personal Information View/Edit" (Ivy's rows).
// PATCH { id, changes: { column: value, ... } }
//   - any signed-in admin (Pau's decision),
//   - only fields listed in app/lib/profileEditRules.js,
//   - eligibility is recomputed, same as when the applicant saves,
//   - the applicant gets a private portal message naming what changed,
//   - every change goes to the Activity Log as old -> new (health details
//     are logged as "changed" without their values).
export async function PATCH(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const body = await request.json()
    const { id, changes } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
    }

    // Oct 1 2026: Locked Applications for Review.
    const locked = await checkLock(request, id)
    if (locked) return locked

    const updates = {}
    for (const [key, raw] of Object.entries(changes)) {
      if (!EDITABLE_FIELDS.has(key)) {
        return NextResponse.json({ error: `"${key}" cannot be edited here.` }, { status: 400 })
      }
      const cleaned = cleanValue(key, raw)
      if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 })
      updates[key] = cleaned.value
    }

    const { data: currentRaw, error: loadError } = await supabase.from('applications').select('*').eq('id', id).maybeSingle()
    if (loadError) return serverError(loadError, 'api/admin-applicant-detail')
    if (!currentRaw) return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 })
    // Oct 7 2026: compare and log against the unlocked values.
    const current = decryptApplicationFields(currentRaw)

    // Keep only real changes.
    const same = (a, b) => (a === null || a === undefined || a === '' ? null : String(a)) === (b === null || b === undefined || b === '' ? null : String(b))
    const changed = Object.keys(updates).filter((key) => !same(current[key], updates[key]))
    if (changed.length === 0) return NextResponse.json({ success: true, changed: [], application: current })

    // Oct 15 2026 (client): the 2nd priority program can't repeat the 1st.
    const nextFirst = 'program_choice_1' in updates ? updates.program_choice_1 : current.program_choice_1
    const nextSecond = 'program_choice_2' in updates ? updates.program_choice_2 : current.program_choice_2
    if (nextFirst && nextFirst === nextSecond) {
      return NextResponse.json({ error: 'The Second Priority Program must be different from the First Priority Program.' }, { status: 400 })
    }

    const patch = {}
    for (const key of changed) patch[key] = updates[key]

    // Recompute eligibility with the applicant's own documents (account-
    // linked, plus older rows never linked to any account).
    const uploadedTypes = new Set()
    const addTypes = async (builder) => {
      const { data } = await builder
      for (const d of data || []) for (const t of documentTypeTokens(d)) uploadedTypes.add(t)
    }
    if (current.applicant_user_id) {
      await addTypes(supabase.from('documents').select('document_type, needs_review, review_status, staff_confirmed_at').eq('applicant_user_id', current.applicant_user_id))
    }
    if (current.applicant_email) {
      await addTypes(supabase.from('documents').select('document_type, needs_review, review_status, staff_confirmed_at').is('applicant_user_id', null).ilike('applicant_email', current.applicant_email))
    }
    const merged = { ...current, ...patch }
    const { status, reasons } = computeEligibility(merged, uploadedTypes)
    patch.eligibility_status = status
    patch.eligibility_reasons = reasons
    patch.updated_at = new Date().toISOString()

    const { data: saved, error: saveError } = await supabase.from('applications').update(encryptApplicationFields(patch)).eq('id', id).select().single()
    if (saveError) return serverError(saveError, 'api/admin-applicant-detail')

    const labels = changed.map((key) => EDITABLE_FIELDS.get(key))
    const short = (v) => {
      if (v === null || v === undefined || v === '') return '(blank)'
      const s = String(v)
      return s.length > 60 ? `${s.slice(0, 57)}...` : s
    }

    // Applicant notice (portal only). Lists which fields changed, not values.
    try {
      await supabase.from('announcements').insert([
        {
          author: adminName,
          title: 'Your application details were updated',
          body:
            `The Guidance Office updated the following in your application:\n\n${labels.map((l) => `- ${l}`).join('\n')}\n\n` +
            'You can see the new details in your profile. If something looks wrong, please contact the Guidance Office or email admissions@ccc.edu.ph.',
          category: 'Profile Update',
          type: 'message',
          target_type: 'specific',
          target_application_id: current.id,
          target_category: null,
        },
      ])
    } catch (noticeErr) {
      console.error('Profile update notice failed (non-blocking):', noticeErr)
    }

    // Activity Log: one line per save, old -> new per field.
    try {
      const details = changed
        .map((key) =>
          PRIVATE_LOG_FIELDS.has(key) || ENCRYPTED_FIELDS.includes(key)
            ? `${EDITABLE_FIELDS.get(key)} changed`
            : `${EDITABLE_FIELDS.get(key)}: "${short(current[key])}" -> "${short(updates[key])}"`
        )
        .join('; ')
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `Edited ${current.applicant_name || 'an applicant'}'s profile. ${details}`.slice(0, 1000),
          kind: 'warn',
          category: 'Documents',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, changed: labels, application: saved ? decryptApplicationFields(saved) : { ...current, ...patch } })
  } catch (err) {
    return serverError(err, 'api/admin-applicant-detail')
  }
}
