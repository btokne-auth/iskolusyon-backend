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
// UPDATE Sept 21 2026: the Applicant Information & Results module now
// exists (see the bottom of this file -- getExamThreshold/suggestExamResult/
// deriveScholarStatus) and uses PROGRAM_PASSING_GRADES for real. It is
// still NOT wired into computeEligibility() above -- eligibility (this
// function) and post-exam scholar status (the functions below) stay two
// separate concerns, matching how CCC itself treats them as sequential, not
// merged, steps.
//
// DELIBERATELY NOT ENCODED (real gaps, not oversights):
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
  'Bachelor of Science in Computer Science': 75, // Appendix J p. 96: printed 85% is crossed out by hand and corrected to 75% (confirmed from the paper copy, Sept 30 2026)
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
export const TRANSFEREE_MAX_GWA = 2.25
export const TRANSFEREE_MIN_UNITS = 26

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
// Oct 12 2026: the rule checks themselves, shared by computeEligibility()
// (the admin-facing status + reasons) and applicantEligibility() (the
// applicant's own checklist in the portal), so both always agree.
// Each check is true (met), false (not met) or null (not checked yet).
// Oct 21 2026 (after the Oct 20 defense): a Voter's ID only counts once it
// is VERIFIED (by the OCR worker plus the content check in
// app/lib/documentContentCheck.js, or by an admin). Callers pass, next to
// each uploaded document_type, a "verified:<type>" entry for documents that
// are neither flagged nor still being read. documentTypeTokens() builds both.
export const VERIFIED_PREFIX = 'verified:'
export function documentTypeTokens(doc) {
  const type = doc?.document_type
  if (!type) return []
  // Nov 2026 (panel revisions S2): passing the OCR / content check is not
  // enough any more; a staff member has to confirm it (app/lib/documentState.js).
  const verified = !doc.needs_review && doc.review_status !== 'processing' && !!doc.staff_confirmed_at
  return verified ? [type, `${VERIFIED_PREFIX}${type}`] : [type]
}

function checkEligibilityRules(row, uploadedTypes) {
  const types = uploadedTypes instanceof Set ? uploadedTypes : new Set(uploadedTypes || [])
  const personalIn = !!row.personal_info_submitted_at

  // ---- Residency (Appendix J I.b, I.c) ----
  const residency = !personalIn ? null : looksLikeCalambaAddress(row.address)

  // ---- Voter registration (Appendix J I.c) ----
  // Uploaded but flagged or still being read counts as "not checked yet"
  // (incomplete), not as met; the admin's Verify moves it to met.
  const voterUploaded = types.has('voterid') || types.has('parentid')
  const voterVerified = types.has(`${VERIFIED_PREFIX}voterid`) || types.has(`${VERIFIED_PREFIX}parentid`)
  const voter = !personalIn ? null : !voterUploaded ? false : voterVerified ? true : null
  const voterPending = personalIn && voterUploaded && !voterVerified

  // ---- Transferee academic standing (Appendix J "Transferees" section) ----
  const transfereeApplies = row.applying_as === 'Transferee'
  const t = { applies: transfereeApplies, ok: true, notSubmitted: false, missing: false }
  if (transfereeApplies) {
    if (!row.academic_submitted_at) {
      t.ok = null
      t.notSubmitted = true
    } else {
      const gwa = row.transferee_gwa
      const units = row.transferee_units_passed
      const failingGrade = row.transferee_failing_grade
      if (gwa == null || units == null || !failingGrade) {
        t.ok = null
        t.missing = true
      } else {
        t.gwa = gwa
        t.units = units
        t.gwaOk = Number(gwa) <= TRANSFEREE_MAX_GWA
        t.unitsOk = Number(units) >= TRANSFEREE_MIN_UNITS
        t.noFailOk = failingGrade === 'No'
        t.ok = t.gwaOk && t.unitsOk && t.noFailOk
      }
    }
  }

  // ---- First Year: no failing grade in the SHS report card (Nov 2026,
  // panel revisions S2 "reconcile the grade requirement"; client interview,
  // Appendix B: "dapat walang failing grade", "Hindi natanggap ng bagsak").
  // Only applications that answered the question are checked, so older
  // ones are not suddenly changed. Old Curriculum / ALS completers are not
  // asked; staff check their proof of grades.
  const g = { applies: row.applying_as === 'First Year' && !!row.academic_submitted_at && !!row.shs_failing_grade, ok: true }
  if (g.applies) g.ok = row.shs_failing_grade === 'No'

  // ---- Report card confirmed by staff (Nov 2026, panel revisions S2) ----
  // OCR reads the report card (at sign-up and in the portal); a staff
  // member confirms it, the same as the Voter's ID, before the applicant can
  // reach the exam. Old Curriculum / ALS completers are checked by staff
  // without this rule. Only checked once Educational Background is in.
  const cardApplies = ['First Year', 'Transferee'].includes(row.applying_as) && !!row.academic_submitted_at
  const cardUploaded = types.has('form138')
  const cardVerified = types.has(`${VERIFIED_PREFIX}form138`)
  const card = !cardApplies ? true : cardVerified ? true : null
  const cardPending = cardApplies && cardUploaded && !cardVerified
  const cardMissing = cardApplies && !cardUploaded

  let status
  if (residency === false || voter === false || t.ok === false || g.ok === false) status = 'not_qualified'
  else if (residency === null || voter === null || t.ok === null || card === null) status = 'incomplete'
  else status = 'pending_exam'

  return { residency, voter, voterPending, transferee: t, grades: g, card: { applies: cardApplies, ok: card, pending: cardPending, missing: cardMissing }, status }
}

export function computeEligibility(row, uploadedTypes) {
  const rules = checkEligibilityRules(row, uploadedTypes)
  const reasons = []

  if (rules.residency === null) {
    reasons.push('Personal Information not yet submitted, so residency was not evaluated.')
  } else if (rules.residency === false) {
    reasons.push("Address on file doesn't indicate residency in Calamba City (Appendix J requires bonafide Calamba residency).")
  }

  if (rules.voterPending) {
    reasons.push("Voter's ID uploaded but not yet verified (flagged for review or still being read). Verify it in Document Review to continue.")
  } else if (rules.voter === null) {
    reasons.push('Personal Information not yet submitted, so voter registration was not evaluated.')
  } else if (rules.voter === false) {
    reasons.push("No Voter's ID on file for the applicant or a parent/guardian (Appendix J requires one).")
  }

  const t = rules.transferee
  if (t.notSubmitted) {
    reasons.push('Educational Background not yet submitted, so transferee standing was not evaluated.')
  } else if (t.missing) {
    reasons.push('Transferee GWA / units passed / failing-grade answer missing.')
  } else if (t.applies) {
    if (!t.gwaOk) reasons.push(`Transferee GWA of ${t.gwa} doesn't meet the 2.25-or-better requirement.`)
    if (!t.unitsOk) reasons.push(`Transferee has passed ${t.units} units. Appendix J requires at least 26.`)
    if (!t.noFailOk) reasons.push('Transferee reported a failing grade in a previous semester (Appendix J disqualifies this).')
  }

  if (rules.card.pending) {
    reasons.push('Report card (Form 138) uploaded but not yet confirmed by staff. Confirm it in Document Review to continue.')
  } else if (rules.card.missing) {
    reasons.push('No report card (Form 138) on file yet.')
  }

  if (rules.grades.applies && !rules.grades.ok) {
    reasons.push('First Year applicant reported a grade below 75 in the Senior High report card (failing grades are not accepted).')
  }

  // ---- BSEd Mathematics / Science (Appendix J p. 96, rule a) ----
  // Program-level only: it closes that program, not the whole application,
  // so it adds a reason without changing the status.
  if (bsedGradeBelow(row.program_choice_1, row)) {
    reasons.push(
      `Lowest SHS Mathematics or Science grade is ${row.shs_math_science_lowest}, below 85, so ${row.program_choice_1} (1st choice) is closed (Appendix J, rule a). Other programs still count.`
    )
  }

  const status = rules.status
  if (status === 'pending_exam') {
    reasons.push('Passes every rule this system can currently check. Final admission still depends on the entrance exam result.')
  }

  return { status, reasons }
}

// Oct 12 2026: Chapter 1 p. 15 promises applicants "a verified scholarship
// eligibility listing", and Objective 2 says it comes "without
// administrative intervention". So the portal shows the same automatic
// check the admins see, right away, as a plain-language checklist, and
// marks it Verified once an admin has set the applicant's status
// (eligibility_override). It never shows Qualified vs Waitlisted: those
// are results, which reach the applicant only through Send Result.
//
// Returns { status, verified, items, note }:
//   status: 'not_checked' | 'meets' | 'not_met'
//   items:  [{ key, label, state: 'met' | 'not_met' | 'not_checked', detail }]
export function applicantEligibility(row, uploadedTypes) {
  const rules = checkEligibilityRules(row, uploadedTypes)
  const stateOf = (v) => (v === true ? 'met' : v === false ? 'not_met' : 'not_checked')
  const items = []

  items.push({
    key: 'residency',
    label: 'Resident of Calamba City',
    state: stateOf(rules.residency),
    detail:
      rules.residency === null
        ? 'Checked once you submit your Personal Information.'
        : rules.residency
        ? 'Your address is in Calamba City.'
        : 'Your address on file is not in Calamba City.',
  })

  items.push({
    key: 'voter',
    label: "Voter's ID (yours or a parent's or guardian's)",
    state: stateOf(rules.voter),
    detail:
      rules.voterPending
        ? "Your Voter's ID is being reviewed. It counts once it is verified."
        : rules.voter === null
        ? 'Checked once you submit your Personal Information.'
        : rules.voter
        ? "A Voter's ID is on file."
        : "Upload your Voter's ID, or a parent's or guardian's.",
  })

  const t = rules.transferee
  if (t.applies) {
    let detail
    if (t.notSubmitted) detail = 'Checked once you submit your Educational Background.'
    else if (t.missing) detail = 'Fill in your GWA, units passed and failing-grade answer in Educational Background.'
    else if (t.ok) detail = `GWA ${t.gwa}, ${t.units} units passed, no failing grade.`
    else {
      const parts = []
      if (!t.gwaOk) parts.push(`GWA of ${t.gwa} (2.25 or better is needed)`)
      if (!t.unitsOk) parts.push(`${t.units} units passed (at least 26 are needed)`)
      if (!t.noFailOk) parts.push('a failing grade in a previous semester')
      detail = `Not met: ${parts.join('; ')}.`
    }
    items.push({ key: 'transferee', label: 'Transferee academic standing', state: stateOf(t.ok), detail })
  }

  if (rules.card.applies) {
    items.push({
      key: 'card',
      label: 'Report card (Form 138) confirmed by the Guidance Office',
      state: rules.card.ok ? 'met' : 'not_checked',
      detail: rules.card.ok
        ? 'Your report card was confirmed.'
        : rules.card.pending
        ? 'Your report card is waiting for the Guidance Office to confirm it.'
        : 'Upload your report card (Form 138) in Educational Background.',
    })
  }

  if (rules.grades.applies) {
    items.push({
      key: 'grades',
      label: 'No failing grade in your Senior High report card',
      state: stateOf(rules.grades.ok),
      detail: rules.grades.ok ? 'You reported no grade below 75.' : 'You reported a grade below 75. Failing grades are not accepted.',
    })
  }

  let status = rules.status === 'not_qualified' ? 'not_met' : rules.status === 'pending_exam' ? 'meets' : 'not_checked'

  // An admin's decision is the verified one.
  const override = row.eligibility_override
  const verified = !!override
  if (override === 'not_qualified') status = 'not_met'
  else if (override === 'qualified' || override === 'waitlisted') {
    status = 'meets'
    // The office accepted the application (e.g. a Program Director
    // exception, Appendix J Transferees rule d), so an item the automatic
    // check couldn't confirm isn't shown as a problem.
    for (const item of items) {
      if (item.state !== 'met') {
        item.state = 'met'
        item.detail = 'Accepted by the Scholarship Office.'
      }
    }
  }

  let note = null
  if (bsedGradeBelow(row.program_choice_1, row)) {
    note = `Your lowest SHS Mathematics or Science grade is below 85, so ${row.program_choice_1} (your 1st choice) is closed to you. Your exam result can still place you in another program.`
  }

  return { status, verified, items, note }
}

// ---------------------------------------------------------------------------
// Applicant Information & Results Module (Sept 21 2026)
//
// Ivy's former module (Roles PDF: "Individual Applicant Profile View, Exam
// Score Entry and Verification, Distribution Status Tracking and Statement
// of Subsequent Actions, Disqualification/Forfeiture Handling"). This is
// what PROGRAM_PASSING_GRADES above was transcribed for back on Sept 20 --
// it was flagged then as "not used yet, for this future module to import",
// and this is that import. See docs/migrations/2026-09-21-applicant-results.sql
// for the schema and its Appendix D grounding notes (same citations apply
// here, not repeated in full).

// A program passing grade of `null` means Appendix J itself hasn't set one
// yet (Social Work / Entrepreneurship, pending their own CHED application) --
// distinct from "no score entered", which is just `examScore == null`.
export function getExamThreshold(programChoice) {
  if (!programChoice) return null
  const grade = PROGRAM_PASSING_GRADES[programChoice]
  return typeof grade === 'number' ? grade : null
}

// A suggestion only, shown alongside the admin's own explicit exam_result
// selection -- never applied automatically. This mirrors the eligibility
// engine's own pattern (compute a real answer where the data supports one,
// but leave the final call to a human where CCC's actual process says a
// human makes it). The client interview is explicit that the exam is
// evaluated as Passing Score or Passed (Appendix D: "Walang minimum grade.
// It must be Passing Score or Passed in the entrance exam.") -- the numeric
// PROGRAM_PASSING_GRADES table is Appendix J's own per-program cutoff for
// what counts as passing, not a separate rule.
export function suggestExamResult(examScore, programChoice) {
  const threshold = getExamThreshold(programChoice)
  if (examScore == null || examScore === '' || threshold == null) {
    return { suggested: null, threshold }
  }
  const score = Number(examScore)
  if (Number.isNaN(score)) return { suggested: null, threshold }
  return { suggested: score >= threshold ? 'passed' : 'failed', threshold }
}

// Derives scholar_status from an admin-entered exam_result. Grounded in the
// client interview (Appendix D):
//   - absent  -> 'forfeited' ("Mafo-forfeit yung application nila kapag
//                hindi sila dumalo")
//   - passed  -> 'passer'
//   - failed  -> 'waitlisted_probationary' ("ang gagawin natin ay waitlisted
//                with probationary... base sa score ng entrance exam")
// 'qualified_probationary' and 'disqualified' are deliberately NOT derived
// here -- both are real admin judgment calls per Appendix D ("Qualified but
// probationary... may contract na ibibigay"; disqualification follows a
// separate later event, failing a subject under that contract, not the
// entrance exam itself), so they're only ever set through the manual
// scholar-status override, same escape-hatch pattern as eligibility_override.
export function deriveScholarStatus(examResult) {
  if (examResult === 'absent') {
    return { status: 'forfeited', reason: 'Did not attend the scheduled entrance examination.' }
  }
  if (examResult === 'passed') {
    return { status: 'passer', reason: null }
  }
  if (examResult === 'failed') {
    return { status: 'waitlisted_probationary', reason: null }
  }
  return { status: 'pending_exam', reason: null }
}

export const SCHOLAR_STATUS_VALUES = new Set([
  'pending_exam',
  'passer',
  'waitlisted_probationary',
  'qualified_probationary',
  'disqualified',
  'forfeited',
])

// Endorsement pipeline after passing, per Appendix D: "ipopadala namin sa
// registrar, tapos ie-endorse sila either sa medical o admissions para sa
// enrollment." Modeled as an ordered sequence an admin advances manually
// (not automated -- CCC's own process routes to either Medical OR
// Admissions depending on a human decision, not a rule this system can
// evaluate) rather than a strict linear state machine, since which of the
// two endorsement branches applies is itself the human call.
export const DISTRIBUTION_STATUS_VALUES = new Set([
  'not_applicable',
  'pending_endorsement',
  'endorsed_registrar',
  'endorsed_medical',
  'endorsed_admissions',
  'enrollment_complete',
])

// ---------------------------------------------------------------------------
// Eligible programs and the BSEd Mathematics / Science rule (Oct 6 2026)
//
// Manuscript p. 10: the matching module "generates a listing of eligible
// programs for each applicant". Appendix J p. 96:
//   rule a: "Additional evaluation procedures will be implemented for BSED
//           Mathematics and Science. Applicants with a grade of below 85 in
//           all mathematics and science academic subjects during senior high
//           school will not be accepted in the said programs." Read as: every
//           SHS Mathematics and Science subject must be 85 or higher, so the
//           portal asks for the LOWEST of those grades
//           (shs_math_science_lowest).
//   rule b: "In cases that the applicant did not qualify in his/her priority
//           program based on the set qualifying grade, he/she will be
//           re-evaluated in another program based on his/her exam result."
// The system only lists the programs a score meets. An admin picks one
// (CCC decides in person, Appendix D), never the system on its own.

export const BSED_MATH_SCIENCE_PROGRAMS = new Set([
  'Bachelor of Secondary Education Major in Mathematics',
  'Bachelor of Secondary Education Major in Science',
])
export const BSED_MIN_SHS_GRADE = 85

export function needsShsMathScienceGrade(row) {
  return BSED_MATH_SCIENCE_PROGRAMS.has(row?.program_choice_1) || BSED_MATH_SCIENCE_PROGRAMS.has(row?.program_choice_2)
}

// Why `program` is closed to this applicant by rule a, or null.
export function bsedBlockReason(program, row) {
  if (!BSED_MATH_SCIENCE_PROGRAMS.has(program)) return null
  const raw = row?.shs_math_science_lowest
  if (raw === null || raw === undefined || raw === '') {
    return 'Lowest SHS Mathematics or Science grade not given yet (Appendix J, rule a)'
  }
  const grade = Number(raw)
  if (Number.isFinite(grade) && grade < BSED_MIN_SHS_GRADE) {
    return `Lowest SHS Mathematics or Science grade is ${grade}, below ${BSED_MIN_SHS_GRADE} (Appendix J, rule a)`
  }
  return null
}

// Every program with a set passing grade, marked with whether this score
// meets it and whether rule a closes it. The 2nd choice comes first, then
// by passing grade, then A-Z. The 1st choice is left out (it's the program
// being re-evaluated from).
export function eligibleProgramsForScore(examScore, row) {
  const score = Number(examScore)
  if (examScore === null || examScore === undefined || examScore === '' || !Number.isFinite(score)) return []
  const second = row?.program_choice_2
  return Object.entries(PROGRAM_PASSING_GRADES)
    .filter(([program, grade]) => typeof grade === 'number' && score >= grade && program !== row?.program_choice_1)
    .map(([program, grade]) => ({ program, grade, isSecondChoice: program === second, blockedReason: bsedBlockReason(program, row) }))
    .sort((a, b) => (b.isSecondChoice - a.isSecondChoice) || (a.grade - b.grade) || a.program.localeCompare(b.program))
}

// The program an applicant is admitted in: the re-evaluated one, else the
// 1st choice.
export function admittedProgramOf(row) {
  return row?.admitted_program || row?.program_choice_1 || null
}

// True when a GIVEN grade closes this BSEd program (rule a). A missing grade
// doesn't close it here (older applications never asked), it's only shown
// as a warning; the re-evaluation list asks for the grade first.
export function bsedGradeBelow(program, row) {
  if (!BSED_MATH_SCIENCE_PROGRAMS.has(program)) return false
  const raw = row?.shs_math_science_lowest
  if (raw === null || raw === undefined || raw === '') return false
  const grade = Number(raw)
  return Number.isFinite(grade) && grade < BSED_MIN_SHS_GRADE
}

// Did this score get the applicant into their 1st choice? null when there's
// no score or the 1st choice has no passing grade yet (Social Work,
// Entrepreneurship).
export function reachedFirstChoice(row) {
  const score = Number(row?.exam_score)
  if (row?.exam_score === null || row?.exam_score === undefined || row?.exam_score === '' || !Number.isFinite(score)) return null
  const threshold = getExamThreshold(row?.program_choice_1)
  if (threshold == null) return null
  return score >= threshold && !bsedGradeBelow(row?.program_choice_1, row)
}
