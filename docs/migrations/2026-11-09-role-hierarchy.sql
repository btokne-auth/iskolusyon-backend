-- Nov 9 2026: role hierarchy (panel revisions S8, final defense Oct 20-23).
-- Roles are defined by function:
--   super_admin   = System Admin (accounts and logs; no applicant data)
--   guidance_head = Guidance Head (owns the admission cycle)   <- NEW
--   admin         = Guidance Staff (processes applicants)
--   registrar     = Office of the Registrar (allowances)
-- Run once in the Supabase SQL editor. No existing row changes.

alter table public.admin_accounts drop constraint if exists admin_accounts_role_check;
alter table public.admin_accounts add constraint admin_accounts_role_check
  check (role in ('super_admin', 'admin', 'guidance_head', 'registrar', 'lgu'));

-- A unit role can never also be a System Admin.
alter table public.admin_accounts drop constraint if exists admin_accounts_limited_not_super;
alter table public.admin_accounts add constraint admin_accounts_limited_not_super
  check (not (is_super_admin and role in ('registrar', 'lgu', 'guidance_head')));
