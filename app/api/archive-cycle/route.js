import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { confirmOwnPassword } from '@/app/lib/adminAccounts'
import { getSystemSettings } from '@/app/lib/systemSettings'
import { serverError } from '@/app/lib/safeError'
import { FORM3_DOWNLOAD_PREFIX } from '@/app/lib/chedForm3'
import { isKept, removeNonAccepted, removableInCycle, RETENTION_CONFIRM_PREFIX } from '@/app/lib/dataRetention'
import { zipSync, strToU8 } from 'fflate'
import { decryptApplicationFields } from '@/app/lib/fieldCrypto'

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
// POST { action: 'remove-non-accepted', cycle, confirmText, confirmPassword }
//   Nov 2026 (panel revisions S4): removes the data of an archived cycle's
//   applicants who were not accepted; accepted ones stay (app/lib/dataRetention.js).

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
    .select('archive_cycle, archived_at, archived_by, scholar_status')
    .not('archived_at', 'is', null)
  if (error) throw new Error(error.message)
  const byCycle = new Map()
  for (const row of data || []) {
    const key = row.archive_cycle || 'Archived'
    const entry = byCycle.get(key) || { cycle: key, count: 0, kept: 0, removable: 0, archivedAt: row.archived_at, archivedBy: row.archived_by }
    entry.count += 1
    if (isKept(row)) entry.kept += 1
    else entry.removable += 1
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

    const params = new URL(request.url).searchParams
    const cycle = params.get('cycle')
    if (cycle && params.get('download') === 'zip') return archiveZip(session, cycle)
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
    if (body.action === 'remove-non-accepted') return removeNonAcceptedResponse(session, body)
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

// Nov 2026 (panel revisions S4): remove non-accepted applicants' data from
// an archived cycle. Only an archived cycle can be cleaned, so the archive's
// own checks (Applications Open off, CHED Form 3 exported) already passed.
async function removeNonAcceptedResponse(session, body) {
  const cycle = String(body.cycle || '').trim()
  if (!cycle) return NextResponse.json({ error: 'Choose an archived cycle.' }, { status: 400 })

  const passwordOk = await confirmOwnPassword(session.email, body.confirmPassword || '')
  if (!passwordOk) {
    await logAudit(session.name, `Incorrect password when confirming: remove non-accepted applicants' data (${cycle})`, 'warn')
    return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 403 })
  }

  const phrase = `${RETENTION_CONFIRM_PREFIX} ${cycle}`
  if (String(body.confirmText || '').trim().toUpperCase() !== phrase.toUpperCase()) {
    return NextResponse.json({ error: `Please type ${phrase} exactly to confirm.`, wrongPhrase: true }, { status: 400 })
  }

  const pending = await removableInCycle(cycle)
  if (pending.length === 0) {
    return NextResponse.json({ error: 'There is no data to remove in this cycle.' }, { status: 409 })
  }

  let removed = 0
  try {
    removed = await removeNonAccepted(cycle)
  } catch (err) {
    await logAudit(session.name, `Removing non-accepted applicants' data of cycle ${cycle} stopped with an error.`, 'warn')
    return serverError(err, 'api/archive-cycle')
  }
  await logAudit(
    session.name,
    `Removed the data of ${removed} non-accepted applicant${removed === 1 ? '' : 's'} from archived cycle ${cycle}. Accepted applicants (Passer, Qualified Probationary) were kept.`,
    'warn'
  )
  return NextResponse.json({ success: true, removed, cycle })
}

// Nov 2026 (panel revisions S4): "keep temporary application data in a
// separate table or side storage (archive or zip)". The Guidance Head can
// download an archived cycle as a zip (applicant records + document list) to
// keep offline, before the non-accepted applicants' data is removed.
const ZIP_COLUMNS = [
  'application_number', 'applicant_name', 'applicant_email', 'applying_as', 'program_choice_1', 'program_choice_2',
  'date_of_birth', 'sex', 'contact_number', 'address', 'barangay', 'residency_years',
  'eligibility_status', 'exam_score', 'exam_result', 'scholar_status', 'admitted_program', 'archived_at', 'archived_by',
]
function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\r\n')
}
async function archiveZip(session, cycle) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('archive_cycle', cycle)
    .not('archived_at', 'is', null)
    .order('applicant_name', { ascending: true })
  if (error) return serverError(error, 'api/archive-cycle')
  const rows = (data || []).map((r) => {
    const d = decryptApplicationFields(r)
    return { ...d, kept: isKept(d) ? 'yes' : 'no' }
  })
  const userIds = rows.map((r) => r.applicant_user_id).filter(Boolean)
  let docs = []
  if (userIds.length) {
    const { data: docRows } = await supabase
      .from('documents')
      .select('applicant_name, document_type, file_path, review_status, staff_confirmed_at, created_at')
      .in('applicant_user_id', userIds)
    docs = docRows || []
  }
  const readme = [
    `Iskolusyon archive: Applications ${cycle}`,
    `Downloaded by ${session.name} on ${new Date().toISOString()}`,
    '',
    'applicants.csv  one row per archived applicant. "kept" = yes for applicants qualified as students (kept as permanent records).',
    'documents.csv   the documents each applicant uploaded (file names and review status only, not the files).',
    '',
    'This file contains personal data (Data Privacy Act of 2012). Keep it on a secured office computer only.',
  ].join('\r\n')
  const zipped = zipSync({
    'README.txt': strToU8(readme),
    'applicants.csv': strToU8(toCsv(rows, [...ZIP_COLUMNS, 'kept'])),
    'documents.csv': strToU8(toCsv(docs, ['applicant_name', 'document_type', 'file_path', 'review_status', 'staff_confirmed_at', 'created_at'])),
  })
  await logAudit(session.name, `Downloaded the archive (zip) of cycle ${cycle} (${rows.length} applicant${rows.length === 1 ? '' : 's'}).`, 'info')
  const safeName = cycle.replace(/[^A-Za-z0-9_-]/g, '_')
  return new NextResponse(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="iskolusyon-archive-${safeName}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
