-- Rename financial_submitted_at to fam_financial_submitted_at.
--
-- This column tracks the submit timestamp for the "Family & Financial
-- Information" sidebar panel (one combined section, per the manuscript's
-- own scope). "financial_submitted_at" alone reads like it only covers
-- financial data, which invites a question from the defense panel about
-- why family info has no submitted-at column of its own. Every other
-- family-related column already uses the fam_ prefix (fam_mother_name,
-- fam_father_name, fam_guardian_name, etc.) — this brings the section's
-- own submitted-at column in line with that convention instead of
-- introducing a second, separate column.
--
-- Run this in the Supabase SQL editor. Safe to run even if a row already
-- has a value in financial_submitted_at — RENAME COLUMN keeps the data,
-- it only changes the column's name.

alter table applications
  rename column financial_submitted_at to fam_financial_submitted_at;
