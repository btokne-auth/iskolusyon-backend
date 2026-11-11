// Nov 2026 (panel revisions S4): Panelist C suggested a reference/tracking
// number, as universities give applicants. Every applicant gets one as soon
// as the account is created (the official application number still comes at
// the final Submit). It is built from the application's own row, so it needs
// no new database column and old applicants have one too.
export function referenceNumber(row) {
  if (!row || !row.id) return null
  return `REF-${String(row.id).padStart(6, '0')}`
}
