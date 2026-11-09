import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { confirmOwnPassword } from '@/app/lib/adminAccounts'
import { getSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'
import { FORM3_DOWNLOAD_PREFIX } from '@/app/lib/chedForm3'

// Oct 5 2026: end-of-cycle archive (Progress Table row 74, archive part;
// Ivy's cell comment: a Super Admin option to archive all applicants once
// admissions work is done, shown only when Applications Open is off). Pau's
// conditions: archive, never delete; Super Admin only; only while
// Applications Open is off; only after a CHED Form 3 was released to the LGU;
// typed confirmation plus the Super Admin's password.
// Oct 15 2026 (client): the LGU login is gone, so "released to the LGU"
// became "CHED Form 3 exported": a Form 3 download in the Activity Log
// since the last archive.
//
// GET              -> readiness checklist, cycle label, archived cycles
// GET ?cycle=<x>   -> that archived cycle's applicants (read-only list)
// POST { confirmText, confirmPassword }

const CONFIRM_PREFIX = 'ARCHIVE'

async function logAudit(actor, action, kind) {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'System' }])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
}

// The current cycle's label from its application numbers ("2026A-0003" ->
// "2026A"), falling back to the year.
function cycleLabel(apps) {
  const tally = new Map()
  for (const app of apps) {
    const prefix = String(app.application_number || '').split('-')[0].trim()
    if (prefix) tally.set(prefix, (tally.get(prefix) || 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [prefix, n] of tally) {
    if (n > bestCount) {
      best = prefix
      bestCount = n
    }
  }
  return best || String(new Date().getFullYear())
}

async function readiness() {
  const { data: current, error } = await supabase
    .from('applications')
    .select('id, application_number')
    .is('archived_at', null)
  if (error) throw new Error(error.message)

  const settings = await getSystemSettings()

  // The newest earlier archive, so an export made for a previous cycle
  // doesn't count for this one.
  const { data: lastArchive } = await supabase
    .from('applications')
    .select('archived_at')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
    .limit(1)
  const since = lastArchive && lastArchive[0] ? lastArchive[0].archived_at : null

  let exportQuery = supabase
    .from('audit_log')
    .select('actor, action, created_at')
    .ilike('action', `${FORM3_DOWNLOAD_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  if (since) exportQuery = exportQuery.gt('created_at', since)
  const { data: exports, error: exportError } = await exportQuery
  if (exportError) throw new Error(exportError.message)
  const lastExport = exports && exports[0] ? exports[0] : null

  const cycle = cycleLabel(current || [])
  return {
    toArchive: (current || []).length,
    cycle,
    confirmPhrase: `${CONFIRM_PREFIX} ${cycle}`,
    applicationsOpen: !!settings.applications_open,
    exported: lastExport ? { by: lastExport.actor, at: lastExport.created_at } : null,
  }
}

async function archivedCycles() {
  const { data, error } = await supabase
    .from('applications')
    .select('archive_cycle, archived_at, archived_by')
    .not('archived_at', 'is', null)
  if (error) throw new Error(error.message)
  const byCycle = new Map()
  for (const row of data || []) {
    const key = row.archive_cycle || 'Archived'
    const entry = byCycle.get(key) || { cycle: key, count: 0, archivedAt: row.archived_at, archivedBy: row.archived_by }
    entry.count += 1
    if (row.archived_at > entry.archivedAt) {
      entry.archivedAt = row.archived_at
      entry.archivedBy = row.archived_by
    }
    byCycle.set(key, entry)
  }
  return Array.from(byCycle.values()).sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1))
}

export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['guidance_head'])
    if (!session) return response

    const cycle = new URL(request.url).searchParams.get('cycle')
    if (cycle) {
      const { data, error } = await supabase
        .from('applications')
        .select('id, applicant_name, application_number, program_choice_1, scholar_status, eligibility_status, eligibility_override')
        .eq('archive_cycle', cycle)
        .not('archived_at', 'is', null)
        .order('applicant_name', { ascending: true })
      if (error) return serverError(error, 'api/archive-cycle')
      return NextResponse.json({ success: true, applicants: data || [] })
    }

    const ready = await readiness()
    return NextResponse.json({ success: true, ...ready, archived: await archivedCycles() })
  } catch (err) {
    return serverError(err, 'api/archive-cycle')
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['guidance_head'])
    if (!session) return response

    const body = await request.json().catch(() => ({}))
    const passwordOk = await confirmOwnPassword(session.email, body.confirmPassword || '')
    if (!passwordOk) {
      await logAudit(session.name, 'Incorrect password when confirming: archive all applicants', 'warn')
      return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 403 })
    }

    const ready = await readiness()
    if (ready.applicationsOpen) {
      return NextResponse.json({ error: 'Turn off Applications Open in Cycle Settings first.' }, { status: 409 })
    }
    if (!ready.exported) {
      return NextResponse.json(
        { error: 'Export this cycle’s CHED Form 3 first (Dashboard, Export CHED Form 3, Download PDF).' },
        { status: 409 }
      )
    }
    if (ready.toArchive === 0) return NextResponse.json({ error: 'There are no applicants to archive.' }, { status: 409 })
    if (String(body.confirmText || '').trim().toUpperCase() !== ready.confirmPhrase.toUpperCase()) {
      return NextResponse.json({ error: `Please type ${ready.confirmPhrase} exactly to confirm.`, wrongPhrase: true }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('applications')
      .update({ archived_at: now, archived_by: session.name, archive_cycle: ready.cycle })
      .is('archived_at', null)
      .select('id')
    if (error) return serverError(error, 'api/archive-cycle')

    const count = (data || []).length
    await logAudit(
      session.name,
      `Archived all applicants of cycle ${ready.cycle} (${count} applicant${count === 1 ? '' : 's'}). CHED Form 3 was exported first.`,
      'warn'
    )
    return NextResponse.json({ success: true, count, cycle: ready.cycle })
  } catch (err) {
    return serverError(err, 'api/archive-cycle')
  }
}
