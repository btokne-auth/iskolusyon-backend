-- Pairs with the Sept 19 2026 fix in app/api/application/route.js.
--
-- Root cause of "I filled everything in, refreshed, and some sections
-- (Academic, Family & Financial) came back blank even though Supabase's
-- own Table Editor shows the data is really there": POST /api/application
-- checked "does a row for this applicant already exist?" and then, if not,
-- inserted a new one — as two separate round-trips. If two saves landed
-- close together (e.g. hitting "Save"/"Submit Section" on one panel right
-- after another), both requests could run that check before either
-- INSERT was visible to the other, so both saw "no row yet" and both
-- inserted — leaving TWO `applications` rows for the same applicant, each
-- holding whichever sections happened to save through it. GET only ever
-- read the single most-recently-updated row, so whichever section wasn't
-- saved to *that* row looked like it had vanished, even though it was
-- sitting safely in the other row the whole time.
--
-- The app-side fix (already shipped, no SQL needed for it) makes GET
-- merge every matching row instead of reading just one, so this should
-- already look correct again on your next reload without running
-- anything below. This file is only for cleaning up the leftover
-- duplicate rows in the database itself and making sure it can't happen
-- again.

-- STEP 1 — read-only, safe to run any time. Shows whether you actually
-- have any duplicate rows right now, and their ids (newest first).
select lower(trim(applicant_name)) as name, count(*), array_agg(id order by updated_at desc) as row_ids
from applications
group by lower(trim(applicant_name))
having count(*) > 1;

-- STEP 2 — only if Step 1 returned any rows. For each duplicate pair,
-- open both ids in the Table Editor, confirm the newest one (first id in
-- row_ids) already has everything the older one does (it should, thanks
-- to the merge-on-read fix — cross-check against what you see in the
-- app), then delete the older row(s) yourself from the Table Editor.
-- Doing this by hand for a couple of rows is safer than a generic script
-- guessing which value should win column-by-column across ~70 columns.

-- STEP 3 — once Step 1 returns no rows (no duplicates left), run this to
-- stop it from happening again: one row per applicant, matched the same
-- case-insensitive/trimmed way the app already looks them up. (POST now
-- also falls back to an UPDATE if it ever hits this constraint from a
-- race, instead of failing the save — see route.js.)
create unique index if not exists applications_applicant_name_unique
  on applications (lower(trim(applicant_name)));
