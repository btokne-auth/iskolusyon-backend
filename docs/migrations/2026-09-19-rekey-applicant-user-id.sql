-- Downstream re-keying (deferred since the applicant-account-module build):
-- documents, reschedule_requests, and the applications table (already has
-- the column, unused until now — see 2026-09-19-applicant-accounts.sql)
-- all still matched applicants by free-text applicant_name/applicant_email.
-- That's the same pattern used for the admin-login swap: add the real
-- foreign key alongside the old text match, backfill what can be matched
-- automatically, and keep the name-based path as a fallback for legacy
-- rows nothing can confidently link.

alter table documents
  add column if not exists applicant_user_id uuid references applicant_accounts(id);

alter table reschedule_requests
  add column if not exists applicant_user_id uuid references applicant_accounts(id);

-- Best-effort backfill for existing rows: link any document/reschedule
-- request whose applicant_name matches exactly one applicant's name on
-- their applications row. Rows that don't match unambiguously (typos,
-- multiple applicants sharing a name, no matching application yet) are
-- left null and keep working via the old name-based fallback in the API
-- routes — nothing breaks, this only adds coverage where it's confident.
update documents d
set applicant_user_id = a.applicant_user_id
from applications a
where d.applicant_user_id is null
  and a.applicant_user_id is not null
  and lower(trim(d.applicant_name)) = lower(trim(a.applicant_name))
  and (
    select count(*) from applications a2
    where a2.applicant_user_id is not null
      and lower(trim(a2.applicant_name)) = lower(trim(d.applicant_name))
  ) = 1;

update reschedule_requests r
set applicant_user_id = a.applicant_user_id
from applications a
where r.applicant_user_id is null
  and a.applicant_user_id is not null
  and lower(trim(r.applicant_name)) = lower(trim(a.applicant_name))
  and (
    select count(*) from applications a2
    where a2.applicant_user_id is not null
      and lower(trim(a2.applicant_name)) = lower(trim(r.applicant_name))
  ) = 1;
