// Oct 1 2026: Locked Applications for Review (progress table row, Ivy's row).
// Her comment: while one admin has an applicant open, the others see that
// applicant greyed out and can't open it, so nobody overrides info, emails or
// updates the status of the same applicant at the same time. One admin per
// applicant at a time.
//
// The same admin (same email) can have the applicant open in several tabs.
// A lock expires on its own if its heartbeat stops (tab closed, laptop
// asleep), so nobody gets stuck locked out.
//
// Write endpoints also check the lock on the server (checkLock below), so the
// rule holds even if someone skips the admin page's buttons.

import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'

export const LOCK_TTL_MS = 90 * 1000

const isFresh = (lock) => lock && Date.now() - new Date(lock.heartbeat_at).getTime() < LOCK_TTL_MS
const sameAdmin = (lock, email) => (lock.admin_email || '').toLowerCase() === (email || '').toLowerCase()

export async function listActiveLocks() {
  const since = new Date(Date.now() - LOCK_TTL_MS).toISOString()
  const { data, error } = await supabase
    .from('applicant_locks')
    .select('application_id, admin_email, admin_name, locked_at, heartbeat_at')
    .gte('heartbeat_at', since)
  if (error) throw new Error(error.message)
  return data || []
}

async function getLock(applicationId) {
  const { data, error } = await supabase
    .from('applicant_locks')
    .select('application_id, admin_email, admin_name, locked_at, heartbeat_at')
    .eq('application_id', applicationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// Claims or refreshes the lock. Returns { ok: true } or { ok: false, lockedBy }.
export async function claimLock(applicationId, admin) {
  const current = await getLock(applicationId)
  if (current && isFresh(current) && !sameAdmin(current, admin.email)) {
    return { ok: false, lockedBy: current.admin_name || 'another admin' }
  }
  const now = new Date().toISOString()
  const keepStart = current && isFresh(current) && sameAdmin(current, admin.email)
  const { error } = await supabase.from('applicant_locks').upsert(
    {
      application_id: Number(applicationId),
      admin_email: admin.email,
      admin_name: admin.name,
      locked_at: keepStart ? current.locked_at : now,
      heartbeat_at: now,
    },
    { onConflict: 'application_id' }
  )
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function releaseLock(applicationId, email) {
  const current = await getLock(applicationId)
  if (!current || !sameAdmin(current, email)) return
  await supabase.from('applicant_locks').delete().eq('application_id', applicationId)
}

// For write endpoints: returns a 423 response if another admin holds the
// lock, or null to go ahead. Fails open (logs and allows) if the locks table
// can't be read, so a missing migration never blocks admin work.
export async function checkLock(request, applicationId) {
  if (!applicationId) return null
  try {
    const session = await verifyAdminCookieFull(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    if (!session) return null
    const current = await getLock(applicationId)
    if (current && isFresh(current) && !sameAdmin(current, session.email)) {
      const who = current.admin_name || 'another admin'
      return NextResponse.json(
        { error: `${who} is currently reviewing this applicant. Only one admin can work on an applicant at a time. Please try again once they're finished.`, lockedBy: who },
        { status: 423 }
      )
    }
  } catch (err) {
    console.error('Applicant lock check failed (allowing):', err.message)
  }
  return null
}
