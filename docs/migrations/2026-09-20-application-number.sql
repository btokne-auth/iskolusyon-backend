-- Adds application_number, assigned server-side in app/api/application/
-- route.js (see maybeAssignApplicationNumber()) once every required
-- document type is on file for that applicant. Format matches CCC's own
-- sample application form numbering (Appendix I of the manuscript):
-- "<year>A-<4-digit id>", e.g. "2026A-0001".
--
-- Nullable and unindexed on purpose — this is a display value assigned
-- once per row, not something queried or joined on elsewhere yet.
--
-- Run this in the Supabase SQL editor before pulling in the app code that
-- reads/writes it.

alter table applications
  add column if not exists application_number text;
