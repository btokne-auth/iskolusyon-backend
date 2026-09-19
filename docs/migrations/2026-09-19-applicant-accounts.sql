-- User Account Module (applicant side) — Sept 19, 2026
--
-- Mirrors the admin_accounts pattern from 2026-09-18: real per-applicant
-- accounts (email + scrypt password hash) replacing the free-text
-- "type any name" identity that app/page.js has used until now.
--
-- Scope decided this session: email+password login only (no per-login OTP
-- yet — deferred until the .dev domain is claimed and Resend can reach
-- real applicant inboxes, not just the account owner's own inbox on the
-- free tier). Signup DOES send a one-time email-verification code, matching
-- Ivy's approved signup.html spec ("account is created upon successful
-- verification") — that email still only lands in the developer's own
-- inbox for now, same limitation as the existing submission-confirmation
-- email.
--
-- Run this whole file in the Supabase SQL editor once (ad hoc, same
-- pattern as every other schema change on this project — not run via a
-- migration tool).

CREATE TABLE IF NOT EXISTS applicant_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,

  -- One-time verification code (signup) — hashed, never stored plain.
  -- Also reused as the password-reset code path if that gets built later.
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts int NOT NULL DEFAULT 0,

  -- Data collected during the signup wizard's Program Application (step 2)
  -- and Personal Information (step 3) panels, staged here until email
  -- verification completes — at which point it's copied into a real
  -- `applications` row (see applicantAccounts.js). Kept as jsonb rather
  -- than duplicating ~40 columns twice; shape matches the camelCase
  -- academicInfo / personalInfo objects app/page.js already uses.
  pending_academic_info jsonb,
  pending_personal_info jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

-- Service-role only — same RLS posture as admin_accounts. The app talks to
-- Supabase with the service-role key from API routes only, never from the
-- browser, so this just makes sure nothing else (anon key, future direct
-- client access) can read password hashes or pending signup data.
ALTER TABLE applicant_accounts ENABLE ROW LEVEL SECURITY;

-- Links an `applications` row to a real account once one exists. Nullable
-- and NOT used by any matching logic yet — existing code still matches
-- applications by applicant_name (now reliably populated from a verified
-- account instead of free-typed, since the name field becomes read-only
-- once signed in). Full re-key of documents/reschedule/audit-log lookups
-- from name-matching to user_id is a separate, later pass — flagged in the
-- project's carried-forward open items, not done in this migration.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid REFERENCES applicant_accounts(id);
