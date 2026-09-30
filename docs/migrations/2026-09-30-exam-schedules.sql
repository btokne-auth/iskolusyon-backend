-- Sept 30 2026: Exam Schedule Alerts (Notifications Module, progress table
-- row "Exam Schedule Alerts").
--
-- One row per exam batch. Per the client interview (Appendix D): the first
-- 100 submissions form the first batch, and each further 100 opens another
-- batch on a different day. Applicants who do not attend forfeit.
create table if not exists public.exam_schedules (
  id bigserial primary key,
  batch_label text not null,
  exam_date date not null,
  exam_time text,
  venue text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by text
);

-- Which batch an applicant is in (null = not scheduled yet).
alter table public.applications
  add column if not exists exam_schedule_id bigint references public.exam_schedules(id) on delete set null;
