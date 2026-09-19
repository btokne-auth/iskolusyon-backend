-- Per-section "Save as Draft" / "Submit Section" (design-parity pass 3,
-- Sept 19 2026) — applicant.html gives every profile panel its own
-- Save-as-Draft/Submit-Section pair instead of one global save button, and
-- (per the mockup's own submitSection() JS) Educational Background is the
-- one panel that locks its fields for good once submitted. These two
-- columns record that a section was explicitly submitted (not just
-- draft-saved) and, for academic, that its fields are now locked.
--
-- Financial & Health & Wellness get their own *_submitted_at columns when
-- those panels are built (still stubs as of this migration).

alter table applications
  add column if not exists personal_info_submitted_at timestamptz,
  add column if not exists academic_submitted_at timestamptz;
