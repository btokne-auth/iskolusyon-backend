-- Health & Wellness panel (design-parity pass 6, Sept 19 2026) — this panel
-- was still a stub as of the section-submit-fields migration, which already
-- reserved the naming pattern ("Financial & Health & Wellness get their own
-- *_submitted_at columns when those panels are built"). Adds the one real
-- field Ivy's spec has for this panel (Medical Status is a free-text
-- textarea, not a fixed set of options) plus its own submit checkpoint.
-- The Medical Examination Results/Certificate upload uses the existing
-- `medcert` document type (already in documentTypes.js) — no new column
-- needed for that, same as every other document upload in this app.

alter table applications
  add column if not exists health_condition text,
  add column if not exists health_submitted_at timestamptz;
