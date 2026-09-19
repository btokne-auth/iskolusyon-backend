-- Family & Financial Information panel (design-parity pass 7, Sept 19
-- 2026) — last stub panel from Ivy's spec. Adds every field from her
-- panel-financial section: the Parent/Guardian table (6 fields x 3
-- people), the only-child branch (number of siblings + the two CCC
-- sibling questions), emergency contact, the working-student branch, and
-- the sibling income table.
--
-- The sibling income table is the one part of this panel with an
-- unknown-length list (Ivy's spec lets the applicant add more sibling
-- columns with a "+" button) — stored as jsonb, same pattern already used
-- for `organizations` on the Personal Information panel (see
-- 2026-09-17-personal-info-fields.sql's follow-up column additions), not
-- a new pattern for this app.
--
-- Verifying-document uploads (parentid, employmentcert, indigency) use
-- the existing document types already in documentTypes.js — no new
-- columns needed for those, same as every other document upload here.

alter table applications
  add column if not exists fam_mother_name text,
  add column if not exists fam_mother_citizenship text,
  add column if not exists fam_mother_dob text,
  add column if not exists fam_mother_contact text,
  add column if not exists fam_mother_education text,
  add column if not exists fam_mother_employment text,
  add column if not exists fam_father_name text,
  add column if not exists fam_father_citizenship text,
  add column if not exists fam_father_dob text,
  add column if not exists fam_father_contact text,
  add column if not exists fam_father_education text,
  add column if not exists fam_father_employment text,
  add column if not exists fam_guardian_name text,
  add column if not exists fam_guardian_citizenship text,
  add column if not exists fam_guardian_dob text,
  add column if not exists fam_guardian_contact text,
  add column if not exists fam_guardian_education text,
  add column if not exists fam_guardian_employment text,
  add column if not exists fam_only_child text,
  add column if not exists fam_num_siblings integer,
  add column if not exists fam_sibling_currentstudent text,
  add column if not exists fam_sibling_graduate text,
  add column if not exists fam_emergency_contact text,
  add column if not exists fam_emergency_contact_number text,
  add column if not exists fam_working_student text,
  add column if not exists fam_siblings jsonb default '[]'::jsonb,
  add column if not exists financial_submitted_at timestamptz;
