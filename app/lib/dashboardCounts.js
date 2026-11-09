// Nov 2026: one way to count the six Dashboard cards, shared by the
// counts-only dashboards (System Admin: /api/console-summary, Registrar:
// /api/registrar-allowance). Same rule as the Guidance Dashboard in
// app/admin/page.js (aplStatusOf / aplBucketOf): once an exam result is
// saved, the after-exam status decides the card; before that, the
// eligibility check does. Before this, the Registrar's Dashboard showed
// Qualified 1 / Waitlisted 0 while the Guidance Dashboard showed 5 / 1.
const POST_EXAM_BUCKET = {
  passer: 'qualified',
  qualified_probationary: 'qualified',
  waitlisted_probationary: 'waitlisted',
  disqualified: 'not_qualified',
  forfeited: 'not_qualified',
}

export function dashboardBucket(app) {
  if (app?.scholar_status && POST_EXAM_BUCKET[app.scholar_status]) return POST_EXAM_BUCKET[app.scholar_status]
  return app?.eligibility_override || app?.eligibility_status || 'incomplete'
}

// apps: rows with applicant_user_id, scholar_status, eligibility_status,
// eligibility_override. requests: reschedule_requests rows.
export function dashboardCounts(apps, requests) {
  const counts = { all: 0, incomplete: 0, qualified: 0, not_qualified: 0, waitlisted: 0, appealed: 0 }
  for (const app of apps || []) {
    counts.all += 1
    const bucket = dashboardBucket(app)
    if (bucket === 'incomplete' || bucket === 'qualified' || bucket === 'not_qualified' || bucket === 'waitlisted') counts[bucket] += 1
  }
  const activeUsers = new Set((apps || []).map((app) => app.applicant_user_id).filter(Boolean))
  counts.appealed = new Set(
    (requests || [])
      .filter((r) => (r.request_type || '').startsWith('Appeal'))
      .filter((r) => !r.applicant_user_id || activeUsers.has(r.applicant_user_id))
      .map((r) => r.applicant_user_id || r.applicant_email || r.applicant_name)
  ).size
  return counts
}
