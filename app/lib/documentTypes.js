// Single source of truth for document types, replacing four copies that
// used to live in page.js, admin/page.js, history/page.js, and
// api/upload/route.js (flagged as tech debt in comments in more than one
// of those files — "worth moving to one shared file later, not urgent").
// Consolidated here while porting the Patch 2 applicant.html changes, since
// that patch touches this exact list and is the natural point to fix it.
//
// Matches the confirmed-merged Patch 2 applicant.html (PR #3) — 9 document
// types, down from the old 10-type list that matched the pre-Patch-2
// admin/applicant mockups. Confirmed via direct inspection of the merged
// front-end repo, not just the PR description text.
//
// Removed vs. the old list: enrollmentcert (Certificate of Enrollment),
// goodmoral (Good Moral Character), currentscholarship (Proof of Current
// Availed Scholarship/s) — panel/CCC dropped these as requirements.
//
// Added: profilepic (Profile Picture) and parentid (Voter's ID /
// Certification of Parent-Guardian) — both new required uploads in Patch 2.
//
// Relabeled only (same value key, so existing stored `documents` rows for
// these types are unaffected): birthcert, voterid, form138, employmentcert,
// medcert, supportdoc.
export const DOCUMENT_TYPE_OPTIONS = [
  { group: 'Personal Information', options: [
    { value: 'profilepic', label: 'Profile Picture' },
    { value: 'birthcert', label: 'Birth Certificate / PSA / NSO' },
    // Oct 15 2026 (client): one Voter's ID, the applicant's own or a
    // parent's/guardian's if the applicant isn't a registered voter yet.
    { value: 'voterid', label: "Voter's ID / Certification of Applicant or Parent/Guardian" },
  ]},
  { group: 'Academic Profile', options: [
    { value: 'form138', label: 'Grades (Proof of Grades / Form 138 / Report Card)' },
  ]},
  // Oct 15 2026: no longer asked for (merged into voterid above). Kept so
  // files already uploaded here stay valid and readable.
  { group: 'Family Information', options: [
    { value: 'parentid', label: "Parent/Guardian's Voter's ID (earlier upload)" },
  ]},
  { group: 'Financial & Employment', options: [
    { value: 'employmentcert', label: 'Proof of Employment' },
    { value: 'indigency', label: 'Proof of Income (Family / Guardian)' },
  ]},
  { group: 'Special Demographics & Legal', options: [
    { value: 'supportdoc', label: 'Supporting Document' },
  ]},
  { group: 'Health & Wellness', options: [
    { value: 'medcert', label: 'Medical Examination Results / Certificate' },
  ]},
]

export const DOC_TYPE_LABEL_MAP = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.flatMap((g) => g.options).map((o) => [o.value, o.label])
)

export function getDocTypeLabel(value) {
  return DOC_TYPE_LABEL_MAP[value] || value || 'Unspecified document'
}

export const VALID_DOCUMENT_TYPES = DOCUMENT_TYPE_OPTIONS.flatMap((g) =>
  g.options.map((o) => o.value)
)

// Document types that are OCR-scoped for Auto-Fill Text Extraction so far.
// Kept here too since api/upload/route.js branches on this — same reasoning
// as everything else in this file, one list instead of a scattered if/else.
// parentid stays out of this on purpose: same OCR-less, typed-field
// treatment already decided for the applicant's own voterid.
export const AUTOFILL_SCOPED_TYPES = ['birthcert', 'form138']
