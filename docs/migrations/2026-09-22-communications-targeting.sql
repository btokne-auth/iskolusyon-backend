-- Adds real targeting to the `announcements` table so it can back both
-- halves of Ivy's admin.html Communications panel, not just the public
-- Announcement side that was already built (2026-09-18-admin-roles-and-
-- announcements.sql):
--   - `type`: 'announcement' (public — shown on the guest page and every
--     applicant's Messages feed) or 'message' (private — only shown to
--     whoever it's targeted at). Existing rows are all real announcements
--     already posted, so they default to 'announcement' and need no
--     backfill.
--   - `target_type` + `target_application_id` + `target_category`: how a
--     'message' row picks its recipient(s). 'all' (every applicant, same
--     as an announcement but kept private/off the guest page), 'specific'
--     (one applicant, by their real `applications.id`), or 'category'
--     (every applicant whose current eligibility bucket matches
--     `target_category` — one of the real ELIGIBILITY_META keys already
--     used throughout the admin/applicant portals: qualified, waitlisted,
--     not_qualified, pending_exam, incomplete. Ivy's mockup only has 4
--     buckets here (pending/qualified/waitlisted/not-qualified); this uses
--     the app's real 5, since collapsing pending_exam and incomplete
--     together would silently drop a real distinction the rest of the app
--     already makes).
-- `target_type`/`target_category` are meaningless for an 'announcement'
-- row (always effectively "all", always public) and are left null there.

alter table announcements
  add column if not exists type text not null default 'announcement'
    check (type in ('announcement', 'message')),
  add column if not exists target_type text
    check (target_type is null or target_type in ('all', 'specific', 'category')),
  add column if not exists target_application_id bigint references applications(id) on delete set null,
  add column if not exists target_category text
    check (
      target_category is null
      or target_category in ('qualified', 'waitlisted', 'not_qualified', 'pending_exam', 'incomplete')
    );

-- Every existing row is a real, already-published announcement -- explicit
-- for clarity, even though it matches the column default above.
update announcements set type = 'announcement' where type is null;
