-- Scholarship Matching & Filtering (Ivy's former module, now automated —
-- see app/lib/matching.js for the eligibility rules and their grounding in
-- Appendix J of the manuscript).
--
-- transferee_gwa / transferee_units_passed / transferee_failing_grade:
--   new fields on the Educational Background panel, only meaningful when
--   applying_as = 'Transferee'. Needed to evaluate Appendix J's transferee
--   rule (no failing grade + >=26 units passed + GWA of 2.25 or better).
--
-- eligibility_status / eligibility_reasons:
--   recomputed on every application save (see maybeAssignApplicationNumber's
--   sibling, computeEligibilityUpdate(), in app/api/application/route.js).
--   status is one of 'incomplete' | 'not_qualified' | 'pending_exam' —
--   'qualified' is never set automatically (see app/lib/matching.js for why).
--
-- eligibility_override / eligibility_override_by / eligibility_override_at:
--   a super admin can manually set a final status (e.g. once real entrance
--   exam results exist, or for a genuine Program Director exception per
--   Appendix J's Transferees rule (d)). Nullable — when null, the computed
--   eligibility_status is what's shown.
--
-- Run this in the Supabase SQL editor before pulling in the app code that
-- reads/writes these columns.

alter table applications
  add column if not exists transferee_gwa numeric,
  add column if not exists transferee_units_passed integer,
  add column if not exists transferee_failing_grade text,
  add column if not exists eligibility_status text,
  add column if not exists eligibility_reasons jsonb default '[]'::jsonb,
  add column if not exists eligibility_override text,
  add column if not exists eligibility_override_by text,
  add column if not exists eligibility_override_at timestamptz;
