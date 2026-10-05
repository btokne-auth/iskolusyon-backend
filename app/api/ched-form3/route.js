import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { confirmOwnPassword, DATE_RE, formatAccessDate } from '@/app/lib/adminAccounts'
import { buildForm3Rows } from '@/app/lib/chedForm3'

// Oct 5 2026: CHED Form 3 export (Progress Table row 79). Admins and Super
// Admins can preview and download it; only a Super Admin can release a
// frozen copy to the LGU or withdraw one. The Registrar and LGU roles are
// refused here (the LGU reads released copies from /api/lgu-reports).
//
// GET                      -> current rows (preview), counts, released reports
// GET ?report=<id>         -> one released report's frozen rows
// POST { action: 'logDownload', referenceNumber, formDate, rowCount, reportId? }
// POST { action: 'release', referenceNumber, formDate, confirmPassword }
// POST { action: 'withdraw', id, confirmPassword }

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
    const { session, response } = await requireConsoleRole(request, ['admin', 'super_admin'])
    if (!session) return response

    const reportId = Number(new URL(request.url).searchParams.get('report'))
    if (reportId) {
      const { data: report, error } = await supabase
        .from('lgu_reports')
        .select('id, reference_number, form_date, rows, row_count, released_by, released_at, withdrawn_at')
        .eq('id', reportId)
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
      return NextResponse.json({ success: true, report })
    }

    const { rows, counts, leftOut } = await buildForm3Rows()
    const { data: released, error: relError } = await supabase
      .from('lgu_reports')
      .select('id, reference_number, form_date, row_count, released_by, released_at, withdrawn_at, withdrawn_by, download_count')
      .order('released_at', { ascending: false })
    if (relError) return NextResponse.json({ error: relError.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      canRelease: session.role === 'super_admin',
      rows,
      counts,
      leftOut,
      released: released || [],
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['admin', 'super_admin'])
    if (!session) return response

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'logDownload') {
      const ref = cleanReference(body.referenceNumber)
      const count = Number(body.rowCount) || 0
      await logAudit(
        session.name,
        `Downloaded CHED Form 3${ref ? ` ${ref}` : ''} (${count} row${count === 1 ? '' : 's'})${body.reportId ? ', released copy' : ''}`,
        'info'
      )
      return NextResponse.json({ success: true })
    }

    if (action !== 'release' && action !== 'withdraw') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    if (session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only a Super Admin can release or withdraw reports for the LGU.' }, { status: 403 })
    }
    const passwordOk = await confirmOwnPassword(session.email, body.confirmPassword || '')
    if (!passwordOk) {
      await logAudit(session.name, `Incorrect password when confirming: ${action} CHED Form 3 for the LGU`, 'warn')
      return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 403 })
    }

    if (action === 'withdraw') {
      const id = Number(body.id)
      if (!id) return NextResponse.json({ error: 'Missing report.' }, { status: 400 })
      const { data: report, error } = await supabase
        .from('lgu_reports')
        .update({ withdrawn_at: new Date().toISOString(), withdrawn_by: session.name })
        .eq('id', id)
        .is('withdrawn_at', null)
        .select('id, reference_number, row_count')
        .maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!report) return NextResponse.json({ error: 'That report was already withdrawn.' }, { status: 404 })
      await logAudit(session.name, `Withdrew CHED Form 3 ${report.reference_number} from the LGU`, 'warn')
      return NextResponse.json({ success: true })
    }

    // release
    const referenceNumber = cleanReference(body.referenceNumber)
    const formDate = String(body.formDate || '')
    if (!referenceNumber) return NextResponse.json({ error: 'Please enter the reference number.' }, { status: 400 })
    if (!DATE_RE.test(formDate)) return NextResponse.json({ error: 'Please set the date on the form.' }, { status: 400 })

    const { rows } = await buildForm3Rows()
    if (rows.length === 0) {
      return NextResponse.json({ error: 'There are no rows to release yet. Record exam results first.' }, { status: 400 })
    }
    const { data: report, error } = await supabase
      .from('lgu_reports')
      .insert([
        {
          reference_number: referenceNumber,
          form_date: formDate,
          rows,
          row_count: rows.length,
          released_by: session.name,
        },
      ])
      .select('id, reference_number, form_date, row_count, released_by, released_at, withdrawn_at, download_count')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(
      session.name,
      `Released CHED Form 3 ${referenceNumber} (${rows.length} rows, dated ${formatAccessDate(formDate)}) to the LGU`,
      'done'
    )
    return NextResponse.json({ success: true, report })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
