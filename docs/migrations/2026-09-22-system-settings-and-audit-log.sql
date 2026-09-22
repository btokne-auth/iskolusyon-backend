-- System & Activity panel: Application Cycle Settings + Activity Log
-- filters/read state (Sept 22 2026). Run once in the Supabase SQL editor,
-- same ad hoc pattern as every other migration in this project.

-- ---------------------------------------------------------------------
-- 1. system_settings -- a single-row settings table (id pinned to 1).
--
--    Scope decided this session: only `applications_open` and
--    `document_uploads_enabled` are wired to real applicant-facing
--    gating (see app/api/application/route.js's POST and
--    app/api/upload/route.js's POST). `applicant_slots`,
--    `acceptance_start_date`/`acceptance_end_date`, and
--    `exam_results_visible` are saved here too so the admin UI round-trips
--    cleanly, but nothing enforces them yet -- their exact real-world
--    meaning (what counts toward a slot, what the date window actually
--    controls, whether "visible" should gate the existing Applicant
--    Results panel data) needs a decision before that's safe to build.
-- ---------------------------------------------------------------------
create table if not exists system_settings (
  id smallint primary key default 1,
  applications_open boolean not null default true,
  applicant_slots integer,
  acceptance_start_date date,
  acceptance_end_date date,
  document_uploads_enabled boolean not null default true,
  exam_results_visible boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint system_settings_singleton check (id = 1)
);

insert into system_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Activity log: a real category per entry (for the Show filter) and a
--    shared read/unread flag (for the Status filter + "Mark all as
--    read"). Every existing audit_log insert call site across the app
--    (admin-eligibility, admin-results, upload, admin-accounts,
--    announcements, documents/[id]/override) was updated alongside this
--    migration to pass an explicit category -- backfilling existing rows
--    to 'System' here is just for anything inserted before this change.
--
--    `read` is a single shared flag, not per-admin -- this is a small
--    shared console (see admin_accounts), not a per-user notification
--    system, so "who marked it read" isn't tracked.
-- ---------------------------------------------------------------------
alter table audit_log
  add column if not exists category text,
  add column if not exists read boolean not null default false;

update audit_log set category = 'System' where category is null;
