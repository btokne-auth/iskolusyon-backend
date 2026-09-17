-- Ad hoc migration, run directly in Supabase's SQL editor (same pattern as
-- earlier column additions on this project — not wired into any migration
-- tool). Adds the 18 Personal Information fields (Step 1, cards 1-3:
-- Identity & Civil Status + Contact & Residency) ported from Ivy's
-- applicant.html. All nullable — required-ness is enforced in the UI.

alter table applications
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists last_name text,
  add column if not exists suffix text,
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists sex text,
  add column if not exists citizenship text,
  add column if not exists religion text,
  add column if not exists civil_status text,
  add column if not exists spouse_name text,
  add column if not exists spouse_occupation text,
  add column if not exists spouse_contact text,
  add column if not exists contact_number text,
  add column if not exists address text,
  add column if not exists voter_precinct text,
  add column if not exists email_updates_opt_in boolean default false,
  add column if not exists sms_updates_opt_in boolean default false;
