// Scholarship Matching & Filtering — the automated eligibility engine.
//
// This is Ivy's former module (see ISKOLUSYON_HANDOFF.md §2, item 7),
// picked up here for the first time — nothing automated existed before
// this. It replaces what Ivy's own admin.html mockup treated as a fully
// manual admin decision (click "Qualified" / "Waitlisted" / "Not
// Qualified" per applicant, see requestStatusChange() in that file) with
// real cross-referencing against CCC's actual written eligibility rules,
// which is literally the capstone's second specific objective (Chapter 1:
// "automate qualification matching and filtering... without administrative
// intervention").
//
// Every rule below is grounded in Appendix J of the manuscript ("Scholar
// Guidelines" — a signed, official CCC document), not assumption. Sept 20
// 2026 session notes on what IS and ISN'T encoded here, and why:
//
// ENCODED (data already exists, or was added this session):
//   - Residency (Appendix J, Sec. I.b/I.c: "must be a resident of the City
//     of Calamba")
//   - Voter registration (Appendix J, Sec. I.c: "Voter's ID or COMELEC
//     Voter's Certificate... For non-registered voters, a parent/
//     guardian's voter ID will do") — modeled as "has uploaded voterid OR
//     parentid", since that's the actual document-level proxy this system
//     collects for it.
//   - Transferee academic standing (Appendix J, Transferees section):
//     no failing grade in any semester from the previous school(s), at
//     least 26 units passed, GWA of 2.25 or better (numerically <= 2.25 —
//     lower is better under PH collegiate grading).
//
// DELIBERATELY NOT ENCODED YET (real gaps, not oversights):
//   - Per-program entrance exam passing grade (Appendix J Sec. VI table —
//     BSA 80%, BSCS 85%, BSIT 80%, etc.). There is no entrance exam score
//     anywhere in this system yet — that data belongs to the still-unbuilt
//     Applicant Information & Results module (handoff §2, item 8). Until
//     that module exists and actually records a score, this can only ever
//     be "pending" — encoding fake thresholds against data that doesn't
//     exist would just be decorative, the same mistake application_number
//     used to be before Sept 20's fix. PROGRAM_PASSING_GRADES below is kept
//     as a straight transcription of Appendix J for that future module to
//     import, not used for any decision here.
//   - BSEd Math/Science SHS-grade rule (Appendix J Sec. VI.a: below-85 in
//     ALL math/science SHS subjects across all programs -> BSEd Math/
//     Science programs rejected). Needs per-subject SHS grades, which the
//     Educational Background panel doesn't collect (only school/address/
//     section/year/honors per level) — not built this session, flagged for
//     a future pass.
//   - Program capacity/quota, Program Director exceptional-case discretion,
//     "derogatory record from previous school", and priority-ranking
//     between equally-qualified residents vs. non-resident relatives
//     (Appendix J Sec. VI.b-e) — these are human/administrative judgment
//     calls per the guidelines themselves, not eligibility facts to compute.
//   - Executive Program's employee-only track — CCC's guidelines describe
//     it, but it isn't one of the 16 programs in PROGRAM_OPTIONS
//     (app/page.js) or the FY 2026-2027 program list below, so there's
//     nothing in the current data model to gate. Flagged, not built.
//   - Financial/socioeconomic and demographic-classification criteria
//     (LGBTQI+, disability, indigency, etc.) — Chapter 1 names these as
//     part of the matching engine's intended scope, but Appendix J itself
//     (the actual signed guidelines) states no numeric threshold or rule
//     for any of them. Inventing one here would violate the standing
//     "ground it in facts" instruction, so these stay informational only.

// FY 2026-2027 program list and entrance-exam passing grades, transcribed
// directly from Appendix J. Not used in computeEligibility() below (see
// note above) — kept here so the Applicant Information & Results module
// can import real, sourced numbers instead of re-deriving them later.
// '-' means "not yet set" in Appendix J itself (Social Work / Entrepreneurship
// are pending their own CHED application for AY 2026-2027).
export const PROGRAM_PASSING_GRADES = {
  'Bachelor of Science in Accountancy': 80,
  'Bachelor of Science in Accounting Information System': 75,
  'Bachelor of Science in Computer Science': 85,
  'Bachelor of Science in Information Technology': 80,
  'Bachelor of Elementary Education': 80,
  'Bachelor of Secondary Education Major in English': 80,
  'Bachelor of Secondary Education Major in Science': 80,
  'Bachelor of Secondary Education Major in Mathematics': 80,
  'Bachelor of Secondary Education Major in Filipino': 80,
  'Bachelor of Secondary Education Major in Social Studies': 80,
  'Bachelor of Early Childhood Education': 80,
  'Bachelor of Science in Psychology': 80,
  'Bachelor of Science in Public Administration': 75, // *subject to CHED approval, AY 2026-2027
  'Bachelor of Arts in Communication': 80, // *subject to CHED approval, AY 2026-2027
  'Bachelor of Science in Social Work': null, // **for CHED application, AY 2026-2027 — not yet set
  'Bachelor of Science in Entrepreneurship': null, // **for CHED application, AY 2026-2027 — not yet set
}

// GWA cutoff for transferees: "2.25 or better" — Philippine collegiate
// grading runs 1.0 (highest) to 5.0 (failing), so "better" means a lower
// number. A GWA of exactly 2.25 passes.
const TRANSFEREE_MAX_GWA = 2.25
const TRANSFEREE_MIN_UNITS = 26

// Very small, deliberately conservative text check — Personal Information
// only collects a free-text `address` field, not a dedicated "resident of
// Calamba? yes/no" flag, so this is a heuristic proxy on the best signal
// actually collected, not a verified residency check. Flagged as a real
// limitation, not hidden as if it were exact.
function looksLikeCalambaAddress(address) {
  return typeof address === 'string' && address.toLowerCase().includes('calamba')
}

// row: a merged `applications` row (snake_case columns, as read from/written
// to Supabase — see app/lib/applicationColumns.js for the shape).
// uploadedTypes: a Set of document_type strings this applicant has on file
// (from the `documents` table — same lookup already used by
// maybeAssignApplicationNumber in app/api/application/route.js).
//
// Returns { status, reasons }.
//   status is one of:
//     'incomplete'   — not enough of the profile has been submitted yet to
//                       evaluate one or more rules
//     'not_qualified' — fails a rule that CAN be fully evaluated today
//     'pending_exam'  — passes everything evaluable today; final admission
//                       still depends on the (not-yet-built) entrance exam
//                       result, matching how CCC itself treats nothing as
//                       final pre-exam (see the client interview: "Qualified
//                       but probationary... waitlisted with probationary...
//                       if di nameet ang entrance examination score")
//   'qualified' is intentionally never computed here — see PATCH NOTES in
//   app/api/application/route.js. An admin can still set it manually via
//   eligibility_override for a real edge case (Program Director discretion,
//   Appendix J Transferees rule (d)).
//   reasons is an array of short human-readable strings for the admin to
//   see WHY, not just what.
export function computeEligibility(row, uploadedTypes) {
  const types = uploadedTypes instanceof Set ? uploadedTypes : new Set(uploadedTypes || [])
  const reasons = []

  // ---- Residency (Appendix J I.b, I.c) ----
  let residencyOk
  if (!row.personal_info_submitted_at) {
    residencyOk = null
    reasons.push('Personal Information not yet submitted — residency not evaluated.')
  } else if (looksLikeCalambaAddress(row.address)) {
    residencyOk = true
  } else {
    residencyOk = false
    reasons.push("Address on file doesn't indicate residency in Calamba City (Appendix J requires bonafide Calamba residency).")
  }

  // ---- Voter registration (Appendix J I.c) ----
  let voterOk
  if (!row.personal_info_submitted_at) {
    voterOk = null
    reasons.push('Personal Information not yet submitted — voter registration not evaluated.')
  } else if (types.has('voterid') || types.has('parentid')) {
    voterOk = true
  } else {
    voterOk = false
    reasons.push("No Voter's ID on file for the applicant or a parent/guardian (Appendix J requires one).")
  }

  // ---- Transferee academic standing (Appendix J "Transferees" section) ----
  let transfereeOk
  if (row.applying_as !== 'Transferee') {
    transfereeOk = true // rule doesn't apply to freshmen / Old Curriculum-ALS applicants
  } else if (!row.academic_submitted_at) {
    transfereeOk = null
    reasons.push('Educational Background not yet submitted — transferee standing not evaluated.')
  } else {
    const gwa = row.transferee_gwa
    const units = row.transferee_units_passed
    const failingGrade = row.transferee_failing_grade
    if (gwa == null || units == null || !failingGrade) {
      transfereeOk = null
      reasons.push('Transferee GWA / units passed / failing-grade answer missing.')
    } else {
      const gwaOk = Number(gwa) <= TRANSFEREE_MAX_GWA
      const unitsOk = Number(units) >= TRANSFEREE_MIN_UNITS
      const noFailOk = failingGrade === 'No'
      transfereeOk = gwaOk && unitsOk && noFailOk
      if (!gwaOk) reasons.push(`Transferee GWA of ${gwa} doesn't meet the 2.25-or-better requirement.`)
      if (!unitsOk) reasons.push(`Transferee has passed ${units} units — Appendix J requires at least 26.`)
      if (!noFailOk) reasons.push('Transferee reported a failing grade in a previous semester (Appendix J disqualifies this).')
    }
  }

  // ---- Overall status ----
  let status
  if (residencyOk === false || voterOk === false || transfereeOk === false) {
    status = 'not_qualified'
  } else if (residencyOk === null || voterOk === null || transfereeOk === null) {
    status = 'incomplete'
  } else {
    status = 'pending_exam'
    reasons.push('Passes every rule this system can currently check — final admission still depends on entrance exam results, which the Applicant Information & Results module does not yet record.')
  }

  return { status, reasons }
}
