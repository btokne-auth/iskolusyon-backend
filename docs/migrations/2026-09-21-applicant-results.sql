-- Applicant Information & Results Module (Ivy's former module, picked up by Pau)
-- See ISKOLUSYON_HANDOFF.md and app/lib/matching.js for the grounding notes on
-- Scholarship Matching & Filtering -- this migration is the sibling piece for
-- the module the Roles PDF describes as:
--   "Individual Applicant Profile View, Exam Score Entry and Verification,
--    Distribution Status Tracking and Statement of Subsequent Actions,
--    Disqualification/Forfeiture Handling"
--
-- Every status value below is grounded in Appendix D of the manuscript (the
-- client interview transcript with Sir Wania, Admissions Office Head), not
-- assumption:
--   - "Mafo-forfeit yung application nila kapag hindi sila dumalo." -> a
--     no-show at the entrance exam forfeits the application.
--   - "If hindi qualified, ang gagawin natin ay waitlisted with probationary.
--     It will base on the score ng entrance exam." -> failing the exam does
--     NOT reject outright, it becomes waitlisted-with-probationary pending an
--     open slot.
--   - "Pwede bang magkaroon ng Qualified but probationary? ... may contract
--     na ibibigay... If bumagsak man siya sa isang subject tanggal na siya."
--     -> a separate "qualified but probationary" contract status that can
--     later flip to disqualified.
--   - "Yung mga passers ay bibigyan ng recommendation para sa medical exam at
--     enrollment process... ipopadala namin sa registrar, tapos ie-endorse
--     sila either sa medical o admissions para sa enrollment." -> the actual
--     post-passing pipeline: Registrar -> Medical or Admissions -> enrollment.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS exam_score numeric,
  ADD COLUMN IF NOT EXISTS exam_result text,
  ADD COLUMN IF NOT EXISTS exam_date date,
  ADD COLUMN IF NOT EXISTS exam_verified_by text,
  ADD COLUMN IF NOT EXISTS exam_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS scholar_status text NOT NULL DEFAULT 'pending_exam',
  ADD COLUMN IF NOT EXISTS scholar_status_reason text,
  ADD COLUMN IF NOT EXISTS scholar_status_set_by text,
  ADD COLUMN IF NOT EXISTS scholar_status_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS distribution_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS distribution_status_updated_by text,
  ADD COLUMN IF NOT EXISTS distribution_status_updated_at timestamptz;

-- NOT VALID: same reasoning as scripts/fix_document_type_check_constraint.sql
-- (Sept 17) -- enforce going forward without choking on any pre-existing
-- rows that predate these columns (all of which default to 'pending_exam' /
-- 'not_applicable' anyway, so this should never actually trip, but NOT VALID
-- costs nothing and avoids a repeat of that incident).
ALTER TABLE applications
  ADD CONSTRAINT applications_exam_result_check
  CHECK (exam_result IS NULL OR exam_result IN ('passed', 'failed', 'absent')) NOT VALID;

ALTER TABLE applications
  ADD CONSTRAINT applications_scholar_status_check
  CHECK (scholar_status IN (
    'pending_exam',            -- default; no exam result recorded yet
    'passer',                  -- passed the entrance exam outright
    'waitlisted_probationary', -- failed, but waitlisted pending an open slot (client's own term)
    'qualified_probationary',  -- admin-set: given a probationary contract (admin judgment call, not auto-derived)
    'disqualified',            -- admin-set: e.g. failed a subject under a probationary contract
    'forfeited'                -- auto-set on an 'absent' exam result, or admin-set for other forfeiture reasons
  )) NOT VALID;

ALTER TABLE applications
  ADD CONSTRAINT applications_distribution_status_check
  CHECK (distribution_status IN (
    'not_applicable',      -- default; only meaningful once scholar_status is passer/qualified_probationary
    'pending_endorsement',
    'endorsed_registrar',
    'endorsed_medical',
    'endorsed_admissions',
    'enrollment_complete'
  )) NOT VALID;

COMMENT ON COLUMN applications.exam_result IS 'Admin-entered outcome of the entrance exam. Drives scholar_status -- see app/lib/matching.js deriveScholarStatus().';
COMMENT ON COLUMN applications.scholar_status IS 'Post-exam standing per Appendix D''s described process (passer / waitlisted-probationary / qualified-probationary / disqualified / forfeited). Auto-derived from exam_result on entry, but admin-overridable for the two judgment-call statuses (qualified_probationary, disqualified) the exam result alone cannot decide.';
COMMENT ON COLUMN applications.distribution_status IS 'Post-passing endorsement pipeline: Registrar -> Medical or Admissions -> enrollment (Appendix D). Manually advanced by an admin; "Statement of Subsequent Actions" is the audit_log trail of these changes, same pattern as every other admin action in this app.';
