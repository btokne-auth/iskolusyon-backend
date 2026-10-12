// Oct 12 2026: re-checks uploaded documents against the SHA-256 fingerprint
// saved at upload (see app/lib/documentIntegrity.js for the whole idea).
//
// POST { paths: [...] }  checks those documents. The admin console calls this
//                        on its own when an applicant is opened, so admins
//                        see ✓ / ✗ without doing anything. A document
//                        verified in the last 10 minutes isn't downloaded
//                        again.
// POST { all: true, offset } checks every document, oldest first, in
//                        chunks that fit Vercel's 60 s limit. The Dashboard's
//                        "Verify all documents" button keeps calling it with
//                        the returned nextOffset until done is true.
//
// Admins and Super Admins only (Registrar and LGU accounts don't review
// documents).

export const maxDuration = 60

import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import { serverError } from '@/app/lib/safeError'
import { MINUTE, limitRequest } from '@/app/lib/rateLimit'
import { INTEGRITY_COLUMNS, checkDocuments, summarize } from '@/app/lib/documentIntegrity'

const MAX_PATHS = 60
const ALL_CHUNK = 40
const TIME_BUDGET_MS = 40 * 1000
const RECENT_MS = 10 * MINUTE

// Before the Oct 12 migration runs, the integrity columns don't exist yet;
// fall back to the columns every documents row already has.
async function selectDocs(build) {
  let { data, error } = await build(INTEGRITY_COLUMNS)
  if (error && /integrity_/i.test(error.message || '')) {
    ;({ data, error } = await build('file_path, sha256_hash, applicant_name, document_type'))
  }
  if (error) throw error
  return data || []
}

export async function POST(request) {
  try {
    const { session, response } = await requireConsoleRole(request, ['admin', 'super_admin'])
    if (response) return response

    const limited = await limitRequest(`doc-verify:${session.email}`, 120, 10 * MINUTE)
    if (limited) return limited

    let body = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const deadline = Date.now() + TIME_BUDGET_MS

    if (body.all) {
      const offset = Math.max(0, Number.parseInt(body.offset, 10) || 0)
      const rows = await selectDocs((cols) =>
        supabase
          .from('documents')
          .select(cols)
          .order('created_at', { ascending: true })
          .order('file_path', { ascending: true })
          .range(offset, offset + ALL_CHUNK - 1)
      )
      const { results, checked } = await checkDocuments(rows, { actor: session.name, deadline })
      const done = checked === rows.length && rows.length < ALL_CHUNK
      return NextResponse.json({
        success: true,
        results,
        summary: summarize(results),
        nextOffset: offset + checked,
        done,
      })
    }

    const paths = Array.isArray(body.paths)
      ? [...new Set(body.paths.filter((p) => typeof p === 'string' && p.length > 0 && p.length < 300))].slice(0, MAX_PATHS)
      : []
    if (paths.length === 0) {
      return NextResponse.json({ error: 'No documents given.' }, { status: 400 })
    }

    const rows = await selectDocs((cols) => supabase.from('documents').select(cols).in('file_path', paths))
    const now = Date.now()
    const fresh = []
    const toCheck = []
    for (const row of rows) {
      const recent =
        row.integrity_status === 'verified' &&
        row.integrity_checked_at &&
        now - new Date(row.integrity_checked_at).getTime() < RECENT_MS
      if (recent && !body.force) {
        fresh.push({
          file_path: row.file_path,
          status: 'verified',
          checkedAt: row.integrity_checked_at,
          applicant_name: row.applicant_name,
          document_type: row.document_type,
        })
      } else {
        toCheck.push(row)
      }
    }
    const { results } = await checkDocuments(toCheck, { actor: session.name, deadline })
    const all = [...fresh, ...results]
    return NextResponse.json({ success: true, results: all, summary: summarize(all) })
  } catch (err) {
    return serverError(err, 'api/documents/verify')
  }
}
