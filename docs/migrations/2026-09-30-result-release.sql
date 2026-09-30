-- Sept 30 2026: result release (item 5, "Real-time Result Notifications").
-- Remembers what result notice was last sent to each applicant, so the
-- admin panel can show "Sent: Passer, Sept 30, by <admin>" and warn before
-- sending the same result twice by accident.
--
-- Run once in the Supabase SQL Editor. Safe to run again.
alter table public.applications
  add column if not exists result_notified_status text,
  add column if not exists result_notified_at timestamptz,
  add column if not exists result_notified_by text,
  add column if not exists result_email_sent boolean;
