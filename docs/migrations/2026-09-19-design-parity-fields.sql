-- Design-parity pass against Ivy's actual iskolusyon_front-end HTML spec
-- (signup.html + applicant.html), Sept 19 2026. Adds the columns needed for
-- fields that exist in her spec but were missing from the app: the
-- signup-time Barangay of Residence / Years of Residency fields (signup.html
-- p-barangay / p-residency), and the two review-step certification
-- checkboxes (signup.html s-terms / s-privacy).

alter table applications
  add column if not exists barangay text,
  add column if not exists residency_years integer,
  add column if not exists terms_certified boolean not null default false,
  add column if not exists privacy_agreed boolean not null default false;
