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
// applicant.
//
// Sept 19 2026 fix: this used to reduce over every match comparing
// `.id`, falling back to just returning the current item whenever `.id`
// wasn't a JS `number` — which it usually isn't, since a bigint primary
// key round-trips through Supabase as a string to avoid precision loss.
// Walking a newest-first array (docs/myDocs/docHistory come straight
// from GET /api/upload, which orders by created_at desc) while always
// keeping "the current item" means the reduce ends on the LAST item it
// sees, i.e. the OLDEST match — the exact opposite of "latest". That's
// why re-uploading a flagged document never seemed to clear its "Needs
// review" badge: the table kept reading the status off the original
// upload forever, no matter how many times it was replaced.
//
// `docs` is already sorted newest-first, so the fix is just to take the
// first match instead of reducing over id comparisons at all.
function findLatestForType(docs, typeValue) {
  return docs.find((d) => d.document_type === typeValue) || null
}

// .badge classes ported from applicant.html's own Document Verification
// Status table (design-parity pass 5, Sept 19 2026): badge-verified for a
// document that passed OCR review, badge-deficient for one flagged for
// review (spec's harshest/needs-attention badge — the honest fit for "low
// OCR confidence", since this app doesn't have spec's fake "image
// unreadable" copy to draw on), and a locally-styled neutral badge for
// "not yet uploaded", which spec's badge set has no equivalent for since
// its mockup table only ever lists documents that already exist.
function StatusBadge({ state }) {
  if (state === 'verified') {
    return (
      <span className="badge badge-verified">
        <IconCheck className="w-3 h-3" />
        Verified
      </span>
    )
  }
  if (state === 'needs_review') {
    return (
      <span className="badge badge-deficient">
        <IconAlertTriangle className="w-3 h-3" />
        Needs review
      </span>
    )
  }
  return (
    <span className="badge" style={{ background: 'var(--off)', color: 'var(--muted)' }}>
      <IconCircle className="w-3 h-3" />
      Not uploaded
    </span>
  )
}

const CATEGORY_HEADER_STYLE = {
  fontFamily: "'Montserrat',sans-serif",
  fontWeight: 700,
  fontSize: '10.8px',
  letterSpacing: '.5px',
  textTransform: 'uppercase',
  color: 'var(--navy)',
  margin: '0 0 7.5px',
  padding: '9px 7.5px 4.5px',
  borderBottom: '2px solid var(--border)',
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
    <div className="card">
      <div className="card-title">
        Document Verification Status
        <span className="tag">{verifiedCount} / {total} verified</span>
      </div>
      <p className="topic-card-intro" style={{ marginTop: '-6px' }}>
        Showing submissions under &ldquo;{applicantName.trim()}&rdquo;
      </p>

      {groups.map((group, i) => (
        <div key={group.group}>
          <p style={CATEGORY_HEADER_STYLE}>{group.group}</p>
          <table className="doc-table" style={{ marginBottom: i === groups.length - 1 ? 0 : '18.75px' }}>
            {/* Fixed column widths, the same across every category table in
                this card — table-layout:fixed (portal-theme.css) means
                each table would otherwise size its own Document column to
                its own longest label, so "Voter's ID / Certification of
                Parent/Guardian" in one category and "Supporting Document"
                in another ended up with Status/Notes/action sitting at
                different x-positions from table to table. Sept 19 2026. */}
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.options.map((opt) => {
                const doc = findLatestForType(docs, opt.value)
                const state = !doc ? 'not_uploaded' : (doc.needs_review ? 'needs_review' : 'verified')
                const submittedNote = doc && doc.created_at
                  ? `Submitted ${new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
                  : null
                return (
                  <tr key={opt.value}>
                    <td>{opt.label}</td>
                    <td><StatusBadge state={state} /></td>
                    <td>
                      {state === 'needs_review'
                        ? 'Low OCR confidence — please check and re-upload if needed'
                        : submittedNote || '—'}
                    </td>
                    <td>
                      {state !== 'verified' ? (
                        <button type="button" className="reupload-link" onClick={() => onReupload(opt.value)}>
                          {state === 'not_uploaded' ? 'Upload' : 'Re-upload'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
