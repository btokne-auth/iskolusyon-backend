-- Oct 1 2026: record the admin's decision on a reschedule or appeal request.
-- CCC reviews these in person (Appendix D); the system records the outcome
-- so the applicant can see it in their portal and the Activity Log has it.
-- status stays a text column: 'submitted' (awaiting review), 'approved',
-- 'declined'.
alter table public.reschedule_requests
  add column if not exists decided_by text,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text;
