import { supabase } from '@/app/supabaseClient'

// Backs the Application Cycle Settings half of the System & Activity
// panel. Single-row table (id pinned to 1) -- see docs/migrations/
// 2026-09-22-system-settings-and-audit-log.sql for the columns and why
// only two of the five fields are actually enforced anywhere yet.

const DEFAULTS = {
  id: 1,
  applications_open: true,
  applicant_slots: null,
  acceptance_start_date: null,
  acceptance_end_date: null,
  document_uploads_enabled: true,
  exam_results_visible: false,
  updated_at: null,
  updated_by: null,
}

// Used by the gating checks in app/api/application/route.js and
// app/api/upload/route.js, and by the admin GET. Falls back to the
// all-open defaults if the singleton row is somehow missing (migration
// not run yet, or the row got deleted) rather than failing closed and
// locking the whole site out.
export async function getSystemSettings() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  return data || DEFAULTS
}

// Partial update -- only the keys present in `patch` are touched.
// `updatedBy` is the signed-in admin's display name, for the "who changed
// this" trail (not itself shown in the activity log yet, just stored).
export async function updateSystemSettings(patch, updatedBy) {
  const allowedKeys = [
    'applications_open',
    'applicant_slots',
    'acceptance_start_date',
    'acceptance_end_date',
    'document_uploads_enabled',
    'exam_results_visible',
  ]
  const updates = { updated_at: new Date().toISOString(), updated_by: updatedBy || null }
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) updates[key] = patch[key]
  }

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({ id: 1, ...updates }, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Oct 1 2026: today's date in the Philippines as YYYY-MM-DD, so the
// Acceptance Start/End dates switch over at Manila midnight, not UTC.
export function manilaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function readableDate(iso) {
  try {
    return new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
  } catch {
    return iso
  }
}

// Oct 1 2026: the Application Cycle Settings gate for a FINAL submit
// (progress table row "Not Qualified... Management", Ivy's comment: a date
// range for opening applications). Returns an error message, or null to
// allow. Checks, in order: Applications Open, the Acceptance Start/End
// window, and Applicant Slots (how many applications may be submitted).
// alreadySubmitted: this applicant already submitted before (re-submitting
// never takes a new slot).
export async function submitBlockedReason(settings, { alreadySubmitted, countSubmitted }) {
  if (!settings.applications_open) return 'Applications are currently closed. Please check back later.'
  const today = manilaToday()
  if (settings.acceptance_start_date && today < settings.acceptance_start_date) {
    return `Applications open on ${readableDate(settings.acceptance_start_date)}. Please submit on or after that date.`
  }
  if (settings.acceptance_end_date && today > settings.acceptance_end_date) {
    return `Applications closed on ${readableDate(settings.acceptance_end_date)}.`
  }
  if (!alreadySubmitted && settings.applicant_slots != null && settings.applicant_slots !== '') {
    const slots = Number(settings.applicant_slots)
    if (Number.isFinite(slots)) {
      const taken = await countSubmitted()
      if (taken >= slots) return 'All applicant slots for this cycle have been filled. Please watch the CCC Official Facebook Page for the next application period.'
    }
  }
  return null
}
