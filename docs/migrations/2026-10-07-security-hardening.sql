-- Oct 7 2026: security hardening (manuscript Ch. 3).
-- Run once in Supabase > SQL Editor BEFORE the new code goes live.
-- Safe to run again (every line uses "if not exists").

-- 1. Emailed sign-in code for console accounts (MFA). Only the SHA-256
--    hash of the code is stored, never the code itself.
alter table admin_accounts add column if not exists login_code_hash text;
alter table admin_accounts add column if not exists login_code_expires_at timestamptz;
alter table admin_accounts add column if not exists login_code_attempts integer not null default 0;
