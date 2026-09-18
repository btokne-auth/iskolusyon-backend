-- fix_document_type_check_constraint.sql
-- The `documents` table has a CHECK constraint on document_type that was
-- never updated when the Patch 2 document-type list changed (documentTypes.js
-- was updated; this constraint wasn't). Blocks inserts for any of the new
-- types (profilepic, parentid) with:
--   "new row for relation \"documents\" violates check constraint
--    \"documents_document_type_check\""
--
-- Run in the Supabase SQL editor.

alter table documents drop constraint if exists documents_document_type_check;

alter table documents add constraint documents_document_type_check
  check (document_type in (
    'profilepic', 'birthcert', 'voterid', 'form138', 'parentid',
    'employmentcert', 'indigency', 'supportdoc', 'medcert'
  ));
