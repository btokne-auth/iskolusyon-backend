-- Oct 7 2026 (manuscript Ch. 3: least privilege, Security Misconfiguration).
-- Turns on Row Level Security for every table the app uses, with NO
-- policies. Effect: the public "anon" key can no longer read or change any
-- row through Supabase's API. The app itself is not affected, because every
-- server route uses the service role key, which Supabase lets through RLS.
--
-- BEFORE RUNNING: confirm the OCR worker on Render also uses the service
-- role key (Render > iskolusyon-ocr-worker > Environment: the Supabase key
-- variable must hold the "service_role" secret, not the "anon public" key).
-- If it used the anon key, document reading would stop until it's switched.
--
-- Safe to run again. Undo for one table: alter table <name> disable row level security;

alter table public.admin_accounts      enable row level security;
alter table public.allowance_posts     enable row level security;
alter table public.announcements       enable row level security;
alter table public.applicant_accounts  enable row level security;
alter table public.applicant_locks     enable row level security;
alter table public.applications        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.conflict_checks     enable row level security;
alter table public.documents           enable row level security;
alter table public.exam_schedules      enable row level security;
alter table public.extracted_fields    enable row level security;
alter table public.lgu_reports         enable row level security;
alter table public.login_attempts      enable row level security;
alter table public.reschedule_requests enable row level security;
alter table public.system_settings     enable row level security;

-- Check: every row below should say rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
