'use client'
import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteHeader from '../components/SiteHeader'
import AdminSidebar from '../components/AdminSidebar'
import { getDocTypeLabel } from '../lib/documentTypes'
import { onConnectivityChange, isNetworkError } from '../lib/offlineSync'
import { suggestExamResult } from '../lib/matching'

// ---------- Icons (same style as the applicant page) ----------

function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}
function IconExternal(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
function IconAlertTriangle(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
    </svg>
  )
}
function IconChevronDown(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}
function IconSearch(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  )
}
function IconCopy(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </svg>
  )
}
function IconAlert(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getCleanFileName(path) {
  if (!path) return 'Unknown file'
  const parts = path.split('-')
  return parts.length > 1 ? parts.slice(1).join('-') : path
}

// A document's file_path carries its original extension (route.js appends
// the original filename after a timestamp), so we can tell an image from a
// PDF without asking the server anything new.
function isImageFile(path) {
  return /\.(png|jpe?g)$/i.test(path || '')
}
function isPdfFile(path) {
  return /\.pdf$/i.test(path || '')
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

// A document preview image that failed to load (slow/dropped connection,
// most commonly) previously just sat there as a broken image icon with no
// way to fix it short of refreshing the entire page. This retries just
// that one image — by changing `src` slightly to force a fresh request —
// instead of forcing the admin to reload everything they were looking at.
//
// It's also lazy: with 100+ documents on the Dashboard, the old version
// requested every single preview the instant the page rendered, all at
// once. Browsers cap concurrent requests to one host at ~6, so the rest
// just queued silently behind them — on a slow connection, cards far down
// the list could sit on "Loading preview..." for a very long time even
// though nothing was actually broken, just waiting its turn. This version
// only starts the real image request once the card scrolls near the
// viewport (via IntersectionObserver), so the browser is only ever asked
// for the handful of previews someone can actually see, not all of them.
function RetryableImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [inView, setInView] = useState(false)
  const containerRef = useRef(null)

  // Reset if the underlying document changes (e.g. paging to a different
  // review card reusing this component).
  useEffect(() => {
    setFailed(false)
    setLoading(true)
    setAttempt(0)
  }, [src])

  // Starts observing this card's position as soon as it mounts. `rootMargin`
  // is set generously (start loading ~400px before it's actually on
  // screen) so images are already there by the time someone scrolls to
  // them, instead of popping in late. Once it's been seen once, stop
  // observing — no need to keep watching a card that's already loaded.
  useEffect(() => {
    if (inView) return
    const el = containerRef.current
    if (!el) return
    // IntersectionObserver isn't available during server rendering — this
    // effect only ever runs client-side, but guard anyway for safety.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  if (!src) {
    return (
      <div className="flex flex-col items-center gap-2 text-ccc-muted py-10">
        <IconFile className="w-10 h-10" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    )
  }

  if (failed) {
    return (
      <div ref={containerRef} className="flex flex-col items-center gap-2 text-ccc-muted py-10">
        <IconAlertTriangle className="w-8 h-8 text-ccc-orange" />
        <span className="text-xs text-center px-4">Couldn&rsquo;t load this preview &mdash; likely a slow or dropped connection.</span>
        <button
          type="button"
          onClick={() => {
            setFailed(false)
            setLoading(true)
            setAttempt((a) => a + 1)
          }}
          className="text-[11px] font-bold text-white bg-ccc-blue hover:bg-ccc-navy rounded-lg px-3 py-1.5 mt-1"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-h-[80px]">
      {(loading || !inView) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] text-ccc-muted">
            {inView ? 'Loading preview…' : 'Scroll to load…'}
          </span>
        </div>
      )}
      {inView && (
        <img
          // A cache-busting query param forces the browser to actually
          // re-request the image on retry, instead of re-showing the same
          // failed/cached response.
          src={attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`}
          alt={alt}
          className={className}
          style={{ opacity: loading ? 0 : 1 }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setFailed(true)
          }}
        />
      )}
    </div>
  )
}

// ---------- Small building blocks (Dashboard panel) ----------

function ReviewStatusBadge({ needsReview }) {
  if (needsReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-orange/50 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-orange">
        <IconAlertTriangle className="w-3 h-3" />
        Needs review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ccc-green/40 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-green">
      <IconCheck className="w-3 h-3" />
      Verified
    </span>
  )
}

// A small horizontal meter so a confidence number reads at a glance instead
// of requiring the admin to do math on a raw percentage.
function ConfidenceMeter({ value }) {
  if (typeof value !== 'number') {
    return <span className="text-xs text-ccc-muted italic">No score</span>
  }
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const color = pct >= 80 ? 'bg-ccc-green' : pct >= 60 ? 'bg-ccc-gold' : 'bg-ccc-red'
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-ccc-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ccc-text w-9 text-right">{pct}%</span>
    </div>
  )
}

function CopyHashButton({ hash }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      // clipboard unavailable — silently ignore
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-[10px] text-ccc-muted hover:text-ccc-navy transition-colors"
      title={hash}
    >
      {copied ? <IconCheck className="w-3 h-3 text-ccc-green" /> : <IconCopy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy hash'}
    </button>
  )
}

// The core review unit: one document, file preview on the left, OCR + status
// on the right. This is what replaces the mockup's dead viewDocument() stub.
function DocumentReviewCard({ doc, onOverride, overriding }) {
  const image = isImageFile(doc.file_path)
  const pdf = isPdfFile(doc.file_path)
  const isBusy = overriding === doc.file_path

  return (
    <div
      className={`rounded-2xl border overflow-hidden bg-white shadow-sm ${
        doc.needs_review ? 'border-ccc-orange/50' : 'border-ccc-border'
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left: the actual file */}
        <div className="bg-ccc-off border-b md:border-b-0 md:border-r border-ccc-border flex items-center justify-center min-h-[220px] p-3">
          {image && doc.publicUrl ? (
            <RetryableImage
              src={doc.publicUrl}
              alt={getCleanFileName(doc.file_path)}
              className="max-h-72 w-auto rounded-lg object-contain"
            />
          ) : pdf && doc.publicUrl ? (
            <iframe
              src={doc.publicUrl}
              title={getCleanFileName(doc.file_path)}
              className="w-full h-72 rounded-lg bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-ccc-muted py-10">
              <IconFile className="w-10 h-10" />
              <span className="text-xs">Preview unavailable</span>
            </div>
          )}
        </div>

        {/* Right: OCR text + status */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ccc-navy truncate" title={doc.file_path} style={{ fontFamily: 'var(--font-montserrat)' }}>
                {getDocTypeLabel(doc.document_type)}
              </p>
              <p className="text-[11px] text-ccc-muted truncate">{getCleanFileName(doc.file_path)}</p>
            </div>
            <ReviewStatusBadge needsReview={doc.needs_review} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
              OCR confidence
            </span>
            <ConfidenceMeter value={doc.ocr_confidence} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
              Detected text
            </span>
            <div className="max-h-28 overflow-y-auto rounded-lg bg-ccc-off border border-ccc-border p-2 text-xs text-ccc-text whitespace-pre-wrap">
              {doc.extracted_text || <span className="italic text-ccc-muted">No text extracted</span>}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {doc.sha256_hash && <CopyHashButton hash={doc.sha256_hash} />}
            {doc.publicUrl && (
              <a
                href={doc.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-ccc-blue hover:text-ccc-navy transition-colors"
              >
                Open full file <IconExternal className="w-3 h-3" />
              </a>
            )}
          </div>

          {onOverride && (
            <div className="flex items-center gap-2 pt-1 border-t border-ccc-border mt-1">
              <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest mr-auto">
                Manual override
              </span>
              <button
                type="button"
                disabled={isBusy || !doc.needs_review}
                onClick={() => onOverride(doc, 'verify')}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-ccc-green/50 text-ccc-green bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? 'Saving...' : 'Mark Verified'}
              </button>
              <button
                type="button"
                disabled={isBusy || doc.needs_review}
                onClick={() => onOverride(doc, 'flag')}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-ccc-orange/50 text-ccc-orange bg-orange-50 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? 'Saving...' : 'Flag for Review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Scholarship Matching & Filtering (Sept 20 2026) ----------
// Automated eligibility result + the one manual override escape hatch.
// See app/lib/matching.js for how eligibility_status is computed and why
// 'qualified' is never set automatically.
const ELIGIBILITY_META = {
  qualified: { label: 'Qualified', className: 'bg-green-50 text-ccc-green border-ccc-green/30' },
  waitlisted: { label: 'Waitlisted', className: 'bg-ccc-gold/10 text-ccc-navy border-ccc-gold/50' },
  not_qualified: { label: 'Not Qualified', className: 'bg-red-50 text-ccc-red border-ccc-red/30' },
  pending_exam: { label: 'Pending Exam Result', className: 'bg-blue-50 text-ccc-blue border-ccc-blue/30' },
  incomplete: { label: 'Incomplete Profile', className: 'bg-ccc-off text-ccc-muted border-ccc-border' },
}

function EligibilityBadge({ status }) {
  const meta = ELIGIBILITY_META[status] || ELIGIBILITY_META.incomplete
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

// The expandable detail: computed status + why, plus the manual override
// buttons. `row` is one entry from GET /api/admin-eligibility (or undefined
// if this applicant has no `applications` row yet — e.g. documents were
// uploaded before any profile section was ever saved).
function EligibilitySection({ row, onOverride, overriding }) {
  if (!row) {
    return (
      <div className="rounded-xl border border-ccc-border bg-ccc-off px-4 py-3 text-xs text-ccc-muted">
        No application profile on file yet for this applicant — eligibility can&rsquo;t be evaluated until one exists.
      </div>
    )
  }

  const effectiveStatus = row.eligibility_override || row.eligibility_status || 'incomplete'
  const isOverridden = !!row.eligibility_override
  const isBusy = overriding === row.id
  const reasons = Array.isArray(row.eligibility_reasons) ? row.eligibility_reasons : []

  return (
    <div className="rounded-xl border border-ccc-border bg-white px-4 py-3.5 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Scholarship Eligibility
          </span>
          <EligibilityBadge status={effectiveStatus} />
          {isOverridden && (
            <span className="text-[10px] text-ccc-muted">
              (manually set by {row.eligibility_override_by || 'an admin'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onOverride(row.id, 'qualified')}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-ccc-green/40 text-ccc-green hover:bg-green-50 disabled:opacity-50"
          >
            Mark Qualified
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onOverride(row.id, 'waitlisted')}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-ccc-gold/50 text-ccc-navy hover:bg-ccc-gold/10 disabled:opacity-50"
          >
            Waitlist
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onOverride(row.id, 'not_qualified')}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-ccc-red/40 text-ccc-red hover:bg-red-50 disabled:opacity-50"
          >
            Mark Not Qualified
          </button>
          {isOverridden && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onOverride(row.id, null)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-ccc-border text-ccc-muted hover:text-ccc-navy disabled:opacity-50"
            >
              Clear override
            </button>
          )}
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="text-[11px] text-ccc-muted space-y-1 list-disc pl-4">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// One applicant, collapsed by default, with all their documents inside.
function ApplicantGroup({ name, email, docs, defaultOpen, onOverride, overriding, eligibilityRow, onEligibilityOverride, eligibilityOverriding }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const flaggedCount = docs.filter((d) => d.needs_review).length

  return (
    <div className="rounded-2xl border border-ccc-border bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-ccc-off transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-ccc-navy flex items-center justify-center text-sm font-bold text-white shrink-0">
            {name ? name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-ccc-navy truncate" style={{ fontFamily: 'var(--font-montserrat)' }}>
              {name || 'Unknown applicant'}
            </p>
            <p className="text-[11px] text-ccc-muted truncate">
              {email || 'No email on file'} · {docs.length} document{docs.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <EligibilityBadge status={eligibilityRow?.eligibility_override || eligibilityRow?.eligibility_status || 'incomplete'} />
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-ccc-gold text-ccc-navy text-[10px] font-bold px-2 py-0.5">
              <IconAlertTriangle className="w-3 h-3" />
              {flaggedCount} flagged
            </span>
          )}
          <IconChevronDown className={`w-4 h-4 text-ccc-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-ccc-border pt-4">
          <EligibilitySection row={eligibilityRow} onOverride={onEligibilityOverride} overriding={eligibilityOverriding} />
          {docs.map((doc) => (
            <DocumentReviewCard key={doc.file_path} doc={doc} onOverride={onOverride} overriding={overriding} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Dashboard panel (document review — the app's existing,
// already-working feature, unchanged in behavior) ----------

function DashboardPanel({
  docs,
  loading,
  error,
  onOverride,
  overriding,
  overrideError,
  eligibility,
  onEligibilityOverride,
  eligibilityOverriding,
  eligibilityError,
  onRecomputeEligibility,
  recomputing,
}) {
  const [search, setSearch] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  const totalFlagged = docs.filter((d) => d.needs_review).length

  // Matched by applicant name, same lowercase-trim key as the document
  // grouping below — `applications` and `documents` aren't joined by a
  // shared id everywhere yet (legacy rows), so name is the common signal
  // both already rely on.
  const eligibilityByName = useMemo(() => {
    const map = new Map()
    for (const row of eligibility || []) {
      const key = (row.applicant_name || '').trim().toLowerCase()
      if (key) map.set(key, row)
    }
    return map
  }, [eligibility])

  // Real automated counts, replacing what Ivy's admin.html mockup had as
  // purely manual per-applicant stat cards (All/Pending/Qualified/Not
  // Qualified) — see the module-level comment on ELIGIBILITY_META above.
  const eligibilityCounts = useMemo(() => {
    const counts = { qualified: 0, waitlisted: 0, not_qualified: 0, pending_exam: 0, incomplete: 0 }
    for (const row of eligibility || []) {
      const status = row.eligibility_override || row.eligibility_status || 'incomplete'
      if (status in counts) counts[status] += 1
    }
    return counts
  }, [eligibility])

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = docs.filter((d) => {
      if (onlyFlagged && !d.needs_review) return false
      if (!term) return true
      const haystack = `${d.applicant_name || ''} ${d.applicant_email || ''} ${getDocTypeLabel(d.document_type)}`.toLowerCase()
      return haystack.includes(term)
    })

    const map = new Map()
    for (const doc of filtered) {
      const key = (doc.applicant_name || 'unknown').trim().toLowerCase() || 'unknown'
      if (!map.has(key)) {
        map.set(key, { name: doc.applicant_name, email: doc.applicant_email, docs: [] })
      }
      map.get(key).docs.push(doc)
    }

    // Applicants with flagged documents float to the top so admins triage
    // those first, without having to hunt through a long alphabetical list.
    return Array.from(map.values()).sort((a, b) => {
      const aFlag = a.docs.some((d) => d.needs_review) ? 1 : 0
      const bFlag = b.docs.some((d) => d.needs_review) ? 1 : 0
      if (aFlag !== bFlag) return bFlag - aFlag
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [docs, search, onlyFlagged])

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Dashboard
          </h1>
          <p className="text-xs text-ccc-muted mt-0.5">
            {docs.length} document{docs.length === 1 ? '' : 's'} on file
            {totalFlagged > 0 && <span className="text-ccc-orange"> · {totalFlagged} need review</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch className="w-4 h-4 text-ccc-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or document type..."
            className="w-full rounded-lg border border-ccc-border bg-white pl-9 pr-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyFlagged((v) => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
            onlyFlagged
              ? 'border-ccc-orange/60 bg-orange-50 text-ccc-orange'
              : 'border-ccc-border bg-white text-ccc-muted hover:text-ccc-navy'
          }`}
        >
          <IconAlertTriangle className="w-3.5 h-3.5" />
          Flagged only
        </button>
      </div>

      {/* Scholarship Matching & Filtering — real, automated counts (see
          app/lib/matching.js). 'qualified'/'waitlisted' only ever show up
          here once an admin has manually set them (the engine itself never
          auto-assigns them — see that file for why), so an all-zero look
          at either of those two is expected until the entrance exam module
          exists or a real edge case comes up. */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Scholarship Eligibility
        </p>
        <button
          type="button"
          onClick={onRecomputeEligibility}
          disabled={recomputing}
          title="Recomputes eligibility for every applicant from their current data — needed for anyone who fully submitted before this feature existed, since a locked application never triggers a new save on its own."
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-ccc-border bg-white text-ccc-navy hover:bg-ccc-off disabled:opacity-50"
        >
          {recomputing ? 'Recomputing…' : 'Recompute all'}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          ['qualified', 'Qualified'],
          ['waitlisted', 'Waitlisted'],
          ['not_qualified', 'Not Qualified'],
          ['pending_exam', 'Pending Exam'],
          ['incomplete', 'Incomplete'],
        ].map(([key, label]) => (
          <div key={key} className="rounded-xl border border-ccc-border bg-white px-3.5 py-3">
            <p className="text-[10px] font-bold text-ccc-muted uppercase tracking-wide">{label}</p>
            <p className="text-xl font-extrabold text-ccc-navy mt-0.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
              {eligibilityCounts[key]}
            </p>
          </div>
        ))}
      </div>

      {eligibilityError && (
        <div className="mb-4 p-3 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">
          {eligibilityError}
        </div>
      )}

      {overrideError && (
        <div className="mb-4 p-3 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">
          {overrideError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-ccc-muted text-sm">Loading documents...</div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-ccc-muted text-sm">
          {docs.length === 0 ? 'No documents uploaded yet.' : 'No documents match your search.'}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g, i) => (
            <ApplicantGroup
              key={g.name ? g.name.toLowerCase() : `unknown-${i}`}
              name={g.name}
              email={g.email}
              docs={g.docs}
              defaultOpen={i === 0}
              onOverride={onOverride}
              overriding={overriding}
              eligibilityRow={eligibilityByName.get((g.name || '').trim().toLowerCase())}
              onEligibilityOverride={onEligibilityOverride}
              eligibilityOverriding={eligibilityOverriding}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Applicant Information & Results panel (Sept 21 2026) ----------
// Ivy's former module. Self-fetching, same pattern as CommunicationsPanel
// below rather than threaded through the top-level component's state, since
// nothing else on the page needs this data. See app/api/admin-results/route.js
// and app/lib/matching.js for the Appendix D grounding behind every status.

const SCHOLAR_STATUS_META = {
  pending_exam: { label: 'Pending Exam', className: 'bg-blue-50 text-ccc-blue border-ccc-blue/30' },
  passer: { label: 'Passer', className: 'bg-green-50 text-ccc-green border-ccc-green/30' },
  waitlisted_probationary: { label: 'Waitlisted (Probationary)', className: 'bg-ccc-gold/10 text-ccc-navy border-ccc-gold/50' },
  qualified_probationary: { label: 'Qualified (Probationary)', className: 'bg-ccc-gold/10 text-ccc-navy border-ccc-gold/50' },
  disqualified: { label: 'Disqualified', className: 'bg-red-50 text-ccc-red border-ccc-red/30' },
  forfeited: { label: 'Forfeited', className: 'bg-red-50 text-ccc-red border-ccc-red/30' },
}

// "What's next" hint -- Sept 21 follow-up. Scholarship Matching (Dashboard
// panel) and Applicant Results (this panel) are genuinely two separate
// modules per the Roles PDF, but working one applicant end to end means
// reading both in sequence: eligibility decides whether an exam entry even
// makes sense yet, and scholar status decides whether distribution tracking
// applies. This spells out that sequence per-applicant instead of leaving
// the admin to hold CCC's process in their head across two panels.
function getNextStepHint(row) {
  const eligStatus = row.eligibility_override || row.eligibility_status || 'incomplete'
  const scholarStatus = row.scholar_status || 'pending_exam'

  if (scholarStatus === 'disqualified' || scholarStatus === 'forfeited') {
    return { text: `No further action -- applicant is ${SCHOLAR_STATUS_META[scholarStatus].label.toLowerCase()}.`, tone: 'stop' }
  }
  if (scholarStatus === 'passer' || scholarStatus === 'qualified_probationary') {
    if (row.distribution_status === 'enrollment_complete') {
      return { text: 'Enrollment complete -- no further action needed.', tone: 'done' }
    }
    return { text: 'Ready to advance Distribution Status below.', tone: 'go' }
  }
  if (scholarStatus === 'waitlisted_probationary') {
    return { text: 'Waitlisted pending an open slot -- re-check later, or use Manual Override if a slot opens.', tone: 'wait' }
  }
  // scholarStatus is 'pending_exam' -- no exam result recorded yet, so
  // whether exam entry even applies depends on eligibility.
  if (eligStatus === 'incomplete') {
    return { text: "Eligibility: Incomplete -- applicant hasn't finished their profile yet. Exam entry doesn't apply yet.", tone: 'wait' }
  }
  if (eligStatus === 'not_qualified') {
    return { text: 'Eligibility: Not Qualified -- exam entry only applies here for a real Program Director exception.', tone: 'stop' }
  }
  // pending_exam (automated) or a manual qualified/waitlisted override --
  // either way, this is the point where recording an exam result applies.
  return { text: `Eligibility: ${ELIGIBILITY_META[eligStatus]?.label || eligStatus} -- ready for exam entry in Step 1 below.`, tone: 'go' }
}

const NEXT_STEP_TONE_CLASSES = {
  go: 'border-ccc-blue/30 bg-blue-50 text-ccc-blue',
  wait: 'border-ccc-gold/40 bg-ccc-gold/10 text-ccc-navy',
  stop: 'border-ccc-red/30 bg-red-50 text-ccc-red',
  done: 'border-ccc-green/30 bg-green-50 text-ccc-green',
}

function NextStepHint({ row }) {
  const { text, tone } = getNextStepHint(row)
  return (
    <div className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${NEXT_STEP_TONE_CLASSES[tone]}`}>
      {text}
    </div>
  )
}

const DISTRIBUTION_STATUS_STEPS = [
  ['pending_endorsement', 'Pending Endorsement'],
  ['endorsed_registrar', 'Endorsed to Registrar'],
  ['endorsed_medical', 'Endorsed to Medical'],
  ['endorsed_admissions', 'Endorsed to Admissions'],
  ['enrollment_complete', 'Enrollment Complete'],
]

function ScholarStatusBadge({ status }) {
  const meta = SCHOLAR_STATUS_META[status] || SCHOLAR_STATUS_META.pending_exam
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

// One applicant's exam entry + scholar status + distribution status. Kept
// as one card (not split into three separate ApplicantGroup-style
// accordions) since these three fields are read together far more than any
// one of them is read alone -- an admin deciding a scholar status wants the
// score right there, not behind another click.
const SCHOLAR_STATUS_OVERRIDE_LABELS = {
  qualified_probationary: 'Qualified (Probationary)',
  disqualified: 'Disqualified',
  forfeited: 'Forfeited',
}

// In-app confirm modal, replacing window.confirm() -- Sept 21 follow-up.
// The native browser dialog ("localhost:3000 says...") reads as generic
// browser chrome, easy to dismiss on reflex without reading it. This is an
// actual overlay in the app's own CCC styling, so it can't be mistaken for
// a routine popup.
// Generic confirm modal -- Sept 21, generalized from the Scholar Status
// override modal so the Distribution Status "Clear" action (added the same
// day) can reuse it instead of duplicating the overlay markup.
function ConfirmActionModal({ eyebrow = 'Confirm', title, message, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-ccc-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-ccc-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ccc-orange mb-1">{eyebrow}</p>
          <p className="text-sm text-ccc-text">{title}</p>
          {message && <p className="text-[11px] text-ccc-muted mt-2">{message}</p>}
        </div>
        <div className="flex gap-2 px-5 py-3.5 bg-ccc-off/50">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-xs font-bold px-3.5 py-2.5 rounded-lg border border-ccc-border bg-white text-ccc-navy hover:bg-ccc-off"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 text-xs font-bold px-3.5 py-2.5 rounded-lg bg-ccc-navy text-white hover:bg-ccc-blue"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ row, onSaveExam, onSetScholarStatus, onAdvanceDistribution, busy }) {
  const [examScore, setExamScore] = useState(row.exam_score ?? '')
  const [examResult, setExamResult] = useState(row.exam_result || '')
  const [examDate, setExamDate] = useState(row.exam_date || '')
  const [statusReason, setStatusReason] = useState('')
  const [pendingOverride, setPendingOverride] = useState(null) // scholar_status target, or null
  const [pendingClearDistribution, setPendingClearDistribution] = useState(false)
  const isBusy = busy === row.id

  const canDistribute = row.scholar_status === 'passer' || row.scholar_status === 'qualified_probationary'
  const currentStepIndex = DISTRIBUTION_STATUS_STEPS.findIndex(([key]) => key === row.distribution_status)
  // Sept 21: a distribution_status set while the applicant still qualified
  // (Passer/Qualified Probationary) is never auto-cleared if Scholar Status
  // later changes away from those (e.g. an admin resets the exam result for
  // retesting) -- the two columns are independent, same as everything else
  // in this module. This flags that leftover case so the UI can surface it
  // even when the stepper itself is hidden (canDistribute false).
  const hasStaleDistribution = !canDistribute && row.distribution_status && row.distribution_status !== 'not_applicable'

  // The exam form and the manual override buttons below are two completely
  // separate write paths (exam form only saves on "Save & Verify"; override
  // buttons fire immediately) -- this compares the two so the UI can warn
  // before an admin accidentally overwrites an unsaved exam entry with an
  // unrelated override click. Real incident this fixes: entering "Passed"
  // in the exam form, not saving it, then clicking Forfeit below expecting
  // it to somehow combine -- Forfeit doesn't know about the unsaved form,
  // so the "Passed" entry was silently lost. See Sept 21 session notes.
  const hasUnsavedExamChanges =
    String(examScore ?? '') !== String(row.exam_score ?? '') ||
    (examResult || '') !== (row.exam_result || '') ||
    (examDate || '') !== (row.exam_date || '')

  // Sept 21 follow-up: surface suggestExamResult() as a live hint next to
  // the score input, instead of only backing deriveScholarStatus() silently
  // after save. Still just a suggestion the admin can ignore -- Result stays
  // a manual dropdown, nothing here auto-fills it. See app/lib/matching.js
  // for the Appendix D/J grounding ("Passing Score or Passed" against each
  // program's own Appendix J cutoff).
  const examSuggestion = useMemo(
    () => suggestExamResult(examScore, row.program_choice_1),
    [examScore, row.program_choice_1]
  )

  const confirmOverride = (targetStatus) => setPendingOverride(targetStatus)
  const handleConfirmed = () => {
    onSetScholarStatus(row.id, pendingOverride, statusReason)
    setPendingOverride(null)
  }
  const handleClearDistributionConfirmed = () => {
    onAdvanceDistribution(row.id, 'not_applicable')
    setPendingClearDistribution(false)
  }

  return (
    <div className="rounded-2xl border border-ccc-border bg-white shadow-sm p-5 space-y-4">
      {pendingOverride && (
        <ConfirmActionModal
          eyebrow="Confirm Override"
          title={
            <>
              Set <span className="font-bold text-ccc-navy">{row.applicant_name || 'this applicant'}</span>&rsquo;s
              Scholar Status to{' '}
              <span className="font-bold text-ccc-navy">
                &ldquo;{SCHOLAR_STATUS_OVERRIDE_LABELS[pendingOverride] || pendingOverride}&rdquo;
              </span>
              ?
            </>
          }
          message="This overrides the status immediately and does not save anything currently typed in the Entrance Exam section above."
          onConfirm={handleConfirmed}
          onCancel={() => setPendingOverride(null)}
        />
      )}
      {pendingClearDistribution && (
        <ConfirmActionModal
          eyebrow="Confirm Clear"
          title={
            <>
              Clear the stored Distribution Status for{' '}
              <span className="font-bold text-ccc-navy">{row.applicant_name || 'this applicant'}</span>?
            </>
          }
          message="Resets it back to Not Applicable. This does not change their Scholar Status, and is safe to do any time (mainly for cleaning up test data or fixing a mistaken click)."
          onConfirm={handleClearDistributionConfirmed}
          onCancel={() => setPendingClearDistribution(false)}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            {row.applicant_name || 'Unknown applicant'}
          </p>
          <p className="text-[11px] text-ccc-muted">
            {row.applicant_email || 'No email on file'}
            {row.application_number && ` · ${row.application_number}`}
            {row.program_choice_1 && ` · ${row.program_choice_1}`}
          </p>
        </div>
        <ScholarStatusBadge status={row.scholar_status || 'pending_exam'} />
      </div>

      <NextStepHint row={row} />

      {/* Exam Score Entry and Verification */}
      <div className="rounded-xl border border-ccc-border bg-ccc-off/40 p-3.5 space-y-2.5">
        <div>
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Step 1 · Entrance Exam
          </p>
          <p className="text-[10.5px] text-ccc-muted">
            Nothing here is saved until you click Save &amp; Verify. Saving auto-sets Scholar Status below (Passed &rarr; Passer, Failed &rarr; Waitlisted, Absent &rarr; Forfeited).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="text-[10px] text-ccc-muted block mb-1">Score</label>
            <input
              type="number"
              value={examScore}
              onChange={(e) => setExamScore(e.target.value)}
              className="w-24 rounded-lg border border-ccc-border px-2.5 py-1.5 text-sm"
              placeholder="e.g. 82"
            />
          </div>
          <div>
            <label className="text-[10px] text-ccc-muted block mb-1">Date</label>
            <input
              type="date"
              value={examDate || ''}
              onChange={(e) => setExamDate(e.target.value)}
              className="rounded-lg border border-ccc-border px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-ccc-muted block mb-1">Result</label>
            <select
              value={examResult}
              onChange={(e) => setExamResult(e.target.value)}
              className="rounded-lg border border-ccc-border px-2.5 py-1.5 text-sm"
            >
              <option value="">Not yet recorded</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="absent">Absent (no-show)</option>
            </select>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSaveExam(row.id, { examScore, examResult, examDate })}
            className="text-xs font-bold px-3.5 py-2 rounded-lg bg-ccc-navy text-white hover:bg-ccc-blue disabled:opacity-50"
          >
            {isBusy ? 'Saving…' : 'Save & Verify'}
          </button>
        </div>
        {examSuggestion.threshold != null && (
          <p
            className={
              'text-[10.5px] rounded-lg px-2.5 py-1.5 ' +
              (examSuggestion.suggested === 'passed'
                ? 'bg-green-50 text-green-800'
                : examSuggestion.suggested === 'failed'
                ? 'bg-red-50 text-red-700'
                : 'text-ccc-muted')
            }
          >
            {row.program_choice_1}&rsquo;s passing grade per Appendix J: <strong>{examSuggestion.threshold}</strong>.
            {examSuggestion.suggested && (
              <>
                {' '}Score of {examScore} suggests{' '}
                <strong>{examSuggestion.suggested === 'passed' ? 'Passed' : 'Failed'}</strong> &mdash; this doesn&rsquo;t
                auto-fill Result, pick it above to confirm.
              </>
            )}
          </p>
        )}
        {row.exam_verified_by && (
          <p className="text-[10px] text-ccc-muted">
            Last verified by {row.exam_verified_by}
            {row.exam_verified_at ? ` on ${new Date(row.exam_verified_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          </p>
        )}
      </div>

      {/* Disqualification/Forfeiture Handling -- manual escape hatch for the
          two statuses the exam result alone can't decide (see matching.js
          deriveScholarStatus). Redesigned Sept 21 after live testing showed
          an admin could type "Passed" into the exam form above, forget to
          click Save & Verify, then click a button here expecting it to
          somehow combine with the unsaved exam entry -- it doesn't, these
          are two independent write paths. Now: clearly labeled Step 2,
          visually set apart (orange-tinted, not the neutral card the exam
          section uses), a live warning when the exam form above has
          unsaved edits, and a confirm prompt before any override fires. */}
      <div className="rounded-xl border border-ccc-orange/30 bg-orange-50/40 p-3.5 space-y-2.5">
        <div>
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Step 2 · Manual Override
          </p>
          <p className="text-[10.5px] text-ccc-muted">
            Only for a real judgment call the exam result itself doesn&rsquo;t decide (Appendix D: a probationary contract, or a
            later disqualification/forfeiture reason). Fires immediately &mdash; independent of Step 1 above.
          </p>
        </div>
        {hasUnsavedExamChanges && (
          <div className="rounded-lg border border-ccc-orange/50 bg-orange-100 px-3 py-2 text-[11px] font-semibold text-ccc-orange">
            You have unsaved changes in the Entrance Exam section above. Clicking a button below will NOT save those &mdash;
            save Step 1 first if you meant to record an exam result.
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] text-ccc-muted block mb-1">Reason / note (optional)</label>
            <input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. failed a subject under probationary contract"
              className="w-full rounded-lg border border-ccc-border px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={isBusy} onClick={() => confirmOverride('qualified_probationary')}
              className="text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-ccc-gold/50 text-ccc-navy hover:bg-ccc-gold/10 disabled:opacity-50">
              Qualified (Probationary)
            </button>
            <button type="button" disabled={isBusy} onClick={() => confirmOverride('disqualified')}
              className="text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-ccc-red/40 text-ccc-red hover:bg-red-50 disabled:opacity-50">
              Disqualify
            </button>
            <button type="button" disabled={isBusy} onClick={() => confirmOverride('forfeited')}
              className="text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-ccc-red/40 text-ccc-red hover:bg-red-50 disabled:opacity-50">
              Forfeit
            </button>
          </div>
        </div>
        {row.scholar_status_reason && (
          <p className="text-[11px] text-ccc-muted">Note: {row.scholar_status_reason}</p>
        )}
      </div>

      {/* Distribution Status Tracking and Statement of Subsequent Actions --
          only meaningful once a passer/qualified-probationary status exists
          (Appendix D: Registrar -> Medical or Admissions -> enrollment). The
          "statement" itself is the audit_log trail each button click writes. */}
      <div className="rounded-xl border border-ccc-border p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Distribution Status
          </p>
          {/* Clear button -- Sept 21, added after live testing found no way
              to reset a leftover distribution_status once Scholar Status no
              longer qualifies (e.g. an exam result got reset for retesting).
              Shown whenever there's something to clear, whether or not the
              stepper itself is currently visible. Data-hygiene only -- see
              the comment above hasStaleDistribution. */}
          {row.distribution_status && row.distribution_status !== 'not_applicable' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setPendingClearDistribution(true)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-ccc-border text-ccc-muted hover:text-ccc-navy hover:bg-ccc-off disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        {hasStaleDistribution && (
          <div className="rounded-lg border border-ccc-orange/40 bg-orange-50 px-3 py-2 text-[11px] text-ccc-orange">
            This applicant&rsquo;s Scholar Status no longer qualifies for distribution tracking, but a stored value
            (&ldquo;{DISTRIBUTION_STATUS_STEPS.find(([k]) => k === row.distribution_status)?.[1] || row.distribution_status}&rdquo;)
            is still on file from before. Use Clear above if this should be reset.
          </div>
        )}
        {!canDistribute ? (
          !hasStaleDistribution && (
            <p className="text-[11px] text-ccc-muted">
              Not applicable yet -- becomes available once this applicant is a Passer or Qualified (Probationary).
            </p>
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {DISTRIBUTION_STATUS_STEPS.map(([key, label], i) => {
              const isCurrent = row.distribution_status === key
              const isPast = currentStepIndex >= 0 && i < currentStepIndex
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAdvanceDistribution(row.id, key)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border disabled:opacity-50 ${
                    isCurrent
                      ? 'bg-ccc-navy text-white border-ccc-navy'
                      : isPast
                      ? 'bg-ccc-off text-ccc-muted border-ccc-border'
                      : 'border-ccc-blue/40 text-ccc-blue hover:bg-blue-50'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
        {row.distribution_status_updated_by && row.distribution_status !== 'not_applicable' && (
          <p className="text-[10px] text-ccc-muted">
            Last updated by {row.distribution_status_updated_by}
            {row.distribution_status_updated_at ? ` on ${new Date(row.distribution_status_updated_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function ResultsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)

  // Sept 21 follow-up: also pulls eligibility (Scholarship Matching, the
  // Dashboard panel's own data) so each card can show a "what's next" hint.
  // These two panels are genuinely two separate modules per the Roles PDF
  // (Scholarship Matching & Filtering vs. Applicant Information & Results),
  // but an admin working a real applicant end to end needs both readings at
  // once -- this merges them client-side by `id` (the shared primary key
  // both endpoints already select) rather than making the admin flip
  // between Dashboard and here to piece the sequence together themselves.
  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [resultsRes, eligRes] = await Promise.all([
        fetch('/api/admin-results'),
        fetch('/api/admin-eligibility'),
      ])
      const resultsData = await resultsRes.json()
      const eligData = await eligRes.json()
      if (!resultsData.success) throw new Error(resultsData.error || 'Failed to load applicant results.')
      if (!eligData.success) throw new Error(eligData.error || 'Failed to load eligibility data.')
      const eligById = new Map(eligData.applications.map((r) => [r.id, r]))
      setRows(resultsData.applications.map((r) => ({ ...eligById.get(r.id), ...r })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runPatch = async (payload) => {
    setBusy(payload.id)
    setError('')
    try {
      const res = await fetch('/api/admin-results', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Update failed.')
        return
      }
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const handleSaveExam = (id, { examScore, examResult, examDate }) =>
    runPatch({ id, field: 'exam', examScore, examResult, examDate })
  const handleSetScholarStatus = (id, scholarStatus, reason) =>
    runPatch({ id, field: 'scholar_status', scholarStatus, reason })
  const handleAdvanceDistribution = (id, distributionStatus) =>
    runPatch({ id, field: 'distribution_status', distributionStatus })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) => `${r.applicant_name || ''} ${r.applicant_email || ''} ${r.application_number || ''}`.toLowerCase().includes(term))
  }, [rows, search])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Applicant Results
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Individual applicant profile view for exam score entry, scholar status, and post-passing distribution
          tracking. Only applicants who have submitted an application (and so have an eligibility profile) appear here.
        </p>
      </div>

      <div className="relative mb-5 max-w-md">
        <IconSearch className="w-4 h-4 text-ccc-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by applicant name, email, or application number..."
          className="w-full rounded-lg border border-ccc-border bg-white pl-9 pr-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-20 text-ccc-muted text-sm">Loading applicants...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-ccc-muted text-sm">
          {rows.length === 0 ? 'No applications on file yet.' : 'No applicants match your search.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((row) => (
            <ResultRow
              key={row.id}
              row={row}
              onSaveExam={handleSaveExam}
              onSetScholarStatus={handleSetScholarStatus}
              onAdvanceDistribution={handleAdvanceDistribution}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Statistical Data & Reporting panel (Sept 21 2026) ----------
// Ivy's other former module. Built to the two Roles-PDF bullets that are
// actually in scope for this capstone version -- Demographic Distribution
// Charts and the ongoing/qualified/not-qualified/waitlisted/appealed status
// analytics. Allowance Distribution Monitoring and Exportable PDF/CSV
// Reports for LGU Compliance are NOT built here: the manuscript's own
// Chapter 1 (Scope and Delimitations) states "full allowance distribution
// monitoring and exportable LGU compliance reports remain to-follow
// modules" -- confirmed by direct text search of the manuscript, not
// assumption. Building those now would be scope creep past what the
// document being defended actually commits to.
//
// "Department" and "Year Level" (also named in the Roles PDF bullet) have
// no backing field anywhere in this system -- Educational Background only
// collects a program choice and an Applying As value (Freshman/Transferee/
// Old Curriculum-ALS), never a department or literal year level. Rather
// than invent a mapping with no source, this panel charts Program (the
// closest real equivalent of "Course") and Applying As (the closest real
// proxy this system has for "Year Level" -- most new applicants enter at
// 1st year, but transferees don't), and says so on the card instead of
// silently pretending the other two exist.

function BarRow({ label, count, total, colorClass }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ccc-text font-medium truncate pr-2">{label}</span>
        <span className="text-ccc-muted shrink-0">{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-ccc-off overflow-hidden">
        <div className={`h-full rounded-full ${colorClass || 'bg-ccc-blue'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function AnalyticsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [eligRes, resultsRes] = await Promise.all([
          fetch('/api/admin-eligibility'),
          fetch('/api/admin-results'),
        ])
        const eligData = await eligRes.json()
        const resultsData = await resultsRes.json()
        if (!eligData.success) throw new Error(eligData.error || 'Failed to load eligibility data.')
        if (!resultsData.success) throw new Error(resultsData.error || 'Failed to load results data.')
        // Merge by id -- both endpoints read the same `applications` table,
        // just different column subsets, so this is a straight join on the
        // one shared key rather than another name-based match.
        const byId = new Map(eligData.applications.map((r) => [r.id, r]))
        const merged = resultsData.applications.map((r) => ({ ...byId.get(r.id), ...r }))
        setRows(merged)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const total = rows.length
    const byProgram = new Map()
    const byApplyingAs = new Map()
    const eligibilityCounts = { qualified: 0, waitlisted: 0, not_qualified: 0, pending_exam: 0, incomplete: 0 }
    const scholarCounts = { pending_exam: 0, passer: 0, waitlisted_probationary: 0, qualified_probationary: 0, disqualified: 0, forfeited: 0 }

    for (const r of rows) {
      const program = r.program_choice_1 || 'Not yet chosen'
      byProgram.set(program, (byProgram.get(program) || 0) + 1)

      const applyingAs = r.applying_as || 'Not yet specified'
      byApplyingAs.set(applyingAs, (byApplyingAs.get(applyingAs) || 0) + 1)

      const elig = r.eligibility_override || r.eligibility_status || 'incomplete'
      if (elig in eligibilityCounts) eligibilityCounts[elig] += 1

      const scholar = r.scholar_status || 'pending_exam'
      if (scholar in scholarCounts) scholarCounts[scholar] += 1
    }

    return {
      total,
      byProgram: Array.from(byProgram.entries()).sort((a, b) => b[1] - a[1]),
      byApplyingAs: Array.from(byApplyingAs.entries()).sort((a, b) => b[1] - a[1]),
      eligibilityCounts,
      scholarCounts,
    }
  }, [rows])

  if (loading) return <div className="text-center py-20 text-ccc-muted text-sm">Loading statistics...</div>
  if (error) return <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Statistics
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          {stats.total} application{stats.total === 1 ? '' : 's'} on file. Allowance monitoring and exportable
          LGU compliance reports aren&rsquo;t built here -- the manuscript itself marks both as to-follow modules,
          out of scope for this version.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-ccc-border bg-white p-5 space-y-3">
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            By Program (Course)
          </p>
          {stats.byProgram.length === 0 ? (
            <p className="text-[11px] text-ccc-muted">No data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.byProgram.map(([label, count]) => (
                <BarRow key={label} label={label} count={count} total={stats.total} colorClass="bg-ccc-blue" />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-ccc-border bg-white p-5 space-y-3">
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            By Applying As (nearest proxy for Year Level)
          </p>
          {stats.byApplyingAs.length === 0 ? (
            <p className="text-[11px] text-ccc-muted">No data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.byApplyingAs.map(([label, count]) => (
                <BarRow key={label} label={label} count={count} total={stats.total} colorClass="bg-ccc-gold" />
              ))}
            </div>
          )}
          <p className="text-[10px] text-ccc-muted pt-1 border-t border-ccc-border">
            No dedicated &ldquo;Department&rdquo; or literal &ldquo;Year Level&rdquo; field exists anywhere in the
            system yet, so those two aren&rsquo;t charted here rather than invented from a guess.
          </p>
        </div>

        <div className="rounded-2xl border border-ccc-border bg-white p-5 space-y-3">
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Ongoing / Qualified / Not Qualified / Waitlisted (Scholarship Matching)
          </p>
          <div className="space-y-2.5">
            <BarRow label="Qualified" count={stats.eligibilityCounts.qualified} total={stats.total} colorClass="bg-ccc-green" />
            <BarRow label="Waitlisted" count={stats.eligibilityCounts.waitlisted} total={stats.total} colorClass="bg-ccc-gold" />
            <BarRow label="Not Qualified" count={stats.eligibilityCounts.not_qualified} total={stats.total} colorClass="bg-ccc-red" />
            <BarRow label="Pending Exam" count={stats.eligibilityCounts.pending_exam} total={stats.total} colorClass="bg-ccc-blue" />
            <BarRow label="Incomplete (Ongoing)" count={stats.eligibilityCounts.incomplete} total={stats.total} colorClass="bg-ccc-muted" />
          </div>
        </div>

        <div className="rounded-2xl border border-ccc-border bg-white p-5 space-y-3">
          <p className="text-[11px] font-bold text-ccc-navy uppercase tracking-wide" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Post-Exam Scholar Status
          </p>
          <div className="space-y-2.5">
            <BarRow label="Passer" count={stats.scholarCounts.passer} total={stats.total} colorClass="bg-ccc-green" />
            <BarRow label="Waitlisted (Probationary)" count={stats.scholarCounts.waitlisted_probationary} total={stats.total} colorClass="bg-ccc-gold" />
            <BarRow label="Qualified (Probationary)" count={stats.scholarCounts.qualified_probationary} total={stats.total} colorClass="bg-ccc-gold" />
            <BarRow label="Disqualified" count={stats.scholarCounts.disqualified} total={stats.total} colorClass="bg-ccc-red" />
            <BarRow label="Forfeited" count={stats.scholarCounts.forfeited} total={stats.total} colorClass="bg-ccc-red" />
            <BarRow label="Pending Exam" count={stats.scholarCounts.pending_exam} total={stats.total} colorClass="bg-ccc-blue" />
          </div>
          <p className="text-[10px] text-ccc-muted pt-1 border-t border-ccc-border">
            &ldquo;Appeals&rdquo; analytics (per the Roles PDF) aren&rsquo;t charted separately -- the Appeal for
            Retake/Re-application feature itself is still parked pending an ownership decision (see
            ISKOLUSYON_HANDOFF.md §5), so there&rsquo;s no data to count yet.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------- Communications panel (new, real — post + list) ----------

function CommunicationsPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/announcements')
      const data = await res.json()
      if (data.success) setItems(data.announcements)
      else setError(data.error || 'Failed to load announcements.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handlePost = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setPosting(true)
    setPostError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category: category || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPostError(data.error || 'Failed to post.')
        return
      }
      setTitle('')
      setBody('')
      setCategory('')
      await load()
    } catch (err) {
      setPostError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Communications
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Post announcements visible to admins here. Applicant-facing delivery (the Messages panel on the
          applicant portal) isn&apos;t wired up to this yet — that&apos;s the next connection once this panel is confirmed.
        </p>
      </div>

      <form onSubmit={handlePost} className="bg-white border border-ccc-border rounded-2xl p-5 mb-6 space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-ccc-muted block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Document submission deadline extended"
            className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
            required
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-ccc-muted block mb-1">Category (optional)</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Deadlines, Requirements, General"
            className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-widest text-ccc-muted block mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Write the announcement..."
            className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
            required
          />
        </div>
        {postError && <p className="text-xs text-ccc-red">{postError}</p>}
        <button
          type="submit"
          disabled={posting}
          className="rounded-lg bg-ccc-navy text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
        >
          {posting ? 'Posting...' : 'Post announcement'}
        </button>
      </form>

      <div className="bg-white border border-ccc-border rounded-2xl p-5">
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No announcements posted yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="pb-4 border-b border-ccc-border last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
                    {item.title}
                  </p>
                  {item.category && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ccc-blue bg-blue-50 border border-ccc-blue/30 rounded-full px-2 py-0.5 shrink-0">
                      {item.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ccc-text mt-1 whitespace-pre-wrap">{item.body}</p>
                <p className="text-[11px] text-ccc-muted mt-1.5">
                  {item.author} · {formatWhen(item.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Admin Accounts panel (new, real, read-only) ----------

function AdminAccountsPanel() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAccounts(data.accounts)
        else setError(data.error || 'Failed to load admin accounts.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Admin Accounts
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Read-only roster for now — inviting or removing an admin isn&apos;t wired up yet (no real User Account Module
          to hang it on). New accounts are still seeded via <code>scripts/seed-admin-account.mjs</code>.
        </p>
      </div>

      <div className="bg-white border border-ccc-border rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No admin accounts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ccc-border text-left text-[10px] font-bold uppercase tracking-widest text-ccc-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.email} className="border-b border-ccc-border last:border-0">
                  <td className="px-5 py-3 font-semibold text-ccc-navy">{acc.name}</td>
                  <td className="px-5 py-3 text-ccc-text">{acc.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        acc.is_super_admin
                          ? 'text-ccc-navy bg-ccc-gold/30 border border-ccc-gold/60'
                          : 'text-ccc-muted bg-ccc-off border border-ccc-border'
                      }`}
                    >
                      {acc.is_super_admin ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------- System & Activity panel (Global Audit Log, moved in from the
// old standalone /admin/activity route — same content, same behavior) ----------

function TimelineItem({ entry }) {
  const isWarn = entry.kind === 'warn'
  return (
    <div className="flex gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isWarn ? 'bg-orange-50 text-ccc-orange border border-ccc-orange/40' : 'bg-green-50 text-ccc-green border border-ccc-green/40'
        }`}
      >
        {isWarn ? <IconAlert className="w-3.5 h-3.5" /> : <IconCheck className="w-3.5 h-3.5" />}
      </div>
      <div className="pb-4 border-b border-ccc-border flex-1 min-w-0">
        <p className="text-sm text-ccc-text leading-snug">{entry.action}</p>
        <p className="text-[11px] text-ccc-muted mt-1">
          {entry.actor} &middot; {formatWhen(entry.created_at)}
        </p>
      </div>
    </div>
  )
}

function SystemActivityPanel() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/audit-log')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setEntries(data.entries)
        else setError(data.error || 'Failed to load audit log.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          System &amp; Activity
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          A running, auto-recorded timeline of system activity — document uploads, manual overrides, and
          announcement posts.
        </p>
      </div>

      <div className="bg-white border border-ccc-border rounded-2xl p-6">
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No activity recorded yet.</p>
        ) : (
          <div className="space-y-0">
            {entries.map((entry) => (
              <TimelineItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Page shell ----------

const VALID_PANELS = ['dashboard', 'communications', 'admins', 'system']

function AdminPageInner() {
  const searchParams = useSearchParams()
  const initialPanel = VALID_PANELS.includes(searchParams.get('panel')) ? searchParams.get('panel') : 'dashboard'

  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eligibility, setEligibility] = useState([])
  const [eligibilityOverriding, setEligibilityOverriding] = useState(null)
  const [eligibilityError, setEligibilityError] = useState('')
  const [recomputing, setRecomputing] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [overriding, setOverriding] = useState(null)
  const [overrideError, setOverrideError] = useState('')
  const [activePanel, setActivePanel] = useState(initialPanel)
  const [isOffline, setIsOffline] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)

  const fetchDocs = async () => {
    // Only show the full "Loading documents..." blank state on the very
    // first load. Every later call (after an override, or after
    // reconnecting) should update the list quietly in the background —
    // wiping 123 already-visible documents back to a loading screen on
    // every single Mark Verified/Flag click was the real cause of the
    // "kept refreshing" feeling, especially pronounced on a slow
    // connection where each full refetch takes several seconds.
    if (docs.length === 0) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/upload')
      const data = await res.json()
      if (data.success) {
        setDocs(data.documents)
      } else {
        setError(data.error || 'Failed to load documents.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/admin-session')
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) {
          setAdminName(data.name)
          setIsSuperAdmin(!!data.isSuperAdmin)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [])

  // Scholarship Matching & Filtering — the automated eligibility result per
  // applicant (see app/lib/matching.js + app/api/admin-eligibility/route.js).
  // Fetched separately from documents since it comes off the `applications`
  // table, not `documents`.
  const fetchEligibility = async () => {
    try {
      const res = await fetch('/api/admin-eligibility')
      const data = await res.json()
      if (data.success) setEligibility(data.applications)
    } catch (err) {
      console.error('Failed to load eligibility:', err)
    }
  }

  useEffect(() => {
    fetchEligibility()
  }, [])

  // Proactive connectivity banner, same module and pattern as the
  // applicant portal — an admin reviewing documents deserves the same
  // clear "you're offline" / "back online" signal instead of things
  // just quietly failing to load.
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOffline(!navigator.onLine)
    const unsubscribe = onConnectivityChange((online) => {
      setIsOffline(!online)
      if (online) {
        setJustReconnected(true)
        setTimeout(() => setJustReconnected(false), 4000)
        // Re-fetch whatever the connection drop may have interrupted —
        // documents, so the dashboard/list doesn't sit stale or half-loaded.
        fetchDocs()
      }
    })
    return unsubscribe
  }, [])

  // A signed-in but non-Super-Admin session shouldn't be able to land on a
  // Super-Admin-only panel (e.g. by an old bookmark) — bounce back to
  // Dashboard the moment the role is known.
  useEffect(() => {
    if (!isSuperAdmin && (activePanel === 'admins' || activePanel === 'system')) {
      setActivePanel('dashboard')
    }
  }, [isSuperAdmin, activePanel])

  const handleLogout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const handleOverride = async (doc, action) => {
    if (!doc.file_path) return
    setOverriding(doc.file_path)
    setOverrideError('')
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.file_path)}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOverrideError(data.error || 'Override failed.')
        return
      }
      await fetchDocs()
    } catch (err) {
      setOverrideError(
        isNetworkError(err)
          ? 'No connection right now — this change did not go through. Try again once you\u2019re back online.'
          : err.message
      )
    } finally {
      setOverriding(null)
    }
  }

  const handleEligibilityOverride = async (applicationId, override) => {
    setEligibilityOverriding(applicationId)
    setEligibilityError('')
    try {
      const res = await fetch('/api/admin-eligibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId, override }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEligibilityError(data.error || 'Override failed.')
        return
      }
      await fetchEligibility()
    } catch (err) {
      setEligibilityError(
        isNetworkError(err)
          ? 'No connection right now — this change did not go through. Try again once you’re back online.'
          : err.message
      )
    } finally {
      setEligibilityOverriding(null)
    }
  }

  const handleRecomputeEligibility = async () => {
    setRecomputing(true)
    setEligibilityError('')
    try {
      const res = await fetch('/api/admin-eligibility/recompute', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setEligibilityError(data.error || 'Recompute failed.')
        return
      }
      await fetchEligibility()
    } catch (err) {
      setEligibilityError(
        isNetworkError(err)
          ? 'No connection right now — this change did not go through. Try again once you’re back online.'
          : err.message
      )
    } finally {
      setRecomputing(false)
    }
  }

  const totalFlagged = docs.filter((d) => d.needs_review).length

  return (
    <main className="min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader
        topbarLabel="Iskolusyon Admin Console"
        portalBadge="Admin Console"
        rightSlot={
          <a
            href="/"
            className="text-xs font-semibold text-ccc-blue hover:text-ccc-navy transition-colors underline underline-offset-2"
          >
            Back to applicant portal
          </a>
        }
      />

      {isOffline && (
        <div className="w-full bg-red-50 border-b border-red-200 text-center py-2.5 px-4">
          <p className="text-xs font-semibold text-red-700">
            You&rsquo;re currently offline. Document previews, saves, and overrides won&rsquo;t go through until
            your connection returns &mdash; this page will pick back up automatically once it does.
          </p>
        </div>
      )}

      {!isOffline && justReconnected && (
        <div className="w-full bg-green-50 border-b border-ccc-green/30 text-center py-2 px-4">
          <p className="text-xs font-semibold text-ccc-green">
            You&rsquo;re back online &mdash; refreshing the latest data now.
          </p>
        </div>
      )}

      <div className="w-full max-w-6xl mx-auto px-4 pt-8 pb-16 flex flex-col lg:flex-row gap-6">
        <AdminSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          displayName={adminName}
          isSuperAdmin={isSuperAdmin}
          flaggedCount={totalFlagged}
          onLogout={handleLogout}
        />

        <div className="flex-1 min-w-0">
          {activePanel === 'dashboard' && (
            <DashboardPanel
              docs={docs}
              loading={loading}
              error={error}
              onOverride={handleOverride}
              overriding={overriding}
              overrideError={overrideError}
              eligibility={eligibility}
              onEligibilityOverride={handleEligibilityOverride}
              eligibilityOverriding={eligibilityOverriding}
              eligibilityError={eligibilityError}
              onRecomputeEligibility={handleRecomputeEligibility}
              recomputing={recomputing}
            />
          )}
          {activePanel === 'communications' && <CommunicationsPanel />}
          {activePanel === 'results' && <ResultsPanel />}
          {activePanel === 'analytics' && <AnalyticsPanel />}
          {activePanel === 'admins' && isSuperAdmin && <AdminAccountsPanel />}
          {activePanel === 'system' && isSuperAdmin && <SystemActivityPanel />}
        </div>
      </div>
    </main>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  )
}