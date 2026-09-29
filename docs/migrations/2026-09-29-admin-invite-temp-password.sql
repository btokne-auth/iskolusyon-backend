-- Sept 29, 2026: Admin invite flow (MCL-style temporary password).
-- Run once in Supabase's SQL editor BEFORE deploying the code that uses it.
-- Safe for existing accounts: both columns default to "no temporary
-- password", so everyone who already has a password keeps signing in as
-- before.
--
-- must_change_password: true while the account is still on a system-
--   generated temporary password (new invite, or a Super Admin reset).
--   The admin must set their own password on their next sign-in.
-- temp_password_expires_at: when that temporary password stops working
--   (7 days after it was issued). NULL once the admin sets their own.

ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE admin_accounts
  ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamptz;
