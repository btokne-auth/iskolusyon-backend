-- Oct 1 2026: link the applicant's Supporting Document to the reschedule or
-- appeal request it was uploaded for (Appendix J V.g: an applicant who
-- missed the exam must give a valid reason with supporting documents).
alter table public.reschedule_requests
  add column if not exists supporting_document_path text;
