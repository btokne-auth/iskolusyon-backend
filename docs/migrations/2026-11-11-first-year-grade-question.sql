-- Nov 11 2026: two-stage application (panel revisions, priority 4 / S2 / S4).
-- The First Year grade question in Educational Background:
-- "Do you have any grade below 75 in your latest Senior High report card?"
-- Run once in the Supabase SQL editor, BEFORE merging the code.
alter table public.applications add column if not exists shs_failing_grade text;
