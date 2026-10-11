// Oct 12 2026: document integrity re-verification (manuscript Ch. 1: the
// system "verifies document integrity through hash matching"; Ch. 2: "If
// the uploaded file is changed later on ... it will produce a different hash
// that the platform can quickly detect").
//
// At upload, app/api/upload/route.js saves each file's SHA-256 fingerprint
// in documents.sha256_hash. Before today nothing ever compared the file
// against it again. This file does that comparison: it downloads the file
// that is actually in storage right now, computes its SHA-256 again and
// compares it with the fingerprint saved at upload.
//
//   verified = same fingerprint: the file is exactly what was uploaded
//   changed  = different fingerprint: the file was replaced or edited
//   missing  = the file is no longer in storage
//
// The saved fingerprint itself can't be rewritten to match a swapped file:
// docs/migrations/2026-10-12-document-integrity.sql makes the database
// refuse any change to sha256_hash or file_path.
//
// Admins never compare hashes by hand. The check runs on its own when an
// admin opens an applicant (POST /api/documents/verify with paths), for
// every document in one click from the Dashboard (POST with all), and
// once a day from Vercel's scheduler (GET /api/documents/verify-cron).
//
// Server only (uses Node's crypto and the service-role Supabase client).

import crypto from 'crypto'
import { supabase } from '@/app/supabaseClient'

export const DOCUMENT_BUCKET = 'scholarship-documents'
export const INTEGRITY_COLUMNS = 'file_path, sha256_hash, applicant_name, document_type, integrity_status, integrity_checked_at'
export const PROBLEM_STATUSES = new Set(['changed', 'missing'])

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function looksMissing(error) {
  const text = `${error?.message || ''} ${error?.statusCode || ''} ${error?.status || ''} ${error?.originalError?.status || ''}`
  return /not.?found|404|does not exist|no such/i.test(text)
}

// Checks one document row (needs file_path and sha256_hash). Returns
// { file_path, status, checkedAt, expected, actual?, error? }.
// status 'error' means the check itself couldn't run (storage down etc.);
// that is reported but never saved, so a network hiccup is never recorded
// as tampering.
export async function checkDocument(doc) {
  const checkedAt = new Date().toISOString()
  const base = { file_path: doc.file_path, checkedAt, expected: doc.sha256_hash || null }
  if (!doc.sha256_hash) return { ...base, status: 'no_hash' }

  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(doc.file_path)
  if (error || !data) {
    if (looksMissing(error)) return { ...base, status: 'missing' }
    return { ...base, status: 'error', error: 'The file could not be read from storage right now.' }
  }
  const buffer = Buffer.from(await data.arrayBuffer())
  const actual = sha256Hex(buffer)
  return { ...base, actual, status: actual === doc.sha256_hash ? 'verified' : 'changed' }
}

// Saves the result on the document row and, the first time a document
// fails, writes a warning to the Activity Log. Best effort: if the
// migration hasn't been run yet (no integrity columns), the check still
// works, it just isn't remembered.
async function recordResult(doc, result, actor) {
  if (!['verified', 'changed', 'missing'].includes(result.status)) return
  try {
    await supabase
      .from('documents')
      .update({ integrity_status: result.status, integrity_checked_at: result.checkedAt })
      .eq('file_path', doc.file_path)
  } catch (err) {
    console.error('Could not save the integrity result (non-blocking):', err?.message)
  }

  const newlyFailed = PROBLEM_STATUSES.has(result.status) && doc.integrity_status !== result.status
  if (newlyFailed) {
    const what = result.status === 'changed' ? 'changed since upload (SHA-256 does not match)' : 'missing from storage'
    try {
      await supabase.from('audit_log').insert([
        {
          actor: actor || 'System',
          action: `Document integrity check failed: ${doc.applicant_name || 'Unknown applicant'} · ${doc.document_type || 'document'} is ${what}`,
          kind: 'warn',
          category: 'Documents',
        },
      ])
    } catch (err) {
      console.error('Audit log insert failed (non-blocking):', err?.message)
    }
  }
}

// Checks a list of rows, a few at a time, and stops early when the time
// budget runs out (Vercel Hobby functions end at 60 s). Returns
// { results, checked } where checked = how many rows were processed.
export async function checkDocuments(rows, { actor, deadline, concurrency = 4 } = {}) {
  const results = []
  let index = 0
  async function worker() {
    while (index < rows.length) {
      if (deadline && Date.now() > deadline) return
      const doc = rows[index++]
      let result
      try {
        result = await checkDocument(doc)
      } catch (err) {
        result = { file_path: doc.file_path, status: 'error', checkedAt: new Date().toISOString(), error: 'The check could not run.' }
        console.error('Integrity check error:', err?.message)
      }
      await recordResult(doc, result, actor)
      results.push({
        ...result,
        applicant_name: doc.applicant_name || null,
        document_type: doc.document_type || null,
      })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker))
  return { results, checked: results.length }
}

export function summarize(results) {
  const summary = { verified: 0, changed: 0, missing: 0, error: 0, no_hash: 0 }
  for (const r of results) if (r.status in summary) summary[r.status] += 1
  return summary
}
