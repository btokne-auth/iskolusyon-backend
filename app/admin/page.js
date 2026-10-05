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
  // Oct 5 2026: allowance posts and LGU reports reuse existing looks.
  Allowance: { icon: IconMessage, className: 'cat-communications' },
  Reports: { icon: IconFile, className: 'cat-documents' },
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
        <span className="text-xs text-center px-4">Couldn&rsquo;t load this preview. The connection may be slow or dropped.</span>
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

// Oct 3 2026: pill styles for the redesigned All Applicants table (same
// labels as ELIGIBILITY_META, colors from admin-theme.css .apl-pill-*).
const APL_STATUS_PILL = {
  qualified: { label: ELIGIBILITY_META.qualified.label, cls: 'apl-pill-green' },
  waitlisted: { label: ELIGIBILITY_META.waitlisted.label, cls: 'apl-pill-gold' },
  not_qualified: { label: ELIGIBILITY_META.not_qualified.label, cls: 'apl-pill-red' },
  pending_exam: { label: ELIGIBILITY_META.pending_exam.label, cls: 'apl-pill-blue' },
  incomplete: { label: ELIGIBILITY_META.incomplete.label, cls: 'apl-pill-gray' },
}

function formatAplDate(iso) {
  if (!iso) return 'No activity yet'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'No activity yet'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
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
        No application profile on file yet for this applicant, so eligibility can&rsquo;t be evaluated until one exists.
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

  // Oct 3 2026 redesign: one row of the All Applicants table (Ivy's
  // applicant-table columns + status tabs), replacing the floating card.
  // Same click-to-open + review lock behavior as before.
  const status = eligibilityRow?.eligibility_override || eligibilityRow?.eligibility_status || 'incomplete'
  const statusMeta = APL_STATUS_PILL[status] || APL_STATUS_PILL.incomplete
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, arr) => (i === 0 || i === arr.length - 1 ? w.charAt(0) : ''))
    .join('')
    .toUpperCase() || '?'

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={opening}
        className={`apl-row${lockedByOther ? ' apl-row-locked' : ''}`}
        title={lockedByOther ? `${lockInfo.admin_name || 'Another admin'} is reviewing this applicant` : `Open ${name || 'applicant'}`}
      >
        <div className="apl-cell apl-who">
          <span className="apl-avatar">{initials}</span>
          <span className="apl-who-text">
            <span className="apl-name">{name || 'Unknown applicant'}</span>
            <span className="apl-sub">{email || 'No email on file'}</span>
            {lockedByOther && (
              <span className="apl-lock-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Being reviewed by {lockInfo.admin_name || 'another admin'}
              </span>
            )}
          </span>
        </div>
        <div className="apl-cell apl-stack">
          <span className="apl-main">{eligibilityRow?.program_choice_1 || 'Not yet chosen'}</span>
          <span className="apl-sub">{eligibilityRow?.applying_as || 'Not yet specified'}</span>
        </div>
        <div className="apl-cell apl-stack">
          <span className="apl-main">
            <b>{sectionsDone}</b> of {PROFILE_SECTIONS.length} sections
          </span>
          <span className="apl-bar" aria-hidden="true">
            <span
              className={sectionsDone === PROFILE_SECTIONS.length ? 'done' : ''}
              style={{ width: `${profilePct}%` }}
            />
          </span>
        </div>
        <div className="apl-cell apl-stack">
          <span className="apl-main">
            {docs.length} file{docs.length === 1 ? '' : 's'}
          </span>
          <span className="apl-chips">
            {flaggedCount > 0 && (
              <span className="apl-chip apl-chip-flag">
                <IconAlertTriangle className="w-3 h-3" />
                {flaggedCount} flagged
              </span>
            )}
            {processingCount > 0 && <span className="apl-chip apl-chip-proc">{processingCount} processing</span>}
            {flaggedCount === 0 && processingCount === 0 && docs.length > 0 && (
              <span className="apl-chip apl-chip-ok">All verified</span>
            )}
          </span>
        </div>
        <div className="apl-cell apl-date">{formatAplDate(eligibilityRow?.updated_at)}</div>
        <div className="apl-cell apl-status">
          <span className={`apl-pill ${statusMeta.cls}`}>{statusMeta.label}</span>
          <svg className="apl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
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
                    <input value={detail?.applicant_email || email || 'Not on file'} disabled readOnly />
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

// Oct 3 2026 redesign: status tabs above the All Applicants table. The
// stat cards above set the same filter (their keys match these). "Needs
// action" = something an admin can do now: a flagged document to check or
// an exam result to record (Pending Exam Result).
const APL_TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'action', label: 'Needs action', match: (g) => g.flagged || g.status === 'pending_exam' },
  { key: 'pending_exam', label: 'Pending Exam Result', match: (g) => g.status === 'pending_exam' },
  { key: 'qualified', label: 'Qualified', match: (g) => g.status === 'qualified' },
  { key: 'not_qualified', label: 'Not Qualified', match: (g) => g.status === 'not_qualified' },
  { key: 'waitlisted', label: 'Waitlisted', match: (g) => g.status === 'waitlisted' },
  { key: 'incomplete', label: 'Incomplete Profile', match: (g) => g.status === 'incomplete' },
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
  const [showForm3, setShowForm3] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'default', dir: 1 })
  const applicantListRef = useRef(null)
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

  // Oct 3 2026 redesign: the status filter moved from "stat card sets a
  // hidden filter" to visible tabs above the table (the stat cards still set
  // it). Search and program filter apply first so each tab shows its count
  // for the current search; the status tab is applied in `groups` below.
  const searchedGroups = useMemo(() => {
    const term = search.trim().toLowerCase()

    const filtered = docs.filter((d) => {
      const key = (d.applicant_name || '').trim().toLowerCase()
      const eligRow = eligibilityByName.get(key)

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

    return Array.from(map.values()).map((g) => {
      const eligRow = eligibilityByName.get((g.name || '').trim().toLowerCase())
      const status = eligRow?.eligibility_override || eligRow?.eligibility_status || 'incomplete'
      const flagged = g.docs.some((d) => d.needs_review)
      return { ...g, status, flagged, updatedAt: eligRow?.updated_at || null }
    })
  }, [docs, search, programFilter, eligibilityByName])

  const tabCounts = useMemo(() => {
    const counts = {}
    for (const tab of APL_TABS) counts[tab.key] = searchedGroups.filter((g) => tab.match(g)).length
    return counts
  }, [searchedGroups])

  const groups = useMemo(() => {
    const tab = APL_TABS.find((t) => t.key === statusFilter) || APL_TABS[0]
    const list = searchedGroups.filter((g) => tab.match(g))
    // Default order (unchanged): applicants with flagged documents float to
    // the top so admins triage those first, then A-Z. Clicking the
    // Applicant or Last Update header sorts by that column instead.
    return list.sort((a, b) => {
      if (sort.key === 'name') return (a.name || '').localeCompare(b.name || '') * sort.dir
      if (sort.key === 'updated') {
        const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return (at - bt) * sort.dir
      }
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [searchedGroups, statusFilter, sort])

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: -prev.dir } : { key, dir: key === 'name' ? 1 : -1 }
    )
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 1 ? 'asc active' : 'active') : '')

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
        <span className="cf-header-actions">
          {/* Oct 5 2026: CHED Form 3 export (Progress Table row 79). */}
          <button type="button" onClick={() => setShowForm3(true)} className="mbtn mbtn-ghost mbtn-sm">
            Export CHED Form 3
          </button>
          <button
            type="button"
            onClick={onRecomputeEligibility}
            disabled={recomputing}
            title="Recomputes eligibility for every applicant from their current data. Needed for anyone who fully submitted before this feature existed, since a locked application never triggers a new save on its own."
            className="mbtn mbtn-ghost mbtn-sm"
          >
            {recomputing ? 'Recomputing…' : 'Recompute all'}
          </button>
        </span>
        {showForm3 && <ChedForm3Dialog onClose={() => setShowForm3(false)} />}
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
            onClick={() => {
              if (card.key === 'appealed') return
              setStatusFilter(card.key === 'all' ? 'all' : card.key)
              applicantListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
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
      <div className="card" ref={applicantListRef} style={{ scrollMarginTop: '16px' }}>
        <div className="card-title">
          All Applicants
          {!loading && !error && (
            <span className="tag">
              {groups.length} of {searchedGroups.length} applicant{searchedGroups.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Oct 3 2026 redesign: status tabs (the stat cards above set the
            same filter). "All" replaces the old "Clear status filter". */}
        <div className="apl-tabs" role="group" aria-label="Filter applicants by status">
          {APL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`apl-tab${statusFilter === tab.key ? ' active' : ''}`}
              aria-pressed={statusFilter === tab.key}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
              <span className="apl-tab-count">{tabCounts[tab.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="reviewer-note">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            Only one admin can have an applicant open at a time. While it&rsquo;s open, the row is grayed out and
            shows who is reviewing it.
          </span>
        </div>

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or document type..."
            aria-label="Search applicants"
          />
          <select
            className="program-filter-select"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            aria-label="Filter by program"
          >
            <option value="all">All programs</option>
            {programOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
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
          <div className="apl-scroll">
           <div className="apl-table">
            <div className="apl-head" role="presentation">
              <button type="button" className="apl-th apl-th-sort" onClick={() => toggleSort('name')}>
                Applicant
                <svg className={`sort-icon ${sortArrow('name')}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 16l-6-6h12z" /></svg>
              </button>
              <span className="apl-th">Program (1st choice)</span>
              <span className="apl-th">Profile</span>
              <span className="apl-th">Documents</span>
              <button type="button" className="apl-th apl-th-sort" onClick={() => toggleSort('updated')} title="Date of the applicant's last update">
                Last Update
                <svg className={`sort-icon ${sortArrow('updated')}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 16l-6-6h12z" /></svg>
              </button>
              <span className="apl-th apl-th-right">Status</span>
            </div>
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
            &ldquo;Department&rdquo; isn&rsquo;t a field this system collects, so this is grouped by the same
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
                      title={deptSortDesc ? 'Sorted highest first within each department. Click to reset' : 'Click to sort each department by Qualified, highest first'}
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
            No literal &ldquo;Year Level&rdquo; field exists yet, so this is grouped by Applying As, the closest real proxy.
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
                        title={yearSortKey === yl.value ? 'Sorted highest first. Click to reset' : `Click to sort all programs by ${yl.label}, highest first`}
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
    return { text: `No further action. The applicant is ${SCHOLAR_STATUS_META[scholarStatus].label.toLowerCase()}.`, tone: 'stop' }
  }
  if (scholarStatus === 'passer' || scholarStatus === 'qualified_probationary') {
    if (row.distribution_status === 'enrollment_complete') {
      return { text: 'Enrollment complete. No further action needed.', tone: 'done' }
    }
    return { text: 'Ready to advance Distribution Status in section 4 below.', tone: 'go' }
  }
  if (scholarStatus === 'waitlisted_probationary') {
    return { text: 'Waitlisted pending an open slot. Re-check later, or use Change manually if a slot opens.', tone: 'wait' }
  }
  // scholarStatus is 'pending_exam' -- no exam result recorded yet, so
  // whether exam entry even applies depends on eligibility.
  if (eligStatus === 'incomplete') {
    return { text: "Eligibility: Incomplete. The applicant hasn't finished their profile yet, so exam entry doesn't apply yet.", tone: 'wait' }
  }
  if (eligStatus === 'not_qualified') {
    return { text: 'Eligibility: Not Qualified. Exam entry only applies here for a real Program Director exception.', tone: 'stop' }
  }
  // pending_exam (automated) or a manual qualified/waitlisted override --
  // either way, this is the point where recording an exam result applies.
  return { text: `Eligibility: ${ELIGIBILITY_META[eligStatus]?.label || eligStatus}. Ready for exam entry in section 1 below.`, tone: 'go' }
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
function ResultNoticeBox({ row, onSent, kind = 'result', number = null }) {
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

  // Oct 3 2026 redesign: shown as numbered section 3 ("Result notice") in
  // the applicant window, or as a sub-block of Distribution Status for the
  // endorsement notice. Same send flow as before.
  const isSection = number != null
  const heading = kind === 'endorsement' ? 'Endorsement notice' : 'Result notice'
  return (
    <div className={isSection ? 'rr-sec' : 'rr-subblock'}>
      <div className={isSection ? 'rr-sec-head' : 'rr-subblock-head'}>
        <div className="rr-sec-title-wrap">
          {isSection && <span className={`rr-num${cfg.lastAt ? ' done' : ''}`}>{number}</span>}
          <h3 className={isSection ? 'rr-sec-title' : 'rr-subblock-title'}>{heading}</h3>
        </div>
        {releasable && !open && (
          <button type="button" className={`rr-btn ${cfg.lastAt ? 'rr-btn-secondary' : 'rr-btn-primary'}`} onClick={openBox}>
            {cfg.lastAt ? 'Send again' : 'Notify applicant'}
          </button>
        )}
      </div>
      <div className={isSection ? 'rr-sec-body' : 'rr-subblock-body'}>

      {cfg.lastAt ? (
        <p className="rr-sent-line">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>
            Last sent: <b>{cfg.label(cfg.lastStatus)}</b>, {fmt(cfg.lastAt)}
            {cfg.lastBy ? ' by ' + cfg.lastBy : ''}
            {cfg.lastEmail ? ' (portal message and email)' : ' (portal message only)'}
            {cfg.lastStatus && cfg.lastStatus !== cfg.current ? '. The status has changed since then.' : '.'}
          </span>
        </p>
      ) : (
        <p className="rr-muted-line">
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
    </div>
  )
}

// Oct 3 2026 redesign (approved on the design canvas): short wording for the
// list's "Next step" column, built from the same branches as
// getNextStepHint() above so the two can't drift apart.
function getShortNextStep(row) {
  const eligStatus = row.eligibility_override || row.eligibility_status || 'incomplete'
  const scholarStatus = row.scholar_status || 'pending_exam'
  if (scholarStatus === 'disqualified' || scholarStatus === 'forfeited') return 'No further action'
  if (scholarStatus === 'passer' || scholarStatus === 'qualified_probationary') {
    if (row.distribution_status === 'enrollment_complete') return 'Enrollment complete'
    const i = DISTRIBUTION_STATUS_STEPS.findIndex(([k]) => k === row.distribution_status)
    const next = DISTRIBUTION_STATUS_STEPS[i + 1] || DISTRIBUTION_STATUS_STEPS[0]
    return `Move to ${next[1]}`
  }
  if (scholarStatus === 'waitlisted_probationary') return 'Waiting for an open slot'
  if (eligStatus === 'incomplete') return 'Waiting on applicant profile'
  if (eligStatus === 'not_qualified') return 'Not qualified (exception only)'
  return 'Record exam result'
}

const RESULT_RELEASABLE = ['passer', 'waitlisted_probationary', 'qualified_probationary', 'forfeited', 'disqualified']

const EXAM_RESULT_LABELS = { passed: 'Passed', failed: 'Failed', absent: 'Absent' }

const SCHOLAR_PILL_CLASS = {
  pending_exam: 'apl-pill-blue',
  passer: 'apl-pill-green',
  waitlisted_probationary: 'apl-pill-gold',
  qualified_probationary: 'apl-pill-gold',
  disqualified: 'apl-pill-red',
  forfeited: 'apl-pill-red',
}

const OVERRIDE_CHOICES = [
  { key: 'qualified_probationary', desc: 'Accepted under a probationary contract.' },
  { key: 'disqualified', desc: 'Removed for a later disqualification reason.' },
  { key: 'forfeited', desc: 'Gave up or lost the slot.' },
]

function rrInitials(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function rrDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function rrShortDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function RrCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ResultRow({ row, onSaveExam, onSetScholarStatus, onAdvanceDistribution, onReload, busy, lockInfo }) {
  const [examScore, setExamScore] = useState(row.exam_score ?? '')
  const [examResult, setExamResult] = useState(row.exam_result || '')
  const [examDate, setExamDate] = useState(row.exam_date || '')
  const [statusReason, setStatusReason] = useState('')
  const [pendingOverride, setPendingOverride] = useState(null) // scholar_status target, or null
  const [pendingClearDistribution, setPendingClearDistribution] = useState(false)
  // Oct 3 2026 redesign: Manual Override now sits behind "Change manually"
  // inside section 2, with the choice picked first and applied with one
  // button (still confirmed by ConfirmActionModal, same as before).
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overridePick, setOverridePick] = useState('')
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
    setOverrideOpen(false)
    setOverridePick('')
  }
  const handleClearDistributionConfirmed = () => {
    onAdvanceDistribution(row.id, 'not_applicable')
    setPendingClearDistribution(false)
  }

  // Sept 24 2026: collapsed-row + click-to-open-modal (see ApplicantGroup).
  const { modalOpen, openModal, closeModal, blockedMsg, setBlockedMsg, opening } = useLockedModal(row.id)
  const lockedByOther = !!lockInfo && !lockInfo.mine && !modalOpen

  const scholarStatus = row.scholar_status || 'pending_exam'
  const scholarLabel = SCHOLAR_STATUS_META[scholarStatus]?.label || scholarStatus
  const pillClass = SCHOLAR_PILL_CLASS[scholarStatus] || 'apl-pill-blue'
  const hint = getNextStepHint(row)
  const examLabel = EXAM_RESULT_LABELS[row.exam_result] || ''
  const examSummary = row.exam_result
    ? `${examLabel}${row.exam_score != null && row.exam_score !== '' ? ` · ${row.exam_score}` : ''}`
    : 'Not recorded'
  const resultUnsent = RESULT_RELEASABLE.includes(scholarStatus) && !row.result_notified_at
  const nextIndex = currentStepIndex + 1
  const nextStep = canDistribute ? DISTRIBUTION_STATUS_STEPS[nextIndex] || null : null

  // Progress strip: 4 stages, each done / current / upcoming / not applicable.
  const stages = (() => {
    const out = [
      {
        title: 'Entrance exam',
        value: examSummary,
        done: !!row.exam_result,
      },
      {
        title: 'Scholar status',
        value: scholarLabel,
        done: scholarStatus !== 'pending_exam',
      },
      {
        title: 'Result notice',
        value: row.result_notified_at
          ? `Sent ${rrShortDate(row.result_notified_at)}`
          : RESULT_RELEASABLE.includes(scholarStatus)
            ? 'Not sent yet'
            : 'Not yet',
        done: !!row.result_notified_at,
      },
      {
        title: 'Distribution',
        value: canDistribute
          ? DISTRIBUTION_STATUS_STEPS.find(([k]) => k === row.distribution_status)?.[1] || 'Not started'
          : 'Not applicable',
        done: row.distribution_status === 'enrollment_complete',
        na: !canDistribute,
      },
    ]
    const firstOpen = out.findIndex((s) => !s.done && !s.na)
    return out.map((s, i) => ({ ...s, current: i === firstOpen }))
  })()

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={opening}
        className={`rr-row${lockedByOther ? ' apl-row-locked' : ''}`}
        title={lockedByOther ? `${lockInfo.admin_name || 'Another admin'} is reviewing this applicant` : `Open ${row.applicant_name || 'applicant'}`}
      >
        <div className="apl-cell apl-who">
          <span className="apl-avatar">{rrInitials(row.applicant_name)}</span>
          <span className="apl-who-text">
            <span className="apl-name">{row.applicant_name || 'Unknown applicant'}</span>
            <span className="apl-sub">
              {[row.application_number, row.applicant_email || 'No email on file'].filter(Boolean).join(' · ')}
            </span>
            {lockedByOther && (
              <span className="apl-lock-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Being reviewed by {lockInfo.admin_name || 'another admin'}
              </span>
            )}
          </span>
        </div>
        <div className="apl-cell apl-stack">
          <span className="apl-main">{row.program_choice_1 || 'Not yet chosen'}</span>
          <span className="apl-sub">{row.applying_as || 'Not yet specified'}</span>
        </div>
        <div className="apl-cell apl-stack">
          <span className={`rr-exam-main ${row.exam_result === 'passed' ? 'pass' : row.exam_result ? 'fail' : 'none'}`}>
            {row.exam_result ? (row.exam_score != null && row.exam_score !== '' ? row.exam_score : examLabel) : 'Not recorded'}
          </span>
          {row.exam_result && (
            <span className="apl-sub">{row.exam_score != null && row.exam_score !== '' ? examLabel : 'No score'}</span>
          )}
        </div>
        <div className="apl-cell">
          <span className={`apl-pill ${pillClass}`}>{scholarLabel}</span>
        </div>
        <div className="apl-cell apl-status rr-next">
          <span className="rr-next-text">
            <span className={`rr-next-dot ${hint.tone}`} aria-hidden="true" />
            <span className="apl-stack">
              <span className={`rr-next-main ${hint.tone}`}>{getShortNextStep(row)}</span>
              {resultUnsent && <span className="apl-sub">Result not sent yet</span>}
            </span>
          </span>
          <svg className="apl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </button>
      <LockedNotice lockInfo={null} blockedMsg={blockedMsg} onDismiss={() => setBlockedMsg('')} />

      {!modalOpen ? null : (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
        onClick={() => closeModal()}
      >
        <div
          className="rr-window w-full max-w-3xl my-auto"
          role="dialog"
          aria-label={`${row.applicant_name || 'Applicant'} results`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rr-head">
            <div className="rr-head-top">
              <div className="rr-head-who">
                <span className="rr-head-avatar">{rrInitials(row.applicant_name)}</span>
                <div className="min-w-0">
                  <div className="rr-head-name-line">
                    <h2 className="rr-head-name">{row.applicant_name || 'Unknown applicant'}</h2>
                    <span className={`apl-pill ${pillClass}`}>{scholarLabel}</span>
                  </div>
                  <div className="rr-head-meta">
                    {row.application_number && <span className="rr-appno">{row.application_number}</span>}
                    <span>{row.applicant_email || 'No email on file'}</span>
                    {row.program_choice_1 && (
                      <span>
                        {row.program_choice_1}
                        {row.applying_as ? ` · ${row.applying_as}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => closeModal()} aria-label="Close" className="rr-close">
                &#10005;
              </button>
            </div>

            <div className="rr-stages">
              {stages.map((s, i) => (
                <div key={s.title} className={`rr-stage${s.done ? ' done' : ''}${s.current ? ' current' : ''}${s.na ? ' na' : ''}`}>
                  <span className="rr-num">{s.done ? <RrCheck /> : i + 1}</span>
                  <span className="rr-stage-text">
                    <span className="rr-stage-title">{s.title}</span>
                    <span className="rr-stage-value">{s.value}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className={`rr-next-line ${hint.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <span>
                <b>Next:</b> {hint.text}
              </span>
            </div>
          </div>

          <div className="rr-body">
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

      {/* 1 · Entrance Exam (Exam Score Entry and Verification) */}
      <section className="rr-sec">
        <div className="rr-sec-head">
          <div className="rr-sec-title-wrap">
            <span className={`rr-num${row.exam_result ? ' done' : ''}`}>1</span>
            <h3 className="rr-sec-title">Entrance exam</h3>
            {hasUnsavedExamChanges && <span className="rr-unsaved">Unsaved changes</span>}
          </div>
          {row.exam_verified_by && (
            <span className="rr-sec-meta">
              Last verified by {row.exam_verified_by}
              {row.exam_verified_at ? ` · ${rrDate(row.exam_verified_at)}` : ''}
            </span>
          )}
        </div>
        <div className="rr-sec-body">
          <div className="rr-exam-grid">
            <label className="rr-field">
              <span className="rr-label">Score</span>
              <input
                type="number"
                value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
                className="rr-input"
                placeholder="e.g. 82"
              />
            </label>
            <label className="rr-field">
              <span className="rr-label">Exam date</span>
              <input type="date" value={examDate || ''} onChange={(e) => setExamDate(e.target.value)} className="rr-input" />
            </label>
            <label className="rr-field">
              <span className="rr-label">Result</span>
              <select value={examResult} onChange={(e) => setExamResult(e.target.value)} className="rr-input">
                <option value="">Not yet recorded</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="absent">Absent (no-show)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSaveExam(row.id, { examScore, examResult, examDate })}
              className="rr-btn rr-btn-primary rr-btn-tall"
            >
              {isBusy ? 'Saving…' : 'Save & verify'}
            </button>
          </div>
          {examSuggestion.threshold != null && (
            <p className={`rr-hint ${examSuggestion.suggested === 'passed' ? 'pass' : examSuggestion.suggested === 'failed' ? 'fail' : ''}`}>
              {row.program_choice_1}&rsquo;s passing grade per Appendix J: <strong>{examSuggestion.threshold}</strong>.
              {examSuggestion.suggested && (
                <>
                  {' '}A score of {examScore} suggests <strong>{examSuggestion.suggested === 'passed' ? 'Passed' : 'Failed'}</strong>.
                  This doesn&rsquo;t auto-fill Result, so pick it above to confirm.
                </>
              )}
            </p>
          )}
          <p className="rr-muted-line">
            Nothing here is saved until you click Save &amp; verify. Saving also sets the Scholar Status: Passed becomes
            Passer, Failed becomes Waitlisted (Probationary), Absent becomes Forfeited.
          </p>
        </div>
      </section>

      {/* 2 · Scholar Status (Disqualification/Forfeiture Handling). The
          manual override is a separate write path from section 1: it fires
          on its own, after a confirm, and never saves the exam form. */}
      <section className="rr-sec">
        <div className="rr-sec-head">
          <div className="rr-sec-title-wrap">
            <span className={`rr-num${scholarStatus !== 'pending_exam' ? ' done' : ''}`}>2</span>
            <h3 className="rr-sec-title">Scholar status</h3>
          </div>
          {!overrideOpen && (
            <button type="button" className="rr-btn rr-btn-secondary" disabled={isBusy} onClick={() => setOverrideOpen(true)}>
              Change manually
            </button>
          )}
        </div>
        <div className="rr-sec-body">
          <div className="rr-status-line">
            <span className={`apl-pill apl-pill-lg ${pillClass}`}>{scholarLabel}</span>
            {row.scholar_status_set_by && (
              <span className="rr-muted-line">
                Last set by {row.scholar_status_set_by}
                {row.scholar_status_set_at ? ` · ${rrDate(row.scholar_status_set_at)}` : ''}
              </span>
            )}
          </div>
          {row.scholar_status_reason && <p className="rr-muted-line">Note: {row.scholar_status_reason}</p>}

          {overrideOpen && (
            <div className="rr-override">
              <p className="rr-override-intro">
                Manual override. Only for a real judgment call the exam result itself doesn&rsquo;t decide (Appendix D: a
                probationary contract, or a later disqualification or forfeiture reason). It applies right away and does
                not save anything typed in section 1.
              </p>
              {hasUnsavedExamChanges && (
                <div className="rr-warn">
                  You have unsaved changes in the Entrance Exam section above. Applying an override will NOT save those,
                  so save section 1 first if you meant to record an exam result.
                </div>
              )}
              <div className="rr-choices" role="group" aria-label="New scholar status">
                {OVERRIDE_CHOICES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`rr-choice rr-choice-${c.key === 'qualified_probationary' ? 'gold' : 'red'}${overridePick === c.key ? ' picked' : ''}`}
                    aria-pressed={overridePick === c.key}
                    onClick={() => setOverridePick(c.key)}
                  >
                    <span className="rr-choice-title">{SCHOLAR_STATUS_OVERRIDE_LABELS[c.key]}</span>
                    <span className="rr-choice-desc">{c.desc}</span>
                  </button>
                ))}
              </div>
              <label className="rr-field">
                <span className="rr-label">Reason / note (optional)</span>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. failed a subject under probationary contract"
                  className="rr-input"
                />
              </label>
              <div className="rr-actions">
                <button
                  type="button"
                  className="rr-btn rr-btn-secondary"
                  onClick={() => {
                    setOverrideOpen(false)
                    setOverridePick('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBusy || !overridePick}
                  onClick={() => confirmOverride(overridePick)}
                  className={`rr-btn ${overridePick === 'qualified_probationary' ? 'rr-btn-primary' : 'rr-btn-danger'}`}
                >
                  {overridePick ? `Set to ${SCHOLAR_STATUS_OVERRIDE_LABELS[overridePick]}` : 'Pick a status'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3 · Result notice */}
      <ResultNoticeBox row={row} onSent={onReload} number={3} />

      {/* 4 · Distribution Status Tracking and Statement of Subsequent Actions --
          only meaningful once a passer/qualified-probationary status exists
          (Appendix D: Registrar -> Medical or Admissions -> enrollment). The
          "statement" itself is the audit_log trail each button click writes. */}
      <section className="rr-sec">
        <div className="rr-sec-head">
          <div className="rr-sec-title-wrap">
            <span className={`rr-num${row.distribution_status === 'enrollment_complete' ? ' done' : ''}`}>4</span>
            <h3 className="rr-sec-title">Distribution Status</h3>
            <span className="rr-sec-meta">Endorsement and enrollment</span>
          </div>
          {/* Clear button -- Sept 21: data-hygiene reset of a leftover
              distribution_status; shown whenever there's something to clear. */}
          {row.distribution_status && row.distribution_status !== 'not_applicable' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setPendingClearDistribution(true)}
              className="rr-link"
            >
              Clear
            </button>
          )}
        </div>
        <div className="rr-sec-body">
          {hasStaleDistribution && (
            <div className="rr-warn">
              This applicant&rsquo;s Scholar Status no longer qualifies for distribution tracking, but a stored value
              (&ldquo;{DISTRIBUTION_STATUS_STEPS.find(([k]) => k === row.distribution_status)?.[1] || row.distribution_status}&rdquo;)
              is still on file from before. Use Clear above if this should be reset.
            </div>
          )}
          {!canDistribute ? (
            !hasStaleDistribution && (
              <p className="rr-muted-line">
                Not applicable yet. Becomes available once this applicant is a Passer or Qualified (Probationary).
              </p>
            )
          ) : (
            <>
              <div className="rr-stepper">
                <span className="rr-stepper-track" aria-hidden="true" />
                <span
                  className="rr-stepper-fill"
                  aria-hidden="true"
                  style={{ width: currentStepIndex > 0 ? `${(currentStepIndex / (DISTRIBUTION_STATUS_STEPS.length - 1)) * 80}%` : '0%' }}
                />
                {DISTRIBUTION_STATUS_STEPS.map(([key, label], i) => {
                  const isCurrent = row.distribution_status === key
                  const isPast = currentStepIndex >= 0 && i < currentStepIndex
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isBusy}
                      aria-current={isCurrent ? 'step' : undefined}
                      onClick={() => onAdvanceDistribution(row.id, key)}
                      className={`rr-step${isCurrent ? ' current' : ''}${isPast ? ' past' : ''}`}
                      title={isCurrent ? `Current: ${label}` : `Set to ${label}`}
                    >
                      <span className="rr-step-dot">{isPast ? <RrCheck /> : i + 1}</span>
                      <span className="rr-step-label">{label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="rr-actions rr-actions-split">
                <span className="rr-muted-line">
                  {row.distribution_status_updated_by && row.distribution_status !== 'not_applicable'
                    ? `Last updated by ${row.distribution_status_updated_by}${row.distribution_status_updated_at ? ` · ${rrDate(row.distribution_status_updated_at)}` : ''}. Click any step to jump to it.`
                    : 'Not started. Click any step to jump to it.'}
                </span>
                {nextStep && (
                  <button
                    type="button"
                    disabled={isBusy}
                    className="rr-btn rr-btn-primary"
                    onClick={() => onAdvanceDistribution(row.id, nextStep[0])}
                  >
                    Move to {nextStep[1]}
                  </button>
                )}
              </div>
            </>
          )}
          {!canDistribute && row.distribution_status_updated_by && row.distribution_status !== 'not_applicable' && (
            <p className="rr-muted-line">
              Last updated by {row.distribution_status_updated_by}
              {row.distribution_status_updated_at ? ` · ${rrDate(row.distribution_status_updated_at)}` : ''}
            </p>
          )}

          {canDistribute && <ResultNoticeBox row={row} onSent={onReload} kind="endorsement" />}
        </div>
      </section>
          </div>
        </div>
      </div>
      )}
    </>
  )
}

// Oct 3 2026 redesign: status tabs for the Applicant Results list.
const RESULT_TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'action', label: 'Needs action', match: (r) => getNextStepHint(r).tone === 'go' },
  { key: 'pending_exam', label: 'Pending Exam', match: (r) => (r.scholar_status || 'pending_exam') === 'pending_exam' },
  { key: 'passer', label: 'Passer', match: (r) => r.scholar_status === 'passer' },
  {
    key: 'probationary',
    label: 'Probationary',
    match: (r) => r.scholar_status === 'qualified_probationary' || r.scholar_status === 'waitlisted_probationary',
  },
  {
    key: 'out',
    label: 'Disqualified / Forfeited',
    match: (r) => r.scholar_status === 'disqualified' || r.scholar_status === 'forfeited',
  },
]

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
  // Oct 3 2026 redesign: status tabs above the table. "Needs action" uses
  // getNextStepHint()'s own 'go' tone, same as the default ordering below.
  const [tab, setTab] = useState('all')

  const searched = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = rows
    if (docFilter === 'complete') list = list.filter((r) => !!r.application_number)
    if (docFilter === 'incomplete') list = list.filter((r) => !r.application_number)
    if (term) {
      list = list.filter((r) =>
        `${r.applicant_name || ''} ${r.applicant_email || ''} ${r.application_number || ''}`.toLowerCase().includes(term)
      )
    }
    return list
  }, [rows, search, docFilter])

  const resultTabCounts = useMemo(() => {
    const counts = {}
    for (const t of RESULT_TABS) counts[t.key] = searched.filter((r) => t.match(r)).length
    return counts
  }, [searched])

  const filtered = useMemo(() => {
    const current = RESULT_TABS.find((t) => t.key === tab) || RESULT_TABS[0]
    const list = searched.filter((r) => current.match(r))
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
  }, [searched, tab])

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
              {filtered.length} of {rows.length} applicant{rows.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="apl-tabs" role="group" aria-label="Filter applicants by scholar status">
          {RESULT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`apl-tab${tab === t.key ? ' active' : ''}`}
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="apl-tab-count">{resultTabCounts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or application number..."
            aria-label="Search applicants"
          />
          <select className="program-filter-select" value={docFilter} onChange={(e) => setDocFilter(e.target.value)} aria-label="Filter by documents">
            <option value="all">All documents</option>
            <option value="complete">Documents Complete</option>
            <option value="incomplete">Documents Incomplete</option>
          </select>
          {(search.trim() !== '' || docFilter !== 'all' || tab !== 'all') && (
            <>
              <div className="filter-divider" />
              <button
                type="button"
                className="filter-clear"
                onClick={() => {
                  setSearch('')
                  setDocFilter('all')
                  setTab('all')
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
          <div className="apl-scroll">
           <div className="apl-table">
            <div className="apl-head rr-grid" role="presentation">
              <span className="apl-th">Applicant</span>
              <span className="apl-th">Program (1st choice)</span>
              <span className="apl-th">Exam</span>
              <span className="apl-th">Scholar status</span>
              <span className="apl-th">Next step</span>
            </div>
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

// Oct 3 2026 redesign (Statistics v2, approved on the design canvas):
// one KPI strip, three status panels with a "% of applicants" column, and
// an "Applicants by program" table. The panel now refreshes on its own,
// same as the Activity Log: every 15 s while the tab is visible, when the
// admin comes back to the tab, and right after any admin action pop-up.
// Same data sources as before (/api/admin-eligibility + /api/admin-results,
// joined by id, plus the appeal count from /api/admin-reschedule).
const STAT_ELIGIBILITY = [
  { key: 'qualified', label: 'Qualified', color: '#1B6B3A' },
  { key: 'not_qualified', label: 'Not Qualified', color: '#C0392B' },
  { key: 'waitlisted', label: 'Waitlisted', color: '#C8A84B' },
  { key: 'pending_exam', label: 'Pending Exam', color: '#003CD0' },
  { key: 'incomplete', label: 'Incomplete (Ongoing)', color: '#A7B4C8' },
]
const STAT_SCHOLAR = [
  { key: 'passer', label: 'Passer', color: '#1B6B3A' },
  { key: 'qualified_probationary', label: 'Qualified (Probationary)', color: '#E07B39' },
  { key: 'waitlisted_probationary', label: 'Waitlisted (Probationary)', color: '#C8A84B' },
  { key: 'disqualified', label: 'Disqualified', color: '#C0392B' },
  { key: 'forfeited', label: 'Forfeited', color: '#5A6B85' },
  { key: 'pending_exam', label: 'Pending Exam', color: '#003CD0' },
]
const STAT_APPLYING_COLORS = ['#0D2F6E', '#C8A84B', '#5A6B85', '#A7B4C8']
const STAT_POLL_MS = 15000

function statPct(n, total) {
  return total ? `${Math.round((n / total) * 100)}%` : '0%'
}

function statDepartmentOf(program) {
  const dept = DASHBOARD_DEPARTMENTS.find((d) => d.programs.includes(program))
  return dept ? dept.label : 'Not yet chosen'
}

function statAgo(ts, now) {
  if (!ts) return 'loading'
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 3) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return `${m} min ago`
}

function StatSplitPanel({ title, items, total, foot, keyLabel = 'Status' }) {
  const withCounts = items.filter((i) => i.count > 0)
  return (
    <section className="st-card">
      <div className="st-card-head">
        <h2 className="st-card-title">{title}</h2>
        <span className="st-meta">
          {total} applicant{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="st-split" role="img" aria-label={items.map((i) => `${i.label}: ${i.count}`).join(', ')}>
        {withCounts.map((i) => (
          <span key={i.label} style={{ width: statPct(i.count, total), background: i.color }} title={`${i.label}: ${i.count}`} />
        ))}
      </div>
      <table className="st-table">
        <thead>
          <tr>
            <th>{keyLabel}</th>
            <th className="r">Applicants</th>
            <th className="r">% of applicants</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.label} className={i.count ? '' : 'zero'}>
              <td>
                <span className="st-key">
                  <span className="st-dot" style={{ background: i.count ? i.color : '#D5DDEA' }} />
                  {i.label}
                </span>
              </td>
              <td className="r st-strong">{i.count}</td>
              <td className="r st-muted">{statPct(i.count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {foot && <div className="st-card-foot">{foot}</div>}
    </section>
  )
}

function AnalyticsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState(false)
  const [loadedAt, setLoadedAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [department, setDepartment] = useState('all')
  const [showEmptyPrograms, setShowEmptyPrograms] = useState(false)
  // Sept 30 2026: appeals count (progress table "... Appeals, and Waitlisted
  // Analytics"). Best effort, 0 if it can't load.
  const [appealCount, setAppealCount] = useState(0)

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true)
      setError('')
    }
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
      setRows(resultsData.applications.map((r) => ({ ...byId.get(r.id), ...r })))
      setLoadedAt(Date.now())
      setRefreshError(false)
    } catch (err) {
      // A failed background refresh keeps the numbers already on screen.
      if (quiet) setRefreshError(true)
      else setError(err.message)
    } finally {
      if (!quiet) setLoading(false)
    }
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
  }

  useEffect(() => {
    load()
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') load({ quiet: true })
    }, STAT_POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    const onFocus = () => {
      if (document.visibilityState === 'visible') load({ quiet: true })
    }
    const onNotice = () => load({ quiet: true })
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('admin-notice', onNotice)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('admin-notice', onNotice)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleRows = useMemo(
    () => (department === 'all' ? rows : rows.filter((r) => statDepartmentOf(r.program_choice_1) === department)),
    [rows, department]
  )

  const stats = useMemo(() => {
    const total = visibleRows.length
    const elig = Object.fromEntries(STAT_ELIGIBILITY.map((s) => [s.key, 0]))
    const scholar = Object.fromEntries(STAT_SCHOLAR.map((s) => [s.key, 0]))
    const applying = new Map()
    const programs = new Map()
    let profileComplete = 0

    for (const r of visibleRows) {
      const e = r.eligibility_override || r.eligibility_status || 'incomplete'
      if (e in elig) elig[e] += 1
      const s = r.scholar_status || 'pending_exam'
      if (s in scholar) scholar[s] += 1
      const a = r.applying_as || 'Not yet specified'
      applying.set(a, (applying.get(a) || 0) + 1)
      if (PROFILE_SECTIONS.every((sec) => !!r[sec.key])) profileComplete += 1

      const program = r.program_choice_1 || 'Not yet chosen'
      if (!programs.has(program)) programs.set(program, { total: 0, ...Object.fromEntries(STAT_ELIGIBILITY.map((x) => [x.key, 0])) })
      const p = programs.get(program)
      p.total += 1
      if (e in p) p[e] += 1
    }

    // Every program CCC offers (in the selected department), so empty ones
    // can be shown on request, plus any other value found in the data.
    const offered = DASHBOARD_DEPARTMENTS.filter((d) => department === 'all' || d.label === department).flatMap((d) => d.programs)
    const names = Array.from(new Set([...offered, ...programs.keys()]))
    const empty = { total: 0, ...Object.fromEntries(STAT_ELIGIBILITY.map((x) => [x.key, 0])) }
    const programRows = names
      .map((name) => ({ name, department: statDepartmentOf(name), ...(programs.get(name) || empty) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

    return {
      total,
      profileComplete,
      elig,
      scholar,
      applying: Array.from(applying.entries()).sort((a, b) => b[1] - a[1]),
      programRows,
    }
  }, [visibleRows, department])

  if (loading) return <div className="text-center py-20 text-ccc-muted text-sm">Loading statistics...</div>
  if (error) return <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>

  const programRowsShown = showEmptyPrograms ? stats.programRows : stats.programRows.filter((p) => p.total > 0)
  const kpis = [
    { label: 'Total applications', value: stats.total, sub: department === 'all' ? 'All applicants this cycle' : department },
    { label: 'Profile complete', value: stats.profileComplete, sub: `${statPct(stats.profileComplete, stats.total)} of applicants` },
    { label: 'Pending exam result', value: stats.elig.pending_exam, sub: `${statPct(stats.elig.pending_exam, stats.total)} of applicants` },
    { label: 'Qualified', value: stats.elig.qualified, sub: `${statPct(stats.elig.qualified, stats.total)} of applicants` },
    { label: 'Appeals filed', value: appealCount, sub: 'Retake or re-application, all departments' },
  ]

  return (
    <div className="st-wrap">
      <div className="st-header">
        <div>
          <h1 className="st-title">Statistics</h1>
          <p className="st-subtitle">Scholarship applications, as of today</p>
        </div>
        <div className="st-tools">
          <label htmlFor="stDept" className="st-tool-label">Department</label>
          <select id="stDept" className="st-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="all">All departments</option>
            {DASHBOARD_DEPARTMENTS.map((d) => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
          <span
            className={`st-live${refreshError ? ' st-live-warn' : ''}`}
            title="Updates on its own every 15 seconds, when you come back to this tab, and after any admin action"
            aria-live="polite"
          >
            <span className="st-live-dot" aria-hidden="true">
              <span className="st-live-pulse" />
              <span className="st-live-core" />
            </span>
            <b>{refreshError ? 'Retrying' : 'Live'}</b>
            <span className="st-live-ago">
              {refreshError ? `· couldn't refresh, last updated ${statAgo(loadedAt, now)}` : `· updated ${statAgo(loadedAt, now)}`}
            </span>
          </span>
        </div>
      </div>

      <div className="st-card st-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="st-kpi">
            <span className="st-kpi-label">{k.label}</span>
            <span className="st-kpi-value">{k.value}</span>
            <span className="st-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="st-panels">
        <StatSplitPanel
          title="Eligibility status"
          total={stats.total}
          items={STAT_ELIGIBILITY.map((s) => ({ ...s, count: stats.elig[s.key] }))}
        />
        <StatSplitPanel
          title="Scholar status (after exam)"
          total={stats.total}
          items={STAT_SCHOLAR.map((s) => ({ ...s, count: stats.scholar[s.key] }))}
          foot={
            <>
              Appeals filed (retake or re-application): <b>{appealCount}</b>. Details are in Appeals &amp; Reschedules.
            </>
          }
        />
        <StatSplitPanel
          title="Applying as"
          keyLabel="Applying as"
          total={stats.total}
          items={stats.applying.map(([label, count], i) => ({
            label,
            count,
            color: STAT_APPLYING_COLORS[i % STAT_APPLYING_COLORS.length],
          }))}
          foot="Used in place of Year Level, which the application form does not collect."
        />
      </div>

      <section className="st-card">
        <div className="st-card-head st-card-head-wrap">
          <div>
            <h2 className="st-card-title">Applicants by program</h2>
            <span className="st-meta">Grouped by 1st choice program. Eligibility status per program.</span>
          </div>
          <label className="st-check">
            <input type="checkbox" checked={showEmptyPrograms} onChange={(e) => setShowEmptyPrograms(e.target.checked)} />
            Show programs with no applicants
          </label>
        </div>
        <div className="st-scroll">
          <table className="st-table st-program-table">
            <thead>
              <tr>
                <th>Program</th>
                <th className="r">Applicants</th>
                <th className="r">Qualified</th>
                <th className="r">Not Qualified</th>
                <th className="r">Waitlisted</th>
                <th className="r">Pending Exam</th>
                <th className="r">Incomplete</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {programRowsShown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="st-empty">No applicants in this department yet.</td>
                </tr>
              ) : (
                programRowsShown.map((p) => (
                  <tr key={p.name} className={p.total ? '' : 'zero'}>
                    <td>
                      <span className="st-prog">{p.name}</span>
                      <span className="st-dept">{p.department}</span>
                    </td>
                    <td className="r st-strong">{p.total}</td>
                    <td className="r">{p.qualified}</td>
                    <td className="r">{p.not_qualified}</td>
                    <td className="r">{p.waitlisted}</td>
                    <td className="r">{p.pending_exam}</td>
                    <td className="r">{p.incomplete}</td>
                    <td>
                      <span className="st-split st-split-sm" aria-hidden="true">
                        {STAT_ELIGIBILITY.filter((s) => p[s.key] > 0).map((s) => (
                          <span key={s.key} style={{ width: statPct(p[s.key], p.total), background: s.color }} />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="r">{stats.total}</td>
                <td className="r">{stats.elig.qualified}</td>
                <td className="r">{stats.elig.not_qualified}</td>
                <td className="r">{stats.elig.waitlisted}</td>
                <td className="r">{stats.elig.pending_exam}</td>
                <td className="r">{stats.elig.incomplete}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="st-footnote">
        Department is derived from the program. Year Level is not collected, so Applying As is used instead. Allowance
        Distribution Monitoring and exportable LGU reports are to-follow modules, out of scope for this version.
      </p>
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
  const [feedType, setFeedType] = useState('all') // 'all' | 'announcement' | 'message'
  const [feedSearch, setFeedSearch] = useState('')
  const [feedCategory, setFeedCategory] = useState('all')
  const [expandedIds, setExpandedIds] = useState([])
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

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

  // Oct 3 2026 redesign: feed filters, "Show more" and a delete confirm.
  const targetLabel = (item) =>
    item.type !== 'message'
      ? 'Everyone (public)'
      : item.target_type === 'specific'
        ? applicants.find((a) => a.id === item.target_application_id)?.applicant_name || 'Applicant'
        : item.target_type === 'category'
          ? `Group: ${ELIGIBILITY_META[item.target_category]?.label || item.target_category}`
          : 'All Applicants'
  const categoryLabel = (c) => COMM_CATEGORY_LABELS[c] || c
  const feedCategories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)))
  const feedTypeCount = (t) => items.filter((i) => t === 'all' || (t === 'message' ? i.type === 'message' : i.type !== 'message')).length
  const feed = items.filter((i) => {
    if (feedType === 'message' && i.type !== 'message') return false
    if (feedType === 'announcement' && i.type === 'message') return false
    if (feedCategory !== 'all' && i.category !== feedCategory) return false
    const q = feedSearch.trim().toLowerCase()
    if (!q) return true
    return `${i.title || ''} ${i.body || ''} ${targetLabel(i)}`.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Communications</h1>
          <p>Post public announcements and send private messages to signed-in applicants.</p>
        </div>
      </div>

      <div className="cm-layout">
        <section className="cm-card cm-composer">
          <div className="cm-head">
            <h2 className="cm-title">New post</h2>
            <span className="cm-meta">Sends right away</span>
          </div>
          <form onSubmit={handlePost} className="cm-form">
            <div className="cm-field">
              <span className="cm-label" id="commTypeLabel">Type</span>
              <div className="cm-type-grid" role="group" aria-labelledby="commTypeLabel">
                {[
                  { key: 'announcement', label: 'Announcement', desc: 'Public. Guest page and every applicant.' },
                  { key: 'message', label: 'Message', desc: 'Private. Applicant Messages tab only.' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`cm-type${commType === t.key ? ' on' : ''}`}
                    aria-pressed={commType === t.key}
                    onClick={() => setCommType(t.key)}
                  >
                    <span className={`cm-type-icon ${t.key}`}>
                      {t.key === 'announcement' ? <IconMegaphone /> : <IconMail />}
                    </span>
                    <span className="cm-type-text">
                      <span className="cm-type-name">{t.label}</span>
                      <span className="cm-type-desc">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {!commType && <p className="cm-hint">Choose a type to start. Each one serves a different purpose.</p>}

            {commType && (
              <>
                {commType === 'message' && (
                  <div className="cm-field">
                    <span className="cm-label" id="msgTargetLabel">Send to</span>
                    <div className="cm-seg" role="group" aria-labelledby="msgTargetLabel">
                      {[
                        ['all', 'All applicants'],
                        ['specific', 'One applicant'],
                        ['category', 'Status group'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`cm-seg-btn${targetType === key ? ' on' : ''}`}
                          aria-pressed={targetType === key}
                          onClick={() => setTargetType(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {targetType === 'specific' && (
                      <select
                        id="msgTargetApplicant"
                        aria-label="Applicant"
                        className="cm-input"
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
                    )}
                    {targetType === 'category' && (
                      <select
                        id="msgTargetCategory"
                        aria-label="Status group"
                        className="cm-input"
                        value={targetCategory}
                        onChange={(e) => setTargetCategory(e.target.value)}
                      >
                        {COMM_ELIGIBILITY_CATEGORIES.map((key) => (
                          <option key={key} value={key}>
                            {ELIGIBILITY_META[key]?.label || key}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="cm-row2">
                  <div className="cm-field">
                    <label className="cm-label" htmlFor="commTitle">Title</label>
                    <input
                      id="commTitle"
                      className="cm-input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Scholarship Examination Schedule Released"
                      required
                    />
                  </div>
                  <div className="cm-field">
                    <label className="cm-label" htmlFor="commCategory">Category</label>
                    <select id="commCategory" className="cm-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {COMM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {COMM_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cm-field">
                  <label className="cm-label" htmlFor="commBody">Message</label>
                  <textarea
                    id="commBody"
                    className="cm-input cm-textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    placeholder={commType === 'announcement' ? 'Write the announcement…' : 'Write the message to applicants…'}
                    required
                  />
                </div>

                <div className={`cm-scope ${commType}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span>
                    {commType === 'announcement'
                      ? 'Public. Shows on the guest (public) page and in every applicant’s portal as soon as you publish.'
                      : 'Private. Goes to the selected recipients’ Messages in the Applicant Portal. Never shown on the public page.'}
                  </span>
                </div>

                {postError && <p className="cm-error">{postError}</p>}
                <button type="submit" disabled={posting} className="cm-btn cm-btn-primary cm-btn-block">
                  {posting
                    ? commType === 'announcement' ? 'Posting…' : 'Sending…'
                    : commType === 'announcement' ? 'Publish announcement' : 'Send message'}
                </button>
              </>
            )}
          </form>
        </section>

        <section className="cm-card">
          <div className="cm-head cm-head-wrap">
            <div className="cm-head-left">
              <h2 className="cm-title">Posted</h2>
              <span className="tag">{items.length} total</span>
            </div>
            <div className="cm-tabs" role="group" aria-label="Filter posts by type">
              {[
                ['all', 'All'],
                ['announcement', 'Announcements'],
                ['message', 'Messages'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`cm-tab${feedType === key ? ' on' : ''}`}
                  aria-pressed={feedType === key}
                  onClick={() => setFeedType(key)}
                >
                  {label} <span className="cm-tab-count">{feedTypeCount(key)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="cm-filters">
            <input
              type="search"
              className="cm-input"
              aria-label="Search posts"
              placeholder="Search by title, message or applicant…"
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
            />
            <select
              className="cm-input cm-filter-cat"
              aria-label="Filter by category"
              value={feedCategory}
              onChange={(e) => setFeedCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {feedCategories.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-ccc-muted text-center py-8">Loading…</p>
          ) : error ? (
            <p className="text-sm text-ccc-red text-center py-8">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ccc-muted text-center py-8">Nothing posted yet.</p>
          ) : feed.length === 0 ? (
            <p className="text-sm text-ccc-muted text-center py-8">No posts match your search and filters.</p>
          ) : (
            <div>
              {feed.map((item) => {
                const isMsg = item.type === 'message'
                const long = (item.body || '').length > 170
                const open = expandedIds.includes(item.id)
                return (
                  <article key={item.id} className="cm-item">
                    <span className={`cm-item-icon ${isMsg ? 'message' : 'announcement'}`}>
                      {isMsg ? <IconMail /> : <IconMegaphone />}
                    </span>
                    <div className="cm-item-main">
                      <h3 className="cm-item-title">{item.title}</h3>
                      <div className="cm-chips">
                        <span className={`cm-chip ${isMsg ? 'message' : 'announcement'}`}>{isMsg ? 'Message' : 'Announcement'}</span>
                        <span className="cm-chip target">{targetLabel(item)}</span>
                        {item.category && <span className="cm-chip cat">{categoryLabel(item.category)}</span>}
                      </div>
                      <p className={`cm-item-body${long && !open ? ' clamp' : ''}`}>{item.body}</p>
                      <div className="cm-item-meta">
                        <span>
                          {item.author} · {formatWhen(item.created_at)}
                        </span>
                        {long && (
                          <button
                            type="button"
                            className="cm-more"
                            onClick={() =>
                              setExpandedIds((prev) => (prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]))
                            }
                          >
                            {open ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                      {confirmDeleteId === item.id && (
                        <div className="cm-confirm">
                          <span>
                            {isMsg
                              ? `Delete this message? ${targetLabel(item)} will no longer see it.`
                              : 'Delete this announcement? It disappears from the guest page and every portal.'}
                          </span>
                          <span className="cm-confirm-actions">
                            <button type="button" className="cm-btn cm-btn-secondary" onClick={() => setConfirmDeleteId(null)}>
                              Keep it
                            </button>
                            <button
                              type="button"
                              className="cm-btn cm-btn-danger"
                              disabled={deletingId === item.id}
                              onClick={async () => {
                                await handleDelete(item.id)
                                setConfirmDeleteId(null)
                              }}
                            >
                              {deletingId === item.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="cm-del"
                      disabled={deletingId === item.id}
                      onClick={() => setConfirmDeleteId(item.id)}
                      title={isMsg ? 'Delete message' : 'Delete announcement'}
                      aria-label={`Delete ${item.title}`}
                    >
                      <IconTrash />
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function IconMegaphone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}


// Oct 5 2026: role cards for Admin Accounts (Registrar and LGU added).
const ADMIN_ROLE_OPTIONS = [
  { key: 'admin', label: 'Admin', desc: 'Reviews applicants, results, schedules, requests and communications.' },
  { key: 'super_admin', label: 'Super Admin', desc: 'Everything an Admin does, plus Admin Accounts and System & Activity.' },
  { key: 'registrar', label: 'Office of the Registrar', desc: 'Posts allowances for scholars. Sees Dashboard counts only.' },
  { key: 'lgu', label: 'LGU (view only)', desc: 'Views and downloads reports CCC releases. Access ends on a set date.' },
]
const ADMIN_ROLE_LABEL = Object.fromEntries(ADMIN_ROLE_OPTIONS.map((r) => [r.key, r.label]))
const ADMIN_ROLE_PHRASE = {
  admin: 'an Admin',
  super_admin: 'a Super Admin',
  registrar: 'the Office of the Registrar',
  lgu: 'an LGU (view only) account',
}
const LGU_DEFAULT_DAYS = 7

// YYYY-MM-DD in Manila, and simple day math on those strings.
function manilaTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}
function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}
function formatYmd(ymd, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return ''
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

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
  // Oct 5 2026: LGU access window (defaults to today through 7 days later).
  const [newFrom, setNewFrom] = useState(() => manilaTodayYmd())
  const [newUntil, setNewUntil] = useState(() => addDaysYmd(manilaTodayYmd(), LGU_DEFAULT_DAYS))
  const [datesFrom, setDatesFrom] = useState('')
  const [datesUntil, setDatesUntil] = useState('')

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
    if (newRole === 'lgu') {
      if (!newFrom || !newUntil) {
        setFormError('Please set both access dates for the LGU account.')
        return
      }
      if (newUntil < newFrom) {
        setFormError('The access end date must be on or after the start date.')
        return
      }
    }
    openConfirm({
      type: 'invite',
      title: 'Confirm Invite',
      desc: `Re-enter your password to invite ${newName.trim()} (${newEmail.trim()}) as ${ADMIN_ROLE_PHRASE[newRole]}${
        newRole === 'lgu' ? `, with access from ${formatYmd(newFrom)} to ${formatYmd(newUntil)}` : ''
      }.`,
    })
  }

  const requestDates = (acc) => {
    setNotice(null)
    setDatesFrom(acc.access_from || manilaTodayYmd())
    setDatesUntil(acc.access_until || addDaysYmd(manilaTodayYmd(), LGU_DEFAULT_DAYS))
    openConfirm({
      type: 'dates',
      account: acc,
      title: 'Change Access Dates',
      desc: `Set when ${acc.name} can sign in. Re-enter your password to save.`,
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
    if (confirmAction.type === 'dates' && (!datesFrom || !datesUntil || datesUntil < datesFrom)) {
      setConfirmError('Please set a start date and an end date on or after it.')
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
            role: newRole,
            isSuperAdmin: newRole === 'super_admin',
            accessFrom: newRole === 'lgu' ? newFrom : undefined,
            accessUntil: newRole === 'lgu' ? newUntil : undefined,
            confirmPassword,
          }),
        })
      } else if (confirmAction.type === 'dates') {
        res = await fetch('/api/admin-accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'dates',
            email: confirmAction.account.email,
            accessFrom: datesFrom,
            accessUntil: datesUntil,
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
        setNewFrom(manilaTodayYmd())
        setNewUntil(addDaysYmd(manilaTodayYmd(), LGU_DEFAULT_DAYS))
      } else if (action.type === 'dates') {
        setAccounts((prev) => prev.map((a) => (a.email === data.account.email ? { ...a, ...data.account } : a)))
        setNotice({
          tone: 'done',
          text: `${data.account.name} can now sign in from ${formatYmd(data.account.access_from)} to ${formatYmd(data.account.access_until)}.`,
        })
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

  // Oct 3 2026 redesign: summary row, invite form beside an accounts table,
  // role picked with two cards, labeled Reset password / Remove buttons and
  // a restyled password check. Same rules and requests as before.
  const roleOf = (a) => a.role_key || (a.is_super_admin ? 'super_admin' : 'admin')
  const superCount = accounts.filter((a) => roleOf(a) === 'super_admin').length
  const adminCount = accounts.filter((a) => roleOf(a) === 'admin').length
  const registrarCount = accounts.filter((a) => roleOf(a) === 'registrar').length
  const lguCount = accounts.filter((a) => roleOf(a) === 'lgu').length
  const waitingCount = accounts.filter((a) => pendingState(a)).length
  const confirmTone = confirmAction?.type === 'remove' ? 'danger' : 'primary'
  const confirmLabel =
    confirmAction?.type === 'invite'
      ? 'Invite'
      : confirmAction?.type === 'reset'
        ? 'Send new password'
        : confirmAction?.type === 'dates'
          ? 'Save dates'
          : 'Remove'

  return (
    <div>
      <div className="portal-header aa-header">
        <div>
          <h1>Admin Accounts</h1>
          <p>
            Invite and manage the people who can use this admin console. They&apos;ll get an email with a temporary
            password and choose their own when they first sign in. Inviting, resetting, changing access dates and
            removing accounts all ask for your password first.
          </p>
        </div>
        <span className="aa-super-chip">
          <IconShield className="w-3.5 h-3.5" /> Super Admin only
        </span>
      </div>

      {/* Oct 1 2026: plain success/failure notices are toasts; a notice
          carrying a temporary password stays here until dismissed. */}
      {notice && !notice.tempPassword && (
        <AdminToast message={notice.text} tone={notice.tone === 'done' ? 'success' : 'error'} onDone={() => setNotice(null)} />
      )}
      {notice && notice.tempPassword && (
        <div className={`aa-temp ${notice.tone === 'done' ? 'done' : 'warn'}`}>
          <IconAlertTriangle className="w-5 h-5 shrink-0" />
          <div className="aa-temp-main">
            <span className="aa-temp-text">{notice.text}</span>
            <span className="aa-temp-row">
              <code className="aa-temp-code">{notice.tempPassword}</code>
              <CopyHashButton hash={notice.tempPassword} label="Copy" />
            </span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="aa-temp-x" aria-label="Dismiss">
            &#10005;
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="cm-card cm-kpis">
          <div className="cm-kpi">
            <span className="cm-kpi-label">Accounts</span>
            <span className="cm-kpi-value">{accounts.length}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Super Admins</span>
            <span className="cm-kpi-value">{superCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Admins</span>
            <span className="cm-kpi-value">{adminCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Registrar</span>
            <span className="cm-kpi-value">{registrarCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">LGU (view only)</span>
            <span className="cm-kpi-value">{lguCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Waiting to set a password</span>
            <span className="cm-kpi-value">{waitingCount}</span>
          </div>
        </div>
      )}

      <div className="cm-layout aa-layout">
        <section className="cm-card">
          <div className="cm-head">
            <h2 className="cm-title">Invite an account</h2>
          </div>
          <form className="cm-form" onSubmit={requestInvite}>
            {formError && <div className="aa-form-error">{formError}</div>}
            <div className="cm-field">
              <label className="cm-label" htmlFor="aaName">Full name or office</label>
              <input id="aaName" className="cm-input" type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Grace Villanueva" required />
            </div>
            <div className="cm-field">
              <label className="cm-label" htmlFor="aaEmail">Email</label>
              <input id="aaEmail" className="cm-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@ccc.edu.ph" required />
            </div>
            <div className="cm-field">
              <span className="cm-label" id="aaRoleLabel">Role</span>
              <div className="aa-roles aa-roles-grid" role="group" aria-labelledby="aaRoleLabel">
                {ADMIN_ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`cm-type aa-role${newRole === r.key ? ' on' : ''}`}
                    aria-pressed={newRole === r.key}
                    onClick={() => setNewRole(r.key)}
                  >
                    <span className="cm-type-text">
                      <span className="cm-type-name">{r.label}</span>
                      <span className="cm-type-desc">{r.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {newRole === 'lgu' && (
              <div className="aa-window">
                <span className="cm-label">Access window</span>
                <div className="aa-window-row">
                  <div className="cm-field">
                    <label className="aa-window-label" htmlFor="aaFrom">Access from</label>
                    <input
                      id="aaFrom"
                      className="cm-input"
                      type="date"
                      value={newFrom}
                      onChange={(e) => {
                        const v = e.target.value
                        setNewFrom(v)
                        if (v) setNewUntil(addDaysYmd(v, LGU_DEFAULT_DAYS))
                      }}
                      required
                    />
                  </div>
                  <div className="cm-field">
                    <label className="aa-window-label" htmlFor="aaUntil">Access until</label>
                    <input id="aaUntil" className="cm-input" type="date" value={newUntil} min={newFrom || undefined}
                      onChange={(e) => setNewUntil(e.target.value)} required />
                  </div>
                </div>
                <span className="aa-window-note">
                  Starts as 7 days. Outside these dates their sign-in is refused. They only see reports CCC has released to
                  the LGU.
                </span>
              </div>
            )}
            <div className="cm-scope muted">
              <IconMail />
              <span>They get an email with a temporary password and choose their own the first time they sign in.</span>
            </div>
            <button type="submit" className="cm-btn cm-btn-primary cm-btn-block">
              Invite
            </button>
          </form>
        </section>

        <section className="cm-card">
          <div className="cm-head">
            <div className="cm-head-left">
              <h2 className="cm-title">Current accounts</h2>
              {!loading && !error && (
                <span className="tag">
                  {accounts.length} account{accounts.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
          ) : error ? (
            <p className="text-sm text-ccc-red text-center py-8">{error}</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-ccc-muted text-center py-8">No admin accounts found.</p>
          ) : (
            <>
              <div className="st-scroll">
                <table className="st-table aa-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Access</th>
                      <th>Status</th>
                      <th className="r">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => {
                      const isSelf = acc.email.toLowerCase() === myEmail
                      const pending = pendingState(acc)
                      const role = roleOf(acc)
                      const isLgu = role === 'lgu'
                      // Status: invite state first, then (LGU only) the access window.
                      const status = pending
                        ? pending
                        : isLgu && acc.access_state === 'not_started'
                          ? 'notstarted'
                          : isLgu && acc.access_state === 'ended'
                            ? 'ended'
                            : 'active'
                      const statusLabel = {
                        expired: 'Invite expired',
                        pending: 'Pending setup',
                        notstarted: 'Access not started',
                        ended: 'Access ended',
                        active: 'Active',
                      }[status]
                      const statusTitle = {
                        expired: 'Their temporary password expired. Use Reset password to send a new one.',
                        pending: 'Invited. Waiting for them to sign in and choose their own password.',
                        notstarted: 'Their access start date has not come yet.',
                        ended: 'Their access end date has passed. Use Change dates to give them more time.',
                        active: 'Signed in with their own password.',
                      }[status]
                      const onlyRegistrar = role === 'registrar' && registrarCount <= 1
                      const removeOff = isSelf || onlyRegistrar
                      return (
                        <tr key={acc.email}>
                          <td>
                            <div className="aa-who">
                              <span className={`aa-avatar-2${isSelf ? ' self' : ''}`}>{getInitials(acc.name)}</span>
                              <span className="aa-who-text">
                                <span className="aa-name-line">
                                  <span className="aa-name-2">{acc.name}</span>
                                  {isSelf && <span className="aa-you">You</span>}
                                </span>
                                <span className="aa-email-2">{acc.email}</span>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`aa-chip ${role === 'super_admin' ? 'super' : role === 'admin' ? 'admin' : 'limited'}`}>
                              {ADMIN_ROLE_LABEL[role]}
                            </span>
                          </td>
                          <td className="aa-access">
                            {isLgu ? `${formatYmd(acc.access_from, { month: 'short', day: 'numeric' })} to ${formatYmd(acc.access_until)}` : 'No end date'}
                          </td>
                          <td>
                            <span className={`aa-chip status ${status}`} title={statusTitle}>
                              <span className="aa-dot" />
                              {statusLabel}
                            </span>
                          </td>
                          <td className="r">
                            <span className="aa-actions">
                              {isLgu && (
                                <button type="button" onClick={() => requestDates(acc)} className="aa-act" title="Change when this LGU account can sign in">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="5" width="18" height="16" rx="2" />
                                    <path d="M3 10h18M8 3v4M16 3v4" />
                                  </svg>
                                  Change dates
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => requestReset(acc)}
                                disabled={isSelf}
                                className="aa-act"
                                title={isSelf ? "You can't reset your own password here." : 'Email a new temporary password'}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="8" cy="15" r="4" />
                                  <path d="m11 12 9-9M17 6l3 3" />
                                </svg>
                                Reset password
                              </button>
                              <button
                                type="button"
                                className="aa-act danger"
                                onClick={() => requestRemove(acc)}
                                disabled={removeOff}
                                title={
                                  isSelf
                                    ? 'You cannot remove your own account while signed in as it.'
                                    : onlyRegistrar
                                      ? 'This is the only Registrar account. Invite another Registrar account first.'
                                      : 'Remove this account'
                                }
                              >
                                <IconTrash />
                                Remove
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="aa-foot">
                You can&apos;t reset or remove your own account, the last Super Admin, or the only Registrar account.{' '}
                <b>Pending setup</b> means they haven&apos;t signed in to choose a password yet; <b>Invite expired</b> means use
                Reset password to send a new one; <b>Access ended</b> means an LGU account&apos;s end date has passed, so use
                Change dates to give it more time.
              </div>
            </>
          )}
        </section>
      </div>

      {/* Password confirm pop-up (ported from Ivy's admin.html,
          #adminActionPasswordOverlay), restyled Oct 3 2026. */}
      {confirmAction && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && closeConfirm()}>
          <form className="aa-confirm" role="dialog" aria-modal="true" aria-label={confirmAction.title} onSubmit={submitConfirm}>
            <div className="aa-confirm-body">
              <span className={`aa-confirm-icon ${confirmTone}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <h3 className="aa-confirm-title">{confirmAction.title}</h3>
              <p className="aa-confirm-desc">{confirmAction.desc}</p>
              {confirmAction.type === 'dates' && (
                <div className="aa-window-row">
                  <div className="cm-field">
                    <label className="cm-label" htmlFor="aaDatesFrom">Access from</label>
                    <input id="aaDatesFrom" className="cm-input" type="date" value={datesFrom} onChange={(e) => setDatesFrom(e.target.value)} />
                  </div>
                  <div className="cm-field">
                    <label className="cm-label" htmlFor="aaDatesUntil">Access until</label>
                    <input id="aaDatesUntil" className="cm-input" type="date" value={datesUntil} min={datesFrom || undefined}
                      onChange={(e) => setDatesUntil(e.target.value)} />
                  </div>
                </div>
              )}
              <label className="cm-label" htmlFor="aaConfirmPw">Your password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="aaConfirmPw"
                  className="cm-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  autoFocus={confirmAction.type !== 'dates'}
                  style={{ paddingRight: 40 }}
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
              {confirmError && <p className="aa-confirm-error">{confirmError}</p>}
            </div>
            <div className="aa-confirm-foot">
              <button type="button" className="cm-btn cm-btn-secondary" onClick={closeConfirm} disabled={confirmBusy}>
                Cancel
              </button>
              <button type="submit" className={`cm-btn ${confirmTone === 'danger' ? 'cm-btn-danger' : 'cm-btn-primary'}`} disabled={confirmBusy}>
                {confirmBusy ? 'Working...' : confirmLabel}
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

const ACTIVITY_CATEGORIES = ['Documents', 'Eligibility', 'Results', 'Communications', 'Allowance', 'Reports', 'Admin Accounts', 'System']

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
          Application cycle controls, and a running, auto-recorded timeline of system activity: document uploads,
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
  const batchSize = data?.batchSize || 100
  const sentCount = schedules.filter((s) => s.sent_at).length
  const scheduledCount = schedules.reduce((n, s) => n + s.applicants.length, 0)
  const dateParts = (iso) => {
    try {
      const d = new Date(`${iso}T00:00:00+08:00`)
      return {
        mon: d.toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' }).toUpperCase(),
        day: d.toLocaleDateString('en-PH', { day: 'numeric', timeZone: 'Asia/Manila' }),
        dow: d.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' }),
      }
    } catch {
      return { mon: '', day: iso, dow: '' }
    }
  }

  // Oct 3 2026 redesign: summary strip, the form beside the batches, and
  // each batch as a card. Every action and rule is the same as before.
  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Exam Schedules</h1>
          <p>
            Create an entrance exam batch and send the schedule to its applicants. Batches fill with the next applicants in
            submission order, up to {batchSize} per batch. Someone removed from a batch goes back to the waiting list and is
            picked first for the next batch.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-ccc-red mb-3">{error}</p>}
      <AdminToast message={notice} onDone={() => setNotice('')} />

      {data && (
        <div className="cm-card cm-kpis">
          <div className="cm-kpi">
            <span className="cm-kpi-label">Waiting for a schedule</span>
            <span className="cm-kpi-value">{data.waitingCount}</span>
            <span className="cm-kpi-sub">Submitted applicants not in a batch</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Batches</span>
            <span className="cm-kpi-value">{schedules.length}</span>
            <span className="cm-kpi-sub">
              {sentCount} sent · {schedules.length - sentCount} not sent yet
            </span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Applicants scheduled</span>
            <span className="cm-kpi-value">{scheduledCount}</span>
            <span className="cm-kpi-sub">Across all batches</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Batch size</span>
            <span className="cm-kpi-value">{batchSize}</span>
            <span className="cm-kpi-sub">Applicants per batch, max</span>
          </div>
        </div>
      )}

      <div className="cm-layout es-layout">
        <section className="cm-card cm-composer">
          <div className="cm-head">
            <h2 className="cm-title">New exam batch</h2>
          </div>
          <form onSubmit={createBatch} className="cm-form">
            <div className="cm-field">
              <label className="cm-label" htmlFor="esLabel">Batch name</label>
              <input id="esLabel" className="cm-input" value={form.batchLabel} maxLength={80} placeholder="e.g. Batch 1"
                onChange={(e) => setForm((f) => ({ ...f, batchLabel: e.target.value }))} />
            </div>
            <div className="cm-field">
              <label className="cm-label" htmlFor="esDate">Exam date</label>
              <input id="esDate" className="cm-input" type="date" value={form.examDate}
                onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))} />
            </div>
            <div className="es-row2">
              <div className="cm-field">
                <label className="cm-label" htmlFor="esStart">Start <span className="cm-opt">(optional)</span></label>
                <input id="esStart" className="cm-input" type="time" value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="cm-field">
                <label className="cm-label" htmlFor="esEnd">End <span className="cm-opt">(optional)</span></label>
                <input id="esEnd" className="cm-input" type="time" value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="cm-field">
              <label className="cm-label" htmlFor="esVenue">Venue <span className="cm-opt">(optional)</span></label>
              <input id="esVenue" className="cm-input" value={form.venue} maxLength={150} placeholder="e.g. CCC Main Campus, Room 101"
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
            </div>
            <div className="cm-field">
              <label className="cm-label" htmlFor="esNotes">Notes for applicants <span className="cm-opt">(optional)</span></label>
              <textarea id="esNotes" className="cm-input cm-textarea" style={{ minHeight: 84 }} rows={3} value={form.notes} maxLength={1000}
                placeholder="e.g. what to bring" onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="cm-scope muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>
                The batch takes the next waiting applicants, up to {batchSize}. Nobody is notified until you click Send
                schedule.
              </span>
            </div>
            <button type="submit" className="cm-btn cm-btn-primary cm-btn-block" disabled={busy || !form.batchLabel.trim() || !form.examDate}>
              {busy ? 'Working...' : 'Create batch'}
            </button>
          </form>
        </section>

        <section className="cm-card">
          <div className="cm-head">
            <div className="cm-head-left">
              <h2 className="cm-title">Batches</h2>
              {!loading && (
                <span className="tag">
                  {schedules.length} batch{schedules.length === 1 ? '' : 'es'}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-ccc-muted text-center py-8">No exam batches yet.</p>
          ) : (
            <div className="es-list">
              {schedules.map((s) => {
                const isOpen = openId === s.id
                const optedIn = s.applicants.filter((a) => a.email_updates_opt_in).length
                const dp = dateParts(s.exam_date)
                const pct = Math.min(100, Math.round((s.applicants.length / batchSize) * 100))
                return (
                  <article key={s.id} className="es-batch">
                    <div className="es-batch-top">
                      <div className="es-date" aria-label={fmtDate(s.exam_date)}>
                        <span className="es-date-mon">{dp.mon}</span>
                        <span className="es-date-day">{dp.day}</span>
                        <span className="es-date-dow">{dp.dow}</span>
                      </div>
                      <div className="es-batch-main">
                        <div className="es-batch-row">
                          <div className="es-batch-info">
                            <div className="es-name-line">
                              <h3 className="es-name">{s.batch_label}</h3>
                              <span className={`es-state ${s.sent_at ? 'sent' : 'draft'}`}>{s.sent_at ? 'Sent' : 'Not sent yet'}</span>
                            </div>
                            <div className="es-where">
                              <span>
                                <IconClock className="w-3.5 h-3.5" /> {s.exam_time || 'Time not set'}
                              </span>
                              <span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
                                  <circle cx="12" cy="10" r="2.5" />
                                </svg>{' '}
                                {s.venue || 'Venue not set'}
                              </span>
                            </div>
                          </div>
                          <div className="es-actions">
                            <button type="button" className="cm-btn cm-btn-secondary" onClick={() => setOpenId(isOpen ? null : s.id)}>
                              {isOpen ? 'Hide applicants' : 'View applicants'}
                            </button>
                            {!s.sent_at && s.applicants.length < batchSize && data?.waitingCount > 0 && (
                              <button type="button" className="cm-btn cm-btn-secondary" disabled={busy}
                                onClick={() => simpleAction({ action: 'fill', scheduleId: s.id }, (j) => `Added ${j.added} applicant${j.added === 1 ? '' : 's'}.`)}>
                                Fill up to {batchSize}
                              </button>
                            )}
                            {!s.sent_at && (
                              <button type="button" className="es-icon-btn" disabled={busy} aria-label={`Delete ${s.batch_label}`}
                                title="Delete batch (its applicants go back to the waiting list)"
                                onClick={() => {
                                  if (window.confirm(`Delete ${s.batch_label}? Its applicants go back to the waiting list.`)) {
                                    simpleAction({ action: 'delete', scheduleId: s.id }, 'Batch deleted.')
                                  }
                                }}>
                                <IconTrash />
                              </button>
                            )}
                            <button type="button" className="cm-btn cm-btn-primary" disabled={busy || s.applicants.length === 0}
                              onClick={() => openSend(s.id)}>
                              {s.sent_at ? 'Send again' : 'Send schedule'}
                            </button>
                          </div>
                        </div>
                        <div className="es-capacity">
                          <span className="es-bar" aria-hidden="true">
                            <span style={{ width: `${Math.max(pct, s.applicants.length ? 2 : 0)}%` }} />
                          </span>
                          <span className="es-count">
                            <b>{s.applicants.length}</b> / {batchSize} applicants
                          </span>
                          <span className="es-sub">{optedIn} of {s.applicants.length} opted in to email</span>
                          <span className={`es-sub es-sent ${s.sent_at ? 'sent' : 'draft'}`}>
                            {s.sent_at
                              ? `Sent ${fmtDateTime(s.sent_at)}${s.sent_by ? ' by ' + s.sent_by : ''}`
                              : 'Not sent yet. Applicants can still be changed.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {sendBox && sendBox.scheduleId === s.id && (
                      <div className="es-send">
                        <div className="es-send-head">
                          <b>
                            Send schedule to {s.applicants.length} applicant{s.applicants.length === 1 ? '' : 's'}
                          </b>
                          <span>
                            A private portal message to all of them, and an email to the {optedIn} who opted in.
                          </span>
                        </div>
                        <div className="es-send-grid">
                          <label className="cm-label" htmlFor={`esSubj${s.id}`}>Subject</label>
                          <input id={`esSubj${s.id}`} className="cm-input" value={sendBox.subject} maxLength={150} disabled={!sendBox.editSubject}
                            onChange={(e) => setSendBox((b) => ({ ...b, subject: e.target.value }))} />
                          <button type="button" className="es-edit" onClick={() => setSendBox((b) => ({ ...b, editSubject: !b.editSubject }))}>
                            {sendBox.editSubject ? 'Done' : 'Edit'}
                          </button>
                          <label className="cm-label es-top" htmlFor={`esMsg${s.id}`}>Message</label>
                          <textarea id={`esMsg${s.id}`} className="cm-input cm-textarea" rows={9} value={sendBox.message} maxLength={4000}
                            disabled={!sendBox.editMessage} onChange={(e) => setSendBox((b) => ({ ...b, message: e.target.value }))} />
                          <button type="button" className="es-edit es-top" onClick={() => setSendBox((b) => ({ ...b, editMessage: !b.editMessage }))}>
                            {sendBox.editMessage ? 'Done' : 'Edit'}
                          </button>
                        </div>
                        {!s.sent_at && <div className="rq-warn">After sending, the applicants in this batch can no longer be changed.</div>}
                        {sendBox.needsResend && <div className="rq-warn">This batch was already sent. Send it again to everyone in it?</div>}
                        <div className="es-send-actions">
                          <button type="button" className="cm-btn cm-btn-secondary" disabled={busy} onClick={() => setSendBox(null)}>
                            Cancel
                          </button>
                          <button type="button" className="cm-btn cm-btn-primary" disabled={busy || !sendBox.subject.trim() || !sendBox.message.trim()} onClick={send}>
                            {busy ? 'Sending...' : sendBox.needsResend ? 'Yes, send again' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )}

                    {isOpen && (
                      s.applicants.length === 0 ? (
                        <p className="es-empty">No applicants in this batch.</p>
                      ) : (
                        <div className="es-table-wrap">
                          <table className="st-table es-table">
                            <thead>
                              <tr>
                                <th style={{ width: 44 }}>#</th>
                                <th>Applicant</th>
                                <th>Application No.</th>
                                <th>Email updates</th>
                                {!s.sent_at && <th />}
                              </tr>
                            </thead>
                            <tbody>
                              {s.applicants.map((a, i) => (
                                <tr key={a.id}>
                                  <td className="es-num">{i + 1}</td>
                                  <td>
                                    <span className="es-person">{a.applicant_name || '(no name)'}</span>
                                    <span className="es-person-sub">{a.applicant_email}</span>
                                  </td>
                                  <td>{a.application_number || '-'}</td>
                                  <td>
                                    <span className={`es-opt ${a.email_updates_opt_in ? 'yes' : 'no'}`}>{a.email_updates_opt_in ? 'Yes' : 'No'}</span>
                                  </td>
                                  {!s.sent_at && (
                                    <td className="r">
                                      <button type="button" className="es-remove" disabled={busy}
                                        onClick={() => simpleAction({ action: 'remove', scheduleId: s.id, applicationId: a.id }, 'Applicant removed from the batch.')}>
                                        Remove
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
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

        {/* Oct 3 2026 redesign: status tabs replace the Status dropdown. */}
        <div className="apl-tabs" role="group" aria-label="Filter requests by status">
          {[
            ['all', 'All'],
            ['submitted', 'Awaiting review'],
            ['approved', 'Approved'],
            ['declined', 'Declined'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`apl-tab${statusFilter === key ? ' active' : ''}`}
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              {label}
              <span className="apl-tab-count">
                {key === 'all' ? requests.length : requests.filter((r) => r.status === key).length}
              </span>
            </button>
          ))}
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
                <th style={{ width: '24%' }}>Applicant</th>
                <th>Request</th>
                <th style={{ width: '15%' }}>Attachment</th>
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
                    <div className="rq-type-line">
                      <span className="text-xs font-bold text-ccc-navy">{r.request_type}</span>
                      {/reschedule/i.test(r.request_type || '') && <span className="rq-req-tag">Document required</span>}
                    </div>
                    <div className="text-xs text-ccc-muted mt-1" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {r.details}
                    </div>
                  </td>
                  <td>
                    {r.supporting_document_url ? (
                      <span className="rq-attach">
                        <span className={`rq-thumb ${docKindOf(r.supporting_document_url)}`} aria-hidden="true">
                          <i /><i /><i /><i />
                          <b>{docExtOf(r.supporting_document_url)}</b>
                        </span>
                        <span className="rq-attach-text">
                          <span className="rq-attach-kind">{docKindOf(r.supporting_document_url) === 'pdf' ? 'PDF' : docKindOf(r.supporting_document_url) === 'image' ? 'Image' : 'File'}</span>
                          <span className="rq-attach-sub">Preview inside</span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-ccc-muted">None attached</span>
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
// Oct 3 2026 redesign (Ivy's suggestion): the supporting document shows
// right inside the window, on the left, instead of behind a link. Images
// are shown directly, PDFs in an embedded viewer (same as the Dashboard's
// document cards); "Open in a new tab" keeps the old link's behavior.
function docExtOf(url) {
  try {
    const path = new URL(url).pathname
    const m = path.match(/\.([a-z0-9]+)$/i)
    return m ? m[1].toUpperCase().slice(0, 4) : 'FILE'
  } catch {
    return 'FILE'
  }
}

function docKindOf(url) {
  const ext = docExtOf(url)
  if (ext === 'PDF') return 'pdf'
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'HEIC', 'BMP'].includes(ext)) return 'image'
  return 'file'
}

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
  const docUrl = r.supporting_document_url
  const kind = docUrl ? docKindOf(docUrl) : null
  const [zoom, setZoom] = useState(100)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="confirm-overlay open rq-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rq-window" role="dialog" aria-modal="true" aria-label="Review request">
        <div className="rq-head">
          <div className="rq-head-who">
            <span className="rq-head-avatar">{getInitials(r.applicant_name)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="rq-head-line">
                <h3 className="rq-head-title">{r.request_type}</h3>
                <span className={`badge whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
              </div>
              <div className="rq-head-meta">
                {[r.applicant_name, r.application_number, r.applicant_email].filter(Boolean).join(' \u00b7 ')} &middot; Sent{' '}
                {formatWhen(r.created_at)}
              </div>
            </div>
          </div>
          <button type="button" className="rq-close" aria-label="Close" onClick={onClose}>
            &#10005;
          </button>
        </div>

        <div className="rq-body">
          <div className="rq-doc">
            <div className="rq-doc-bar">
              <span className="rq-doc-name">
                <span className="rq-label">Supporting document</span>
                <span>{docUrl ? (kind === 'pdf' ? 'PDF document' : `${kind === 'image' ? 'Image' : 'File'} (${docExtOf(docUrl)})`) : 'None attached'}</span>
              </span>
              {docUrl && (
                <span className="rq-doc-tools">
                  {kind === 'image' && (
                    <>
                      <button type="button" className="rq-tool" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(50, z - 25))}>
                        &minus;
                      </button>
                      <span className="rq-zoom">{zoom}%</span>
                      <button type="button" className="rq-tool" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(250, z + 25))}>
                        +
                      </button>
                    </>
                  )}
                  <a className="rq-tool rq-tool-wide" href={docUrl} target="_blank" rel="noopener noreferrer">
                    <IconExternal className="w-3.5 h-3.5" /> Open in a new tab
                  </a>
                </span>
              )}
            </div>
            <div className="rq-doc-view">
              {!docUrl ? (
                <div className="rq-doc-empty">
                  <IconFile className="w-10 h-10" />
                  <b>No supporting document</b>
                  <span>
                    The applicant didn&rsquo;t attach a file. A document is only required for Reschedule Examination
                    (Absence).
                  </span>
                </div>
              ) : kind === 'image' && !imgFailed ? (
                <img
                  src={docUrl}
                  alt={`Supporting document from ${r.applicant_name || 'the applicant'}`}
                  className="rq-doc-img"
                  style={{ width: `${zoom}%` }}
                  onError={() => setImgFailed(true)}
                />
              ) : kind === 'pdf' ? (
                <iframe src={docUrl} title="Supporting document" className="rq-doc-frame" />
              ) : (
                <div className="rq-doc-empty">
                  <IconFile className="w-10 h-10" />
                  <b>{imgFailed ? 'Couldn\u2019t load the preview' : 'Preview not available for this file type'}</b>
                  <span>Use &ldquo;Open in a new tab&rdquo; above to see the file.</span>
                </div>
              )}
            </div>
          </div>

          <div className="rq-side">
            <div className="rq-side-main">
              <div>
                <div className="rq-label">Details from the applicant</div>
                <div className="rq-details">{r.details || 'No details given.'}</div>
              </div>

              {decided ? (
                <div className={`rq-decision ${r.status}`}>
                  <div className="rq-decision-top">
                    <b>{badge.label}</b>
                    <span>
                      {r.decided_by ? `by ${r.decided_by}` : ''}
                      {r.decided_at ? `, ${formatWhen(r.decided_at)}` : ''}
                    </span>
                  </div>
                  {r.decision_note && (
                    <div className="rq-decision-note">
                      <b>Note to applicant:</b> {r.decision_note}
                    </div>
                  )}
                  {nextStep && <div className="rq-next">Next: {nextStep}</div>}
                </div>
              ) : (
                <>
                  <div>
                    <label className="rq-label" htmlFor="request-decision-note">
                      Note to the applicant <span className="rq-opt">(optional)</span>
                    </label>
                    <textarea
                      id="request-decision-note"
                      value={note}
                      onChange={(e) => onNote(e.target.value)}
                      maxLength={500}
                      rows={4}
                      placeholder="e.g. Moved to the Oct 10 batch, or the reason for declining"
                      className="rq-note"
                      disabled={Boolean(saving)}
                    />
                    <div className="rq-count">{note.length} / 500</div>
                  </div>
                  <div className="rq-warn">
                    The applicant sees this in their portal. Leave out private details. A decision can&rsquo;t be changed
                    once saved.
                  </div>
                </>
              )}
            </div>
            <div className="rq-foot">
              {decided ? (
                <button type="button" className="cm-btn cm-btn-secondary" onClick={onClose}>
                  Close
                </button>
              ) : (
                <>
                  <button type="button" className="cm-btn cm-btn-secondary" onClick={onClose} disabled={Boolean(saving)}>
                    Cancel
                  </button>
                  <button type="button" className="cm-btn cm-btn-outline-red" onClick={() => onDecide('declined')} disabled={Boolean(saving)}>
                    {saving === 'declined' ? 'Saving...' : 'Decline'}
                  </button>
                  <button type="button" className="cm-btn cm-btn-green" onClick={() => onDecide('approved')} disabled={Boolean(saving)}>
                    {saving === 'approved' ? 'Saving...' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Page shell ----------

const VALID_PANELS = ['dashboard', 'communications', 'reschedule', 'admins', 'system']

// ---------- Office of the Registrar console (Oct 5 2026) ----------
// Progress Table row 78, Allowance Distribution Monitoring. Behavior from
// Ivy's admin.html Registrar view (Dashboard counts view-only, an Allowance
// Distribution page in place of Announcements), rebuilt on real data with
// Pau's changes: pick the scholar from a list, a Remove button on posts, and
// a portal message (plus an email if opted in) to the scholar on each post.
// Design: canvas page "Registrar, LGU and archive (Oct 5)".

const REGISTRAR_STAT_CARDS = DASHBOARD_STAT_CARDS

function RegistrarDashboardPanel({ data, loading, error, onGoAllowance }) {
  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            A summary of where applicants are this cycle. The Registrar can view these counts only. Applicant details stay
            with the Guidance Office.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
      ) : error ? (
        <p className="text-sm text-ccc-red text-center py-8">{error}</p>
      ) : (
        <>
          <div className="stat-grid ra-stat-grid">
            {REGISTRAR_STAT_CARDS.map((card) => (
              <div key={card.key} className={`stat-card ${card.className} ra-stat-static`}>
                <p className="stat-label">{card.label}</p>
                <p className="stat-value">{data?.counts?.[card.key] ?? 0}</p>
                <p className="stat-note">{card.note}</p>
              </div>
            ))}
          </div>
          <div className="cm-card ra-info">
            <IconAlert className="w-4 h-4 shrink-0" />
            <span>
              To post an allowance, open{' '}
              <button type="button" className="ra-link" onClick={onGoAllowance}>
                Allowance Distribution
              </button>
              . Scholars with a Passer or Qualified (Probationary) status are listed there.
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function RegistrarAllowancePanel({ data, loading, error, onReload }) {
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [picked, setPicked] = useState(null)
  const [date, setDate] = useState('')
  const [type, setType] = useState('Wi-Fi')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [posting, setPosting] = useState(false)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')

  const today = data?.today || manilaTodayYmd()
  useEffect(() => {
    if (!date) setDate(today)
  }, [today, date])

  const scholars = data?.scholars || []
  const posts = data?.posts || []
  const q = query.trim().toLowerCase()
  const matches = scholars.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.applicationNumber || '').toLowerCase().includes(q)
  )
  const s2 = search.trim().toLowerCase()
  const shown = posts.filter(
    (p) =>
      (tab === 'all' || p.allowance_type === tab) &&
      (!s2 || (p.applicant_name || '').toLowerCase().includes(s2) || (p.application_number || '').toLowerCase().includes(s2))
  )
  const tabCount = (key) => posts.filter((p) => key === 'all' || p.allowance_type === key).length
  const latest = posts.reduce((acc, p) => (!acc || p.distribution_date > acc ? p.distribution_date : acc), '')

  const resetForm = () => {
    setPicked(null)
    setQuery('')
    setDate(today)
    setType('Wi-Fi')
    setDescription('')
  }

  const handlePost = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!picked) return setFormError('Please choose a scholar.')
    if (!date) return setFormError('Please set the date of distribution.')
    if (date > today) return setFormError('The date of distribution can be today or an earlier date.')
    if (type === 'Other' && !description.trim()) return setFormError('Please describe the allowance.')
    setPosting(true)
    try {
      const res = await fetch('/api/registrar-allowance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: picked.id, distributionDate: date, type, description }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setFormError(result.error || 'Could not post this allowance.')
        return
      }
      const what = type === 'Other' ? description.trim() : 'Wi-Fi'
      const told = result.emailSent
        ? 'They were sent a portal message and an email.'
        : result.emailOptIn
          ? 'They were sent a portal message. The email could not be sent.'
          : 'They were sent a portal message. They did not opt in to email updates.'
      showAdminNotice(
        `A ${what} allowance dated ${formatYmd(date)} was posted to ${picked.name}${
          picked.applicationNumber ? ` (${picked.applicationNumber})` : ''
        }. It now shows on their Allowance page. ${told}`
      )
      resetForm()
      onReload()
    } catch (err) {
      setFormError(
        isNetworkError(err)
          ? 'No connection right now, so this allowance was not posted. Try again once you’re back online.'
          : err.message
      )
    } finally {
      setPosting(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError('')
    try {
      const res = await fetch('/api/registrar-allowance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: removeTarget.id }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setRemoveError(result.error || 'Could not remove this post.')
        return
      }
      const name = removeTarget.applicant_name
      setRemoveTarget(null)
      showAdminNotice(`The allowance post was removed from ${name}'s Allowance page.`)
      onReload()
    } catch (err) {
      setRemoveError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Allowance Distribution</h1>
          <p>
            Post allowance distributions for scholars. Only scholars with a Passer or Qualified (Probationary) status whose
            result was already sent to them are listed. Each post appears right away on the scholar&apos;s Allowance page.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
      ) : error && !data ? (
        <p className="text-sm text-ccc-red text-center py-8">{error}</p>
      ) : (
        <>
          <div className="cm-card cm-kpis">
            <div className="cm-kpi">
              <span className="cm-kpi-label">Scholars</span>
              <span className="cm-kpi-value">{scholars.length}</span>
            </div>
            <div className="cm-kpi">
              <span className="cm-kpi-label">Posts this cycle</span>
              <span className="cm-kpi-value">{posts.length}</span>
            </div>
            <div className="cm-kpi">
              <span className="cm-kpi-label">Scholars with no post yet</span>
              <span className="cm-kpi-value">{data?.scholarsWithoutPost ?? 0}</span>
            </div>
            <div className="cm-kpi">
              <span className="cm-kpi-label">Latest distribution</span>
              <span className="cm-kpi-value ra-kpi-date">{latest ? formatYmd(latest) : 'None yet'}</span>
            </div>
          </div>

          <div className="cm-layout ra-layout">
            <section className="cm-card">
              <div className="cm-head">
                <h2 className="cm-title">New post</h2>
              </div>
              <form className="cm-form" onSubmit={handlePost}>
                {formError && <div className="aa-form-error">{formError}</div>}
                <div className="cm-field">
                  <label className="cm-label" htmlFor="raScholar">Scholar</label>
                  {picked ? (
                    <div className="ra-picked">
                      <span className="aa-avatar-2">{getInitials(picked.name)}</span>
                      <span className="ra-picked-text">
                        <span className="ra-picked-name">{picked.name}</span>
                        <span className="ra-picked-sub">
                          {[picked.applicationNumber, picked.program, picked.statusLabel].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="cm-btn cm-btn-secondary ra-change"
                        onClick={() => {
                          setPicked(null)
                          setListOpen(true)
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="raScholar"
                        className="cm-input"
                        type="search"
                        placeholder="Search by name or application number"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value)
                          setListOpen(true)
                        }}
                        onFocus={() => setListOpen(true)}
                        autoComplete="off"
                      />
                      {listOpen && (
                        <div className="ra-options" role="listbox" aria-label="Scholars">
                          {scholars.length === 0 ? (
                            <div className="ra-empty">
                              No scholars yet. Scholars appear here once their result (Passer or Qualified (Probationary))
                              has been sent to them.
                            </div>
                          ) : matches.length === 0 ? (
                            <div className="ra-empty">No scholar matches that search.</div>
                          ) : (
                            matches.slice(0, 30).map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                role="option"
                                aria-selected="false"
                                className="ra-option"
                                onClick={() => {
                                  setPicked(s)
                                  setListOpen(false)
                                }}
                              >
                                <span className="aa-avatar-2 ra-option-av">{getInitials(s.name)}</span>
                                <span className="ra-option-text">
                                  <span className="ra-option-name">{s.name}</span>
                                  <span className="ra-option-sub">{[s.applicationNumber, s.program].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span className={`aa-chip ${s.status === 'passer' ? 'active' : 'pending'}`}>{s.statusLabel}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="cm-field">
                  <label className="cm-label" htmlFor="raDate">Date of distribution</label>
                  <input id="raDate" className="cm-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
                  <span className="ra-hint">Today or an earlier date.</span>
                </div>

                <div className="cm-field">
                  <span className="cm-label" id="raTypeLabel">Type</span>
                  <div className="cm-type-grid" role="group" aria-labelledby="raTypeLabel">
                    {[
                      { key: 'Wi-Fi', desc: 'Wi-Fi allowance' },
                      { key: 'Other', desc: 'Describe it below' },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`cm-type${type === t.key ? ' on' : ''}`}
                        aria-pressed={type === t.key}
                        onClick={() => setType(t.key)}
                      >
                        <span className="cm-type-text">
                          <span className="cm-type-name">{t.key}</span>
                          <span className="cm-type-desc">{t.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {type === 'Other' && (
                  <div className="cm-field">
                    <label className="cm-label" htmlFor="raDesc">Description</label>
                    <input id="raDesc" className="cm-input" type="text" maxLength={200} placeholder="e.g. Monetary allowance"
                      value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </div>
                )}

                <div className="cm-scope info">
                  <IconMail />
                  <span>
                    This posts right away to the scholar&apos;s Allowance page. They also get a portal message, and an email if
                    they turned on email updates.
                  </span>
                </div>
                <button type="submit" className="cm-btn cm-btn-primary cm-btn-block" disabled={posting || !picked}>
                  {posting ? 'Disseminating...' : 'Disseminate Allowance'}
                </button>
              </form>
            </section>

            <section className="cm-card">
              <div className="cm-head cm-head-wrap">
                <div className="cm-head-left">
                  <h2 className="cm-title">Posted allowances</h2>
                </div>
                <input
                  type="search"
                  className="cm-input ra-search"
                  aria-label="Search posted allowances"
                  placeholder="Search scholar"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="ra-tabs">
                <div className="cm-tabs" role="group" aria-label="Filter posts by type">
                  {[
                    ['all', 'All'],
                    ['Wi-Fi', 'Wi-Fi'],
                    ['Other', 'Other'],
                  ].map(([key, label]) => (
                    <button key={key} type="button" className={`cm-tab${tab === key ? ' on' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
                      {label} <span className="cm-tab-count">{tabCount(key)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="text-sm text-ccc-muted text-center py-8">
                  {posts.length === 0 ? 'No allowance has been posted yet.' : 'No post matches this filter.'}
                </p>
              ) : (
                <div className="st-scroll">
                  <table className="st-table ra-table">
                    <thead>
                      <tr>
                        <th>Scholar</th>
                        <th>Date of distribution</th>
                        <th>Type</th>
                        <th>Posted by</th>
                        <th className="r">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="ra-cell">
                              <span className="ra-cell-main">{p.applicant_name}</span>
                              <span className="ra-cell-sub">{p.application_number}</span>
                            </span>
                          </td>
                          <td>{formatYmd(p.distribution_date)}</td>
                          <td>
                            <span className="ra-cell">
                              <span className="ra-cell-type">{p.allowance_type}</span>
                              <span className="ra-cell-sub">{p.description || 'No description'}</span>
                            </span>
                          </td>
                          <td>
                            <span className="ra-cell">
                              <span>{p.posted_by}</span>
                              <span className="ra-cell-sub">Posted {new Date(p.posted_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                            </span>
                          </td>
                          <td className="r">
                            <button
                              type="button"
                              className="aa-act danger"
                              onClick={() => {
                                setRemoveError('')
                                setRemoveTarget(p)
                              }}
                            >
                              <IconTrash />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="aa-foot">Each post and removal is saved in the Activity Log.</div>
            </section>
          </div>
        </>
      )}

      {removeTarget && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !removing && setRemoveTarget(null)}>
          <div className="aa-confirm" role="dialog" aria-modal="true" aria-label="Remove allowance post">
            <div className="aa-confirm-body">
              <h3 className="aa-confirm-title">Remove this allowance post?</h3>
              <p className="aa-confirm-desc">
                The {removeTarget.allowance_type === 'Other' ? removeTarget.description : 'Wi-Fi'} allowance dated{' '}
                {formatYmd(removeTarget.distribution_date)} will disappear from {removeTarget.applicant_name}&apos;s Allowance
                page. The message they already received stays in their Messages.
              </p>
              {removeError && <p className="aa-confirm-error">{removeError}</p>}
            </div>
            <div className="aa-confirm-foot">
              <button type="button" className="cm-btn cm-btn-secondary" disabled={removing} onClick={() => setRemoveTarget(null)} autoFocus>
                Keep it
              </button>
              <button type="button" className="cm-btn cm-btn-danger" disabled={removing} onClick={confirmRemove}>
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- CHED Form 3 export (Oct 5 2026, Progress Table row 79) ----------
// Dashboard "Export CHED Form 3" window. Behavior from Ivy's Patch 5
// export (reference number + date, then a landscape PDF in the Form 3
// layout), plus Release to LGU (Super Admin only): a frozen copy the LGU
// (view only) account can see during its access dates. Design: canvas page
// "Registrar, LGU and archive (Oct 5)".
function ChedForm3Dialog({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('new')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [formDate, setFormDate] = useState(() => manilaTodayYmd())
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState(false)
  // { type: 'release' } | { type: 'withdraw', report }
  const [confirm, setConfirm] = useState(null)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ched-form3')
      const result = await res.json()
      if (result.success) setData(result)
      else setError(result.error || 'Could not load the report.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const rows = data?.rows || []
  const counts = data?.counts || {}
  const released = data?.released || []
  const activeReleased = released.filter((r) => !r.withdrawn_at)

  const checkForm = () => {
    if (!referenceNumber.trim()) return 'Please enter the reference number.'
    if (!formDate) return 'Please set the date on the form.'
    if (rows.length === 0) return 'There are no rows yet. Record exam results first.'
    return ''
  }

  const download = async () => {
    const problem = checkForm()
    setFormError(problem)
    if (problem) return
    setDownloading(true)
    try {
      const { downloadForm3Pdf } = await import('../lib/chedForm3Pdf')
      await downloadForm3Pdf({ rows, referenceNumber: referenceNumber.trim(), formDate })
      fetch('/api/ched-form3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logDownload', referenceNumber: referenceNumber.trim(), formDate, rowCount: rows.length }),
      }).catch(() => {})
    } catch (err) {
      setFormError(`The PDF could not be made: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const downloadReleased = async (report) => {
    try {
      const res = await fetch(`/api/ched-form3?report=${report.id}`)
      const result = await res.json()
      if (!result.success) {
        showAdminNotice(result.error || 'Could not load that report.', 'error')
        return
      }
      const { downloadForm3Pdf } = await import('../lib/chedForm3Pdf')
      await downloadForm3Pdf({ rows: result.report.rows, referenceNumber: result.report.reference_number, formDate: result.report.form_date })
      fetch('/api/ched-form3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'logDownload',
          referenceNumber: result.report.reference_number,
          rowCount: result.report.row_count,
          reportId: report.id,
        }),
      }).catch(() => {})
    } catch (err) {
      showAdminNotice(err.message, 'error')
    }
  }

  const askRelease = () => {
    const problem = checkForm()
    setFormError(problem)
    if (problem) return
    setConfirmPassword('')
    setConfirmError('')
    setConfirm({ type: 'release' })
  }

  const submitConfirm = async (e) => {
    e.preventDefault()
    if (!confirmPassword) {
      setConfirmError('Please enter your password.')
      return
    }
    setConfirmBusy(true)
    setConfirmError('')
    try {
      const body =
        confirm.type === 'release'
          ? { action: 'release', referenceNumber: referenceNumber.trim(), formDate, confirmPassword }
          : { action: 'withdraw', id: confirm.report.id, confirmPassword }
      const res = await fetch('/api/ched-form3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setConfirmError(result.error || 'Something went wrong.')
        return
      }
      const done = confirm
      setConfirm(null)
      setConfirmPassword('')
      await load()
      if (done.type === 'release') {
        setTab('released')
        showAdminNotice(
          `CHED Form 3 ${result.report.reference_number} (${result.report.row_count} rows) was released to the LGU. LGU accounts can see it during their access dates.`
        )
      } else {
        showAdminNotice(`CHED Form 3 ${done.report.reference_number} was withdrawn. The LGU can no longer see it.`)
      }
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !confirm && onClose()}>
      <div className="cf-dialog" role="dialog" aria-modal="true" aria-label="Export CHED Form 3">
        <div className="cf-head">
          <h2 className="cf-title">Export CHED Form 3</h2>
          <p className="cf-sub">Free Higher Education Billing Details, admission fees (Section 7, Rule II of the IRR of RA 10931).</p>
          <div className="cm-tabs" role="group" aria-label="Export or released reports">
            {[
              ['new', 'New export', rows.length],
              ['released', 'Released to LGU', activeReleased.length],
            ].map(([key, label, n]) => (
              <button key={key} type="button" className={`cm-tab${tab === key ? ' on' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
                {label} <span className="cm-tab-count">{n}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <p className="text-sm text-ccc-muted text-center py-10">Loading...</p>
        ) : error && !data ? (
          <p className="text-sm text-ccc-red text-center py-10">{error}</p>
        ) : tab === 'new' ? (
          <>
            <div className="cf-body">
              <div className="cf-side">
                {formError && <div className="aa-form-error">{formError}</div>}
                <div className="cm-field">
                  <label className="cm-label" htmlFor="cfRef">Reference number</label>
                  <input id="cfRef" className="cm-input" type="text" maxLength={60} placeholder="e.g. 04-CCC-2026-1-1"
                    value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                  <span className="ra-hint">Required. Printed at the top right of the form.</span>
                </div>
                <div className="cm-field">
                  <label className="cm-label" htmlFor="cfDate">Date</label>
                  <input id="cfDate" className="cm-input" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div className="cm-field">
                  <span className="cm-label">Who&apos;s included</span>
                  <div className="cf-counts">
                    <div><span>passed-enrolled</span><b>{counts['passed-enrolled'] || 0}</b></div>
                    <div><span>passed-did not enrol</span><b>{counts['passed-did not enrol'] || 0}</b></div>
                    <div><span>failed</span><b>{counts.failed || 0}</b></div>
                    <div className="cf-total"><span>Total rows</span><b>{rows.length}</b></div>
                  </div>
                  <span className="ra-hint">
                    Everyone with a recorded pass or fail exam result, plus Qualified (Probationary) scholars.
                    {data?.leftOut ? ` ${data.leftOut} applicant${data.leftOut === 1 ? '' : 's'} marked Absent or with no exam result yet ${data.leftOut === 1 ? 'is' : 'are'} left out.` : ''}
                  </span>
                </div>
              </div>
              <div className="cf-preview">
                <span className="cm-label">
                  Preview {rows.length > 0 ? `(first ${Math.min(rows.length, 8)} of ${rows.length} rows, sorted A to Z by last name)` : ''}
                </span>
                {rows.length === 0 ? (
                  <p className="text-sm text-ccc-muted py-6">No rows yet. Rows appear once exam results are recorded in Applicant Results.</p>
                ) : (
                  <div className="st-scroll cf-table-wrap">
                    <table className="st-table cf-table">
                      <thead>
                        <tr>
                          <th>No.</th><th>Last name</th><th>Given name</th><th>Middle name</th><th>Sex</th><th>Birthdate</th>
                          <th>Degree program</th><th>Year level</th><th>Email</th><th>Phone</th><th>Fee</th><th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 8).map((r) => (
                          <tr key={r.seq}>
                            <td>{r.seq}</td><td className="cf-strong">{r.lastName}</td><td>{r.givenName}</td><td>{r.middleName}</td>
                            <td>{r.sex}</td><td>{r.birthdate}</td><td>{r.program}</td><td>{r.yearLevel}</td><td>{r.email}</td>
                            <td>{r.phone}</td><td>{r.fee}</td><td className="cf-strong">{r.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <span className="ra-hint">
                  Passers and Qualified (Probationary) scholars show as <b>passed</b>: <b>passed-enrolled</b> once Distribution
                  Status reached Enrollment complete, otherwise <b>passed-did not enrol</b>. The PDF is landscape A4 with the
                  Form 3 header and no signatures or seals. Sign the printed copy.
                </span>
              </div>
            </div>
            <div className="cf-foot">
              <span className="cf-foot-note">
                Download saves the PDF for you.{' '}
                {data?.canRelease
                  ? <>
                      <b>Release to LGU</b> also saves a frozen copy that LGU accounts can see. Release only after enrollment is
                      finished.
                    </>
                  : 'Only a Super Admin can release it to the LGU.'}
              </span>
              <span className="cf-foot-actions">
                <button type="button" className="cm-btn cm-btn-secondary" onClick={onClose}>Cancel</button>
                {data?.canRelease && (
                  <button type="button" className="cm-btn cm-btn-secondary" onClick={askRelease}>Release to LGU</button>
                )}
                <button type="button" className="cm-btn cm-btn-primary" onClick={download} disabled={downloading}>
                  {downloading ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="cf-released">
              <p className="cf-released-note">
                These frozen copies are what LGU accounts see. Changes in the system after a release don&apos;t change them.
                {data?.canRelease ? ' Withdraw a report to hide it from the LGU.' : ''}
              </p>
              {released.length === 0 ? (
                <p className="text-sm text-ccc-muted text-center py-8">Nothing has been released to the LGU yet.</p>
              ) : (
                <div className="st-scroll">
                  <table className="st-table cf-rel-table">
                    <thead>
                      <tr>
                        <th>Reference no.</th><th>Date on form</th><th>Rows</th><th>Released by</th><th>LGU downloads</th><th>Status</th>
                        <th className="r">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {released.map((r) => (
                        <tr key={r.id}>
                          <td className="cf-strong">{r.reference_number}</td>
                          <td>{formatYmd(r.form_date)}</td>
                          <td>{r.row_count}</td>
                          <td>
                            {r.released_by}, {new Date(r.released_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td>{r.download_count || 0}</td>
                          <td>
                            <span className={`aa-chip ${r.withdrawn_at ? 'ended' : 'active'}`}>
                              {r.withdrawn_at ? 'Withdrawn' : 'Visible to LGU'}
                            </span>
                          </td>
                          <td className="r">
                            <span className="aa-actions">
                              <button type="button" className="aa-act" onClick={() => downloadReleased(r)}>Download</button>
                              {data?.canRelease && !r.withdrawn_at && (
                                <button
                                  type="button"
                                  className="aa-act danger"
                                  onClick={() => {
                                    setConfirmPassword('')
                                    setConfirmError('')
                                    setConfirm({ type: 'withdraw', report: r })
                                  }}
                                >
                                  Withdraw
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="cf-foot cf-foot-end">
              <button type="button" className="cm-btn cm-btn-secondary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>

      {confirm && (
        <div className="confirm-overlay open" style={{ zIndex: 1600 }} onClick={(e) => e.target === e.currentTarget && !confirmBusy && setConfirm(null)}>
          <form className="aa-confirm" role="dialog" aria-modal="true" aria-label={confirm.type === 'release' ? 'Release to LGU' : 'Withdraw report'} onSubmit={submitConfirm}>
            <div className="aa-confirm-body">
              <h3 className="aa-confirm-title">{confirm.type === 'release' ? 'Release this report to the LGU?' : 'Withdraw this report?'}</h3>
              <p className="aa-confirm-desc">
                {confirm.type === 'release'
                  ? `A frozen copy of ${referenceNumber.trim()} (${rows.length} rows) becomes visible to LGU accounts during their access dates. Release only after enrollment is finished. Re-enter your password to continue.`
                  : `LGU accounts will no longer see ${confirm.report.reference_number}. It stays listed here for the record. Re-enter your password to continue.`}
              </p>
              <label className="cm-label" htmlFor="cfPw">Your password</label>
              <input id="cfPw" className="cm-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Your password" autoComplete="current-password" autoFocus />
              {confirmError && <p className="aa-confirm-error">{confirmError}</p>}
            </div>
            <div className="aa-confirm-foot">
              <button type="button" className="cm-btn cm-btn-secondary" disabled={confirmBusy} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="submit" className={`cm-btn ${confirm.type === 'release' ? 'cm-btn-primary' : 'cm-btn-danger'}`} disabled={confirmBusy}>
                {confirmBusy ? 'Working...' : confirm.type === 'release' ? 'Release to LGU' : 'Withdraw'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// ---------- LGU (view only) console: Released reports (Oct 5 2026) ----------
function LguReportsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    fetch('/api/lgu-reports')
      .then(async (res) => {
        const result = await res.json()
        if (res.status === 401) {
          window.location.href = '/admin'
          return
        }
        if (result.success) setData(result)
        else setError(result.error || 'Could not load reports.')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const download = async (report) => {
    setBusyId(report.id)
    try {
      const res = await fetch(`/api/lgu-reports?id=${report.id}`)
      const result = await res.json()
      if (res.status === 401) {
        window.location.href = '/admin'
        return
      }
      if (!result.success) {
        showAdminNotice(result.error || 'Could not download this report.', 'error')
        return
      }
      const { downloadForm3Pdf } = await import('../lib/chedForm3Pdf')
      await downloadForm3Pdf({ rows: result.report.rows, referenceNumber: result.report.reference_number, formDate: result.report.form_date })
    } catch (err) {
      showAdminNotice(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const reports = data?.reports || []
  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Released reports</h1>
          <p>Reports City College of Calamba has released to the LGU. This account can view and download them only.</p>
        </div>
      </div>
      {data?.accessFrom && data?.accessUntil && (
        <div className="cm-card ra-info lg-access">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span>
            Your access: <b>{formatYmd(data.accessFrom, { month: 'long', day: 'numeric', year: 'numeric' })} to {formatYmd(data.accessUntil, { month: 'long', day: 'numeric', year: 'numeric' })}</b>.
            After that, this account can no longer sign in.
          </span>
        </div>
      )}
      <section className="cm-card lg-card">
        <div className="cm-head">
          <h2 className="cm-title">CHED Form 3: Free Higher Education Billing Details</h2>
        </div>
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-8">Loading...</p>
        ) : error ? (
          <p className="text-sm text-ccc-red text-center py-8">{error}</p>
        ) : reports.length === 0 ? (
          <p className="lg-empty">No report has been released yet. City College of Calamba will release the report once enrollment is finished.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table lg-table">
              <thead>
                <tr>
                  <th>Reference no.</th><th>Date on form</th><th>Rows</th><th>Released on</th><th className="r">File</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="cf-strong">{r.reference_number}</td>
                    <td>{formatYmd(r.form_date, { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                    <td>{r.row_count}</td>
                    <td>{new Date(r.released_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                    <td className="r">
                      <button type="button" className="cm-btn cm-btn-primary lg-dl" onClick={() => download(r)} disabled={busyId === r.id}>
                        {busyId === r.id ? 'Preparing...' : 'Download PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="aa-foot">Every sign-in and download is recorded by City College of Calamba.</div>
      </section>
    </div>
  )
}

// ---------- Limited consoles: shell (Oct 5 2026) ----------
// Office of the Registrar and LGU (view only) accounts see this instead of
// the full console. Same header, sidebar look and log-out confirm.
function LimitedConsole({ session }) {
  const role = session.role
  const [activePanel, setActivePanel] = useState(role === 'registrar' ? 'allowance' : 'reports')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [regData, setRegData] = useState(null)
  const [regLoading, setRegLoading] = useState(role === 'registrar')
  const [regError, setRegError] = useState('')

  const handleLogout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const loadRegistrar = async () => {
    setRegLoading(true)
    setRegError('')
    try {
      const res = await fetch('/api/registrar-allowance')
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (data.success) setRegData(data)
      else setRegError(data.error || 'Could not load allowance data.')
    } catch (err) {
      setRegError(err.message)
    } finally {
      setRegLoading(false)
    }
  }

  useEffect(() => {
    if (role === 'registrar') loadRegistrar()
  }, [role])

  const sessionLabel = role === 'registrar' ? 'Registrar Session' : 'LGU View-only Session'

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
            {sessionLabel}
          </span>
        }
        portalBadge="Admin Console"
        logos={[
          { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
          { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
          { src: '/LOGO_CCC_Registrar.png', alt: 'CCC Registrar Logo' },
        ]}
      />
      <div className="portal-shell">
        <AdminSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          displayName={session.name}
          email={session.email}
          isSuperAdmin={false}
          role={role}
          onLogout={() => setConfirmLogout(true)}
        />
        {confirmLogout && (
          <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !loggingOut && setConfirmLogout(false)}>
            <div className="aa-confirm" role="dialog" aria-modal="true" aria-label="Log out">
              <div className="aa-confirm-body">
                <h3 className="aa-confirm-title">Log out?</h3>
                <p className="aa-confirm-desc">You&rsquo;ll need your email and password to sign in again.</p>
              </div>
              <div className="aa-confirm-foot">
                <button type="button" className="cm-btn cm-btn-secondary" disabled={loggingOut} onClick={() => setConfirmLogout(false)} autoFocus>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-primary"
                  disabled={loggingOut}
                  onClick={async () => {
                    setLoggingOut(true)
                    try {
                      await handleLogout()
                    } catch {
                      setLoggingOut(false)
                    }
                  }}
                >
                  {loggingOut ? 'Logging out...' : 'Log out'}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="portal-main">
          {role === 'registrar' && activePanel === 'dashboard' && (
            <RegistrarDashboardPanel data={regData} loading={regLoading && !regData} error={regError} onGoAllowance={() => setActivePanel('allowance')} />
          )}
          {role === 'registrar' && activePanel === 'allowance' && (
            <RegistrarAllowancePanel data={regData} loading={regLoading} error={regError} onReload={loadRegistrar} />
          )}
          {role === 'lgu' && activePanel === 'reports' && <LguReportsPanel session={session} />}
        </div>
      </div>
    </main>
  )
}

// Picks the console for whoever is signed in. Admins and Super Admins get the
// full console exactly as before.
function AdminRoleGate() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    fetch('/api/admin-session')
      .then((res) => res.json())
      .then((data) => setSession(data || {}))
      .catch(() => setSession({}))
  }, [])

  if (session === undefined) return null
  if (!session.loggedIn && session.accessEnded) {
    return (
      <main className="admin-portal">
        <div className="ra-ended">
          <div className="cm-card ra-ended-card">
            <h1 className="cm-title">Your access has ended</h1>
            <p>{session.error || 'Your access has ended. Please contact City College of Calamba.'}</p>
            <button
              type="button"
              className="cm-btn cm-btn-primary"
              onClick={async () => {
                await fetch('/api/admin-logout', { method: 'POST' })
                window.location.href = '/admin/login'
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </main>
    )
  }
  if (session.loggedIn && (session.role === 'registrar' || session.role === 'lgu')) {
    return <LimitedConsole session={session} />
  }
  return <AdminPageInner />
}

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
  const [adminEmail, setAdminEmail] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
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
          setAdminEmail(data.email || '')
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
          ? 'No connection right now, so this change did not go through. Try again once you\u2019re back online.'
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
          ? 'No connection right now, so this change did not go through. Try again once you’re back online.'
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
          ? 'No connection right now, so this change did not go through. Try again once you’re back online.'
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
            your connection returns. This page will pick back up automatically once it does.
          </p>
        </div>
      )}

      {!isOffline && justReconnected && (
        <div className="w-full bg-green-50 border-b border-ccc-green/30 text-center py-2 px-4">
          <p className="text-xs font-semibold text-ccc-green">
            You&rsquo;re back online. Refreshing the latest data now.
          </p>
        </div>
      )}

      <div className="portal-shell">
        <AdminSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          displayName={adminName}
          email={adminEmail}
          isSuperAdmin={isSuperAdmin}
          flaggedCount={totalFlagged}
          onLogout={() => setConfirmLogout(true)}
        />
        {/* Oct 3 2026: log out asks first (was one click). */}
        {confirmLogout && (
          <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !loggingOut && setConfirmLogout(false)}>
            <div className="aa-confirm" role="dialog" aria-modal="true" aria-label="Log out">
              <div className="aa-confirm-body">
                <h3 className="aa-confirm-title">Log out?</h3>
                <p className="aa-confirm-desc">
                  You&rsquo;ll need your email and password to sign in again. Any applicant you have open is released for
                  other admins.
                </p>
              </div>
              <div className="aa-confirm-foot">
                <button type="button" className="cm-btn cm-btn-secondary" disabled={loggingOut} onClick={() => setConfirmLogout(false)} autoFocus>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cm-btn cm-btn-primary"
                  disabled={loggingOut}
                  onClick={async () => {
                    setLoggingOut(true)
                    try {
                      await handleLogout()
                    } catch {
                      setLoggingOut(false)
                    }
                  }}
                >
                  {loggingOut ? 'Logging out...' : 'Log out'}
                </button>
              </div>
            </div>
          </div>
        )}

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
      <AdminRoleGate />
    </Suspense>
  )
}