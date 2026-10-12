-- Oct 12 2026. RUN THIS BEFORE MERGING the matching pull request: the new
-- form saves these columns, and a save fails if they don't exist yet.
--
-- 1. Special classification answers (manuscript Ch. 1 inputs: "homeless or
--    underprivileged, PWD, solo parents, and indigenous people"). Stored
--    encrypted by the app (app/lib/fieldCrypto.js), like LGBTQI+ and
--    disability.
--
-- 2. When the applicant agreed to the Data Privacy Consent (RA 10173).
--    Before, only a true/false was kept. A trigger fills the date the
--    moment privacy_agreed becomes true, on every path that saves it.
--    Existing applicants who already agreed get their application's
--    creation date, since agreeing was required to create the account.
--
-- 3. Activity Log fix: audit_log.kind only allowed 'done' and 'warn', but
--    several actions log as 'info' (admin sign-in steps, admin invites and
--    resets, CHED Form 3 release, LGU report downloads), so the database
--    silently refused those lines. This allows 'info' too.
--
-- 4. Removes sms_updates_opt_in: the SMS option was taken out of the form
--    in PR #34 and nothing reads this column anymore.
--
-- Safe to run again.

alter table public.applications
  add column if not exists solo_parent text,
  add column if not exists indigenous_member text,
  add column if not exists underprivileged text,
  add column if not exists privacy_agreed_at timestamptz;

update public.applications
set privacy_agreed_at = created_at
where privacy_agreed = true and privacy_agreed_at is null;

create or replace function public.applications_stamp_privacy_consent()
returns trigger
language plpgsql
as $$
begin
  if new.privacy_agreed is true and new.privacy_agreed_at is null then
    new.privacy_agreed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_stamp_privacy_consent on public.applications;
create trigger applications_stamp_privacy_consent
  before insert or update on public.applications
  for each row
  execute function public.applications_stamp_privacy_consent();

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.audit_log'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.audit_log drop constraint %I', c);
  end loop;
end $$;
alter table public.audit_log
  add constraint audit_log_kind_check check (kind in ('done', 'warn', 'info'));

alter table public.applications drop column if exists sms_updates_opt_in;

-- Check: 4 rows (solo_parent, indigenous_member, underprivileged,
-- privacy_agreed_at) and no sms_updates_opt_in.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'applications'
  and column_name in ('solo_parent', 'indigenous_member', 'underprivileged', 'privacy_agreed_at', 'sms_updates_opt_in')
order by column_name;
