import { supabase } from '@/app/supabaseClient'
import { CONTENT_CHECK_FIELD } from '@/app/lib/documentContentCheck'

// ---------------------------------------------------------------------------
// Qualification Conflict Detection (Oct 6 2026)
//
// Scholarship Matching & Filtering Module (Member Roles; manuscript p. 10:
// the module "verifies document integrity through hash matching, and flags
// qualification conflicts"). Grounded in Appendix D: fake IDs and documents
// are common (interview 1), applicants sometimes type wrong information and
// copied report cards need "human intervention... verification" (interview
// 2), and "Hindi tatanggapin kung freshman sila tas transferee".
//
// What it does: compares what the applicant typed with what OCR read from
// their latest Birth Certificate and Voter's ID, checks Applying As against
// the College row, and looks for another account with the same name and
// birth date. It only FLAGS. Nothing is rejected or changed: the manuscript's
// delimitations leave policy enforcement to CCC, so an admin decides. A field
// OCR couldn't read is never a conflict (text detection is limited to
// properly scanned, typed documents, per the delimitations).
//
// Conflicts are worked out fresh on every request; conflict_checks only
// remembers which ones an admin marked as checked. The key holds the two
// values compared, so if either changes the conflict shows up again.

function plain(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasText(value) {
  return plain(value).length > 0
}

// Oct 7 2026 (found on the Preview): applicants type "None" or "N/A" in rows
// that don't apply to them, like the College row. Those count as empty.
const EMPTY_ANSWERS = new Set(['n a', 'na', 'none', 'not applicable', 'nil', 'null', 'wala', 'no', 'n a n a'])
function hasRealText(value) {
  const p = plain(value)
  return p.length > 0 && !EMPTY_ANSWERS.has(p)
}

// Accepts YYYY-MM-DD, MM/DD/YYYY or a Date-parsable string; returns
// YYYY-MM-DD or null.
function isoDate(value) {
  if (!value) return null
  const s = String(value).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function showDate(iso) {
  if (!iso) return ''
  const [y, mo, d] = iso.split('-')
  return `${mo}/${d}/${y}`
}

function sexLetter(value) {
  const p = plain(value)
  if (p.startsWith('f')) return 'F'
  if (p.startsWith('m')) return 'M'
  return null
}

function fullName(first, middle, last) {
  return [first, middle, last].map((v) => String(v || '').trim()).filter(Boolean).join(' ')
}

// "Calamba City, Laguna" -> "calamba"; "City of Calamba" -> "calamba".
function placeCore(value) {
  const first = plain(String(value || '').split(',')[0])
  return first.replace(/\b(city|of|municipality|province)\b/g, '').replace(/\s+/g, ' ').trim()
}

// "Brgy. Real, Calamba City" -> "real". Null if no barangay is named.
function barangayOf(value) {
  const m = String(value || '').match(/\b(?:brgy|barangay|bgy)\.?\s+([^,]+)/i)
  return m ? plain(m[1]) : null
}

function mentionsOtherCity(value) {
  const p = plain(value)
  return /\bcity\b|\blaguna\b|\bcabuyao\b|\bsanta rosa\b|\blos banos\b|\bbinan\b|\bsan pedro\b/.test(p) && !p.includes('calamba')
}

function isFirstYear(applyingAs) {
  return plain(applyingAs) === 'first year'
}

// Pure: one application + its latest read Birth Certificate / Voter's ID
// fields + the other applications (for the duplicate check).
export function findConflicts(app, { birth, voter, others = [] } = {}) {
  const list = []
  const add = (type, what, typed, typedFrom, read, readFrom, extra = {}) => {
    list.push({ key: `${type}|${plain(typed)}|${plain(read)}`, type, what, typed, typedFrom, read, readFrom, ...extra })
  }

  if (birth?.fields) {
    const f = birth.fields
    const doc = { filePath: birth.file_path, documentType: 'birthcert' }
    const firstDiff = hasText(f.first_name) && hasText(app.first_name) && plain(f.first_name) !== plain(app.first_name)
    const lastDiff = hasText(f.last_name) && hasText(app.last_name) && plain(f.last_name) !== plain(app.last_name)
    const middleDiff = hasText(f.middle_name) && hasText(app.middle_name) && plain(f.middle_name) !== plain(app.middle_name)
    if (firstDiff || lastDiff || middleDiff) {
      add('name', 'Name', fullName(app.first_name, app.middle_name, app.last_name), 'Personal Information',
        fullName(f.first_name, f.middle_name, f.last_name), 'Birth Certificate', doc)
    }
    const readDob = isoDate(f.date_of_birth)
    const typedDob = isoDate(app.date_of_birth)
    if (readDob && typedDob && readDob !== typedDob) {
      add('dob', 'Date of birth', showDate(typedDob), 'Personal Information', showDate(readDob), 'Birth Certificate', doc)
    }
    const readSex = sexLetter(f.sex)
    const typedSex = sexLetter(app.sex)
    if (readSex && typedSex && readSex !== typedSex) {
      add('sex', 'Sex at Birth', app.sex, 'Personal Information', f.sex, 'Birth Certificate', doc)
    }
    const readPlace = placeCore(f.place_of_birth)
    const typedPlace = placeCore(app.place_of_birth)
    if (readPlace && typedPlace && !readPlace.includes(typedPlace) && !typedPlace.includes(readPlace)) {
      add('place', 'Place of birth', app.place_of_birth, 'Personal Information', f.place_of_birth, 'Birth Certificate', doc)
    }
  }

  if (voter?.fields) {
    const f = voter.fields
    const doc = { filePath: voter.file_path, documentType: 'voterid' }
    const typedAddress = [app.address, app.barangay].filter(Boolean).join(', ')
    const readBrgy = barangayOf(f.address)
    if (hasText(f.address) && hasText(typedAddress)) {
      // Oct 7 2026: only a disagreement is a conflict. A voter's ID outside
      // Calamba when the profile says Calamba is one; when both say the same
      // other city they agree (residency itself is the eligibility check's job).
      const outside = mentionsOtherCity(f.address) && plain(typedAddress).includes('calamba')
      const brgyDiff = readBrgy && !plain(typedAddress).includes(readBrgy)
      if (outside || brgyDiff) {
        add('address', 'Home address', typedAddress, 'Personal Information', f.address,
          outside ? "Voter's ID (outside Calamba)" : "Voter's ID", doc)
      }
    }
    const readPrecinct = plain(f.voter_precinct).replace(/ /g, '')
    const typedPrecinct = plain(app.voter_precinct).replace(/ /g, '')
    if (readPrecinct && typedPrecinct && readPrecinct !== typedPrecinct) {
      add('precinct', "Voter's precinct no.", app.voter_precinct, 'Personal Information', f.voter_precinct, "Voter's ID", doc)
    }
  }

  // Appendix D interview 2: "Hindi tatanggapin kung freshman sila tas
  // transferee." Only once Educational Background was submitted.
  if (app.academic_submitted_at) {
    if (isFirstYear(app.applying_as) && hasRealText(app.edu_tert_school)) {
      add('class', 'Applying As', app.applying_as, 'Educational Background',
        `A college is listed (${app.edu_tert_school}${hasRealText(app.edu_tert_year) ? `, ${app.edu_tert_year}` : ''})`, 'Educational Background, College row',
        { section: 'academic' })
    } else if (plain(app.applying_as) === 'transferee' && !hasRealText(app.edu_tert_school)) {
      add('class', 'Applying As', app.applying_as, 'Educational Background', 'No college is listed', 'Educational Background, College row',
        { section: 'academic' })
    }
  }

  // Same name and birth date as another (not archived) account. Appendix D
  // interview 2: CCC tells applicants with mostly wrong details to "create a
  // new account... then resubmit", so this happens. Flag only, so admins see
  // the other one.
  const myDob = isoDate(app.date_of_birth)
  if (myDob && hasText(app.first_name) && hasText(app.last_name)) {
    const twin = others.find(
      (o) =>
        o.id !== app.id &&
        plain(o.first_name) === plain(app.first_name) &&
        plain(o.last_name) === plain(app.last_name) &&
        isoDate(o.date_of_birth) === myDob
    )
    if (twin) {
      add('dup', 'Possible duplicate', `${fullName(app.first_name, null, app.last_name)}, born ${showDate(myDob)}`, 'This account',
        'Same name and birth date', `Another account: ${twin.applicant_email || twin.applicant_name || 'no email'}`,
        { otherId: twin.id, otherName: twin.applicant_name })
    }
  }

  return list
}

const APP_COLUMNS =
  'id, applicant_name, applicant_email, applicant_user_id, first_name, middle_name, last_name, date_of_birth, sex, place_of_birth, address, barangay, voter_precinct, applying_as, edu_tert_school, edu_tert_year, academic_submitted_at'

// Loads everything and returns { [applicationId]: [conflict + checked] }.
// onlyId narrows the result (the duplicate check still looks at everyone).
export async function loadConflicts({ onlyId = null } = {}) {
  const { data: apps, error: appsError } = await supabase.from('applications').select(APP_COLUMNS).is('archived_at', null)
  if (appsError) throw new Error(appsError.message)

  const targets = onlyId ? (apps || []).filter((a) => String(a.id) === String(onlyId)) : apps || []
  if (targets.length === 0) return {}

  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('file_path, document_type, applicant_user_id, applicant_name, review_status, created_at')
    .in('document_type', ['birthcert', 'voterid'])
    .neq('review_status', 'processing')
    .order('created_at', { ascending: false })
  if (docsError) throw new Error(docsError.message)

  // Latest read document of each type per application: by account first,
  // then by name for older rows that were never linked to an account.
  const latest = new Map() // `${appId}|${type}` -> doc
  for (const app of targets) {
    for (const type of ['birthcert', 'voterid']) {
      const mine = (docs || []).find(
        (d) =>
          d.document_type === type &&
          ((app.applicant_user_id && d.applicant_user_id === app.applicant_user_id) ||
            (!d.applicant_user_id && plain(d.applicant_name) && plain(d.applicant_name) === plain(app.applicant_name)))
      )
      if (mine) latest.set(`${app.id}|${type}`, mine)
    }
  }

  const paths = Array.from(latest.values()).map((d) => d.file_path)
  const fieldsByPath = new Map()
  if (paths.length > 0) {
    const { data: rows, error: fieldsError } = await supabase
      .from('extracted_fields')
      .select('file_path, field_name, extracted_value')
      .in('file_path', paths)
      .neq('field_name', CONTENT_CHECK_FIELD)
    if (fieldsError) throw new Error(fieldsError.message)
    for (const r of rows || []) {
      const value = typeof r.extracted_value === 'string' ? r.extracted_value.trim() : r.extracted_value
      if (!value) continue
      if (!fieldsByPath.has(r.file_path)) fieldsByPath.set(r.file_path, {})
      fieldsByPath.get(r.file_path)[r.field_name] = value
    }
  }

  let checks = []
  {
    let q = supabase.from('conflict_checks').select('application_id, conflict_key, note, checked_by, checked_at')
    if (onlyId) q = q.eq('application_id', onlyId)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    checks = data || []
  }
  const checkOf = new Map(checks.map((c) => [`${c.application_id}|${c.conflict_key}`, c]))

  const result = {}
  for (const app of targets) {
    const withFields = (type) => {
      const d = latest.get(`${app.id}|${type}`)
      return d ? { file_path: d.file_path, fields: fieldsByPath.get(d.file_path) || null } : null
    }
    const items = findConflicts(app, { birth: withFields('birthcert'), voter: withFields('voterid'), others: apps || [] }).map((c) => {
      const chk = checkOf.get(`${app.id}|${c.key}`)
      return { ...c, checked: chk ? { by: chk.checked_by, at: chk.checked_at, note: chk.note } : null }
    })
    if (items.length > 0) result[app.id] = items
  }
  return result
}
