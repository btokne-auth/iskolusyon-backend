import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { buildForm3Rows, FORM3_DOWNLOAD_PREFIX } from '@/app/lib/chedForm3'
import { serverError } from '@/app/lib/safeError'

// Oct 5 2026: CHED Form 3 export (Progress Table row 79). Admins and Super
// Admins can preview and download it. The Registrar role is refused here.
//
// Oct 15 2026 (client, interview of Oct 15): the LGU login and "Release to
// LGU" are removed. CCC downloads the PDF here and sends it to the LGU
// itself. Each download is written to the Activity Log, and the end-of-cycle
// archive checks for that download (app/api/archive-cycle).
//
// GET                      -> current rows (preview), counts
// POST { action: 'logDownload', referenceNumber, formDate, rowCount }

async function logAudit(actor, action, kind) {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'Reports' }])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
}

function cleanReference(value) {
  return String(value || '').trim().slice(0, 60)
}

export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['admin', 'guidance_head'])
    if (!session) return response

    const { rows, counts, leftOut } = await buildForm3Rows()
    return NextResponse.json({ success: true, rows, counts, leftOut })
  } catch (err) {
    return serverError(err, 'api/ched-form3')
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['admin', 'guidance_head'])
    if (!session) return response

    const body = await request.json().catch(() => ({}))
    if (body.action !== 'logDownload') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    const ref = cleanReference(body.referenceNumber)
    const count = Math.max(0, Math.floor(Number(body.rowCount) || 0))
    await logAudit(
      session.name,
      `${FORM3_DOWNLOAD_PREFIX}${ref ? ` ${ref}` : ''} (${count} row${count === 1 ? '' : 's'})`,
      'info'
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/ched-form3')
  }
}
