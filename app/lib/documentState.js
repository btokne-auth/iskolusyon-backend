// Nov 2026 (panel revisions S2, final defense Oct 20-23): "OCR reads, a
// person decides". The OCR worker and the automatic content check can only
// say a document PASSED THE SYSTEM CHECK. Only a staff member's Confirm
// makes it Verified (documents.staff_confirmed_at, set by
// app/api/documents/[id]/override). Shared by the admin console, the
// applicant portal and the eligibility rules, so all three agree.
//
//   processing  still being read by OCR
//   flagged     the system or a staff member found a problem
//   checked     passed the system check, waiting for staff to confirm
//   verified    confirmed by staff
export function docState(doc) {
  if (!doc) return 'missing'
  if (doc.review_status === 'processing' && !doc.needs_review) return 'processing'
  if (doc.needs_review) return 'flagged'
  if (doc.staff_confirmed_at) return 'verified'
  return 'checked'
}

export const DOC_STATE_LABEL = {
  processing: 'Processing',
  flagged: 'Needs review',
  checked: 'System check passed',
  verified: 'Verified by staff',
}
