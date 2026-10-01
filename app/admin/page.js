'use client'
import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import '../admin-theme.css'
import SiteHeader from '../components/SiteHeader'
import AdminSidebar from '../components/AdminSidebar'
import { getDocTypeLabel } from '../lib/documentTypes'
import { onConnectivityChange, isNetworkError } from '../lib/offlineSync'
import { suggestExamResult } from '../lib/matching'
import { PROFILE_CATEGORIES, formatFieldValue } from '../lib/applicantProfileSchema'
import { EDITABLE_FIELDS, SELECT_OPTIONS, DATE_FIELDS, LONG_TEXT_FIELDS, isEditableStack } from '../lib/profileEditRules'

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
function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

// Sept 24 2026: category icons for the Activity Log timeline (see
// ACTIVITY_CATEGORIES / ACTIVITY_CATEGORY_STYLE below) -- added so each row
// reads as its own kind of event at a glance instead of every entry
// rendering the same green checkmark regardless of what actually happened.
function IconTarget(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  )
}
function IconBarChart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 20V10M12 20V4M19 20v-6" />
    </svg>
  )
}
function IconMessage(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}
function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  )
}
function IconGear(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

// One icon + tint per category, all distinct from the warn/red used for
// entries needing attention (kind === 'warn' always wins over category --
// see TimelineItem -- so "something needs a look" stays a reserved signal
// rather than one more category color).
const ACTIVITY_CATEGORY_STYLE = {
  Documents: { icon: IconFile, className: 'cat-documents' },
  Eligibility: { icon: IconTarget, className: 'cat-eligibility' },
  Results: { icon: IconBarChart, className: 'cat-results' },
  Communications: { icon: IconMessage, className: 'cat-communications' },
  'Admin Accounts': { icon: IconShield, className: 'cat-admin' },
  System: { icon: IconGear, className: 'cat-system' },
}
function getCategoryStyle(category) {
  return ACTIVITY_CATEGORY_STYLE[category] || { icon: IconCheck, className: 'done' }
}

// Sept 24 2026: date-section headers for the Activity Log timeline ("Today"
// / "Yesterday" / a full date) so 50+ entries don't read as one
// undifferentiated scroll -- groups consecutive entries by calendar day,
// in whatever order the API already returned them (newest first).
function activityDateLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}
function groupActivityByDate(entries) {
  const groups = []
  for (const entry of entries) {
    const label = activityDateLabel(entry.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(entry)
    } else {
      groups.push({ label, items: [entry] })
    }
  }
  return groups
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

// Sept 24 2026: two-letter initials for the Admin Accounts row avatars,
// matching Ivy's mockup (e.g. "Guidance & Testing Office" -> "GO", "Grace
// Villanueva" -> "GV") -- first letter of the first word + first letter of
// the last word, so a multi-word office name still collapses to two letters
// instead of overflowing the circle.
function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Sept 24 2026: same eye / eye-slash icons as the applicant side (see
// ApplicantAuth.js's EyeIcon/EyeOffIcon, which itself matches app/page.js's
// IconEye/IconEyeOff) -- reused here rather than a new pair so the show/
// hide toggle looks identical across the whole app, admin included. An
// emoji version was tried first but rendered as a broken fallback glyph on
// some Windows setups, which is exactly the kind of inconsistency this
// avoids.
function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.11A10.6 10.6 0 0112 5c6 0 9.5 7 9.5 7a13.6 13.6 0 01-3.13 3.94M6.6 6.6C4.16 8.2 2.5 10.5 2.5 12c0 0 3.5 7 9.5 7 1.13 0 2.19-.19 3.17-.53" />
    </svg>
  )
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

// Sept 29: same fix as the applicant portal. A new upload sits in
// review_status 'processing' until the OCR worker on Render reads it, and
// used to show as Verified here during that time.
function ReviewStatusBadge({ needsReview, reviewStatus }) {
  if (reviewStatus === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-blue/40 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-blue shrink-0 whitespace-nowrap">
        <IconClock className="w-3 h-3" />
        Processing
      </span>
    )
  }
  if (needsReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-orange/50 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-orange shrink-0 whitespace-nowrap">
        <IconAlertTriangle className="w-3 h-3" />
        Needs review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ccc-green/40 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-green shrink-0 whitespace-nowrap">
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

function CopyHashButton({ hash, label = 'Copy hash' }) {
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
      {copied ? 'Copied' : label}
    </button>
  )
}

// The core review unit: one document, file preview on the left, OCR + status
// on the right. This is what replaces the mockup's dead viewDocument() stub.
function DocumentReviewCard({ doc, onOverride, overriding }) {
  const image = isImageFile(doc.file_path)
  const pdf = isPdfFile(doc.file_path)
  const isBusy = overriding === doc.file_path
  const isProcessing = doc.review_status === 'processing'

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
            <ReviewStatusBadge needsReview={doc.needs_review} reviewStatus={doc.review_status} />
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
              {doc.extracted_text || (
                <span className="italic text-ccc-muted">
                  {isProcessing ? 'Still being read by OCR. Refresh in a minute.' : 'No text extracted'}
                </span>
              )}
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
                disabled={isBusy || isProcessing || !doc.needs_review}
                onClick={() => onOverride(doc, 'verify')}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-ccc-green/50 text-ccc-green bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? 'Saving...' : 'Mark Verified'}
              </button>
              <button
                type="button"
                disabled={isBusy || isProcessing || doc.needs_review}
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

// The 3 manual-override choices, restyled Sept 22 2026 as Ivy's mockup's
// big "Update Application Status" cards (.status-action-grid/.status-btn,
// already in admin-theme.css, previously unused) instead of small pills --
// cosmetic only, per the user's explicit scope pick that day: no new
// per-field editing or admin-controlled applicant emails (her mockup's
// "EDIT"/"EDITABLE" toggles and "Emails Applicant" switch aren't real
// features this app has yet, so they're deliberately left out here, not
// silently added). `key` matches VALID_OVERRIDES in
// app/api/admin-eligibility/route.js; `cls` is only the CSS modifier name
// (status-btn.not-qualified, hyphenated) so it doesn't have to match.
const STATUS_OPTIONS = [
  { key: 'qualified', cls: 'qualified', icon: '✓', label: 'Qualified' },
  { key: 'waitlisted', cls: 'waitlisted', icon: '⏳', label: 'Waitlisted' },
  { key: 'not_qualified', cls: 'not-qualified', icon: '✕', label: 'Not Qualified' },
]

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
    <div className="rounded-xl border border-ccc-border bg-white px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="modal-section-label" style={{ marginBottom: 0 }}>
          Update Application Status
        </span>
        {isOverridden && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ccc-muted">Manually set by {row.eligibility_override_by || 'an admin'}</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onOverride(row.id, null)}
              className="text-[10px] font-semibold text-ccc-blue hover:underline disabled:opacity-50"
            >
              Clear override
            </button>
          </div>
        )}
      </div>
      <div className="status-action-grid">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            disabled={isBusy}
            onClick={() => onOverride(row.id, opt.key)}
            className={`status-btn ${opt.cls}${effectiveStatus === opt.key ? ' current' : ''}`}
          >
            <div className="sb-icon">{opt.icon}</div>
            <div className="sb-label">{opt.label}</div>
          </button>
        ))}
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

// ---------- Action pop-up (Oct 1 2026) ----------
// Pau's request: after an admin action (save, send, invite, recompute, set a
// status, verify a document...), show a pop-up instead of a corner toast so
// it isn't overlooked. Same look as the applicant portal's pop-up (Ivy's
// confirm-box), with OK locked for 5 seconds. The name stays AdminToast so
// every place that already used the toast now gets the pop-up.
// NOT used for the Admin Accounts notice that shows a temporary password:
// that one stays on the page until the admin copies it and dismisses it.
const ADMIN_NOTICE_LOCK_SECONDS = 5

function AdminToast({ message, tone = 'success', onDone }) {
  const [secondsLeft, setSecondsLeft] = useState(ADMIN_NOTICE_LOCK_SECONDS)
  useEffect(() => {
    if (!message) return undefined
    setSecondsLeft(ADMIN_NOTICE_LOCK_SECONDS)
    const t = setInterval(() => setSecondsLeft((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [message])
  const locked = secondsLeft > 0
  useEffect(() => {
    if (!message) return undefined
    const onKey = (e) => e.key === 'Escape' && !locked && onDone && onDone()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [message, locked, onDone])
  if (!message) return null
  const isError = tone === 'error'
  const text = String(message).replace(/^\u2713\s*/, '')
  return (
    <div className="confirm-overlay open" style={{ zIndex: 2000 }} onClick={(e) => e.target === e.currentTarget && !locked && onDone && onDone()}>
      <div className="confirm-box" role="alertdialog" aria-modal="true" aria-live="polite" style={{ maxWidth: 420 }}>
        <div className="confirm-icon" style={isError ? undefined : { background: '#E3F4EA', color: '#1E8E5A' }}>
          {isError ? '!' : '\u2713'}
        </div>
        <h3>{isError ? 'Something went wrong' : 'Done'}</h3>
        <p style={{ whiteSpace: 'pre-line' }}>{text}</p>
        <div className="confirm-actions">
          <button type="button" className="mbtn mbtn-primary" onClick={() => onDone && onDone()} disabled={locked}>
            {locked ? `OK (${secondsLeft})` : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

// For handlers that have no pop-up of their own (Dashboard status and
// document actions, Applicant Results, Announcements): fire an event that
// the one AdminNoticeHost on the page shows.
function showAdminNotice(text, tone = 'success') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('admin-notice', { detail: { text, tone } }))
}

function AdminNoticeHost() {
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    const onNotice = (e) => setNotice(e.detail)
    window.addEventListener('admin-notice', onNotice)
    return () => window.removeEventListener('admin-notice', onNotice)
  }, [])
  return <AdminToast message={notice?.text || ''} tone={notice?.tone} onDone={() => setNotice(null)} />
}

// ---------- Locked Applications for Review (Oct 1 2026, Ivy's row) ----------
// While one admin has an applicant open (Dashboard or Applicant Results),
// other admins see that applicant greyed out with "Being reviewed by ..." and
// can't open it, so nobody edits, emails or changes the status of the same
// applicant at the same time. The server enforces the same rule on every
// write (app/lib/applicantLocks.js), and a lock frees itself about 90 seconds
// after the admin's tab stops refreshing it.

// Polls who has which applicant open. Returns { [applicationId]: { admin_name, mine } }.
function useApplicantLocks() {
  const [locks, setLocks] = useState({})
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/admin-applicant-lock')
        const data = await res.json()
        if (cancelled || !data.success) return
        const map = {}
        for (const l of data.locks || []) map[l.application_id] = { admin_name: l.admin_name, mine: l.mine }
        setLocks(map)
      } catch {
        // Locks are a convenience on screen; the server still enforces them.
      }
    }
    load()
    // Oct 1 2026: every 5 seconds (was 15) so the "Being reviewed by" badge
    // appears and clears quickly, plus right away when the admin comes back
    // to this tab. Clicking an applicant always checks the lock live anyway.
    const timer = setInterval(load, 5000)
    const onFocus = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])
  return locks
}

function releaseApplicantLock(applicationId) {
  if (!applicationId) return
  const body = JSON.stringify({ id: applicationId, action: 'release' })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/admin-applicant-lock', new Blob([body], { type: 'application/json' }))
      return
    }
  } catch {}
  fetch('/api/admin-applicant-lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

// Opens an applicant's modal only after claiming the lock, keeps the lock
// alive while open, and releases it on close or when the tab closes.
function useLockedModal(applicationId) {
  const [modalOpen, setModalOpen] = useState(false)
  const [blockedMsg, setBlockedMsg] = useState('')
  const [opening, setOpening] = useState(false)

  const claim = async () => {
    const res = await fetch('/api/admin-applicant-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: applicationId }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) return { blocked: data.error || 'Another admin is reviewing this applicant.' }
    return { ok: true }
  }

  const openModal = async () => {
    setBlockedMsg('')
    if (!applicationId) {
      setModalOpen(true)
      return
    }
    setOpening(true)
    try {
      const result = await claim()
      if (result.blocked) {
        setBlockedMsg(result.blocked)
        return
      }
      setModalOpen(true)
    } catch {
      // Network trouble: open anyway; the server still checks every save.
      setModalOpen(true)
    } finally {
      setOpening(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    releaseApplicantLock(applicationId)
  }

  useEffect(() => {
    if (!modalOpen || !applicationId) return undefined
    const beat = setInterval(() => {
      claim()
        .then((r) => {
          if (r.blocked) setBlockedMsg(r.blocked)
        })
        .catch(() => {})
    }, 30000)
    const onUnload = () => releaseApplicantLock(applicationId)
    window.addEventListener('pagehide', onUnload)
    return () => {
      clearInterval(beat)
      window.removeEventListener('pagehide', onUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, applicationId])

  return { modalOpen, openModal, closeModal, blockedMsg, setBlockedMsg, opening }
}

function LockedNotice({ lockInfo, blockedMsg, onDismiss }) {
  if (!blockedMsg && !(lockInfo && !lockInfo.mine)) return null
  return (
    <p className="text-[11px] text-ccc-orange px-2 -mt-2 mb-3 flex items-center gap-2">
      {blockedMsg || `${lockInfo.admin_name || 'Another admin'} is reviewing this applicant right now.`}
      {blockedMsg && (
        <button type="button" className="underline text-ccc-muted" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </p>
  )
}

// One applicant, collapsed by default, with all their documents inside.
// Row-in-a-list + click-to-open-detail-modal (Sept 22 2026) -- was an
// inline-expanding accordion (defaultOpen={i===0} forced the first
// applicant open on every page load, which read as broken/random rather
// than deliberate). Matches the click-a-row-to-see-details pattern from
// Ivy's mockup's applicant-table -> applicantModal, using this app's own
// existing modal idiom (see ConfirmActionModal above) rather than her raw
// modal-overlay/modal-box markup -- same interaction, not a redesign of
// what's already a real, working review flow (eligibility override,
// per-document verify/flag) into her read-only summary layout.
// The 4 real profile sections (app/page.js, applicant side) -- matches
// Ivy's mockup's "X of 4 sections done" exactly, using the applicant's
// actual *_submitted_at columns rather than a fabricated number.
const PROFILE_SECTIONS = [
  { key: 'personal_info_submitted_at', label: 'Personal Information' },
  { key: 'academic_submitted_at', label: 'Educational Background' },
  { key: 'fam_financial_submitted_at', label: 'Family & Financial Information' },
  { key: 'health_submitted_at', label: 'Health & Wellness' },
]

// Oct 1 2026: one stack of the "Submitted Documents & Profile Data" panel,
// editable by any admin (progress table rows "Applicant Profile Edit & Save
// Controls" / "Applicant Detail with Personal Information View/Edit", Ivy's
// rows). Read-only until the admin clicks Edit; Save sends only the fields
// that changed. The server logs old -> new and notifies the applicant.
function ProfileStackFields({ stack, detail, applicationId, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const canEdit = !!detail && !!applicationId && isEditableStack(stack)

  const startEdit = () => {
    const start = {}
    for (const f of stack.fields) {
      if (!EDITABLE_FIELDS.has(f.key)) continue
      const v = detail?.[f.key]
      start[f.key] = v === null || v === undefined ? '' : String(v)
    }
    setValues(start)
    setError('')
    setNote('')
    setEditing(true)
  }

  const save = async () => {
    const changes = {}
    for (const [key, v] of Object.entries(values)) {
      const before = detail?.[key] === null || detail?.[key] === undefined ? '' : String(detail[key])
      if (v.trim() !== before.trim()) changes[key] = v
    }
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin-applicant-detail', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId, changes }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save.')
      setEditing(false)
      setNote(data.changed?.length ? 'Saved. The applicant was notified in their portal.' : 'No changes to save.')
      if (onSaved) onSaved(data.application)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const input = (field) => {
    const editable = editing && EDITABLE_FIELDS.has(field.key)
    if (!editable) return <input value={formatFieldValue(detail, field)} disabled readOnly />
    const v = values[field.key] ?? ''
    const set = (val) => setValues((prev) => ({ ...prev, [field.key]: val }))
    const options = SELECT_OPTIONS[field.key]
    if (options) {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">(blank)</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
          {v && !options.includes(v) && <option value={v}>{v}</option>}
        </select>
      )
    }
    if (DATE_FIELDS.has(field.key)) return <input type="date" value={v} onChange={(e) => set(e.target.value)} />
    if (LONG_TEXT_FIELDS.has(field.key)) return <textarea rows={3} value={v} maxLength={2000} onChange={(e) => set(e.target.value)} />
    return <input value={v} maxLength={200} onChange={(e) => set(e.target.value)} />
  }

  return (
    <>
      {canEdit && (
        <div className="flex items-center justify-end gap-2" style={{ marginTop: '-6px', marginBottom: '6px' }}>
          {editing ? (
            <>
              <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={saving} onClick={() => { setEditing(false); setError('') }}>
                Cancel
              </button>
              <button type="button" className="mbtn mbtn-primary mbtn-sm" disabled={saving} onClick={save}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button type="button" className="section-edit-btn" onClick={startEdit}>Edit</button>
          )}
        </div>
      )}
      {editing && (
        <p className="text-[11px] text-ccc-muted mb-2">
          Edit only what the applicant asked to correct or what doesn&apos;t match their documents. Every change is logged and the applicant is notified.
        </p>
      )}
      <div className="doc-cat-fields">
        {stack.fields.map((field) => (
          <div key={field.key} className="efield">
            <label>{field.label}</label>
            {input(field)}
          </div>
        ))}
      </div>
      {error && <p className="text-[11px] text-ccc-red mt-1">{error}</p>}
      <AdminToast message={note} onDone={() => setNote('')} />
    </>
  )
}

function ApplicantGroup({ name, email, docs, onOverride, overriding, eligibilityRow, onEligibilityOverride, eligibilityOverriding, onProfileSaved, lockInfo }) {
  const { modalOpen, openModal, closeModal, blockedMsg, setBlockedMsg, opening } = useLockedModal(eligibilityRow?.id)
  const lockedByOther = !!lockInfo && !lockInfo.mine && !modalOpen
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activeCat, setActiveCat] = useState(PROFILE_CATEGORIES[0].key)
  const flaggedCount = docs.filter((d) => d.needs_review).length
  // Sept 29: documents still waiting on the OCR worker are neither.
  const processingCount = docs.filter((d) => d.review_status === 'processing' && !d.needs_review).length
  const verifiedCount = docs.filter((d) => !d.needs_review && d.review_status !== 'processing').length
  const sectionsDone = PROFILE_SECTIONS.filter((s) => !!eligibilityRow?.[s.key]).length
  const profilePct = Math.round((sectionsDone / PROFILE_SECTIONS.length) * 100)

  // Full-row fetch, lazy -- only once an admin actually opens this
  // applicant's modal (see app/api/admin-applicant-detail/route.js).
  // `attemptedIdRef` tracks which applicant id has already been fetched
  // (success OR failure) so a failed request surfaces its real error
  // instead of silently retrying forever -- the original version here
  // had `detail`/`detailLoading` in its own dependency array, so a
  // failed fetch (detail still null, detailLoading back to false) made
  // the effect immediately re-run and refetch in a tight loop, which is
  // why the modal could get stuck showing "Loading..." with every field
  // blank and no error ever visible (Sept 22 2026 bug report). fetchDetail
  // is exposed via a "Retry" button instead, for a deliberate re-attempt.
  const attemptedIdRef = useRef(null)
  const fetchDetail = () => {
    if (!eligibilityRow?.id) return
    attemptedIdRef.current = eligibilityRow.id
    setDetailLoading(true)
    setDetailError('')
    fetch(`/api/admin-applicant-detail?id=${encodeURIComponent(eligibilityRow.id)}`)
      .then(async (res) => {
        let data = null
        try {
          data = await res.json()
        } catch {
          throw new Error(`Server returned an unexpected response (HTTP ${res.status}).`)
        }
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Could not load applicant profile (HTTP ${res.status}).`)
        }
        setDetail(data.application)
      })
      .catch((err) => {
        setDetailError(err?.message || 'Could not load applicant profile.')
      })
      .finally(() => {
        setDetailLoading(false)
      })
  }
  useEffect(() => {
    if (!modalOpen || !eligibilityRow?.id) return
    if (attemptedIdRef.current === eligibilityRow.id) return
    fetchDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, eligibilityRow?.id])

  const activeCategory = PROFILE_CATEGORIES.find((c) => c.key === activeCat) || PROFILE_CATEGORIES[0]

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={opening}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-ccc-border bg-white shadow-sm hover:bg-ccc-off hover:border-ccc-blue/40 transition-colors${lockedByOther ? ' opacity-60' : ''}`}
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
          {lockedByOther && (
            <span className="rounded-full border border-ccc-border bg-ccc-off text-ccc-muted text-[10px] font-bold px-2 py-0.5">
              &#128274; Being reviewed by {lockInfo.admin_name || 'another admin'}
            </span>
          )}
          <EligibilityBadge status={eligibilityRow?.eligibility_override || eligibilityRow?.eligibility_status || 'incomplete'} />
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-ccc-gold text-ccc-navy text-[10px] font-bold px-2 py-0.5">
              <IconAlertTriangle className="w-3 h-3" />
              {flaggedCount} flagged
            </span>
          )}
        </div>
      </button>
      <LockedNotice lockInfo={null} blockedMsg={blockedMsg} onDismiss={() => setBlockedMsg('')} />

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
          onClick={() => closeModal()}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white shadow-xl border border-ccc-border overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tinted header band (Sept 22 2026 -- was a flat white bar
                cramming application number, email and a redundant document
                count onto one dense "·"-joined line; the count already
                repeats what the Documents mini-summary card below shows).
                A soft tint sets this off as a clear title area, the name
                reads larger/bolder, and the application number is its own
                badge instead of being run into the email line. */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 border-b border-ccc-border"
              style={{ background: 'linear-gradient(135deg, #eef3fd 0%, #ffffff 100%)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-ccc-navy flex items-center justify-center text-base font-bold text-white shrink-0">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-ccc-navy truncate" style={{ fontFamily: 'var(--font-montserrat)' }}>
                    {name || 'Unknown applicant'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {eligibilityRow?.application_number && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ccc-blue bg-white/70 border border-ccc-blue/30 rounded-full px-2 py-0.5 shrink-0">
                        {eligibilityRow.application_number}
                      </span>
                    )}
                    <span className="text-[11px] text-ccc-muted truncate">{email || 'No email on file'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeModal()}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ccc-muted hover:bg-white hover:text-ccc-navy transition-colors"
              >
                &#10005;
              </button>
            </div>
            {/* Mini-summary pair mirroring Ivy's modal's Profile Completion /
                Documents cards -- real data, not her mockup's numbers: the
                4 sections are the applicant's actual submitted_at columns,
                and Documents is a real Verified/Pending split. Her third
                bucket, "Deficient", isn't a state this system tracks (a
                document is either needs_review or it isn't), so it's left
                out rather than faked. */}
            <div className="mini-summary-grid px-5 pt-4">
              <div className={`mini-summary ms-profile${sectionsDone === PROFILE_SECTIONS.length ? ' complete' : sectionsDone > 0 ? ' ongoing' : ''}`}>
                <div className="ms-label">Profile Completion</div>
                <div className="ms-value">
                  {sectionsDone} of {PROFILE_SECTIONS.length} sections done ({profilePct}%)
                </div>
              </div>
              <div className="mini-summary ms-docs">
                <div className="ms-label">Documents</div>
                <div className="ms-value">
                  {verifiedCount} Verified{processingCount > 0 ? ` · ${processingCount} Processing` : ''} · {flaggedCount} Pending Review
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* General Information grid -- mirrors Ivy's modal's own top
                  section (Last Name / First Name / Email / Contact Number /
                  Applying As / Term Applying In / Approved Program), read
                  from the full-row fetch above. One deliberate deviation:
                  her "Approved Program for Applicant" is an editable
                  dropdown an admin sets manually -- this app has no such
                  feature, since the automated Scholarship Matching &
                  Filtering engine (app/lib/matching.js) decides eligibility
                  against the applicant's own two program choices instead of
                  an admin-assigned program. Shown here read-only as the
                  applicant's actual First/Second Priority Program. */}
              <div>
                <div className="modal-section-label">
                  General Information
                  {detailLoading && <span className="tag">Loading…</span>}
                </div>
                {detailError && (
                  <p className="text-[11px] text-ccc-red mb-2 flex items-center gap-2">
                    {detailError}
                    <button
                      type="button"
                      onClick={fetchDetail}
                      className="text-[10px] font-bold uppercase tracking-wide text-ccc-blue underline"
                    >
                      Retry
                    </button>
                  </p>
                )}
                <div className="edit-grid">
                  <div className="efield">
                    <label>Last Name</label>
                    <input value={formatFieldValue(detail, { key: 'last_name' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>First Name</label>
                    <input value={formatFieldValue(detail, { key: 'first_name' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>Email Address</label>
                    <input value={detail?.applicant_email || email || '—'} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>Contact Number</label>
                    <input value={formatFieldValue(detail, { key: 'contact_number' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>Applying As</label>
                    <input value={formatFieldValue(detail, { key: 'applying_as' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>Term Applying In</label>
                    <input value={formatFieldValue(detail, { key: 'term_applying' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>First Priority Program</label>
                    <input value={formatFieldValue(detail, { key: 'program_choice_1' })} disabled readOnly />
                  </div>
                  <div className="efield">
                    <label>Second Priority Program</label>
                    <input value={formatFieldValue(detail, { key: 'program_choice_2' })} disabled readOnly />
                  </div>
                </div>
              </div>

              <hr className="modal-divider" style={{ margin: '0 0 4px' }} />
              <EligibilitySection row={eligibilityRow} onOverride={onEligibilityOverride} overriding={eligibilityOverriding} />

              {/* Submitted Documents & Profile Data -- Ivy's mockup's 4
                  tabbed categories (CATEGORY_DEFS), remapped onto this app's
                  real fields/doc types in app/lib/applicantProfileSchema.js.
                  Each stack shows the applicant's real submitted values plus
                  its verifying document(s), reusing the existing, already-
                  working DocumentReviewCard for the actual verify/flag
                  controls rather than a read-only copy of them. */}
              <div>
                <div className="modal-section-label">Submitted Documents &amp; Profile Data</div>
                <div className="doc-cat-tabs">
                  {PROFILE_CATEGORIES.map((cat) => {
                    const visibleStacks = cat.stacks.filter((s) => !s.showIf || s.showIf(detail))
                    const catDocTypes = visibleStacks.flatMap((s) => s.docTypes)
                    const catDocs = docs.filter((d) => catDocTypes.includes(d.document_type))
                    const catFlagged = catDocs.filter((d) => d.needs_review).length
                    // Stacks that require a document but have none submitted
                    // yet -- the real-data equivalent of Ivy's tab count/
                    // asterisk (her mockup's exact numbers came from her own
                    // mock data, not a documented formula, so this counts
                    // what's actually missing for this applicant instead of
                    // trying to reproduce her specific numbers).
                    const catMissing = visibleStacks.filter(
                      (s) => s.docTypes.length > 0 && docs.filter((d) => s.docTypes.includes(d.document_type)).length === 0
                    ).length
                    const catAttention = catFlagged + catMissing
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setActiveCat(cat.key)}
                        className={`doc-cat-tab${activeCat === cat.key ? ' active' : ''}`}
                      >
                        <span className={`cat-dot${catAttention > 0 ? ' attention' : catDocs.length > 0 ? ' complete' : ''}`} />
                        {cat.label}
                        {catAttention > 0 && (
                          <>
                            <span className="cat-count">({catAttention})</span>
                            <span className="cat-required-asterisk">*</span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="doc-cat-panel">
                  {activeCategory.stacks
                    .filter((stack) => !stack.showIf || stack.showIf(detail))
                    .map((stack, si) => {
                      const stackDocs = docs.filter((d) => stack.docTypes.includes(d.document_type))
                      return (
                        <div key={stack.label} className="doc-cat-stack">
                          <div className="doc-cat-stack-label">
                            <span className="stack-num">{si + 1}</span>
                            {stack.label}
                          </div>
                          {stack.fields.length > 0 && (
                            <ProfileStackFields
                              stack={stack}
                              detail={detail}
                              applicationId={eligibilityRow?.id}
                              onSaved={(app) => {
                                setDetail(app)
                                if (onProfileSaved) onProfileSaved()
                              }}
                            />
                          )}
                          {stack.docTypes.length > 0 && (
                            stackDocs.length > 0 ? (
                              stackDocs.map((doc) => (
                                <DocumentReviewCard key={doc.file_path} doc={doc} onOverride={onOverride} overriding={overriding} />
                              ))
                            ) : (
                              <p className="doc-cat-empty">No document submitted for this yet.</p>
                            )
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Safety net: any submitted document whose type doesn't map
                  to one of the 4 tabbed categories above. Shouldn't happen
                  given VALID_DOCUMENT_TYPES, but better a visible fallback
                  than a silently dropped document. */}
              {(() => {
                const mappedTypes = PROFILE_CATEGORIES.flatMap((c) => c.stacks.flatMap((s) => s.docTypes))
                const leftover = docs.filter((d) => !mappedTypes.includes(d.document_type))
                if (leftover.length === 0) return null
                return (
                  <div>
                    <div className="modal-section-label">Other Documents</div>
                    {leftover.map((doc) => (
                      <DocumentReviewCard key={doc.file_path} doc={doc} onOverride={onOverride} overriding={overriding} />
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Dashboard panel (document review — the app's existing,
// already-working feature, unchanged in behavior) ----------

// Stat cards, in the order/labelling Ivy's admin.html mockup uses, mapped
// onto this app's own real automated eligibility_status values (see
// app/lib/matching.js) rather than the fully-manual counts her mockup had.
// "appealed" counts applicants who filed an Appeal (Retake / Re-application)
// request from Appeals & Rescheduling (Sept 30 2026).
const DASHBOARD_STAT_CARDS = [
  {
    key: 'all',
    label: 'All Applications',
    className: 'stat-all',
    note: 'All applications submitted across the pipeline.',
  },
  {
    key: 'incomplete',
    label: 'Pending for Review',
    className: 'stat-pending',
    note: 'Profile or documents not yet fully submitted/verified.',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    className: 'stat-qualified',
    note: 'Meets requirements for the CCC scholarship program.',
  },
  {
    key: 'not_qualified',
    label: 'Not Qualified',
    className: 'stat-notqualified',
    note: 'Does not currently meet program requirements.',
  },
  {
    key: 'waitlisted',
    label: 'Waitlisted',
    className: 'stat-waitlisted',
    note: 'Meets baseline requirements, pending available slots.',
  },
  {
    key: 'appealed',
    label: 'Appealed',
    className: 'stat-appealed',
    note: 'Filed an appeal for a retake or re-application. See Appeals & Reschedules.',
  },
]

// Department groupings mirror Ivy's admin.html mockup's DEPARTMENTS const
// (mirrors the "Programs Offered" listing on index.html) — kept in the same
// order/labels so the "per Department" breakdown below has the same shape
// as the approved mockup, not a flattened simplification of it.
const DASHBOARD_DEPARTMENTS = [
  {
    label: 'Business and Accounting',
    programs: ['Bachelor of Science in Accounting Information System', 'Bachelor of Science in Accountancy'],
  },
  {
    label: 'Teacher Education',
    programs: [
      'Bachelor of Early Childhood Education',
      'Bachelor of Secondary Education Major in Filipino',
      'Bachelor of Secondary Education Major in English',
      'Bachelor of Elementary Education',
      'Bachelor of Secondary Education Major in Social Studies',
      'Bachelor of Secondary Education Major in Science',
      'Bachelor of Secondary Education Major in Mathematics',
    ],
  },
  {
    label: 'Computing and Informatics',
    programs: ['Bachelor of Science in Computer Science', 'Bachelor of Science in Information Technology'],
  },
  {
    label: 'Arts and Sciences',
    programs: ['Bachelor of Science in Psychology'],
  },
]

// Year Level groupings mirror the mockup's YEAR_LEVELS const — same values
// as the real applying_as options (SelectField in ApplicantAuth.js / page.js).
const DASHBOARD_YEAR_LEVELS = [
  { label: 'First Year', value: 'First Year' },
  { label: 'Transferee', value: 'Transferee' },
  { label: 'Old Curriculum & ALS Completer', value: 'Old Curriculum and ALS Completer' },
]

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
  onProfileSaved,
}) {
  const locks = useApplicantLocks()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')
  // Sept 30 2026: real appeal count for the Appealed card (applicants with
  // at least one Appeal request). Best effort: 0 if it can't load.
  const [appealCount, setAppealCount] = useState(0)
  useEffect(() => {
    fetch('/api/admin-reschedule')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return
        const who = new Set(
          (data.requests || [])
            .filter((r) => (r.request_type || '').startsWith('Appeal'))
            .map((r) => r.applicant_user_id || r.applicant_email || r.applicant_name)
        )
        setAppealCount(who.size)
      })
      .catch(() => {})
  }, [])
  const [deptOpen, setDeptOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  // Click-to-sort for the two breakdown tables. null = mockup's default
  // department/program order. For the dept table, sorting only reorders
  // programs WITHIN each department (breaking the grouping to sort the
  // whole table flat would defeat the point of having departments at all).
  // For the year-level table there's no single "Qualified" column to sort
  // by -- it's a per-year-level matrix -- so each of its three count
  // columns is independently sortable instead.
  const [deptSortDesc, setDeptSortDesc] = useState(false)
  const [yearSortKey, setYearSortKey] = useState(null) // null | a DASHBOARD_YEAR_LEVELS value

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
  // purely manual per-applicant stat cards — see the module-level comment
  // on ELIGIBILITY_META above.
  const eligibilityCounts = useMemo(() => {
    const counts = { qualified: 0, waitlisted: 0, not_qualified: 0, pending_exam: 0, incomplete: 0 }
    for (const row of eligibility || []) {
      const status = row.eligibility_override || row.eligibility_status || 'incomplete'
      if (status in counts) counts[status] += 1
    }
    return counts
  }, [eligibility])

  const statCardCounts = {
    all: (eligibility || []).length,
    incomplete: eligibilityCounts.incomplete,
    qualified: eligibilityCounts.qualified,
    not_qualified: eligibilityCounts.not_qualified,
    waitlisted: eligibilityCounts.waitlisted,
    appealed: appealCount,
  }

  const programOptions = useMemo(() => {
    const set = new Set()
    for (const row of eligibility || []) {
      if (row.program_choice_1) set.add(row.program_choice_1)
    }
    return Array.from(set).sort()
  }, [eligibility])

  // "Qualified Applicants per Department/Year Level" — mirrors Ivy's
  // admin.html mockup's DEPARTMENTS/YEAR_LEVELS groupings and
  // choice1-or-choice2 counting exactly (see DASHBOARD_DEPARTMENTS/
  // DASHBOARD_YEAR_LEVELS above), rendered as real tables like hers rather
  // than a bar-row simplification. Filtered down to applicants currently
  // Qualified, same as hers.
  // Qualified applicants counted for a program whenever it's EITHER of their
  // two program choices — matches Ivy's mockup (renderDepartmentStats /
  // renderYearLevelStats both check choice1 and choice2), not just choice 1.
  const qualifiedRows = useMemo(
    () => (eligibility || []).filter((row) => (row.eligibility_override || row.eligibility_status || 'incomplete') === 'qualified'),
    [eligibility]
  )

  // "per Department": department-grouped rows (rowSpan on the department
  // cell), one row per program — same shape as buildBreakdownRows() in the
  // mockup. When deptSortDesc is on, programs within each department are
  // reordered by count descending — the department grouping itself never
  // gets flattened, so "which program has the most" stays answerable
  // without losing the department context the table exists to show.
  const deptBreakdown = useMemo(() => {
    return DASHBOARD_DEPARTMENTS.map((dept) => {
      const programs = dept.programs.map((program) => ({
        label: program,
        count: qualifiedRows.filter((row) => row.program_choice_1 === program || row.program_choice_2 === program).length,
      }))
      if (deptSortDesc) programs.sort((a, b) => b.count - a.count)
      return { label: dept.label, programs }
    })
  }, [qualifiedRows, deptSortDesc])

  // "per Year Level": one row per program (flat, same order as the mockup's
  // allPrograms unless yearSortKey is set), one column per year level — the
  // same pivoted matrix as renderYearLevelStats(). Since there's no single
  // "Qualified" column here (it's a matrix), each year-level column header
  // is independently clickable to sort the whole table by that column.
  const yearBreakdown = useMemo(() => {
    const allPrograms = DASHBOARD_DEPARTMENTS.reduce((acc, d) => acc.concat(d.programs), [])
    const rows = allPrograms.map((program) => {
      const matched = qualifiedRows.filter((row) => row.program_choice_1 === program || row.program_choice_2 === program)
      const levels = DASHBOARD_YEAR_LEVELS.map((yl) => ({
        label: yl.label,
        value: yl.value,
        count: matched.filter((row) => row.applying_as === yl.value).length,
      }))
      return { label: program, levels }
    })
    if (yearSortKey) {
      rows.sort((a, b) => {
        const bCount = b.levels.find((l) => l.value === yearSortKey)?.count || 0
        const aCount = a.levels.find((l) => l.value === yearSortKey)?.count || 0
        return bCount - aCount
      })
    }
    return rows
  }, [qualifiedRows, yearSortKey])

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = docs.filter((d) => {
      const key = (d.applicant_name || '').trim().toLowerCase()
      const eligRow = eligibilityByName.get(key)

      if (statusFilter !== 'all') {
        const status = eligRow?.eligibility_override || eligRow?.eligibility_status || 'incomplete'
        if (status !== statusFilter) return false
      }
      if (programFilter !== 'all' && eligRow?.program_choice_1 !== programFilter) return false
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
  }, [docs, search, statusFilter, programFilter, eligibilityByName])

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            A summary of applicant statuses across the scholarship pipeline. Available to all types of Admins.
            {totalFlagged > 0 && ` · ${totalFlagged} document${totalFlagged === 1 ? '' : 's'} need review`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRecomputeEligibility}
          disabled={recomputing}
          title="Recomputes eligibility for every applicant from their current data — needed for anyone who fully submitted before this feature existed, since a locked application never triggers a new save on its own."
          className="mbtn mbtn-ghost mbtn-sm"
        >
          {recomputing ? 'Recomputing…' : 'Recompute all'}
        </button>
      </div>

      {/* ── SCHOLARSHIP ELIGIBILITY: stat cards, click-to-filter (a real
          working version of the mockup's "CLICK TO VIEW LIST" links --
          clicking one sets statusFilter and jumps straight to the matching
          slice of the All Applicants table below). ── */}
      <div className="stat-grid">
        {DASHBOARD_STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className={`stat-card ${card.className}`}
            onClick={() => card.key !== 'appealed' && setStatusFilter(card.key === 'all' ? 'all' : card.key)}
          >
            <p className="stat-label">{card.label}</p>
            <p className="stat-value">{statCardCounts[card.key]}</p>
            <p className="stat-note">{card.note}</p>
            {card.key !== 'appealed' && (
              <p className="stat-card-hint">
                <IconSearch className="w-3 h-3" /> Click to view list
              </p>
            )}
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

      {/* ── All Applicants — moved above the breakdown reports (Sept 22 2026).
          This is the actual daily work queue (search, open a record, the
          stat cards' "Click to view list" links jump straight here) so it
          belongs right after the KPI summary, not after two read-only
          report tables. Deviates from the mockup's literal top-to-bottom
          order -- flagged and agreed with Pau first since it touches how
          Ivy's Dashboard module is laid out, same as the department/
          year-level table content itself did earlier. The report tables
          below are unchanged in content/structure, just relocated. ── */}
      <div className="card">
        <div className="card-title">
          All Applicants
          {statusFilter !== 'all' && (
            <span className="tag">
              Filtered: {DASHBOARD_STAT_CARDS.find((c) => c.key === statusFilter)?.label}
            </span>
          )}
        </div>

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or document type..."
          />
          <select
            className="program-filter-select"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
          >
            <option value="all">All programs</option>
            {programOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {statusFilter !== 'all' && (
            <>
              <div className="filter-divider" />
              <button type="button" className="filter-clear" onClick={() => setStatusFilter('all')}>
                Clear status filter
              </button>
            </>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-ccc-muted text-sm">Loading documents...</div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 text-ccc-muted text-sm">
            {docs.length === 0 ? 'No documents uploaded yet.' : 'No applicants match your filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g, i) => (
              <ApplicantGroup
                key={g.name ? g.name.toLowerCase() : `unknown-${i}`}
                name={g.name}
                email={g.email}
                docs={g.docs}
                onOverride={onOverride}
                overriding={overriding}
                eligibilityRow={eligibilityByName.get((g.name || '').trim().toLowerCase())}
                onEligibilityOverride={onEligibilityOverride}
                eligibilityOverriding={eligibilityOverriding}
                onProfileSaved={onProfileSaved}
                lockInfo={locks[eligibilityByName.get((g.name || '').trim().toLowerCase())?.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Reports: Qualified Applicants per Department / per Year Level ──
          Same tables, same data, same collapsed-by-default state as the
          mockup -- just moved below the work queue instead of between the
          KPIs and it, plus a section label so this reads as its own
          "reference data" zone rather than a random interruption. ── */}
      <div className="dashboard-section-label">Reports</div>
      <div className="qualified-breakdown-columns">
        <div className="qualified-breakdown-col">
          <div className={`dept-divider${deptOpen ? ' expanded' : ''}`} onClick={() => setDeptOpen((v) => !v)}>
            Qualified Applicants per Department
            <span className="dept-divider-arrow">&#9662;</span>
          </div>
          <p className="dept-helper-text">
            &ldquo;Department&rdquo; isn&rsquo;t a field this system collects — grouped by the same
            program-to-department mapping as the approved mockup, applied to each applicant&rsquo;s Program (Course)
            choices.
          </p>
          <div className={`dept-section-body${deptOpen ? '' : ' collapsed'}`}>
            <div className="breakdown-table-wrap">
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th className="bd-group">Department</th>
                    <th className="bd-program">Program</th>
                    <th
                      className={`bd-count bd-count-sortable${deptSortDesc ? ' bd-sorted' : ''}`}
                      onClick={() => setDeptSortDesc((v) => !v)}
                      title={deptSortDesc ? 'Sorted highest first within each department — click to reset' : 'Click to sort each department by Qualified, highest first'}
                    >
                      Qualified {deptSortDesc ? '▼' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deptBreakdown.map((dept) =>
                    dept.programs.map((p, i) => (
                      <tr key={p.label} className={p.count === 0 ? 'bd-row-zero' : ''}>
                        {i === 0 && (
                          <td className="bd-group" rowSpan={dept.programs.length}>
                            {dept.label}
                          </td>
                        )}
                        <td className="bd-program">{p.label}</td>
                        <td className={`bd-count${p.count > 0 ? ' bd-count-has' : ''}`}>{p.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="qualified-breakdown-col">
          <div className={`dept-divider${yearOpen ? ' expanded' : ''}`} onClick={() => setYearOpen((v) => !v)}>
            Qualified Applicants per Year Level
            <span className="dept-divider-arrow">&#9662;</span>
          </div>
          <p className="dept-helper-text">
            No literal &ldquo;Year Level&rdquo; field exists yet — grouped by Applying As, the closest real proxy.
          </p>
          <div className={`dept-section-body${yearOpen ? '' : ' collapsed'}`}>
            <div className="breakdown-table-wrap">
              <table className="breakdown-table year-breakdown-table">
                <thead>
                  <tr>
                    <th className="bd-program">Program</th>
                    {DASHBOARD_YEAR_LEVELS.map((yl) => (
                      <th
                        key={yl.label}
                        className={`bd-count bd-count-sortable${yearSortKey === yl.value ? ' bd-sorted' : ''}`}
                        onClick={() => setYearSortKey((v) => (v === yl.value ? null : yl.value))}
                        title={yearSortKey === yl.value ? 'Sorted highest first — click to reset' : `Click to sort all programs by ${yl.label}, highest first`}
                      >
                        {yl.label} {yearSortKey === yl.value ? '▼' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearBreakdown.map((p) => (
                    <tr key={p.label} className={p.levels.every((lvl) => lvl.count === 0) ? 'bd-row-zero' : ''}>
                      <td className="bd-program">{p.label}</td>
                      {p.levels.map((lvl) => (
                        <td key={lvl.label} className={`bd-count${lvl.count > 0 ? ' bd-count-has' : ''}`}>
                          {lvl.count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Applicant Information & Results panel (Sept 21 2026) ----------
// Ivy's former module. Self-fetching, same pattern as CommunicationsPanel
// below rather than threaded through the top-level component's state, since
// nothing else on the page needs this data. See app/api/admin-results/route.js
// and app/lib/matching.js for the Appendix D grounding behind every status.

// Sept 24, 2026: className values switched from ad hoc Tailwind to the
// shared .badge/.badge-* tokens from admin-theme.css (same ones the
// Dashboard/Document review badges already use), part of the Applicant
// Results panel's design-parity pass. badge-orange (gold) covers both
// probationary statuses to match the gold treatment they had before.
const SCHOLAR_STATUS_META = {
  pending_exam: { label: 'Pending Exam', className: 'badge-progress' },
  passer: { label: 'Passer', className: 'badge-verified' },
  waitlisted_probationary: { label: 'Waitlisted (Probationary)', className: 'badge-orange' },
  qualified_probationary: { label: 'Qualified (Probationary)', className: 'badge-orange' },
  disqualified: { label: 'Disqualified', className: 'badge-deficient' },
  forfeited: { label: 'Forfeited', className: 'badge-deficient' },
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

// Distribution steps that have an applicant notice (Sept 30 2026).
const ENDORSEMENT_NOTICE_STEPS = ['endorsed_registrar', 'endorsed_medical', 'endorsed_admissions', 'enrollment_complete']

const DISTRIBUTION_STATUS_STEPS = [
  ['pending_endorsement', 'Pending Endorsement'],
  ['endorsed_registrar', 'Endorsed to Registrar'],
  ['endorsed_medical', 'Endorsed to Medical'],
  ['endorsed_admissions', 'Endorsed to Admissions'],
  ['enrollment_complete', 'Enrollment Complete'],
]

function ScholarStatusBadge({ status }) {
  const meta = SCHOLAR_STATUS_META[status] || SCHOLAR_STATUS_META.pending_exam
  return <span className={`badge ${meta.className}`}>{meta.label}</span>
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


// ---------- Result notice (Sept 30 2026, item 5) ----------
// Admin-triggered release of one applicant's result: a private portal
// message always, plus an email only if the applicant opted in. Follows Ivy's
// admin.html confirm-and-edit step (Email / Subject / Message, each with an
// Edit toggle). Nothing is sent until the admin clicks "Send".
function ResultNoticeBox({ row, onSent, kind = 'result' }) {
  // Sept 30 2026: the same box also sends endorsement notices (kind
  // 'endorsement', progress table row "Real-time Result Notifications
  // (Pass/Fail/Endorsement)"), driven by Distribution Status instead of
  // Scholar Status.
  const cfg = kind === 'endorsement'
    ? {
        api: '/api/admin-endorsement-notice',
        title: 'Send Endorsement Notice to Applicant',
        current: row.distribution_status,
        releasable: ENDORSEMENT_NOTICE_STEPS.includes(row.distribution_status) && !!row.result_notified_at,
        notReady: !row.result_notified_at
          ? 'Send the applicant their result first.'
          : 'Nothing to send yet. Move the applicant to an endorsement step above first.',
        lastStatus: row.endorsement_notified_status,
        lastAt: row.endorsement_notified_at,
        lastBy: row.endorsement_notified_by,
        lastEmail: row.endorsement_email_sent,
        label: (v) => DISTRIBUTION_STATUS_STEPS.find(([k]) => k === v)?.[1] || v,
      }
    : {
        api: '/api/admin-result-release',
        title: 'Send Result to Applicant',
        current: row.scholar_status,
        releasable: ['passer', 'waitlisted_probationary', 'qualified_probationary', 'forfeited', 'disqualified'].includes(row.scholar_status),
        notReady: 'Nothing to send yet. Record the exam result first.',
        lastStatus: row.result_notified_status,
        lastAt: row.result_notified_at,
        lastBy: row.result_notified_by,
        lastEmail: row.result_email_sent,
        label: (v) => SCHOLAR_STATUS_META[v]?.label || v,
      }
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [editSubject, setEditSubject] = useState(false)
  const [editMessage, setEditMessage] = useState(false)
  const [needsResend, setNeedsResend] = useState(false)

  const releasable = cfg.releasable

  const openBox = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    setNotice('')
    setNeedsResend(false)
    setEditSubject(false)
    setEditMessage(false)
    try {
      const res = await fetch(cfg.api + '?id=' + encodeURIComponent(row.id))
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not prepare the message.')
      setDraft(data)
      setSubject(data.subject)
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const closeBox = () => {
    setOpen(false)
    setDraft(null)
    setError('')
    setNeedsResend(false)
  }

  const send = async (resend) => {
    setSending(true)
    setError('')
    try {
      const res = await fetch(cfg.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, subject, message, resend: !!resend }),
      })
      const data = await res.json()
      if (res.status === 409 && data.alreadySent) {
        setNeedsResend(true)
        return
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not send.')
      setNotice(data.emailNote || (data.emailSent ? "Sent to the applicant's portal and email." : "Sent to the applicant's portal."))
      closeBox()
      if (onSent) await onSent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
  }

  return (
    <div className="rounded-xl border border-ccc-border p-3.5 space-y-2.5">
      <div className="modal-section-label" style={{ marginBottom: '4px' }}>
        <span>{cfg.title}</span>
        {releasable && !open && (
          <button type="button" className="section-edit-btn" onClick={openBox}>
            {cfg.lastAt ? 'Send again' : 'Notify applicant'}
          </button>
        )}
      </div>

      {cfg.lastAt ? (
        <p className="text-[11px] text-ccc-muted">
          Last sent: {cfg.label(cfg.lastStatus)}, {fmt(cfg.lastAt)}
          {cfg.lastBy ? ' by ' + cfg.lastBy : ''}
          {cfg.lastEmail ? ' (portal message and email)' : ' (portal message only)'}
          {cfg.lastStatus && cfg.lastStatus !== cfg.current ? '. The status has changed since then.' : '.'}
        </p>
      ) : (
        <p className="text-[11px] text-ccc-muted">
          {releasable ? 'Not sent yet.' : cfg.notReady}
        </p>
      )}
      <AdminToast message={notice} onDone={() => setNotice('')} />

      {open && (
        <div className="confirm-inline show">
          {loading ? (
            <p>Preparing the message...</p>
          ) : !draft ? (
            <>
              <p style={{ color: 'var(--red, #b91c1c)' }}>{error}</p>
              <div className="confirm-inline-actions">
                <button type="button" className="mbtn mbtn-ghost mbtn-sm" onClick={closeBox}>Close</button>
              </div>
            </>
          ) : (
            <>
              <p>
                This sends a private message to the applicant&apos;s portal
                {draft.emailOptIn ? ' and an email.' : '. This applicant did not opt in to email, so only the portal message will be sent.'}
              </p>
              <div className="email-fields">
                <div className="email-field-row">
                  <label>Email</label>
                  <div className="email-field-input-wrap">
                    <input className="email-field-input" type="text" value={draft.to || '(no email on file)'} disabled readOnly />
                  </div>
                </div>
                <div className="email-field-row">
                  <label>Subject</label>
                  <div className="email-field-input-wrap">
                    <input className="email-field-input" type="text" value={subject} maxLength={150}
                      disabled={!editSubject} onChange={(e) => setSubject(e.target.value)} />
                    <button type="button" className="mbtn mbtn-ghost mbtn-sm email-field-edit-btn" onClick={() => setEditSubject((v) => !v)}>
                      {editSubject ? 'Done' : 'Edit'}
                    </button>
                  </div>
                </div>
                <div className="email-field-row">
                  <label>Message</label>
                  <div className="email-field-input-wrap">
                    <textarea className="email-field-input" rows={8} value={message} maxLength={4000}
                      disabled={!editMessage} onChange={(e) => setMessage(e.target.value)} />
                    <button type="button" className="mbtn mbtn-ghost mbtn-sm email-field-edit-btn" onClick={() => setEditMessage((v) => !v)}>
                      {editMessage ? 'Done' : 'Edit'}
                    </button>
                  </div>
                </div>
              </div>
              {!draft.resultsVisible && (
                <p style={{ color: 'var(--red, #b91c1c)' }}>
                  Exam results are hidden from applicants right now. Turn on &ldquo;Exam Results Visible to Applicants&rdquo; in System &amp; Activity first.
                </p>
              )}
              {needsResend && (
                <p>This applicant was already sent this same result. Send it again?</p>
              )}
              {error && <p style={{ color: 'var(--red, #b91c1c)' }}>{error}</p>}
              <div className="confirm-inline-actions">
                <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={sending} onClick={closeBox}>Cancel</button>
                <button type="button" className="mbtn mbtn-primary mbtn-sm" disabled={sending || !draft.resultsVisible || !subject.trim() || !message.trim()}
                  onClick={() => send(needsResend)}>
                  {sending ? 'Sending...' : needsResend ? 'Yes, send again' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultRow({ row, onSaveExam, onSetScholarStatus, onAdvanceDistribution, onReload, busy, lockInfo }) {
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

  // Sept 24 2026: collapsed-row + click-to-open-modal, replacing the old
  // always-expanded card. Live testing (Pau, Sept 24) found a scrolling
  // list of fully-expanded Step 1/Step 2/Distribution Status sections per
  // applicant overwhelming to scan. Mirrors ApplicantGroup's existing
  // pattern above (Dashboard panel) for consistency across the admin
  // console -- that panel deliberately moved to this same collapsed-row +
  // modal shape on Sept 22 for the same reason (an inline accordion with
  // the first row forced open read as broken/random). No new data fetch
  // needed here, unlike ApplicantGroup's lazy detail fetch -- ResultsPanel
  // already loads every field this modal shows up front.
  const { modalOpen, openModal, closeModal, blockedMsg, setBlockedMsg, opening } = useLockedModal(row.id)
  const lockedByOther = !!lockInfo && !lockInfo.mine && !modalOpen

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={opening}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-ccc-border bg-white shadow-sm hover:bg-ccc-off hover:border-ccc-blue/40 transition-colors${lockedByOther ? ' opacity-60' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-ccc-navy flex items-center justify-center text-sm font-bold text-white shrink-0">
            {row.applicant_name ? row.applicant_name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-ccc-navy truncate" style={{ fontFamily: 'var(--font-montserrat)' }}>
              {row.applicant_name || 'Unknown applicant'}
            </p>
            <p className="text-[11px] text-ccc-muted truncate">
              {row.applicant_email || 'No email on file'}
              {row.application_number && ` · ${row.application_number}`}
              {row.program_choice_1 && ` · ${row.program_choice_1}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lockedByOther && (
            <span className="rounded-full border border-ccc-border bg-ccc-off text-ccc-muted text-[10px] font-bold px-2 py-0.5">
              &#128274; Being reviewed by {lockInfo.admin_name || 'another admin'}
            </span>
          )}
          <ScholarStatusBadge status={row.scholar_status || 'pending_exam'} />
        </div>
      </button>
      <LockedNotice lockInfo={null} blockedMsg={blockedMsg} onDismiss={() => setBlockedMsg('')} />

      {!modalOpen ? null : (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
        onClick={() => closeModal()}
      >
        <div
          className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-ccc-border overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tinted header band -- same treatment as ApplicantGroup's modal
              above, for visual consistency between the two panels. */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-4 border-b border-ccc-border"
            style={{ background: 'linear-gradient(135deg, #eef3fd 0%, #ffffff 100%)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-ccc-navy flex items-center justify-center text-base font-bold text-white shrink-0">
                {row.applicant_name ? row.applicant_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-ccc-navy truncate" style={{ fontFamily: 'var(--font-montserrat)' }}>
                  {row.applicant_name || 'Unknown applicant'}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {row.application_number && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ccc-blue bg-white/70 border border-ccc-blue/30 rounded-full px-2 py-0.5 shrink-0">
                      {row.application_number}
                    </span>
                  )}
                  <span className="text-[11px] text-ccc-muted truncate">{row.applicant_email || 'No email on file'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ScholarStatusBadge status={row.scholar_status || 'pending_exam'} />
              <button
                type="button"
                onClick={() => closeModal()}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-ccc-muted hover:bg-white hover:text-ccc-navy transition-colors"
              >
                &#10005;
              </button>
            </div>
          </div>

          <div className="px-5 pb-5 pt-4 space-y-4 max-h-[75vh] overflow-y-auto">
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

      <NextStepHint row={row} />

      {/* Exam Score Entry and Verification */}
      <div className="rounded-xl border border-ccc-border bg-ccc-off/40 p-3.5 space-y-2.5">
        <div>
          <span className="modal-section-label" style={{ marginBottom: '4px' }}>Step 1 · Entrance Exam</span>
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
                <strong>{examSuggestion.suggested === 'passed' ? 'Passed' : 'Failed'}</strong>. This doesn&rsquo;t
                auto-fill Result, so pick it above to confirm.
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
          <span className="modal-section-label" style={{ marginBottom: '4px' }}>Step 2 · Manual Override</span>
          <p className="text-[10.5px] text-ccc-muted">
            Only for a real judgment call the exam result itself doesn&rsquo;t decide (Appendix D: a probationary contract, or a
            later disqualification/forfeiture reason). Fires immediately, independent of Step 1 above.
          </p>
        </div>
        {hasUnsavedExamChanges && (
          <div className="rounded-lg border border-ccc-orange/50 bg-orange-100 px-3 py-2 text-[11px] font-semibold text-ccc-orange">
            You have unsaved changes in the Entrance Exam section above. Clicking a button below will NOT save those, so
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

      <ResultNoticeBox row={row} onSent={onReload} />

      {/* Distribution Status Tracking and Statement of Subsequent Actions --
          only meaningful once a passer/qualified-probationary status exists
          (Appendix D: Registrar -> Medical or Admissions -> enrollment). The
          "statement" itself is the audit_log trail each button click writes. */}
      <div className="rounded-xl border border-ccc-border p-3.5 space-y-2.5">
        <div className="modal-section-label" style={{ marginBottom: '4px' }}>
          <span>Distribution Status</span>
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
              Not applicable yet. Becomes available once this applicant is a Passer or Qualified (Probationary).
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

      {canDistribute && <ResultNoticeBox row={row} onSent={onReload} kind="endorsement" />}
          </div>
        </div>
      </div>
      )}
    </>
  )
}

function ResultsPanel() {
  const locks = useApplicantLocks()
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
  const load = async (silent) => {
    if (!silent) setLoading(true)
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
      // Oct 1 2026: quiet reload, so the applicant's window stays open behind
      // the pop-up instead of the list flashing to "Loading..." and closing it.
      await load(true)
      const name = rows.find((r) => r.id === payload.id)?.applicant_name || 'the applicant'
      if (payload.field === 'exam') {
        showAdminNotice(`Exam result saved and verified for ${name}. Scholar Status was updated to match.`)
      } else if (payload.field === 'scholar_status') {
        showAdminNotice(`${name}'s Scholar Status was set to ${SCHOLAR_STATUS_OVERRIDE_LABELS[payload.scholarStatus] || payload.scholarStatus}.`)
      } else if (payload.field === 'distribution_status') {
        const step = DISTRIBUTION_STATUS_STEPS.find(([k]) => k === payload.distributionStatus)?.[1]
        showAdminNotice(
          step ? `${name}'s Distribution Status was set to ${step}.` : `${name}'s Distribution Status was cleared.`
        )
      }
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

  // Sept 24 2026, per Pau's live testing feedback: a filter for whether an
  // applicant has an application_number, labeled by what that actually
  // means rather than the raw column name. application_number is only ever
  // assigned once every required document is on file (see
  // maybeAssignApplicationNumber() in app/api/application/route.js) and
  // never revoked, so "Documents Complete"/"Documents Incomplete" is an
  // accurate, not just convenient, label for this.
  const [docFilter, setDocFilter] = useState('all') // 'all' | 'complete' | 'incomplete'

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = rows
    if (docFilter === 'complete') list = list.filter((r) => !!r.application_number)
    if (docFilter === 'incomplete') list = list.filter((r) => !r.application_number)
    if (term) {
      list = list.filter((r) =>
        `${r.applicant_name || ''} ${r.applicant_email || ''} ${r.application_number || ''}`.toLowerCase().includes(term)
      )
    }
    // "Needs action first" default ordering, per Pau's Sept 24 request --
    // reuses getNextStepHint()'s own tone classification instead of
    // inventing a second "needs action" definition that could drift out of
    // sync with the colored hint banner each card already shows. 'go' means
    // genuinely actionable right now (ready for exam entry, or ready to
    // advance distribution status); 'wait'/'stop'/'done' need nothing from
    // an admin at this moment. Alphabetical by name within each group.
    const priority = { go: 0, wait: 1, stop: 2, done: 3 }
    return [...list].sort((a, b) => {
      const pa = priority[getNextStepHint(a).tone] ?? 1
      const pb = priority[getNextStepHint(b).tone] ?? 1
      if (pa !== pb) return pa - pb
      return (a.applicant_name || '').localeCompare(b.applicant_name || '')
    })
  }, [rows, search, docFilter])

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Applicant Results</h1>
          <p>
            Individual applicant profile view for exam score entry, scholar status, and post-passing distribution
            tracking. Only applicants who have submitted an application (and so have an eligibility profile) appear here.
          </p>
        </div>
      </div>

      {/* Oct 1 2026 reskin: same card + filter bar as the Dashboard's All
          Applicants card, so the two lists look and behave alike. Rows and
          the pop-up are unchanged. */}
      <div className="card">
        <div className="card-title">
          All Applicants
          {!loading && (
            <span className="tag">
              {filtered.length} applicant{filtered.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or application number..."
          />
          <select className="program-filter-select" value={docFilter} onChange={(e) => setDocFilter(e.target.value)}>
            <option value="all">All documents</option>
            <option value="complete">Documents Complete</option>
            <option value="incomplete">Documents Incomplete</option>
          </select>
          {(search.trim() !== '' || docFilter !== 'all') && (
            <>
              <div className="filter-divider" />
              <button
                type="button"
                className="filter-clear"
                onClick={() => {
                  setSearch('')
                  setDocFilter('all')
                }}
              >
                &times; Clear filters
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-20 text-ccc-muted text-sm">Loading applicants...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-ccc-muted text-sm">
            {rows.length === 0 ? 'No applications on file yet.' : 'No applicants match your search and filter.'}
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
              onReload={() => load(true)}
              busy={busy}
              lockInfo={locks[row.id]}
              />
            ))}
          </div>
        )}
      </div>
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

// Sept 24 2026: single 100%-stacked bar + legend, replacing a column of
// separate BarRow bars for part-to-whole data (every applicant has exactly
// one eligibility status / one scholar status, so these always sum to the
// same total). Five-to-six bars each independently scaled against that
// same total made it hard to see at a glance that they add up to a whole,
// and repeated the total that many times. One stacked bar with a legend
// (colored dot + label + count + percent) reads as one whole made of
// parts instead. Segment colors reuse the same status color mapping the
// rest of the admin console already uses (green=good, gold=warning,
// red=critical, blue=neutral/pending, gray=unresolved/incomplete) rather
// than introducing a second color scheme.
function StackedBar({ segments, total }) {
  const visible = segments.filter((s) => s.count > 0)
  return (
    <div className="space-y-3">
      <div className="flex w-full h-6 rounded-full overflow-hidden bg-ccc-off" style={{ gap: '2px' }}>
        {total > 0 && visible.length > 0 ? (
          visible.map((s) => (
            <div
              key={s.label}
              className={s.colorClass}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            />
          ))
        ) : (
          <div className="w-full bg-ccc-off" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.colorClass}`} />
            <span className="text-ccc-text font-medium">{s.label}</span>
            <span className="text-ccc-muted">
              {s.count} ({total > 0 ? Math.round((s.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Sept 30 2026: appeals count (progress table "... Appeals, and Waitlisted
  // Analytics"). Best effort, 0 if it can't load.
  const [appealCount, setAppealCount] = useState(0)
  useEffect(() => {
    fetch('/api/admin-reschedule')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return
        const who = new Set(
          (data.requests || [])
            .filter((r) => (r.request_type || '').startsWith('Appeal'))
            .map((r) => r.applicant_user_id || r.applicant_email || r.applicant_name)
        )
        setAppealCount(who.size)
      })
      .catch(() => {})
  }, [])

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
      <div className="portal-header">
        <div>
          <h1>Statistics</h1>
          <p>
            Allowance monitoring and exportable LGU compliance reports aren&rsquo;t built here -- the manuscript
            itself marks both as to-follow modules, out of scope for this version.
          </p>
        </div>
        {/* Sept 24 2026: the headline number gets its own tile instead of
            being buried in a sentence -- a dashboard's lead number should
            read in one glance, not require reading a paragraph. */}
        <div className="rounded-2xl border border-ccc-border bg-white px-5 py-3 text-right shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-ccc-muted" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Total Applications
          </div>
          <div className="text-2xl font-extrabold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            {stats.total}
          </div>
        </div>
      </div>

      {/* Sept 24 2026: the four cards below answer two different questions
          (how many applied to what, vs where do they stand) but read as one
          undifferentiated 2x2 grid without a lead-in -- same section-label
          pattern the Dashboard panel already uses for its own breakdown
          tables, reused here rather than inventing new CSS. */}
      <div className="dashboard-section-label" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
        Application Volume
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">By Program (Course)</div>
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

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">By Applying As (nearest proxy for Year Level)</div>
          {stats.byApplyingAs.length === 0 ? (
            <p className="text-[11px] text-ccc-muted">No data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.byApplyingAs.map(([label, count]) => (
                <BarRow key={label} label={label} count={count} total={stats.total} colorClass="bg-ccc-gold" />
              ))}
            </div>
          )}
          <p className="text-[10px] text-ccc-muted pt-3 mt-1 border-t border-ccc-border">
            No dedicated &ldquo;Department&rdquo; or literal &ldquo;Year Level&rdquo; field exists anywhere in the
            system yet, so those two aren&rsquo;t charted here rather than invented from a guess.
          </p>
        </div>

      </div>

      <div className="dashboard-section-label">Status Breakdown</div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="card" style={{ marginBottom: 0 }}>
          {/* Shortened from "Ongoing / Qualified / Not Qualified / Waitlisted
              (Scholarship Matching)" -- the legend right below already spells
              out every category, so the heading doesn't need to. */}
          <div className="card-title">Eligibility Status</div>
          <StackedBar
            total={stats.total}
            segments={[
              { label: 'Qualified', count: stats.eligibilityCounts.qualified, colorClass: 'bg-ccc-green' },
              { label: 'Waitlisted', count: stats.eligibilityCounts.waitlisted, colorClass: 'bg-ccc-gold' },
              { label: 'Not Qualified', count: stats.eligibilityCounts.not_qualified, colorClass: 'bg-ccc-red' },
              { label: 'Pending Exam', count: stats.eligibilityCounts.pending_exam, colorClass: 'bg-ccc-blue' },
              { label: 'Incomplete (Ongoing)', count: stats.eligibilityCounts.incomplete, colorClass: 'bg-ccc-muted' },
            ]}
          />
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Post-Exam Scholar Status</div>
          <StackedBar
            total={stats.total}
            segments={[
              { label: 'Passer', count: stats.scholarCounts.passer, colorClass: 'bg-ccc-green' },
              {
                label: 'Waitlisted (Probationary)',
                count: stats.scholarCounts.waitlisted_probationary,
                colorClass: 'bg-ccc-gold',
              },
              {
                // Sept 24 2026: split from Waitlisted's gold to bg-ccc-orange --
                // both used the same gold in the old separate-bars layout (fine
                // there, each got its own full bar), but two adjacent segments
                // sharing a color in one stacked bar would visually merge into
                // one blob and defeat the point of stacking them.
                label: 'Qualified (Probationary)',
                count: stats.scholarCounts.qualified_probationary,
                colorClass: 'bg-ccc-orange',
              },
              { label: 'Disqualified', count: stats.scholarCounts.disqualified, colorClass: 'bg-ccc-red' },
              // Same collision as Waitlisted/Qualified (Probationary) above --
              // Forfeited was also sharing bg-ccc-red with the segment right
              // next to it, so it gets its own color here too.
              { label: 'Forfeited', count: stats.scholarCounts.forfeited, colorClass: 'bg-ccc-muted' },
              { label: 'Pending Exam', count: stats.scholarCounts.pending_exam, colorClass: 'bg-ccc-blue' },
            ]}
          />
          <p className="text-[10px] text-ccc-muted pt-3 mt-1 border-t border-ccc-border">
            Appeals filed (retake or re-application): <b>{appealCount}</b>. Details are in Appeals &amp; Reschedules.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------- Communications panel (real — post + list) ----------
//
// Sept 22 2026: rebuilt to match Ivy's admin.html Communications panel --
// a real Type split (public Announcement vs private, targeted Message),
// a fixed category dropdown instead of free text, and Send To targeting
// (All Applicants / one Specific Applicant / a Category of Applicants --
// mapped onto this app's real eligibility buckets, see
// docs/migrations/2026-09-22-communications-targeting.sql). One
// deliberate simplification from her mockup: her Message/Body field is a
// full WYSIWYG rich-text editor (Quill) that stores raw HTML; this app
// has no rich-text library wired in yet and storing admin-authored raw
// HTML would need real sanitization before it's safe to render back to
// applicants, so this uses a plain textarea for now -- same information,
// same real send behavior, just not bold/italic/images. Flagged as a
// separate, lower-priority polish item, not blocking the real feature.
const COMM_CATEGORIES = ['General', 'Exam', 'Deficiency', 'Result', 'Others']
const COMM_CATEGORY_LABELS = {
  General: 'General',
  Exam: 'Exam Schedule',
  Deficiency: 'Document Deficiency',
  Result: 'Results & Status',
  Others: 'Others',
}
// Real eligibility buckets (ELIGIBILITY_META above) -- Ivy's mockup only
// has 4 (pending/qualified/waitlisted/not-qualified); this uses the app's
// real 5 so 'Category of Applicants' targeting doesn't silently collapse
// pending_exam and incomplete into one bucket.
const COMM_ELIGIBILITY_CATEGORIES = ['incomplete', 'pending_exam', 'qualified', 'waitlisted', 'not_qualified']

function CommunicationsPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applicants, setApplicants] = useState([])

  const [commType, setCommType] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState('all')
  const [targetApplicationId, setTargetApplicationId] = useState('')
  const [targetCategory, setTargetCategory] = useState('qualified')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

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
    fetch('/api/admin-eligibility')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setApplicants(data.applications)
      })
      .catch(() => {})
  }, [])

  const resetForm = () => {
    setCommType('')
    setTitle('')
    setCategory('General')
    setBody('')
    setTargetType('all')
    setTargetApplicationId('')
    setTargetCategory('qualified')
  }

  const handlePost = async (e) => {
    e.preventDefault()
    if (!commType || !title.trim() || !body.trim()) return
    if (commType === 'message' && targetType === 'specific' && !targetApplicationId) {
      setPostError('Pick which applicant this message goes to.')
      return
    }
    setPosting(true)
    setPostError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          category,
          type: commType,
          targetType: commType === 'message' ? targetType : undefined,
          targetApplicationId: commType === 'message' && targetType === 'specific' ? targetApplicationId : undefined,
          targetCategory: commType === 'message' && targetType === 'category' ? targetCategory : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPostError(data.error || 'Failed to post.')
        return
      }
      const postedType = commType
      resetForm()
      await load()
      showAdminNotice(
        postedType === 'message'
          ? 'Message sent. It now shows in the applicant\u2019s Messages.'
          : 'Announcement posted. Applicants can see it now, and it shows on the guest page.'
      )
    } catch (err) {
      setPostError(err.message)
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete.')
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== id))
      showAdminNotice('Deleted. Applicants no longer see it.')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="portal-header">
        <h1>Communications</h1>
        <p>Manage public announcements and private messages for signed-in applicants.</p>
      </div>

      <div className="card">
        <div className="card-title">New Post</div>
        <form onSubmit={handlePost} className="announce-form">
          <div className="mfield">
            <label htmlFor="commTypeSelect">Type</label>
            <select id="commTypeSelect" value={commType} onChange={(e) => setCommType(e.target.value)}>
              <option value="">Select a type…</option>
              <option value="announcement">Announcement</option>
              <option value="message">Message</option>
            </select>
          </div>

          {!commType && <p className="publish-note">Please choose a communication type. Each option serves a different purpose.</p>}

          {commType && (
            <>
              <div className="comm-scope-note">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <span>
                  {commType === 'announcement' ? (
                    <>
                      <b>Announcements</b> are displayed at the guest (public) page as well as the Applicant Portal,
                      and are received by all applicants.
                    </>
                  ) : (
                    <>
                      <b>Messages</b> are private and never shown on the guest/public page — send to a specific
                      applicant or a category of applicants.
                    </>
                  )}
                </span>
              </div>

              <div className="mfield">
                <label htmlFor="commTitle">Title</label>
                <input
                  id="commTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Scholarship Examination Schedule Released"
                  required
                />
              </div>

              <div className="mfield">
                <label htmlFor="commCategory">Category</label>
                <select id="commCategory" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {COMM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {COMM_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              {commType === 'message' && (
                <>
                  <div className="mfield">
                    <label htmlFor="msgTarget">Send To</label>
                    <select id="msgTarget" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                      <option value="all">All Applicants</option>
                      <option value="specific">Specific Applicant</option>
                      <option value="category">Category of Applicants</option>
                    </select>
                  </div>
                  {targetType === 'specific' && (
                    <div className="mfield">
                      <label htmlFor="msgTargetApplicant">Applicant</label>
                      <select
                        id="msgTargetApplicant"
                        value={targetApplicationId}
                        onChange={(e) => setTargetApplicationId(e.target.value)}
                      >
                        <option value="">Select an applicant…</option>
                        {applicants.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.applicant_name || 'Unknown applicant'}
                            {a.application_number ? ` (${a.application_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {targetType === 'category' && (
                    <div className="mfield">
                      <label htmlFor="msgTargetCategory">Category</label>
                      <select id="msgTargetCategory" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)}>
                        {COMM_ELIGIBILITY_CATEGORIES.map((key) => (
                          <option key={key} value={key}>
                            {ELIGIBILITY_META[key]?.label || key}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="mfield">
                <label htmlFor="commBody">Message</label>
                <textarea
                  id="commBody"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder={commType === 'announcement' ? 'Write the announcement…' : 'Write the message to applicants…'}
                  required
                />
              </div>

              {postError && <p className="text-xs text-ccc-red mb-2">{postError}</p>}
              <button type="submit" disabled={posting} className="mbtn mbtn-primary">
                {posting ? (commType === 'announcement' ? 'Posting…' : 'Sending…') : commType === 'announcement' ? 'Publish Announcement' : 'Send Message'}
              </button>
              <p className="publish-note">
                {commType === 'announcement'
                  ? '📢 This will publish immediately to the Applicant Portal and the public website.'
                  : "📢 This will be sent immediately to the selected recipient(s)' Applicant Portal Messages."}
              </p>
            </>
          )}
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          Posted
          <span className="tag">{items.length} total</span>
        </div>
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading…</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">Nothing posted yet.</p>
        ) : (
          <div>
            {items.map((item) =>
              item.type === 'message' ? (
                <div key={item.id} className="message-item">
                  <div className="message-dot">✉️</div>
                  <div className="message-body">
                    <h4>
                      {item.title}
                      <span className="msg-target-tag">
                        {item.target_type === 'specific'
                          ? applicants.find((a) => a.id === item.target_application_id)?.applicant_name || 'Applicant'
                          : item.target_type === 'category'
                          ? ELIGIBILITY_META[item.target_category]?.label || item.target_category
                          : 'All Applicants'}
                      </span>
                    </h4>
                    <p>{item.body}</p>
                    <span className="message-date">
                      {item.author} · {formatWhen(item.created_at)}
                      {item.category ? ` · ${COMM_CATEGORY_LABELS[item.category] || item.category}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="message-del"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    title="Delete message"
                  >
                    🗑
                  </button>
                </div>
              ) : (
                <div key={item.id} className="announce-item">
                  <div className="announce-dot">📣</div>
                  <div className="announce-body">
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                    <span className="announce-date">
                      {item.author} · {formatWhen(item.created_at)}
                      {item.category ? ` · ${COMM_CATEGORY_LABELS[item.category] || item.category}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="announce-del"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    title="Delete announcement"
                  >
                    🗑
                  </button>
                </div>
              )
            )}
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
  const [myEmail, setMyEmail] = useState('')

  // Sept 29 2026: invite flow. Behavior follows Ivy's admin.html (Invite
  // button, no password field, "re-enter your password" pop-up before
  // Invite and Remove, extended here to Reset too). The system generates a
  // temporary password and emails it; the new admin chooses their own on
  // first sign-in (see app/api/admin-accounts/route.js).
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('admin')
  const [formError, setFormError] = useState('')

  // The pending action waiting for the Super Admin's password:
  // { type: 'invite' | 'reset' | 'remove', account?, title, desc }
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)

  // Result banner after an invite or reset: { tone: 'done' | 'warn', text, tempPassword? }
  const [notice, setNotice] = useState(null)

  const loadAccounts = () => {
    setLoading(true)
    fetch('/api/admin-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAccounts(data.accounts)
        else setError(data.error || 'Failed to load admin accounts.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAccounts()
    fetch('/api/admin-session')
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) setMyEmail((data.email || '').toLowerCase())
      })
      .catch(() => {})
  }, [])

  const openConfirm = (action) => {
    setConfirmPassword('')
    setShowConfirmPassword(false)
    setConfirmError('')
    setConfirmAction(action)
  }

  const closeConfirm = () => {
    if (confirmBusy) return
    setConfirmAction(null)
    setConfirmPassword('')
    setConfirmError('')
  }

  const requestInvite = (e) => {
    e.preventDefault()
    setFormError('')
    setNotice(null)
    if (!newName.trim() || !newEmail.trim()) {
      setFormError('Please enter a full name and email.')
      return
    }
    openConfirm({
      type: 'invite',
      title: 'Confirm Invite',
      desc: `Re-enter your password to invite ${newName.trim()} (${newEmail.trim()}) as ${
        newRole === 'super_admin' ? 'a Super Admin' : 'an Admin'
      }.`,
    })
  }

  const requestReset = (acc) => {
    setNotice(null)
    openConfirm({
      type: 'reset',
      account: acc,
      title: 'Reset Password',
      desc: `Re-enter your password to email ${acc.name} a new temporary password. Their current password will stop working.`,
    })
  }

  const requestRemove = (acc) => {
    setNotice(null)
    openConfirm({
      type: 'remove',
      account: acc,
      title: 'Remove Admin',
      desc: `Re-enter your password to remove ${acc.name} (${acc.email}). This can\u2019t be undone.`,
    })
  }

  const describeTempResult = (data, name) => {
    if (data.emailSent) {
      return { tone: 'done', text: `Email sent to ${name} with a temporary password. They\u2019ll choose their own when they first sign in.` }
    }
    return {
      tone: 'warn',
      text: `The account is ready, but the email couldn\u2019t be sent. Share this temporary password with ${name} directly. It won\u2019t be shown again.`,
      tempPassword: data.tempPassword,
    }
  }

  const submitConfirm = async (e) => {
    e.preventDefault()
    if (!confirmAction) return
    if (!confirmPassword) {
      setConfirmError('Please enter your password.')
      return
    }
    setConfirmError('')
    setConfirmBusy(true)
    try {
      let res
      if (confirmAction.type === 'invite') {
        res = await fetch('/api/admin-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName,
            email: newEmail,
            isSuperAdmin: newRole === 'super_admin',
            confirmPassword,
          }),
        })
      } else if (confirmAction.type === 'reset') {
        res = await fetch('/api/admin-accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: confirmAction.account.email, confirmPassword }),
        })
      } else {
        res = await fetch('/api/admin-accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: confirmAction.account.email, confirmPassword }),
        })
      }
      const data = await res.json()

      // Wrong password: stay in the pop-up so they can retry.
      if (res.status === 403) {
        setConfirmError(data.error || 'Incorrect password. Please try again.')
        return
      }

      const action = confirmAction
      setConfirmAction(null)
      setConfirmPassword('')

      if (!data.success) {
        if (action.type === 'invite') setFormError(data.error || 'Could not invite this admin.')
        else setNotice({ tone: 'warn', text: data.error || 'Something went wrong.' })
        return
      }

      if (action.type === 'invite') {
        setAccounts((prev) => [...prev, data.account])
        setNotice(describeTempResult(data, data.account.name))
        setNewName('')
        setNewEmail('')
        setNewRole('admin')
      } else if (action.type === 'reset') {
        setAccounts((prev) => prev.map((a) => (a.email === data.account.email ? { ...a, ...data.account } : a)))
        setNotice(describeTempResult(data, data.account.name))
      } else {
        setAccounts((prev) => prev.filter((a) => a.email !== action.account.email))
        setNotice({ tone: 'done', text: `${action.account.name} was removed.` })
      }
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setConfirmBusy(false)
    }
  }

  const pendingState = (acc) => {
    if (!acc.must_change_password) return null
    const expired = acc.temp_password_expires_at && new Date(acc.temp_password_expires_at).getTime() < Date.now()
    return expired ? 'expired' : 'pending'
  }

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Admin Accounts</h1>
          <p>
            Super admin only. Invite an Admin or Super Admin below. They&apos;ll get an email with a temporary
            password and choose their own when they first sign in. Inviting, resetting and removing accounts all
            ask for your password first.
          </p>
        </div>
      </div>

      {/* Oct 1 2026: plain success/failure notices are toasts; a notice
          carrying a temporary password stays here until dismissed. */}
      {notice && !notice.tempPassword && (
        <AdminToast message={notice.text} tone={notice.tone === 'done' ? 'success' : 'error'} onDone={() => setNotice(null)} />
      )}
      {notice && notice.tempPassword && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-xs font-semibold ${
            notice.tone === 'done'
              ? 'border-ccc-green/40 bg-green-50 text-ccc-green'
              : 'border-ccc-orange/50 bg-orange-50 text-ccc-orange'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-ccc-muted hover:text-ccc-text" aria-label="Dismiss">
              ✕
            </button>
          </div>
          {notice.tempPassword && (
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-md border border-ccc-border bg-white px-3 py-1.5 text-sm font-bold tracking-wider text-ccc-text">
                {notice.tempPassword}
              </code>
              <CopyHashButton hash={notice.tempPassword} label="Copy" />
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Add Admin Account</div>
        {formError && (
          <div className="mb-4 rounded-xl border border-ccc-red/40 bg-red-50 px-4 py-2.5 text-xs font-semibold text-ccc-red">
            {formError}
          </div>
        )}
        <form className="add-admin-form" onSubmit={requestInvite}>
          <div className="efield">
            <label>Full Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Grace Villanueva"
              required
            />
          </div>
          <div className="efield">
            <label>Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@ccc.edu.ph"
              required
            />
          </div>
          <div className="efield">
            <label>Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <button
            type="submit"
            className="text-xs font-bold uppercase tracking-wide text-white bg-ccc-navy px-4 py-2.5 rounded-lg"
          >
            Invite
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Current Accounts</span>
          {!loading && !error && (
            <span className="badge badge-notsubmitted">
              {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No admin accounts found.</p>
        ) : (
          <div className="admin-list">
            {accounts.map((acc) => {
              const isSelf = acc.email.toLowerCase() === myEmail
              const pending = pendingState(acc)
              return (
                <div key={acc.email} className="admin-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '13px', width: '100%' }}>
                    <div className="aa-avatar">{getInitials(acc.name)}</div>
                    <div className="aa-info">
                      <div className="aa-name">
                        {acc.name}
                        {isSelf && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ccc-muted">You</span>}
                      </div>
                      <div className="aa-email">{acc.email}</div>
                    </div>
                    {pending && (
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          pending === 'expired'
                            ? 'border-ccc-red/40 bg-red-50 text-ccc-red'
                            : 'border-ccc-orange/50 bg-orange-50 text-ccc-orange'
                        }`}
                        title={
                          pending === 'expired'
                            ? 'Their temporary password expired. Use Reset to send a new one.'
                            : 'Invited. Waiting for them to sign in and choose their own password.'
                        }
                      >
                        {pending === 'expired' ? 'Invite expired' : 'Pending setup'}
                      </span>
                    )}
                    <span className={`role-tag ${acc.is_super_admin ? 'super' : 'admin'}`}>
                      {acc.is_super_admin ? 'Super Admin' : 'Admin'}
                    </span>
                    <button
                      type="button"
                      onClick={() => requestReset(acc)}
                      disabled={isSelf}
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-sm text-ccc-blue hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isSelf ? "You can't reset your own password here." : 'Email a new temporary password'}
                    >
                      🔑
                    </button>
                    <button
                      type="button"
                      className={`admin-row-del${isSelf ? ' is-disabled' : ''}`}
                      onClick={() => requestRemove(acc)}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot remove your own account while signed in as it.' : 'Remove this admin account'}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Password confirm pop-up, ported from Ivy's admin.html
          (#adminActionPasswordOverlay). */}
      {confirmAction && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && closeConfirm()}>
          <form className="confirm-box has-password" role="dialog" aria-modal="true" onSubmit={submitConfirm}>
            <div className="confirm-icon">&#128274;</div>
            <h3>{confirmAction.title}</h3>
            <p>{confirmAction.desc}</p>
            <div className="gate-field" style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                autoFocus
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ccc-muted hover:text-ccc-text"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {confirmError && <p className="confirm-password-error show">{confirmError}</p>}
            <div className="confirm-actions">
              <button type="button" className="mbtn mbtn-ghost" onClick={closeConfirm} disabled={confirmBusy}>
                Cancel
              </button>
              <button type="submit" className="mbtn mbtn-primary" disabled={confirmBusy}>
                {confirmBusy ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ---------- System & Activity panel ----------
// Sept 22, 2026 rebuild: this used to be just the audit log (moved in from
// the old standalone /admin/activity route), now split into the two real
// halves Ivy's mockup shows. All settings are enforced on the server:
// Applications Open, Applicant Slots and the Acceptance Start/End window
// gate the final submit (Oct 1 2026, app/lib/systemSettings.js), Document
// Uploads gates /api/upload, and Exam Results Visible gates results
// (Sept 30 2026). The activity log gets real category/status filters and a shared
// read/unread flag; Communications posts stay their own separate list in
// the Communications panel rather than merging into this feed.

const ACTIVITY_CATEGORIES = ['Documents', 'Eligibility', 'Results', 'Communications', 'Admin Accounts', 'System']

function CycleSettingsCard() {
  const [settings, setSettings] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState(false)

  useEffect(() => {
    fetch('/api/system-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSettings(data.settings)
          setDraft(data.settings)
        } else {
          setError(data.error || 'Failed to load settings.')
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const dirty = settings && draft && JSON.stringify(settings) !== JSON.stringify(draft)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSavedNote(false)
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications_open: draft.applications_open,
          applicant_slots: draft.applicant_slots === '' ? null : draft.applicant_slots,
          acceptance_start_date: draft.acceptance_start_date || null,
          acceptance_end_date: draft.acceptance_end_date || null,
          document_uploads_enabled: draft.document_uploads_enabled,
          exam_results_visible: draft.exam_results_visible,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to save settings.')
        return
      }
      setSettings(data.settings)
      setDraft(data.settings)
      setSavedNote(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-title">Application Cycle Settings</div>
        <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
      </div>
    )
  }
  if (!draft) {
    return (
      <div className="card">
        <div className="card-title">Application Cycle Settings</div>
        <p className="text-sm text-ccc-red text-center py-8">{error || 'Failed to load settings.'}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title">Application Cycle Settings</div>

      {error && (
        <div className="mb-4 rounded-xl border border-ccc-red/40 bg-red-50 px-4 py-2.5 text-xs font-semibold text-ccc-red">
          {error}
        </div>
      )}

      <div className="toggle-row">
        <div className="toggle-row-info">
          <h4>Applications Open</h4>
          <p>
            When off, applicants can no longer submit new applications. When on, applicants can only submit between the
            acceptance dates below, and only until the applicant slots are filled. Leave a field blank for no limit.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={!!draft.applications_open}
            onChange={(e) => setDraft((d) => ({ ...d, applications_open: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>
      <div className={`toggle-detail-panel${draft.applications_open ? '' : ' collapsed'}`}>
        <div className="efield">
          <label>Applicant Slots</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 100"
            value={draft.applicant_slots ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, applicant_slots: e.target.value === '' ? null : Number(e.target.value) }))
            }
          />
        </div>
        <div className="efield">
          <label>Acceptance Start Date</label>
          <input
            type="date"
            value={draft.acceptance_start_date || ''}
            onChange={(e) => setDraft((d) => ({ ...d, acceptance_start_date: e.target.value || null }))}
          />
        </div>
        <div className="efield">
          <label>Acceptance End Date</label>
          <input
            type="date"
            value={draft.acceptance_end_date || ''}
            onChange={(e) => setDraft((d) => ({ ...d, acceptance_end_date: e.target.value || null }))}
          />
        </div>
      </div>

      <div className="toggle-row">
        <div className="toggle-row-info">
          <h4>Document Uploads Enabled</h4>
          <p>When off, applicants cannot upload or re-upload documents.</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={!!draft.document_uploads_enabled}
            onChange={(e) => setDraft((d) => ({ ...d, document_uploads_enabled: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="toggle-row">
        <div className="toggle-row-info">
          <h4>Exam Results Visible to Applicants</h4>
          <p>
            When on, an applicant sees their result on their dashboard and in Messages once an admin has sent it to
            them from Applicant Results. When off, all results are hidden from applicants and results cannot be sent.
          </p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={!!draft.exam_results_visible}
            onChange={(e) => setDraft((d) => ({ ...d, exam_results_visible: e.target.checked }))}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <AdminToast message={savedNote ? 'Settings saved. The applicant pages follow the new settings right away.' : ''} onDone={() => setSavedNote(false)} />
        <button
          type="button"
          className="mbtn mbtn-secondary"
          onClick={() => setDraft(settings)}
          disabled={!dirty || saving}
        >
          Cancel
        </button>
        <button type="button" className="mbtn mbtn-primary" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// Oct 1 2026 redesign (Pau's request): the log now updates by itself (every
// 15 seconds, right after any admin action's pop-up, and when the tab comes
// back into focus), with a Refresh button and an "Updated ..." line. The
// category filter is a row of chips instead of a full-width dropdown, and
// each entry shows the action, then a category chip, who did it, and the
// time on the right.
function relativeTime(date) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`
  return new Date(date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function TimelineItem({ entry }) {
  const isWarn = entry.kind === 'warn'
  const { icon: CategoryIcon, className: categoryClass } = getCategoryStyle(entry.category)
  return (
    <div className={`alog-item${isWarn ? ' is-warn' : ''}`}>
      <div className={`timeline-dot ${isWarn ? 'warn' : categoryClass}`}>
        {isWarn ? <IconAlert className="w-3.5 h-3.5" /> : <CategoryIcon className="w-3.5 h-3.5" />}
      </div>
      <div className="alog-main">
        <div className="alog-action">{entry.action}</div>
        <div className="alog-meta">
          {entry.category && <span className={`alog-cat ${categoryClass}`}>{entry.category}</span>}
          <span>{entry.actor || 'System'}</span>
        </div>
      </div>
      <div className="alog-time" title={new Date(entry.created_at).toLocaleString('en-PH')}>
        {relativeTime(entry.created_at)}
      </div>
    </div>
  )
}

function ActivityLogCard() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [, setTick] = useState(0)
  const filterRef = useRef(categoryFilter)
  filterRef.current = categoryFilter

  const load = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    const want = filterRef.current
    try {
      const params = new URLSearchParams()
      if (want !== 'all') params.set('category', want)
      const qs = params.toString()
      const res = await fetch(`/api/audit-log${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      if (want !== filterRef.current) return // the filter changed meanwhile
      if (data.success) {
        setEntries(data.entries)
        setError(null)
        setUpdatedAt(Date.now())
      } else if (!quiet) setError(data.error || 'Failed to load audit log.')
    } catch (err) {
      if (!quiet) setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter])

  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') load({ quiet: true })
    }, 15000)
    const onFocus = () => load({ quiet: true })
    const onNotice = () => setTimeout(() => load({ quiet: true }), 600)
    const clock = setInterval(() => setTick((t) => t + 1), 30000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('admin-notice', onNotice)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('admin-notice', onNotice)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupedEntries = useMemo(() => groupActivityByDate(entries), [entries])

  return (
    <div className="card">
      <div className="card-title">
        Recent Activity Log
        <span className="alog-live">
          <span className="alog-live-dot" />
          {refreshing ? 'Updating...' : updatedAt ? `Updated ${relativeTime(updatedAt)}` : 'Live'}
          <button type="button" className="alog-refresh" onClick={() => load({ quiet: true })} disabled={refreshing}>
            Refresh
          </button>
        </span>
      </div>

      <div className="alog-chips" role="tablist" aria-label="Filter activity by category">
        {['all', ...ACTIVITY_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={categoryFilter === c}
            className={`alog-chip${categoryFilter === c ? ' active' : ''}`}
            onClick={() => setCategoryFilter(c)}
          >
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
      ) : error ? (
        <p className="text-sm text-ccc-red text-center py-8">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ccc-muted text-center py-8">No activity recorded yet.</p>
      ) : (
        <div className="alog">
          {groupedEntries.map((group) => (
            <div key={group.label} className="alog-group">
              <div className="activity-date-heading">
                {group.label}
                <span className="alog-count">{group.items.length}</span>
              </div>
              {group.items.map((entry) => (
                <TimelineItem key={entry.id} entry={entry} />
              ))}
            </div>
          ))}
          <p className="alog-foot">Showing the latest {entries.length} entries.</p>
        </div>
      )}
    </div>
  )
}

function SystemActivityPanel() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          System &amp; Activity
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Application cycle controls, and a running, auto-recorded timeline of system activity — document uploads,
          manual overrides, and announcement posts.
        </p>
      </div>

      <CycleSettingsCard />
      <ActivityLogCard />
    </div>
  )
}

// ---------- Exam schedules (Notifications Module, Sept 30 2026) ----------
// Progress table row "Exam Schedule Alerts". An admin creates a batch (date,
// time, venue); it fills itself with the next applicants in submission order
// (first 100 = first batch, per the client interview). The admin can remove
// people, then send: a private portal message to everyone in the batch plus
// an email to those who opted in. Same confirm-and-edit step as sending a
// result (Ivy's admin.html status email flow).
function ExamSchedulesPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ batchLabel: '', examDate: '', startTime: '', endTime: '', venue: '', notes: '' })
  const [openId, setOpenId] = useState(null)
  const [sendBox, setSendBox] = useState(null) // { scheduleId, subject, message, editSubject, editMessage, needsResend }

  const load = async () => {
    setError('')
    try {
      const res = await fetch('/api/admin-exam-schedules')
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load exam schedules.')
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const post = async (payload) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin-exam-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      return { res, json }
    } finally {
      setBusy(false)
    }
  }

  const createBatch = async (e) => {
    e.preventDefault()
    // Time pickers give "HH:MM" (24-hour); the batch stores readable text
    // like "8:00 AM to 12:00 PM".
    const to12h = (hhmm) => {
      if (!hhmm) return ''
      const [h, m] = hhmm.split(':').map(Number)
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    }
    if (form.endTime && !form.startTime) {
      setError('Pick a start time too, or clear the end time.')
      return
    }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      setError('The end time has to be after the start time.')
      return
    }
    const examTime = form.startTime ? to12h(form.startTime) + (form.endTime ? ' to ' + to12h(form.endTime) : '') : ''
    const { res, json } = await post({
      action: 'create',
      batchLabel: form.batchLabel,
      examDate: form.examDate,
      examTime,
      venue: form.venue,
      notes: form.notes,
    })
    if (!res.ok || !json.success) {
      setError(json.error || 'Could not create the batch.')
      return
    }
    setForm({ batchLabel: '', examDate: '', startTime: '', endTime: '', venue: '', notes: '' })
    setNotice(`Batch created with ${json.added} applicant${json.added === 1 ? '' : 's'}.`)
    setOpenId(json.scheduleId)
    await load()
  }

  const simpleAction = async (payload, doneText) => {
    const { res, json } = await post(payload)
    if (!res.ok || !json.success) {
      setError(json.error || 'Something went wrong.')
      return
    }
    setNotice(typeof doneText === 'function' ? doneText(json) : doneText)
    await load()
  }

  const openSend = async (scheduleId) => {
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin-exam-schedules?draft=' + encodeURIComponent(scheduleId))
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not prepare the message.')
      setSendBox({ scheduleId, subject: json.subject, message: json.message, editSubject: false, editMessage: false, needsResend: false })
    } catch (err) {
      setError(err.message)
    }
  }

  const send = async () => {
    const { res, json } = await post({
      action: 'send',
      scheduleId: sendBox.scheduleId,
      subject: sendBox.subject,
      message: sendBox.message,
      resend: sendBox.needsResend,
    })
    if (res.status === 409 && json.alreadySent) {
      setSendBox((b) => ({ ...b, needsResend: true }))
      return
    }
    if (!res.ok || !json.success) {
      setError(json.error || 'Could not send.')
      return
    }
    setSendBox(null)
    setNotice(json.note)
    await load()
  }

  const fmtDate = (iso) => {
    try {
      return new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
    } catch {
      return iso
    }
  }
  const fmtDateTime = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  const schedules = data?.schedules || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Exam Schedules
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Create an entrance exam batch and send the schedule to its applicants. Batches fill with the next applicants in
          submission order, up to {data?.batchSize || 100} per batch. Someone removed from a batch goes back to the waiting
          list and is picked first for the next batch.
        </p>
      </div>

      {error && <p className="text-sm text-ccc-red mb-3">{error}</p>}
      <AdminToast message={notice} onDone={() => setNotice('')} />

      <div className="card">
        <div className="card-title">
          New Exam Batch
          {data && (
            <span className="tag" style={{ marginLeft: '10px' }}>
              {data.waitingCount} applicant{data.waitingCount === 1 ? '' : 's'} waiting for a schedule
            </span>
          )}
        </div>
        <form onSubmit={createBatch} className="email-fields" style={{ marginBottom: 0 }}>
          <div className="email-field-row">
            <label>Batch name</label>
            <input className="email-field-input" value={form.batchLabel} maxLength={80} placeholder="e.g. Batch 1"
              onChange={(e) => setForm((f) => ({ ...f, batchLabel: e.target.value }))} />
          </div>
          <div className="email-field-row">
            <label>Exam date</label>
            <input className="email-field-input" type="date" value={form.examDate}
              onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))} />
          </div>
          <div className="email-field-row">
            <label>Start time (optional)</label>
            <input className="email-field-input" type="time" value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div className="email-field-row">
            <label>End time (optional)</label>
            <input className="email-field-input" type="time" value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
          </div>
          <div className="email-field-row">
            <label>Venue (optional)</label>
            <input className="email-field-input" value={form.venue} maxLength={150} placeholder="e.g. CCC Main Campus, Room 101"
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
          </div>
          <div className="email-field-row">
            <label>Notes for applicants (optional)</label>
            <textarea className="email-field-input" rows={3} value={form.notes} maxLength={1000} placeholder="e.g. what to bring"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="confirm-inline-actions" style={{ marginBottom: '8px' }}>
            <button type="submit" className="mbtn mbtn-primary mbtn-sm" disabled={busy || !form.batchLabel.trim() || !form.examDate}>
              {busy ? 'Working...' : 'Create batch'}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-title">
          Batches
          {!loading && (
            <span className="tag" style={{ marginLeft: '10px' }}>
              {schedules.length} batch{schedules.length === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No exam batches yet.</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => {
              const isOpen = openId === s.id
              const optedIn = s.applicants.filter((a) => a.email_updates_opt_in).length
              return (
                <div key={s.id} className="rounded-xl border border-ccc-border p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-ccc-navy">{s.batch_label}</p>
                      <p className="text-[11px] text-ccc-muted">
                        {fmtDate(s.exam_date)}
                        {s.exam_time ? `, ${s.exam_time}` : ''}
                        {s.venue ? `, ${s.venue}` : ''}
                      </p>
                      <p className="text-[11px] text-ccc-muted">
                        {s.applicants.length} applicant{s.applicants.length === 1 ? '' : 's'} ({optedIn} opted in to email)
                        {s.sent_at ? `. Sent ${fmtDateTime(s.sent_at)}${s.sent_by ? ' by ' + s.sent_by : ''}.` : '. Not sent yet.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="mbtn mbtn-ghost mbtn-sm" onClick={() => setOpenId(isOpen ? null : s.id)}>
                        {isOpen ? 'Hide applicants' : 'View applicants'}
                      </button>
                      {!s.sent_at && s.applicants.length < (data?.batchSize || 100) && data?.waitingCount > 0 && (
                        <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={busy}
                          onClick={() => simpleAction({ action: 'fill', scheduleId: s.id }, (j) => `Added ${j.added} applicant${j.added === 1 ? '' : 's'}.`)}>
                          Fill up to {data?.batchSize || 100}
                        </button>
                      )}
                      {!s.sent_at && (
                        <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Delete ${s.batch_label}? Its applicants go back to the waiting list.`)) {
                              simpleAction({ action: 'delete', scheduleId: s.id }, 'Batch deleted.')
                            }
                          }}>
                          Delete
                        </button>
                      )}
                      <button type="button" className="mbtn mbtn-primary mbtn-sm" disabled={busy || s.applicants.length === 0}
                        onClick={() => openSend(s.id)}>
                        {s.sent_at ? 'Send again' : 'Send schedule'}
                      </button>
                    </div>
                  </div>

                  {sendBox && sendBox.scheduleId === s.id && (
                    <div className="confirm-inline show" style={{ marginTop: '12px' }}>
                      <p>
                        This sends a private message to all {s.applicants.length} applicant{s.applicants.length === 1 ? '' : 's'} in this
                        batch, and an email to the {optedIn} who opted in.
                      </p>
                      <div className="email-fields">
                        <div className="email-field-row">
                          <label>Subject</label>
                          <div className="email-field-input-wrap">
                            <input className="email-field-input" value={sendBox.subject} maxLength={150} disabled={!sendBox.editSubject}
                              onChange={(e) => setSendBox((b) => ({ ...b, subject: e.target.value }))} />
                            <button type="button" className="mbtn mbtn-ghost mbtn-sm email-field-edit-btn"
                              onClick={() => setSendBox((b) => ({ ...b, editSubject: !b.editSubject }))}>
                              {sendBox.editSubject ? 'Done' : 'Edit'}
                            </button>
                          </div>
                        </div>
                        <div className="email-field-row">
                          <label>Message</label>
                          <div className="email-field-input-wrap">
                            <textarea className="email-field-input" rows={9} value={sendBox.message} maxLength={4000} disabled={!sendBox.editMessage}
                              onChange={(e) => setSendBox((b) => ({ ...b, message: e.target.value }))} />
                            <button type="button" className="mbtn mbtn-ghost mbtn-sm email-field-edit-btn"
                              onClick={() => setSendBox((b) => ({ ...b, editMessage: !b.editMessage }))}>
                              {sendBox.editMessage ? 'Done' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      </div>
                      {!s.sent_at && <p>After sending, the applicants in this batch can no longer be changed.</p>}
                      {sendBox.needsResend && <p>This batch was already sent. Send it again to everyone in it?</p>}
                      <div className="confirm-inline-actions">
                        <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={busy} onClick={() => setSendBox(null)}>Cancel</button>
                        <button type="button" className="mbtn mbtn-primary mbtn-sm" disabled={busy || !sendBox.subject.trim() || !sendBox.message.trim()} onClick={send}>
                          {busy ? 'Sending...' : sendBox.needsResend ? 'Yes, send again' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}

                  {isOpen && (
                    s.applicants.length === 0 ? (
                      <p className="text-[11px] text-ccc-muted mt-3">No applicants in this batch.</p>
                    ) : (
                      <table className="applicant-table" style={{ marginTop: '12px' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Applicant</th>
                            <th>Application No.</th>
                            <th>Email updates</th>
                            {!s.sent_at && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {s.applicants.map((a, i) => (
                            <tr key={a.id}>
                              <td>{i + 1}</td>
                              <td>
                                <div className="font-bold">{a.applicant_name || '(no name)'}</div>
                                <div className="text-[11px] text-ccc-muted">{a.applicant_email}</div>
                              </td>
                              <td>{a.application_number || '-'}</td>
                              <td>{a.email_updates_opt_in ? 'Yes' : 'No'}</td>
                              {!s.sent_at && (
                                <td>
                                  <button type="button" className="mbtn mbtn-ghost mbtn-sm" disabled={busy}
                                    onClick={() => simpleAction({ action: 'remove', scheduleId: s.id, applicationId: a.id }, 'Applicant removed from the batch.')}>
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Reschedule requests (Notifications Module, admin side) ----------

// The requests applicants send from Appeals & Rescheduling. Oct 1 2026: the
// admin records the office's decision (Approve / Decline + optional note);
// the applicant sees it in their portal and it goes to the Activity Log.
// CCC still reviews requests in person; this records the outcome.
//
// Ivy's admin.html has no reschedule screen, so this borrows the look of her
// "All Applicants" card (search + filter bar above an applicant-table with the
// avatar / name / id cell) to sit naturally next to the Dashboard.
function ReschedulePanel() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewingId, setReviewingId] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [savingDecision, setSavingDecision] = useState(null) // 'approved' | 'declined' while saving
  const [toast, setToast] = useState(null) // { text, tone }

  const reviewing = reviewingId === null ? null : requests.find((r) => r.id === reviewingId) || null

  const openReview = (id) => {
    setReviewingId(id)
    setDecisionNote('')
  }
  const closeReview = () => {
    if (savingDecision) return
    setReviewingId(null)
    setDecisionNote('')
  }

  const saveDecision = async (decision) => {
    if (!reviewing || savingDecision) return
    setSavingDecision(decision)
    try {
      const res = await fetch('/api/admin-reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewing.id, decision, note: decisionNote }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setToast({ text: data.error || 'Could not save the decision.', tone: 'error' })
        return
      }
      setRequests((prev) => prev.map((r) => (r.id === reviewing.id ? { ...r, ...data.request } : r)))
      const approved = data.request.status === 'approved'
      const next =
        approved && /reschedule/i.test(reviewing.request_type || '')
          ? ' Next: add them to a new batch in Exam Schedules.'
          : approved && /appeal/i.test(reviewing.request_type || '')
            ? ' Next: update their status in Applicant Results.'
            : ''
      setToast({
        text: `\u2713 Request ${approved ? 'approved' : 'declined'}.${data.notified ? ' The applicant was notified in their portal.' : ''}${next}`,
        tone: 'success',
      })
      setReviewingId(null)
      setDecisionNote('')
    } catch (err) {
      setToast({ text: err.message || 'Could not save the decision.', tone: 'error' })
    } finally {
      setSavingDecision(null)
    }
  }

  useEffect(() => {
    fetch('/api/admin-reschedule')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setRequests(data.requests)
        else setError(data.error || 'Failed to load reschedule requests.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const requestTypes = useMemo(() => [...new Set(requests.map((r) => r.request_type).filter(Boolean))], [requests])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = requests.filter((r) => {
      if (typeFilter !== 'all' && r.request_type !== typeFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return [r.applicant_name, r.applicant_email, r.application_number, r.request_type, r.details]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    })
    rows.sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at)
      return newestFirst ? -diff : diff
    })
    return rows
  }, [requests, search, typeFilter, statusFilter, newestFirst])

  const filtersActive = search.trim() !== '' || typeFilter !== 'all' || statusFilter !== 'all'
  const awaitingCount = requests.filter((r) => r.status === 'submitted').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Appeals &amp; Reschedule Requests
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Exam rescheduling requests and appeals for a retake or re-application, sent by applicants from Appeals &amp; Rescheduling.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-title">
          All Requests
          {!loading && !error && (
            <span className="tag" style={{ marginLeft: '10px' }}>
              {visible.length} request{visible.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="reviewer-note">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Review each request with the applicant (in person at the Guidance Office or by email), then click the
            request to record the decision. The applicant sees it in their portal, and a decision can't be changed once
            saved.
            {awaitingCount > 0 && (
              <>
                {' '}
                <b>
                  {awaitingCount} request{awaitingCount === 1 ? '' : 's'} awaiting review.
                </b>
              </>
            )}
          </span>
        </div>

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, application number, email or details..."
          />
          {requestTypes.length > 1 && (
            <>
              <span className="filter-divider"></span>
              <span className="filter-bar-label">Type</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                {requestTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          )}
          <span className="filter-divider"></span>
          <span className="filter-bar-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="submitted">Awaiting review</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
          {filtersActive && (
            <button
              type="button"
              className="filter-clear"
              onClick={() => {
                setSearch('')
                setTypeFilter('all')
                setStatusFilter('all')
              }}
            >
              &times; Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No reschedule requests yet.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-ccc-muted text-center py-8">No requests match your search or filter.</p>
        ) : (
          <table className="applicant-table">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Applicant</th>
                <th>Request</th>
                <th
                  className="sortable-th"
                  style={{ width: '17%' }}
                  onClick={() => setNewestFirst((v) => !v)}
                  title="Sort by date sent"
                >
                  <span className="sort-header-inner">
                    Sent
                    <svg className={`sort-icon active${newestFirst ? '' : ' asc'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 16l-6-6h12z" />
                    </svg>
                  </span>
                </th>
                <th style={{ width: '15%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="app-row"
                  tabIndex={0}
                  title={r.status === 'submitted' ? 'Click to review this request' : 'Click to view the decision'}
                  onClick={() => openReview(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openReview(r.id)
                    }
                  }}
                >
                  <td>
                    <div className="app-name-cell">
                      <div className="app-avatar">{getInitials(r.applicant_name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{r.applicant_name}</div>
                        <div className="id" style={{ overflowWrap: 'anywhere' }}>
                          {[r.application_number, r.applicant_email].filter(Boolean).join(' · ') || 'No contact details'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs font-bold text-ccc-navy">{r.request_type}</div>
                    <div className="text-xs text-ccc-muted mt-1" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {r.details}
                    </div>
                    {r.supporting_document_url ? (
                      <a
                        href={r.supporting_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block text-xs font-bold text-ccc-blue underline mt-1.5"
                      >
                        &#128206; View supporting document
                      </a>
                    ) : (
                      <div className="text-[11px] text-ccc-muted mt-1.5">No supporting document attached.</div>
                    )}
                  </td>
                  <td className="text-xs text-ccc-muted whitespace-nowrap">{formatWhen(r.created_at)}</td>
                  <td>
                    <RequestStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {reviewing && (
        <RequestReviewDialog
          request={reviewing}
          note={decisionNote}
          onNote={setDecisionNote}
          saving={savingDecision}
          onDecide={saveDecision}
          onClose={closeReview}
        />
      )}
      <AdminToast message={toast?.text || ''} tone={toast?.tone} onDone={() => setToast(null)} />
    </div>
  )
}

// Status pill for one request. The whole row is clickable (same as the
// Dashboard's All Applicants table) and opens the review pop-up.
const REQUEST_STATUS_BADGE = {
  submitted: { label: 'Awaiting review', cls: 'badge-pending' },
  approved: { label: 'Approved', cls: 'badge-verified' },
  declined: { label: 'Declined', cls: 'badge-deficient' },
}

function RequestStatusBadge({ status }) {
  const badge = REQUEST_STATUS_BADGE[status] || REQUEST_STATUS_BADGE.submitted
  return <span className={`badge whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
}

// Review pop-up (same look as the Admin Accounts confirm pop-up, ported from
// Ivy's admin.html). Awaiting requests: note + Decline / Approve. Decided
// requests: read-only summary with the note and the next step.
function RequestReviewDialog({ request: r, note, onNote, saving, onDecide, onClose }) {
  const decided = r.status === 'approved' || r.status === 'declined'
  const badge = REQUEST_STATUS_BADGE[r.status] || REQUEST_STATUS_BADGE.submitted
  const isReschedule = /reschedule/i.test(r.request_type || '')
  const isAppeal = /appeal/i.test(r.request_type || '')
  const nextStep =
    r.status === 'approved' && isReschedule
      ? 'Add the applicant to a new batch in Exam Schedules.'
      : r.status === 'approved' && isAppeal
        ? 'Update the applicant\u2019s status in Applicant Results.'
        : null

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = { fontSize: '10.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--navy)' }

  return (
    <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="confirm-box" role="dialog" aria-modal="true" aria-label="Review request" style={{ maxWidth: 520, textAlign: 'left' }}>
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ marginBottom: 2 }}>{r.request_type}</h3>
            <div className="text-xs text-ccc-muted" style={{ overflowWrap: 'anywhere' }}>
              {[r.applicant_name, r.application_number].filter(Boolean).join(' \u00b7 ')} &middot; Sent {formatWhen(r.created_at)}
            </div>
          </div>
          <span className={`badge whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
        </div>

        <div className="mt-4" style={label}>Details</div>
        <div className="text-[13px] text-ccc-text mt-1" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {r.details || 'No details given.'}
        </div>
        <div className="mt-2">
          {r.supporting_document_url ? (
            <a href={r.supporting_document_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-ccc-blue underline">
              &#128206; View supporting document
            </a>
          ) : (
            <span className="text-xs text-ccc-muted">No supporting document attached.</span>
          )}
        </div>

        {decided ? (
          <>
            <div className="mt-4" style={label}>Decision</div>
            <div className="text-[13px] text-ccc-text mt-1">
              {badge.label}
              {r.decided_by ? ` by ${r.decided_by}` : ''}
              {r.decided_at ? `, ${formatWhen(r.decided_at)}` : ''}
            </div>
            {r.decision_note && (
              <div className="text-[13px] text-ccc-text mt-1" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                Note to applicant: {r.decision_note}
              </div>
            )}
            {nextStep && <div className="text-xs text-ccc-muted mt-2">Next: {nextStep}</div>}
            <div className="confirm-actions" style={{ marginTop: 22 }}>
              <button type="button" className="mbtn mbtn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block mt-4" style={label} htmlFor="request-decision-note">
              Note to the applicant <span className="text-ccc-muted" style={{ textTransform: 'none', fontWeight: 600 }}>(optional)</span>
            </label>
            <textarea
              id="request-decision-note"
              value={note}
              onChange={(e) => onNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Moved to the Oct 10 batch, or the reason for declining"
              className="w-full mt-1.5 text-[13px] border border-ccc-border rounded-md p-2"
              disabled={Boolean(saving)}
            />
            <div className="text-[11px] text-ccc-muted mt-1">
              The applicant sees this in their portal. Leave out private details. A decision can&rsquo;t be changed once saved.
            </div>
            <div className="confirm-actions" style={{ marginTop: 20 }}>
              <button type="button" className="mbtn mbtn-ghost" onClick={onClose} disabled={Boolean(saving)}>
                Cancel
              </button>
              <button type="button" className="mbtn mbtn-danger" onClick={() => onDecide('declined')} disabled={Boolean(saving)}>
                {saving === 'declined' ? 'Saving...' : 'Decline'}
              </button>
              <button type="button" className="mbtn mbtn-primary" onClick={() => onDecide('approved')} disabled={Boolean(saving)}>
                {saving === 'approved' ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- Page shell ----------

const VALID_PANELS = ['dashboard', 'communications', 'reschedule', 'admins', 'system']

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
      showAdminNotice(
        action === 'verify'
          ? `${doc.applicant_name ? `${doc.applicant_name}'s ` : ''}document was marked as verified.`
          : `${doc.applicant_name ? `${doc.applicant_name}'s ` : ''}document was flagged for review.`
      )
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
      showAdminNotice(
        override
          ? `Application status set to ${ELIGIBILITY_META[override]?.label || override}. The Dashboard cards are updated.`
          : 'Manual status cleared. The application status is back to what the system computed.'
      )
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
      showAdminNotice(
        `Recomputed eligibility for ${data.total ?? 'all'} applicant${data.total === 1 ? '' : 's'}${typeof data.updated === 'number' ? `. ${data.updated} changed.` : '.'}`
      )
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
    <main className="admin-portal">
      <AdminNoticeHost />
      <SiteHeader
        topbarLabel="Iskolusyon Admin Console"
        topbarRight={
          <span className="flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-[10.2px] text-ccc-gold">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {isSuperAdmin ? 'Super Admin Session' : 'Admin Session'}
          </span>
        }
        portalBadge="Admin Console"
        logos={[
          { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
          { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
          { src: '/LOGO_CCC_Registrar.png', alt: 'CCC Registrar Logo' },
        ]}
        rightSlot={
          <a
            href="/portal"
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

      <div className="portal-shell">
        <AdminSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          displayName={adminName}
          isSuperAdmin={isSuperAdmin}
          flaggedCount={totalFlagged}
          onLogout={handleLogout}
        />

        <div className="portal-main">
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
              onProfileSaved={fetchEligibility}
            />
          )}
          {activePanel === 'communications' && <CommunicationsPanel />}
          {activePanel === 'reschedule' && <ReschedulePanel />}
          {activePanel === 'exams' && <ExamSchedulesPanel />}
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