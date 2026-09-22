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
