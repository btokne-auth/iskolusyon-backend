// Oct 12 2026: the daily automatic document integrity check. Vercel's
// scheduler calls this once a day (see vercel.json) with
// "Authorization: Bearer <CRON_SECRET>". Without a CRON_SECRET set in
// Vercel's environment variables, it refuses every call, so nobody outside
// can trigger it.
//
// Each run checks the documents that were checked longest ago (never-checked
// ones first), as many as fit in the time limit, so over a few days every
// document gets re-checked even when there are a lot. Problems are written
// to the Activity Log (see app/lib/documentIntegrity.js), plus one summary
// line per run.

export const maxDuration = 60

import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { sameText } from '@/app/lib/sessionPolicy'
import { serverError } from '@/app/lib/safeError'
import { INTEGRITY_COLUMNS, checkDocuments, summarize } from '@/app/lib/documentIntegrity'

const BATCH = 200
const TIME_BUDGET_MS = 45 * 1000

export async function GET(request) {
  const secret = (process.env.CRON_SECRET || '').trim()
  const header = request.headers.get('authorization') || ''
  if (!secret || !sameText(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  }

  try {
    const { data: rows, error } = await supabase
      .from('documents')
      .select(INTEGRITY_COLUMNS)
      .order('integrity_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH)
    if (error) throw error

    const { results } = await checkDocuments(rows || [], { actor: 'System (daily check)', deadline: Date.now() + TIME_BUDGET_MS })
    const summary = summarize(results)

    try {
      await supabase.from('audit_log').insert([
        {
          actor: 'System (daily check)',
          action: `Daily document integrity check: ${summary.verified} unchanged, ${summary.changed} changed, ${summary.missing} missing`,
          kind: summary.changed + summary.missing > 0 ? 'warn' : 'done',
          category: 'Documents',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr?.message)
    }

    return NextResponse.json({ success: true, checked: results.length, summary })
  } catch (err) {
    return serverError(err, 'api/documents/verify-cron')
  }
}
