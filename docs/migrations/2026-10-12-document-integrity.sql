-- Oct 12 2026: document integrity re-verification (manuscript Ch. 1 and 2:
-- "verifies document integrity through hash matching", "a different hash
-- that the platform can quickly detect"). See app/lib/documentIntegrity.js.
--
-- 1. Two columns that remember each document's latest check:
--      integrity_status     'verified' | 'changed' | 'missing' (empty = never checked)
--      integrity_checked_at when that check ran
--
-- 2. Locks the fingerprint saved at upload. Once a document has a
--    sha256_hash, the database refuses to change it, or the file_path it
--    belongs to, for everyone: the app, an admin, or someone editing in the
--    Supabase Table Editor. So a swapped file can't be "fixed" by also
--    rewriting its saved hash; the next check will always catch it.
--    Every other column (OCR results, review status, the two above) can
--    still be updated as before.
--
-- Safe to run again.
-- Undo the lock: drop trigger if exists documents_lock_fingerprint on public.documents;

alter table public.documents
  add column if not exists integrity_status text,
  add column if not exists integrity_checked_at timestamptz;

create or replace function public.documents_lock_fingerprint()
returns trigger
language plpgsql
as $$
begin
  if old.sha256_hash is not null and new.sha256_hash is distinct from old.sha256_hash then
    raise exception 'A document''s SHA-256 fingerprint cannot be changed after upload.'
      using errcode = 'P0001';
  end if;
  if old.file_path is not null and new.file_path is distinct from old.file_path then
    raise exception 'A document''s file path cannot be changed after upload.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_lock_fingerprint on public.documents;
create trigger documents_lock_fingerprint
  before update on public.documents
  for each row
  execute function public.documents_lock_fingerprint();

-- Check 1: both columns exist (2 rows).
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'documents'
  and column_name in ('integrity_status', 'integrity_checked_at');

-- Check 2: the lock is on (1 row).
select tgname from pg_trigger where tgname = 'documents_lock_fingerprint';
