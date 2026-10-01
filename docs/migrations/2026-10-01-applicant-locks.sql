-- Oct 1 2026: Locked Applications for Review (progress table row, Applicant
-- Information & Results Module). One row per applicant currently open by an
-- admin. A lock counts only while its heartbeat is fresh (the admin page
-- refreshes it every 30 seconds while the applicant is open), so a closed
-- tab or a crashed browser frees the applicant again within about 90 seconds.
create table if not exists public.applicant_locks (
  application_id bigint primary key references public.applications(id) on delete cascade,
  admin_email text not null,
  admin_name text,
  locked_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);
