'use client'

// The applicant-side "Documents & Status" checklist.
// Purely a display feature — reads from documents already fetched by the
// parent page (docHistory via GET /api/upload). No new OCR/upload logic,
// no new API route, no new DB columns. Mirrors the "Documents &
// Verification Status" panel from the approved CCC mockup (confirmed-
// merged Patch 2 applicant.html), grouped the same way as
// DOCUMENT_TYPE_OPTIONS (now in app/lib/documentTypes.js) so it always
// matches the upload form's categories.

function IconAlertTriangle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
    </svg>
  )
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function IconCircle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

// Picks the most-recently-uploaded document of a given type for this
// applicant. Falls back gracefully whether `id` is a numeric/bigint
// primary key (comparable with >) or something else — if comparison isn't
// meaningful, it still returns a match, just not guaranteed to be the
// newest of several duplicates.
function findLatestForType(docs, typeValue) {
  const matches = docs.filter((d) => d.document_type === typeValue)
  if (matches.length === 0) return null
  return matches.reduce((latest, d) => {
    if (!latest) return d
    if (typeof d.id === 'number' && typeof latest.id === 'number') {
      return d.id > latest.id ? d : latest
    }
    return d
  }, null)
}

function StatusBadge({ state }) {
  if (state === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-green/40 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-green shrink-0">
        <IconCheck className="w-3 h-3" />
        Verified
      </span>
    )
  }
  if (state === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-orange/50 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-orange shrink-0">
        <IconAlertTriangle className="w-3 h-3" />
        Needs review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ccc-border bg-ccc-off px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-muted shrink-0">
      <IconCircle className="w-3 h-3" />
      Not uploaded
    </span>
  )
}

export default function DocumentStatusTable({ groups, docs, applicantName, onReupload }) {
  const total = groups.reduce((n, g) => n + g.options.length, 0)
  const verifiedCount = groups.reduce(
    (n, g) => n + g.options.filter((opt) => {
      const doc = findLatestForType(docs, opt.value)
      return doc && !doc.needs_review
    }).length,
    0
  )

  return (
    <div className="bg-white border border-ccc-border rounded-3xl shadow-md p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Documents &amp; Status
          </h2>
          <p className="text-xs text-ccc-muted mt-0.5">
            Showing submissions under &ldquo;{applicantName.trim()}&rdquo;
          </p>
        </div>
        <span className="text-xs font-semibold text-ccc-muted bg-ccc-off border border-ccc-border rounded-full px-3 py-1">
          {verifiedCount} / {total} verified
        </span>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.group}>
            <p
              className="text-[11px] font-bold uppercase tracking-wide text-ccc-navy pb-2 mb-2 border-b-2 border-ccc-border"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              {group.group}
            </p>
            <div className="divide-y divide-ccc-border">
              {group.options.map((opt) => {
                const doc = findLatestForType(docs, opt.value)
                const state = !doc ? 'not_uploaded' : (doc.needs_review ? 'needs_review' : 'verified')
                return (
                  <div key={opt.value} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-ccc-text truncate">{opt.label}</p>
                      {state === 'needs_review' && (
                        <p className="text-[11px] text-ccc-orange mt-0.5">Low OCR confidence — please check and re-upload if needed</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge state={state} />
                      {state !== 'verified' && (
                        <button
                          type="button"
                          onClick={() => onReupload(opt.value)}
                          className="text-xs font-semibold text-ccc-blue hover:text-ccc-navy underline underline-offset-2"
                        >
                          {state === 'not_uploaded' ? 'Upload' : 'Re-upload'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
