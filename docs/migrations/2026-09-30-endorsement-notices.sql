-- Sept 30 2026: endorsement notices (progress table row "Real-time Result
-- Notifications (Pass/Fail/Endorsement)"). Remembers the last endorsement
-- notice sent to each applicant, same as the result_notified_* columns.
alter table public.applications
  add column if not exists endorsement_notified_status text,
  add column if not exists endorsement_notified_at timestamptz,
  add column if not exists endorsement_notified_by text,
  add column if not exists endorsement_email_sent boolean;
