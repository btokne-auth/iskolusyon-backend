import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { serverError } from '@/app/lib/safeError'

// Oct 5 2026: the LGU (view only) account's only data route (Progress Table
// row 79). It lists reports CCC released to the LGU and returns one report's
// frozen rows for download. Withdrawn reports are never shown. Every other
// admin route refuses LGU sessions, and requireConsoleRole() re-checks the
// account's access dates on every request.
//
// GET           -> released reports (no rows) and the account's access dates
// GET ?id=<id>  -> that report's rows (counts and logs the download)

export async function GET(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['lgu'])
    if (!session) return response

    const id = Number(new URL(request.url).searchParams.get('id'))
    if (id) {
      const { data: report, error } = await supabase
        .from('lgu_reports')
        .select('id, reference_number, form_date, rows, row_count, released_at, download_count')
        .eq('id', id)
        .is('withdrawn_at', null)
        .maybeSingle()
      if (error) return serverError(error, 'api/lgu-reports')
      if (!report) return NextResponse.json({ error: 'This report is no longer available.' }, { status: 404 })

      await supabase
        .from('lgu_reports')
        .update({ download_count: (report.download_count || 0) + 1 })
        .eq('id', report.id)
      try {
        await supabase.from('audit_log').insert([
          {
            actor: session.name,
            action: `LGU account downloaded CHED Form 3 ${report.reference_number}`,
            kind: 'info',
            category: 'Reports',
          },
        ])
      } catch (auditErr) {
        console.error('Audit log insert failed (non-blocking):', auditErr)
      }
      return NextResponse.json({ success: true, report })
    }

    const { data: reports, error } = await supabase
      .from('lgu_reports')
      .select('id, reference_number, form_date, row_count, released_at')
      .is('withdrawn_at', null)
      .order('released_at', { ascending: false })
    if (error) return serverError(error, 'api/lgu-reports')

    return NextResponse.json({
      success: true,
      reports: reports || [],
      accessFrom: session.account.access_from || null,
      accessUntil: session.account.access_until || null,
    })
  } catch (err) {
    return serverError(err, 'api/lgu-reports')
  }
}
