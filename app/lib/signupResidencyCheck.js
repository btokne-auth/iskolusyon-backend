import crypto from 'crypto'
import { supabase } from '@/app/supabaseClient'
import { checkDocumentContent, CONTENT_CHECK_FIELD, failingGradesOn, isCollegeGradeRecord } from '@/app/lib/documentContentCheck'

// Nov 2026: the same check also reads the report card (Form 138) at sign-up,
// with its own token, for the academic screening (app/lib/screening.js):
// it must read as a report card and show no grade below 75. The name is
// checked later in the portal (it isn't known yet at sign-up step 1).
export const SIGNUP_CHECK_TYPES = ['voterid', 'form138']
import { CALAMBA_BARANGAYS } from '@/app/lib/fieldValidation'

// Nov 2026 (panel revisions S3/S4, final defense Oct 20-23): residency is
// checked BEFORE an account exists.
//
// The applicant answers "Are you a resident of Calamba City?" and then
// uploads a Voter's ID or Voter's Certification (their own, or a parent's
// or guardian's). The file is read by the same OCR worker as every other
// document, then checked with the same rule as the portal
// (app/lib/documentContentCheck.js):
//
//   PASS = the text read from the document mentions COMELEC / Commission on
//          Elections / Voter's Certification, AND mentions Calamba.
//
// Only a PASS lets them create an account. A document that fails is deleted
// right away (file, row and read text), so nothing is kept about someone who
// can't apply; only an anonymous count goes to the Activity Log.
//
// Before an account exists the upload is tied to a random check token that
// only the applicant's browser holds. The database only ever sees a hash of
// it, as part of the storage path: signup-check/<hash>/<file>.

export const SIGNUP_CHECK_PREFIX = 'signup-check/'
const CHECK_TTL_MS = 24 * 60 * 60 * 1000 // an unused passed check expires after a day

export function newCheckToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex').slice(0, 32)
}

export function checkFolder(token) {
  return `${SIGNUP_CHECK_PREFIX}${tokenHash(token)}/`
}

export function isValidTokenShape(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(token)
}

export function isSignupCheckPath(filePath) {
  return String(filePath || '').startsWith(SIGNUP_CHECK_PREFIX)
}

async function latestCheckDoc(token) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .like('file_path', `${checkFolder(token)}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function readFields(filePath) {
  const { data } = await supabase
    .from('extracted_fields')
    .select('field_name, extracted_value')
    .eq('file_path', filePath)
    .neq('field_name', CONTENT_CHECK_FIELD)
  const fields = {}
  for (const row of data || []) {
    const v = typeof row.extracted_value === 'string' ? row.extracted_value.trim() : row.extracted_value
    if (v) fields[row.field_name] = v
  }
  return fields
}

// Which Calamba barangay the document names, if any (used to pre-fill the
// sign-up form, which the applicant then confirms).
export function findBarangay(text) {
  const plain = ` ${String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  const sorted = [...CALAMBA_BARANGAYS].sort((a, b) => b.length - a.length)
  for (const b of sorted) {
    const key = ` ${b.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
    if (plain.includes(key)) return b
  }
  return ''
}

// Nov 2026: certificates often write the address inside a sentence ("is a
// registered voter of Blk 3 Lot 9 Sampaguita St., Barangay Parian, City of
// Calamba, Laguna, with Precinct No. 0521B") instead of on labeled lines,
// so the OCR worker leaves the address / precinct fields empty. These read
// them from the text itself. The applicant still checks and can edit both.
export function addressFromText(text) {
  const flat = String(text || '').replace(/\s+/g, ' ')
  const m = flat.match(/(?:registered voter of|resident of|residing at|address\s*:?)\s*(.+?(?:calamba)[^,.]*)/i)
  return m ? m[1].trim() : ''
}

export function precinctFromText(text) {
  const m = String(text || '').replace(/\s+/g, ' ').match(/precinct\s*(?:no\.?|number|#)?\s*:?\s*([0-9]{3,4}\s?[A-Z]?)\b/i)
  return m ? m[1].replace(/\s+/g, '').toUpperCase() : ''
}

// "Blk 5 Lot 12 Mabini St., Brgy. Real, Calamba City, Laguna" -> "Blk 5 Lot 12 Mabini St."
export function streetPart(address) {
  const v = String(address || '').trim()
  const cut = v.search(/,?\s*(brgy\.?|barangay|bgy\.?)\s/i)
  const street = (cut > 0 ? v.slice(0, cut) : v.split(',')[0] || '').replace(/[,\s]+$/, '').trim()
  return /calamba/i.test(street) ? '' : street
}

async function removeDoc(doc) {
  try {
    await supabase.from('extracted_fields').delete().eq('file_path', doc.file_path)
    await supabase.from('documents').delete().eq('file_path', doc.file_path)
    await supabase.storage.from('scholarship-documents').remove([doc.file_path])
  } catch (err) {
    console.error('Sign-up check clean-up failed (non-blocking):', err)
  }
}

async function logAnonymous(action, kind) {
  try {
    await supabase.from('audit_log').insert([{ actor: 'Sign-up (no account)', action, kind, category: 'Eligibility' }])
  } catch (err) {
    console.error('Audit log insert failed (non-blocking):', err)
  }
}

// The content check, plus the grade rule for a First Year's report card
// (Form 138, the document CCC lists for First Year applicants).
// Returns { passed } or { passed: false, reason, kind: 'failing_grade' | 'unreadable' }.
// Transferees don't upload at sign-up: CCC's transferee list names no grade
// document, and the Program Director decides exceptional cases (Appendix J),
// so their proof of grades is uploaded in the portal and confirmed by staff.
export function gradeAwareCheck(type, extractedText) {
  const result = checkDocumentContent({ documentType: type, extractedText, applicantName: '' })
  if (type !== 'form138') return result.passed ? result : { ...result, kind: 'unreadable' }
  if (isCollegeGradeRecord(extractedText)) {
    return { passed: false, kind: 'unreadable', reason: 'This looks like a college transcript. First Year applicants upload their latest Senior High report card (Form 138).' }
  }
  if (result.passed) return result
  const low = failingGradesOn(extractedText)
  if (low.length) {
    return { passed: false, kind: 'failing_grade', reason: `A grade below 75 appears on your report card (${low.slice(0, 3).join(', ')}). Applicants with a failing grade are not accepted.` }
  }
  return { ...result, kind: 'unreadable' }
}

// Status of a check, for the sign-up page to poll.
//   { status: 'none' }        no upload for this token
//   { status: 'processing' }  still being read
//   { status: 'passed', prefill }
//   { status: 'failed', reason } (and the upload is deleted)
export async function getCheckStatus(token) {
  const doc = await latestCheckDoc(token)
  if (!doc) return { status: 'none' }
  if (doc.applicant_user_id) return { status: 'used' }
  if (Date.now() - new Date(doc.created_at).getTime() > CHECK_TTL_MS) {
    await removeDoc(doc)
    return { status: 'none' }
  }
  if (doc.review_status === 'processing') return { status: 'processing' }

  const type = SIGNUP_CHECK_TYPES.includes(doc.document_type) ? doc.document_type : 'voterid'
  const result = gradeAwareCheck(type, doc.extracted_text)
  if (!result.passed) {
    // A failing grade (or a GWA below the rule) means not eligible at all;
    // anything else (not a report card, unreadable) can be retried with a
    // clearer copy.
    await removeDoc(doc)
    await logAnonymous(`Sign-up stopped at the ${type === 'form138' ? 'report card' : 'residency'} check: ${result.reason}`, 'warn')
    return { status: 'failed', reason: result.reason, kind: result.kind || 'unreadable' }
  }
  if (type === 'form138') return { status: 'passed', type, prefill: {} }

  const fields = await readFields(doc.file_path)
  const address = fields.address || addressFromText(doc.extracted_text)
  const sourceText = address || doc.extracted_text
  return {
    status: 'passed',
    type,
    prefill: {
      street: streetPart(address),
      barangay: findBarangay(sourceText),
      voterPrecinct: fields.voter_precinct || precinctFromText(doc.extracted_text),
    },
  }
}

// Called by sign-up 'start'. Re-checks the token on the server (never
// trusts the browser), then links the upload to the new account so it
// becomes the applicant's Voter's ID in the portal.
export async function claimPassedCheck(token, { accountId, email, type = 'voterid' }) {
  if (!isValidTokenShape(token)) return { error: 'Please complete the residency check first.' }
  const status = await getCheckStatus(token)
  // The type must match, so a passed report card can't stand in for the
  // Voter's ID (or the other way around).
  if (status.status !== 'passed' || status.type !== type) return { error: 'Please complete the residency check first.' }
  const doc = await latestCheckDoc(token)
  const { error } = await supabase
    .from('documents')
    .update({ applicant_user_id: accountId, applicant_email: email, needs_review: false, review_status: 'verified' })
    .eq('file_path', doc.file_path)
    .is('applicant_user_id', null)
  if (error) return { error: 'Could not save your residency check. Please try again.' }
  // Marks it as already checked, so the portal's content check doesn't run
  // on it again (app/api/upload GET).
  try {
    await supabase.from('extracted_fields').insert({
      file_path: doc.file_path,
      document_type: doc.document_type || 'voterid',
      field_name: CONTENT_CHECK_FIELD,
      extracted_value: 'passed at sign-up',
      needs_review: false,
    })
  } catch (err) {
    console.error('Content check marker failed (non-blocking):', err)
  }
  await logAnonymous(
    doc.document_type === 'form138'
      ? 'Sign-up report card check passed (report card, no grade below 75)'
      : 'Sign-up residency check passed (COMELEC record with a Calamba address)',
    'done'
  )
  return { success: true, prefill: status.prefill }
}

// Nov 2026: the applicant passed the residency check but not the academic
// screening, so no account will be made. The Voter's ID is deleted right
// away and only an anonymous count is kept.
export async function discardCheck(token, reason) {
  if (!isValidTokenShape(token)) return
  const doc = await latestCheckDoc(token)
  if (!doc || doc.applicant_user_id) return
  await removeDoc(doc)
  await logAnonymous(`Sign-up stopped at the academic screening: ${reason}`, 'warn')
}

// Deletes checks nobody finished (older than a day, never linked).
export async function cleanUpOldChecks() {
  try {
    const cutoff = new Date(Date.now() - CHECK_TTL_MS).toISOString()
    const { data } = await supabase
      .from('documents')
      .select('file_path, created_at')
      .like('file_path', `${SIGNUP_CHECK_PREFIX}%`)
      .is('applicant_user_id', null)
      .lt('created_at', cutoff)
      .limit(50)
    for (const doc of data || []) await removeDoc(doc)
  } catch (err) {
    console.error('Sign-up check clean-up failed (non-blocking):', err)
  }
}
