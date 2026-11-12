// Nov 2026 (panel revisions S8): one set of status names and meanings, used
// by the admin status legend and the applicant's dashboard. Internal status
// codes are unchanged; only what people read is defined here.
export const STATUS_DEFINITIONS = [
  { label: 'Incomplete Profile', meaning: 'Sections or required documents are not complete yet.' },
  { label: 'Awaiting review', meaning: 'Application submitted; the Guidance Office is confirming the documents.' },
  { label: 'Eligible for Exam', meaning: 'Meets every requirement and the documents are confirmed by staff; can take the entrance exam.' },
  { label: 'Qualified as a Student', meaning: 'Passed the entrance exam (CCC: Passer). Can proceed to the medical exam and enrollment.' },
  { label: 'Qualified as a Student (Probationary)', meaning: 'Accepted on probation under the CCC Scholar Guidelines; signs a probationary contract.' },
  { label: 'Waitlisted (Probationary)', meaning: 'Did not pass the exam; can be admitted if a slot opens up, ranked by exam score.' },
  { label: 'Not Qualified', meaning: 'Does not meet a requirement, such as Calamba residency or the grade rule.' },
  { label: 'Disqualified', meaning: 'Removed after review (for example the medical result or false information). The reason is never shown to the applicant.' },
  { label: 'Forfeited', meaning: 'Did not attend the scheduled entrance exam, or did not claim the slot.' },
]
