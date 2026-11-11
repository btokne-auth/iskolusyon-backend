// Oct 21 2026 (after the Oct 20 defense): a stricter auto-verify.
//
// The OCR worker on Render marks a document "verified" when Tesseract reads
// it with high confidence. Confidence only says the text was READABLE, not
// that it is the RIGHT document: an overseas sample Voter's ID was
// auto-verified at 91%, the same file was also verified as Grades, and a
// marriage certificate was uploaded as a birth certificate.
//
// So after the worker finishes, a system-verified document must also:
//   1. contain words that belong to its document type, and
//   2. carry the applicant's last name (where the document is theirs).
// If it doesn't, it is moved to "flagged" so an admin checks it. Nothing is
// rejected or deleted; the admin still makes the final decision.
//
// Pure functions only (no database), so they can be tested on their own.
// The database side lives in app/api/upload/route.js (GET).

// Only documents uploaded from this date on are checked, so documents that
// were already reviewed before this patch are not suddenly re-flagged.
export const CONTENT_CHECK_START = '2026-10-21T00:00:00+08:00'

// The extracted_fields row that records "this document was already
// checked", so the check runs once per document (and never undoes an
// admin's manual Verify).
export const CONTENT_CHECK_FIELD = '_content_check'

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasAny(text, words) {
  return words.some((w) => ` ${text} `.includes(` ${normalize(w)} `))
}

// Words that must appear (at least one) for each document type.
const RULES = {
  birthcert: {
    label: 'Birth Certificate',
    mustHave: ['certificate of live birth', 'live birth', 'philippine statistics authority', 'civil registrar', 'birth certificate'],
    mustNotHave: ['certificate of marriage', 'marriage contract', 'certificate of death', 'death certificate'],
    nameCheck: true,
  },
  voterid: {
    label: "Voter's ID / Certification",
    mustHave: ['comelec', 'commission on elections', 'voter s certification', 'voters certification', 'voter certification', 'voter s id', 'voters id'],
    needsCalamba: true,
    nameCheck: false, // may be a parent's or guardian's
  },
  parentid: {
    label: "Parent/Guardian's Voter's ID",
    mustHave: ['comelec', 'commission on elections', 'voter s certification', 'voters certification', 'voter certification', 'voter s id', 'voters id'],
    needsCalamba: true,
    nameCheck: false,
  },
  form138: {
    label: 'Grades / Form 138',
    failingGradeCheck: true,
    mustHave: ['report card', 'form 138', 'sf9', 'sf 9', 'progress report', 'general average', 'final grade', 'final rating', 'grades', 'gwa', 'weighted average', 'transcript of records', 'certificate of grades', 'semester', 'quarter'],
    nameCheck: true,
  },
  medcert: {
    label: 'Medical Certificate',
    mustHave: ['medical', 'physician', 'clinic', 'hospital', 'laboratory', 'diagnosis', 'fit to', 'physically fit', 'examination', 'health'],
    nameCheck: true,
  },
}

export const CONTENT_CHECKED_TYPES = Object.keys(RULES)

// Other Laguna cities and municipalities (normalized, so "Biñan" is "binan").
const OTHER_PLACES = [
  'cabuyao', 'santa rosa', 'sta rosa', 'binan', 'san pedro', 'los banos', 'bay', 'san pablo', 'santa cruz', 'sta cruz',
  'alaminos', 'calauan', 'victoria', 'pila', 'nagcarlan', 'liliw', 'rizal', 'pagsanjan', 'lumban', 'kalayaan', 'paete',
  'pakil', 'pangil', 'siniloan', 'famy', 'mabitac', 'santa maria', 'cavinti', 'luisiana', 'majayjay', 'magdalena',
  'tanauan', 'silang', 'carmona', 'gma', 'dasmarinas', 'muntinlupa',
]

// Last name from "First Middle Last" (or "Last, First"). Skips suffixes.
export function lastNameOf(fullName) {
  const raw = String(fullName || '').trim()
  if (!raw) return ''
  if (raw.includes(',')) return normalize(raw.split(',')[0]).split(' ').pop() || ''
  const parts = normalize(raw).split(' ').filter((p) => !['jr', 'sr', 'ii', 'iii', 'iv'].includes(p))
  return parts.length >= 2 ? parts[parts.length - 1] : ''
}

// Returns { passed: true } or { passed: false, reason }.
export function checkDocumentContent({ documentType, extractedText, applicantName }) {
  const rule = RULES[documentType]
  if (!rule) return { passed: true }

  const text = normalize(extractedText)
  if (text.length < 20) {
    return { passed: false, reason: `Too little readable text to confirm this is a ${rule.label}.` }
  }

  if (rule.mustNotHave && hasAny(text, rule.mustNotHave)) {
    return { passed: false, reason: `This looks like a different document (marriage or death certificate), not a ${rule.label}.` }
  }

  if (!hasAny(text, rule.mustHave)) {
    return { passed: false, reason: `No words expected on a ${rule.label} were found (for example: ${rule.mustHave.slice(0, 2).join(', ')}).` }
  }

  // Nov 2026 (panel revisions S2, OCR accuracy test): the word "calamba"
  // anywhere was not enough. A Cabuyao voter living on "Calamba Road"
  // passed. Now the document must name the CITY of Calamba, and a document
  // that names another city or municipality (the issuing COMELEC office or
  // the voter's address) is refused.
  if (rule.needsCalamba) {
    const other = OTHER_PLACES.find((p) => new RegExp(`\\b(city of|municipality of) ${p}\\b|\\b${p} (city|laguna)\\b`).test(text))
    if (other) {
      return { passed: false, reason: `This document is from ${other.replace(/\b\w/g, (c) => c.toUpperCase())}, not the City of Calamba.` }
    }
    if (!/\b(city of calamba|calamba city|calamba laguna)\b/.test(text)) {
      return { passed: false, reason: 'The address on this document does not show the City of Calamba.' }
    }
  }

  if (rule.nameCheck) {
    const last = lastNameOf(applicantName)
    if (last.length >= 2 && !` ${text} `.includes(` ${last} `)) {
      return { passed: false, reason: `The applicant's last name (${last.toUpperCase()}) was not found on the document.` }
    }
  }

  // Nov 2026 (panel revisions S2): a grade below 75 read on the report card
  // flags it for the Guidance Office, so a "No" to the First Year grade
  // question can't slip through. It only flags; staff decide.
  if (rule.failingGradeCheck) {
    const low = failingGradesOn(extractedText)
    if (low.length) {
      return { passed: false, reason: `A grade below 75 appears on this report card (${low.slice(0, 3).join(', ')}). The Guidance Office will check it.` }
    }
  }

  return { passed: true }
}

// Lines that read like "General Mathematics 72" (a subject followed only by
// grades from 60 to 100) and contain a grade below 75. Lines with an LRN,
// year, section or similar are skipped so other numbers aren't misread.
export function failingGradesOn(extractedText) {
  const hits = []
  for (const raw of String(extractedText || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!/^[A-Za-z]/.test(line)) continue
    if (/\b(lrn|grade\s*\d|year|section|school|age|page|units?|no\.?)\b/i.test(line)) continue
    // Whole numbers only: the "62" in a college grade of 1.62 is not a grade.
    const nums = (line.match(/(?<![\d.])\d{2,3}(?:\.\d+)?(?![\d.])/g) || []).map(Number)
    if (!nums.length || nums.some((n) => n < 60 || n > 100)) continue
    const subject = line.replace(/[\d.]+/g, '').replace(/[^A-Za-z&() -]/g, ' ').replace(/\s+/g, ' ').trim()
    for (const n of nums) if (n < 75) hits.push(`${subject || 'a subject'}: ${n}`)
  }
  return hits
}

// Nov 2026 (panel revisions S2): a transferee's grades come from a college
// transcript or certificate of grades, graded 1.00 (best) to 5.00 (failed),
// not a Senior High report card graded 60 to 100.

// True when the text reads like a college grade record and not a Senior High
// report card (so a transferee can't send their SHS card instead).
export function isCollegeGradeRecord(extractedText) {
  const text = normalize(extractedText)
  const shs = ['form 138', 'sf9', 'sf 9', 'report card', 'lrn', 'learner reference', 'department of education', 'deped', 'senior high']
  const college = ['transcript of records', 'certificate of grades', 'units', 'weighted average', 'gwa', 'college', 'university', 'semester']
  return hasAny(text, college) && !hasAny(text, shs)
}

// Lines that read like a subject with a college grade of 5.00 (or marked
// FAILED). Average / GWA lines are skipped.
export function collegeFailingGradesOn(extractedText) {
  const hits = []
  for (const raw of String(extractedText || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!/^[A-Za-z]/.test(line)) continue
    if (/\b(average|gwa|total)\b/i.test(line)) continue
    const grades = (line.match(/\b[1-5]\.\d{2}\b/g) || []).map(Number)
    const failed = grades.includes(5) || /\bfailed\b/i.test(line)
    if (!failed) continue
    // Drops the grade, then the units column right before it.
    const subject = line.replace(/\b[1-5]\.\d{2}\b/g, '').replace(/\bfailed\b/ig, '').replace(/[^A-Za-z0-9&() -]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\s+\d+$/, '')
    hits.push(`${subject || 'a subject'}: 5.00`)
  }
  return hits
}

// The GWA printed on a college grade record (e.g. "General Weighted Average:
// 1.85"), or null when none is read.
export function collegeGwaOn(extractedText) {
  const m = String(extractedText || '').match(/(?:general weighted average|weighted average|\bgwa\b)[^0-9\n]{0,20}([1-5]\.\d{1,2})\b/i)
  return m ? Number(m[1]) : null
}
