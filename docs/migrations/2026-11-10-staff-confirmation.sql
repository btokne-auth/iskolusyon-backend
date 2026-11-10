-- Nov 10 2026: "OCR reads, a person decides" (panel revisions S2).
-- The OCR worker can only say a document passed the system check; a staff
-- member's Confirm sets these two columns, and only then is it Verified.
-- Run once in the Supabase SQL editor, BEFORE merging the code.

alter table public.documents add column if not exists staff_confirmed_at timestamptz;
alter table public.documents add column if not exists staff_confirmed_by text;

-- Documents that were already accepted before this change keep counting,
-- so no applicant's status changes. They are labeled honestly instead of
-- being credited to a staff member who never opened them.
update public.documents
set staff_confirmed_at = coalesce(created_at, now()),
    staff_confirmed_by = 'Accepted before staff confirmation (Nov 2026)'
where staff_confirmed_at is null
  and coalesce(needs_review, false) = false
  and review_status is distinct from 'processing'
  and coalesce(applicant_user_id::text, applicant_email, applicant_name) is not null;
