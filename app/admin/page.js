'use client'
import { STATUS_DEFINITIONS } from '@/app/lib/statusDefinitions'
import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import '../admin-theme.css'
import SiteHeader from '../components/SiteHeader'
import AdminSidebar from '../components/AdminSidebar'
import LoadingScreen from '../components/LoadingScreen'
import { Skeleton, SkeletonRows, SkeletonList, SkeletonForm, SkeletonText, SkeletonStatGrid } from '../components/Skeleton'
import { getDocTypeLabel } from '../lib/documentTypes'
import { docState, DOC_STATE_LABEL } from '../lib/documentState'
import { peek, keep, forgetAll } from '../lib/panelCache'
import { onConnectivityChange, isNetworkError } from '../lib/offlineSync'
import { suggestExamResult, eligibleProgramsForScore, admittedProgramOf, reachedFirstChoice, bsedGradeBelow, BSED_MATH_SCIENCE_PROGRAMS } from '../lib/matching'
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
  // Only the file's own name (sign-up checks sit in a signup-check/<id>/ folder).
  const parts = path.split('/').pop().split('-')
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
// Nov 2026 (panel revisions S2): a fourth state, "System check passed",
// for documents the OCR accepted but no staff member has confirmed yet.
// Only a staff Confirm makes a document Verified (app/lib/documentState.js).
function ReviewStatusBadge({ needsReview, reviewStatus, doc }) {
  const state = doc ? docState(doc) : null
  if (state === 'checked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-navy/30 bg-ccc-off px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-navy shrink-0 whitespace-nowrap">
        <IconClock className="w-3 h-3" />
        System check passed
      </span>
    )
  }
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
      {doc ? 'Verified by staff' : 'Verified'}
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

// Oct 12 2026: document integrity (see app/lib/documentIntegrity.js). The
// system re-reads each file from storage, recomputes its SHA-256 and
// compares it with the fingerprint saved at upload. Admins never compare
// hashes themselves; they only see this badge.
const INTEGRITY_META = {
  checking: { label: 'Checking integrity…', color: '#5F6B7D', bg: '#F1F4F8', border: '#DCE2EA', title: 'Comparing the file in storage with the SHA-256 fingerprint saved at upload.' },
  verified: { label: 'Unchanged since upload', color: '#1B5E20', bg: '#EDF7EE', border: '#B9DDBB', title: 'The file in storage has exactly the same SHA-256 fingerprint as when it was uploaded.' },
  changed: { label: 'Changed since upload', color: '#B71C1C', bg: '#FDECEC', border: '#F2B8B8', title: 'The file in storage no longer matches the SHA-256 fingerprint saved at upload. It was replaced or edited.' },
  missing: { label: 'File missing from storage', color: '#B71C1C', bg: '#FDECEC', border: '#F2B8B8', title: 'The file saved at upload is no longer in storage.' },
  error: { label: 'Integrity check unavailable', color: '#8A6300', bg: '#FFF7E0', border: '#F0D98A', title: 'The file could not be read just now. Try again in a moment.' },
}

function IntegrityBadge({ info }) {
  const meta = info && INTEGRITY_META[info.status]
  if (!meta) return null
  const bad = info.status === 'changed' || info.status === 'missing'
  const when = info.checkedAt ? new Date(info.checkedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <span
      role="status"
      title={`${meta.title}${when ? ` Last checked ${when}.` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
      }}
    >
      <span aria-hidden="true">{info.status === 'verified' ? '✓' : bad ? '✗' : info.status === 'checking' ? '…' : '!'}</span>
      {meta.label}
    </span>
  )
}

// Runs the integrity check for the given documents as soon as `enabled`
// turns true (the applicant window opens). Returns { [file_path]: info }.
function useDocumentIntegrity(docs, enabled) {
  const [results, setResults] = useState({})
  const key = docs.map((d) => d.file_path).filter(Boolean).sort().join('|')
  const ranFor = useRef('')
  useEffect(() => {
    if (!enabled || !key || ranFor.current === key) return
    ranFor.current = key
    const paths = key.split('|')
    setResults((prev) => {
      const next = { ...prev }
      for (const p of paths) if (!next[p]) next[p] = { status: 'checking' }
      return next
    })
    fetch('/api/documents/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || 'failed')
        setResults((prev) => {
          const next = { ...prev }
          for (const r of data.results || []) next[r.file_path] = { status: r.status, checkedAt: r.checkedAt }
          for (const p of paths) if (next[p]?.status === 'checking') next[p] = { status: 'error' }
          return next
        })
      })
      .catch(() => {
        ranFor.current = ''
        setResults((prev) => {
          const next = { ...prev }
          for (const p of paths) if (next[p]?.status === 'checking') next[p] = { status: 'error' }
          return next
        })
      })
  }, [enabled, key])
  return results
}

// What to show for one document: the live result if there is one, else the
// last saved check.
function integrityFor(doc, results) {
  if (results && results[doc.file_path]) return results[doc.file_path]
  if (doc.integrity_status) return { status: doc.integrity_status, checkedAt: doc.integrity_checked_at }
  return null
}

// The core review unit: one document, file preview on the left, OCR + status
// on the right. This is what replaces the mockup's dead viewDocument() stub.
// Oct 15 2026 (client): when an applicant re-uploads, the admin sees the
// latest file per document type first, marked Current. Earlier files stay
// (nothing is deleted) but are folded under "Previous uploads (N)".
// parentid (the former parent/guardian Voter's ID slot) keeps its own group:
// older applicants uploaded both their own and a parent's ID, and one is not
// a re-upload of the other.
const uploadGroupKey = (type) => type
function groupUploadsByType(docs) {
  const sorted = [...docs].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const groups = new Map()
  for (const d of sorted) {
    const key = uploadGroupKey(d.document_type)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(d)
  }
  return [...groups.values()]
}

function DocumentReviewCard({ doc, onOverride, overriding, integrity }) {
  const [previewing, setPreviewing] = useState(false)
  const image = isImageFile(doc.file_path)
  const pdf = isPdfFile(doc.file_path)
  const isBusy = overriding === doc.file_path
  const isProcessing = doc.review_status === 'processing'
  const state = docState(doc)

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
            <ReviewStatusBadge needsReview={doc.needs_review} reviewStatus={doc.review_status} doc={doc} />
          </div>

          {state === 'checked' && (
            <p className="text-[11px] leading-snug text-ccc-navy bg-ccc-off rounded-md px-2 py-1.5">
              <span className="font-bold">Passed the system check.</span> Compare the file with the text read from it,
              then Confirm. It counts as Verified only after a staff member confirms it.
            </p>
          )}
          {state === 'verified' && doc.staff_confirmed_by && (
            <p className="text-[11px] leading-snug text-ccc-green">
              Confirmed by {doc.staff_confirmed_by}
              {doc.staff_confirmed_at && !String(doc.staff_confirmed_by).startsWith('Accepted before')
                ? ` · ${new Date(doc.staff_confirmed_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                : ''}
            </p>
          )}

          {doc.content_issue && (
            <p className="text-[11px] leading-snug text-ccc-orange bg-ccc-orange/10 rounded-md px-2 py-1.5">
              <span className="font-bold">Flagged by content check:</span> {doc.content_issue}
            </p>
          )}

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

          {integrity && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest">Integrity (SHA-256)</span>
              <IntegrityBadge info={integrity} />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {doc.sha256_hash && <CopyHashButton hash={doc.sha256_hash} />}
            {doc.publicUrl && (
              <button type="button" className="dpv-open" onClick={() => setPreviewing(true)}>
                View full file <IconExternal className="w-3 h-3" />
              </button>
            )}
          </div>
          {previewing && <AdminFilePreview doc={doc} onClose={() => setPreviewing(false)} />}

          {onOverride && (
            <div className="flex items-center gap-2 pt-1 border-t border-ccc-border mt-1">
              <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest mr-auto">
                Staff decision
              </span>
              <button
                type="button"
                disabled={isBusy || isProcessing || state === 'verified'}
                onClick={() => onOverride(doc, 'verify')}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-ccc-green/50 text-ccc-green bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? 'Saving...' : state === 'flagged' ? 'Mark Verified' : 'Confirm'}
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
  pending_exam: { label: 'Eligible for Exam', className: 'bg-blue-50 text-ccc-blue border-ccc-blue/30' },
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

// Oct 6 2026: once an exam result is saved, the Dashboard follows it
// (Pau found Bianca, who passed, still shown as "Pending Exam Result", and
// Carlo, who failed, missing from Waitlisted). Before the exam it's the
// eligibility check, as before. `bucket` is the stat card / tab it counts in.
const APL_POST_EXAM = {
  passer: { label: 'Qualified as a Student', cls: 'apl-pill-green', bucket: 'qualified' },
  qualified_probationary: { label: 'Qualified as a Student (Probationary)', cls: 'apl-pill-gold', bucket: 'qualified' },
  waitlisted_probationary: { label: 'Waitlisted (Probationary)', cls: 'apl-pill-gold', bucket: 'waitlisted' },
  disqualified: { label: 'Disqualified', cls: 'apl-pill-red', bucket: 'not_qualified' },
  forfeited: { label: 'Forfeited', cls: 'apl-pill-red', bucket: 'not_qualified' },
}

function aplStatusOf(row) {
  if (!row) return 'incomplete'
  if (row.scholar_status && APL_POST_EXAM[row.scholar_status]) return row.scholar_status
  return row.eligibility_override || row.eligibility_status || 'incomplete'
}

function aplBucketOf(status) {
  return APL_POST_EXAM[status]?.bucket || status
}

function aplPillOf(status) {
  return APL_POST_EXAM[status] || APL_STATUS_PILL[status] || APL_STATUS_PILL.incomplete
}

const EXAM_RESULT_WORD = { passed: 'Passed', failed: 'Failed', absent: 'Absent' }

// Small line under the status pill: what decided it.
function aplStatusSub(row) {
  if (!row) return ''
  const word = EXAM_RESULT_WORD[row.exam_result]
  if (row.admitted_program) return 'Re-evaluated into another program'
  // A passing score in a BSEd Math/Science 1st choice that rule a closes
  // (Appendix J p. 96) stays Waitlisted until re-evaluated.
  if (row.exam_result === 'passed' && row.scholar_status === 'waitlisted_probationary') return `Exam: ${row.exam_score ?? 'Passed'} · SHS grade below 85`
  if (word) return row.exam_score != null && row.exam_result !== 'absent' ? `Exam: ${word} · ${row.exam_score}` : `Exam: ${word}`
  if (APL_POST_EXAM[row.scholar_status]) return 'Set manually'
  const status = row.eligibility_override || row.eligibility_status || 'incomplete'
  if (status === 'pending_exam') return 'No exam score yet'
  if (row.eligibility_override) return 'Set manually'
  return ''
}

// ---------- Document preview popup (Oct 6 2026) ----------
// Pau: View should open the file inside the site, never send the admin to
// the raw storage link (same as the applicant portal's View popup, PR #29,
// and the Appeals window, PR #25). Images can be zoomed; PDFs show in a
// frame (Download opens the file itself).
function AdminFilePreview({ doc, onClose }) {
  const [zoom, setZoom] = useState(100)
  const docPath = doc?.file_path
  useEffect(() => {
    setZoom(100)
  }, [docPath])
  useEffect(() => {
    if (!doc) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [doc, onClose])
  if (!doc) return null
  const name = getCleanFileName(doc.file_path)
  const image = isImageFile(doc.file_path)
  const pdf = isPdfFile(doc.file_path)
  const status = DOC_STATE_LABEL[docState(doc)] || 'Processing'
  return (
    <div
      className="dpv-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dpv-box" role="dialog" aria-modal="true" aria-labelledby="dpvTitle">
        <div className="dpv-head">
          <div className="dpv-titles">
            <span id="dpvTitle" className="dpv-title">{getDocTypeLabel(doc.document_type)}</span>
            <span className="dpv-sub">
              {doc.applicant_name ? `${doc.applicant_name} · ` : ''}
              {name}
              {doc.created_at ? ` · uploaded ${formatAplDate(doc.created_at)}` : ''} · {status}
            </span>
          </div>
          <button type="button" className="dpv-close" aria-label="Close preview" onClick={onClose}>
            &#10005;
          </button>
        </div>
        <div className="dpv-body">
          {image && doc.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.publicUrl} alt={name} className="dpv-img" style={{ width: `${zoom}%`, maxWidth: zoom > 100 ? 'none' : '100%' }} />
          ) : pdf && doc.publicUrl ? (
            <iframe src={doc.publicUrl} title={name} className="dpv-frame" />
          ) : (
            <div className="dpv-none">
              <IconFile className="w-10 h-10" />
              <span>Preview isn&rsquo;t available for this file.</span>
            </div>
          )}
        </div>
        <div className="dpv-foot">
          <span>Press Esc or click outside to close.</span>
          <span className="dpv-tools">
            {image && (
              <>
                <button type="button" className="dpv-tool" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(50, z - 25))}>
                  &minus;
                </button>
                <span className="dpv-zoom">{zoom}%</span>
                <button type="button" className="dpv-tool" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(300, z + 25))}>
                  +
                </button>
              </>
            )}
            {doc.publicUrl && (
              <a className="dpv-tool" href={doc.publicUrl} download={name} target="_blank" rel="noreferrer">
                Download
              </a>
            )}
            <button type="button" className="dpv-tool" onClick={onClose}>
              Close
            </button>
          </span>
        </div>
      </div>
    </div>
  )
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
// Nov 2026: simple line icons instead of the ✓ / ⏳ / ✕ characters.
const STATUS_ICON_PATHS = {
  qualified: 'M5 12.5l4.5 4.5L19 7.5',
  waitlisted: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  not_qualified: 'M7 7l10 10M17 7L7 17',
}
function StatusIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={STATUS_ICON_PATHS[name]} />
    </svg>
  )
}
const STATUS_OPTIONS = [
  { key: 'qualified', cls: 'qualified', icon: <StatusIcon name="qualified" />, label: 'Qualified' },
  { key: 'waitlisted', cls: 'waitlisted', icon: <StatusIcon name="waitlisted" />, label: 'Waitlisted' },
  { key: 'not_qualified', cls: 'not-qualified', icon: <StatusIcon name="not_qualified" />, label: 'Not Qualified' },
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
            <span className="sb-icon">{opt.icon}</span>
            <span className="sb-label">{opt.label}</span>
            {effectiveStatus === opt.key && <span className="sb-current">Current</span>}
          </button>
        ))}
      </div>
      {/* Nov 2026: bigger and boxed, so the reasons behind a status aren't overlooked. */}
      {reasons.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-900 mb-1">Why this status</div>
          <ul className="text-[13px] text-amber-950 leading-relaxed space-y-1 list-disc pl-5">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------- Action pop-up (Oct 1 2026) ----------
// Pau's request: after an admin action (save, send, invite, recompute, set a
// status, verify a document...), show a pop-up instead of a corner toast so
// it isn't overlooked. Same look as the applicant portal's pop-up (Ivy's
// confirm-box), with OK locked for 3 seconds (was 5 until Oct 12 2026). The name stays AdminToast so
// every place that already used the toast now gets the pop-up.
// NOT used for the Admin Accounts notice that shows a temporary password:
// that one stays on the page until the admin copies it and dismisses it.
const ADMIN_NOTICE_LOCK_SECONDS = 3 // Oct 12 2026: was 5

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
  // Oct 7 2026: sendBeacon can't carry the anti-CSRF header, so this uses a
  // keepalive fetch, which also finishes after the tab closes.
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

// ---------- Qualification Conflict Detection (Oct 6 2026) ----------
// Scholarship Matching & Filtering Module (Member Roles; manuscript p. 10:
// "flags qualification conflicts"). What the applicant typed vs what OCR
// read from their documents, plus Applying As vs the College row and a
// possible duplicate account (see app/lib/conflicts.js). It only flags; an
// admin checks it and either fixes the profile (Edit below), flags the
// document, or marks it as checked with a note. Each check is logged.
function ConflictsBox({ applicationId, items, docs, onChanged, onGoToSection }) {
  const [editing, setEditing] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewDoc, setPreviewDoc] = useState(null)
  if (!items || items.length === 0) return null
  const open = items.filter((c) => !c.checked)
  const sorted = [...open, ...items.filter((c) => c.checked)]

  const save = async (item) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, key: item.key, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not save. Please try again.')
      setEditing('')
      setNote('')
      showAdminNotice(`Marked as checked: ${item.what}. It's in the Activity Log.`)
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const viewOf = (c) => {
    if (c.filePath) {
      const doc = (docs || []).find((d) => d.file_path === c.filePath)
      if (doc) return { label: c.documentType === 'voterid' ? "View voter's ID" : 'View birth certificate', go: () => setPreviewDoc(doc) }
    }
    if (c.section && onGoToSection) return { label: 'View section', go: () => onGoToSection(c.section) }
    return null
  }

  return (
    <section className="qc-box" aria-label="Conflicts to check">
      <div className="qc-head">
        <h3 className="qc-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 7h10M7 12h6M7 17h3" />
            <path d="m15 15 5 5M20 15l-5 5" />
          </svg>
          Conflicts to check
          <span className={`qc-count${open.length === 0 ? ' is-done' : ''}`}>
            {open.length === 0 ? 'All checked' : `${open.length} open`}
          </span>
        </h3>
        <span className="qc-help">Found by comparing the profile with what was read from the documents.</span>
      </div>
      {error && <div className="qc-error" role="alert">{error}</div>}
      <div className="qc-scroll">
        <table className="qc-table">
          <thead>
            <tr>
              <th style={{ width: '17%' }}>What</th>
              <th style={{ width: '24%' }}>In the profile</th>
              <th style={{ width: '25%' }}>Read from the document</th>
              <th style={{ width: '34%', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const view = viewOf(c)
              const isEditing = !c.checked && editing === c.key
              return (
                <tr key={c.key} className={c.checked ? 'is-checked' : ''}>
                  <td><span className="qc-what">{c.what}</span></td>
                  <td>
                    {c.typed || 'Not given'}
                    <span className="qc-from">{c.typedFrom}</span>
                  </td>
                  <td>
                    <span className="qc-read">{c.read}</span>
                    <span className="qc-from">{c.readFrom}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {c.checked ? (
                      <span className="qc-done">
                        <span className="qc-done-chip">&#10003; Checked</span>
                        <span className="qc-done-by">
                          {[c.checked.by || 'An admin', formatWhen(c.checked.at), c.checked.note ? `"${c.checked.note}"` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    ) : isEditing ? (
                      <div className="qc-note">
                        <label htmlFor={`qcNote-${c.key}`}>Note (optional)</label>
                        <input
                          id={`qcNote-${c.key}`}
                          type="text"
                          maxLength={300}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="e.g. PSA copy checked onsite, profile is correct"
                        />
                        <span className="qc-actions">
                          <button type="button" className="qc-btn" disabled={saving} onClick={() => { setEditing(''); setNote('') }}>
                            Cancel
                          </button>
                          <button type="button" className="qc-btn pri" disabled={saving} onClick={() => save(c)}>
                            {saving ? 'Saving…' : 'Mark as checked'}
                          </button>
                        </span>
                      </div>
                    ) : (
                      <span className="qc-actions">
                        {view && (
                          <button type="button" className="qc-link" onClick={view.go}>
                            {view.label}
                          </button>
                        )}
                        <button type="button" className="qc-btn" onClick={() => { setEditing(c.key); setNote('') }}>
                          Mark as checked
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="qc-foot">
        This only flags. Nothing is rejected on its own. If the profile is wrong, fix it with <b>Edit</b> in Submitted Documents
        &amp; Profile Data. If the document is wrong, flag it for re-upload. Each check is logged in the Activity Log.
      </div>
      {previewDoc && <AdminFilePreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </section>
  )
}

function ApplicantGroup({ name, email, docs, onOverride, overriding, eligibilityRow, onEligibilityOverride, eligibilityOverriding, onProfileSaved, lockInfo, conflicts, onConflictsChanged }) {
  const { modalOpen, openModal, closeModal, blockedMsg, setBlockedMsg, opening } = useLockedModal(eligibilityRow?.id)
  const lockedByOther = !!lockInfo && !lockInfo.mine && !modalOpen
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  // Oct 5 2026: skeletons in the General Information fields until the
  // first detail load finishes, instead of blank boxes or "Not on file".
  const detailPending = !detail && !detailError && (detailLoading || !!eligibilityRow?.id)
  const [activeCat, setActiveCat] = useState(PROFILE_CATEGORIES[0].key)
  // Oct 12 2026: re-checks this applicant's files against their upload
  // fingerprints as soon as the window opens.
  const integrityResults = useDocumentIntegrity(docs, modalOpen)
  const integrityProblems = docs.filter((d) => ['changed', 'missing'].includes(integrityFor(d, integrityResults)?.status)).length
  const flaggedCount = docs.filter((d) => d.needs_review).length
  // Sept 29: documents still waiting on the OCR worker are neither.
  const processingCount = docs.filter((d) => d.review_status === 'processing' && !d.needs_review).length
  const verifiedCount = docs.filter((d) => docState(d) === 'verified').length
  const toConfirmCount = docs.filter((d) => docState(d) === 'checked').length
  const sectionsDone = PROFILE_SECTIONS.filter((s) => !!eligibilityRow?.[s.key]).length
  const openConflicts = (conflicts || []).filter((c) => !c.checked).length
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
  const status = aplStatusOf(eligibilityRow)
  const statusMeta = aplPillOf(status)
  const statusSub = aplStatusSub(eligibilityRow)
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
            <span className="apl-sub">{[eligibilityRow?.application_number, eligibilityRow?.reference_number, email || 'No email on file'].filter(Boolean).join(' \u00b7 ')}</span>
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
            {toConfirmCount > 0 && <span className="apl-chip apl-chip-proc">{toConfirmCount} to confirm</span>}
            {openConflicts > 0 && (
              <span className="apl-chip apl-chip-conflict" title="What the applicant typed doesn't match a document. Open to check.">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 7h10M7 12h6M7 17h3" />
                  <path d="m15 15 5 5M20 15l-5 5" />
                </svg>
                {openConflicts} conflict{openConflicts === 1 ? '' : 's'}
              </span>
            )}
            {flaggedCount === 0 && processingCount === 0 && toConfirmCount === 0 && openConflicts === 0 && docs.length > 0 && (
              <span className="apl-chip apl-chip-ok">All verified</span>
            )}
          </span>
        </div>
        <div className="apl-cell apl-date">{formatAplDate(eligibilityRow?.updated_at)}</div>
        <div className="apl-cell apl-status">
          <span className="apl-status-stack">
            <span className={`apl-pill ${statusMeta.cls}`}>{statusMeta.label}</span>
            {statusSub && <span className="apl-status-sub">{statusSub}</span>}
          </span>
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
                      <span className="text-[11px] font-bold tracking-wide text-ccc-blue bg-white border border-ccc-blue/40 rounded-full px-2.5 py-0.5 shrink-0">
                        <span className="font-semibold text-ccc-muted mr-1">App. No.</span>{eligibilityRow.application_number}
                      </span>
                    )}
                    {eligibilityRow?.reference_number && (
                      <span className="text-[11px] font-bold tracking-wide text-ccc-navy bg-white border border-ccc-navy/30 rounded-full px-2.5 py-0.5 shrink-0" title="Reference number given at sign-up">
                        <span className="font-semibold text-ccc-muted mr-1">Ref. No.</span>{eligibilityRow.reference_number}
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
                  {verifiedCount} Verified{toConfirmCount > 0 ? ` · ${toConfirmCount} To confirm` : ''}{processingCount > 0 ? ` · ${processingCount} Processing` : ''} · {flaggedCount} Pending Review
                  {integrityProblems > 0 && (
                    <span style={{ color: '#B71C1C', fontWeight: 700 }}>{` · ✗ ${integrityProblems} changed since upload`}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 pt-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <ConflictsBox
                applicationId={eligibilityRow?.id}
                items={conflicts}
                docs={docs}
                onChanged={onConflictsChanged}
                onGoToSection={(key) => {
                  setActiveCat(key)
                  if (typeof document !== 'undefined') {
                    document.getElementById(`docCats-${eligibilityRow?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              />
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
                </div>
                {/* Oct 12 2026 (RA 10173): when the applicant agreed to the
                    Data Privacy Consent. */}
                {detail && (
                  <p className="text-[11px] text-ccc-muted mb-2">
                    Data Privacy Consent:{' '}
                    {detail.privacy_agreed ? (
                      <strong className="text-ccc-text">
                        Agreed
                        {detail.privacy_agreed_at
                          ? ` on ${new Date(detail.privacy_agreed_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                          : ''}
                      </strong>
                    ) : (
                      <strong className="text-ccc-red">Not recorded</strong>
                    )}
                  </p>
                )}
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
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'last_name' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>First Name</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'first_name' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>Email Address</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={detail?.applicant_email || email || 'Not on file'} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>Contact Number</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'contact_number' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>Applying As</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'applying_as' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>Term Applying In</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'term_applying' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>First Priority Program</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'program_choice_1' })} disabled readOnly />}
                  </div>
                  <div className="efield">
                    <label>Second Priority Program</label>
                    {detailPending ? <Skeleton width="100%" height={38} radius={8} /> : <input value={formatFieldValue(detail, { key: 'program_choice_2' })} disabled readOnly />}
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
                <div className="modal-section-label" id={`docCats-${eligibilityRow?.id}`}>Submitted Documents &amp; Profile Data</div>
                <div className="doc-cat-tabs">
                  {PROFILE_CATEGORIES.map((cat) => {
                    const visibleStacks = cat.stacks.filter((s) => !s.showIf || s.showIf(detail))
                    const catDocTypes = visibleStacks.flatMap((s) => s.docTypes)
                    const catDocs = docs.filter((d) => catDocTypes.includes(d.document_type))
                    // Only the current (latest) file of each type counts as flagged.
                    const catFlagged = groupUploadsByType(catDocs).filter((g) => g[0].needs_review).length
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
                                if (onConflictsChanged) onConflictsChanged()
                              }}
                            />
                          )}
                          {stack.docTypes.length > 0 && (
                            stackDocs.length > 0 ? (
                              groupUploadsByType(stackDocs).map(([current, ...previous]) => (
                                <div key={current.file_path} className="doc-upload-group">
                                  {previous.length > 0 && <div className="doc-current-tag">Current (latest upload)</div>}
                                  <DocumentReviewCard doc={current} onOverride={onOverride} overriding={overriding} integrity={integrityFor(current, integrityResults)} />
                                  {previous.length > 0 && (
                                    <details className="doc-prev-uploads">
                                      <summary>Previous uploads ({previous.length})</summary>
                                      {previous.map((doc) => (
                                        <DocumentReviewCard key={doc.file_path} doc={doc} onOverride={onOverride} overriding={overriding} integrity={integrityFor(doc, integrityResults)} />
                                      ))}
                                    </details>
                                  )}
                                </div>
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
                      <DocumentReviewCard key={doc.file_path} doc={doc} onOverride={onOverride} overriding={overriding} integrity={integrityFor(doc, integrityResults)} />
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
    note: 'Profile or documents not yet complete, or not yet confirmed by staff.',
  },
  {
    key: 'qualified',
    label: 'Qualified as a Student',
    className: 'stat-qualified',
    note: 'Passed the entrance exam, or accepted on probation (Qualified as a Student, Probationary).',
  },
  {
    key: 'not_qualified',
    label: 'Not Qualified',
    className: 'stat-notqualified',
    note: 'Fails a requirement, or Disqualified / Forfeited after the exam.',
  },
  {
    key: 'waitlisted',
    label: 'Waitlisted',
    className: 'stat-waitlisted',
    note: 'Failed the exam. Waitlisted (Probationary) for open slots.',
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
// Oct 6 2026: tabs count by `bucket` (the exam result once there is one, see
// aplStatusOf), and Needs action also includes unchecked conflicts.
const APL_TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'action', label: 'Needs action', match: (g) => g.flagged || g.openConflicts > 0 || g.bucket === 'pending_exam' },
  { key: 'pending_exam', label: 'Eligible for Exam', match: (g) => g.bucket === 'pending_exam' },
  { key: 'qualified', label: 'Qualified as a Student', match: (g) => g.bucket === 'qualified' },
  { key: 'not_qualified', label: 'Not Qualified', match: (g) => g.bucket === 'not_qualified' },
  { key: 'waitlisted', label: 'Waitlisted', match: (g) => g.bucket === 'waitlisted' },
  { key: 'incomplete', label: 'Incomplete Profile', match: (g) => g.bucket === 'incomplete' },
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

// Oct 12 2026: document integrity on the Dashboard. "Verify all documents"
// sits in the header next to the other admin tools; the server works
// through every file in chunks and this keeps asking for the next chunk
// until it's done. Nothing extra is shown while every file is fine: a slim
// red banner appears only when a document no longer matches its upload
// fingerprint (or while a check is running).
function useVerifyAllDocuments(docs) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [run, setRun] = useState(null) // { summary, problems }
  const [runError, setRunError] = useState('')

  const savedProblems = useMemo(
    () => docs.filter((d) => d.integrity_status === 'changed' || d.integrity_status === 'missing'),
    [docs]
  )
  const problems = run ? run.problems : savedProblems

  const verifyAll = async () => {
    setRunning(true)
    setRunError('')
    setProgress(0)
    const summary = { verified: 0, changed: 0, missing: 0, error: 0, no_hash: 0 }
    const found = []
    let offset = 0
    try {
      for (let guard = 0; guard < 500; guard++) {
        const res = await fetch('/api/documents/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true, offset }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'The check could not finish.')
        for (const k of Object.keys(summary)) summary[k] += data.summary?.[k] || 0
        for (const r of data.results || []) if (r.status === 'changed' || r.status === 'missing') found.push(r)
        offset = data.nextOffset
        setProgress(offset)
        if (data.done || (data.results || []).length === 0) break
      }
      setRun({ summary, problems: found, finishedAt: new Date() })
      // Problems show on the Document integrity card; a clean run gets a
      // short confirmation toast.
      if (summary.changed + summary.missing === 0) {
        showAdminNotice(
          `Integrity check done: all ${summary.verified} documents are unchanged since upload.${summary.error ? ` ${summary.error} couldn’t be read; try again later.` : ''}`
        )
      }
    } catch (err) {
      setRunError(isNetworkError(err) ? 'No connection right now. Try again once you’re back online.' : err.message)
    } finally {
      setRunning(false)
    }
  }

  const savedVerified = docs.filter((d) => d.integrity_status === 'verified').length
  const savedLast = docs.reduce((max, d) => (d.integrity_checked_at && d.integrity_checked_at > max ? d.integrity_checked_at : max), '')
  return {
    running,
    progress,
    total: docs.length,
    problems,
    runError,
    verifyAll,
    verified: run ? run.summary.verified : savedVerified,
    lastChecked: run ? run.finishedAt : savedLast ? new Date(savedLast) : null,
  }
}

// Oct 12 2026 (Pau picked option B): two more stat cards in the Dashboard
// grid, same look as the others. "Documents to review" replaces the small
// grey "· 1 document need review" line that used to sit in the subtitle;
// "Document integrity" shows how many files still match the SHA-256
// fingerprint saved at upload, turns red when one doesn't, and holds the
// "Verify all documents" action.
function DocumentStatCards({ check, flaggedCount, toConfirmCount = 0, docsLoading, onShowFlagged }) {
  const { running, progress, total, problems, runError, verifyAll, verified, lastChecked } = check
  const changed = problems.length
  const when = lastChecked
    ? lastChecked.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  let value
  let note
  if (running) {
    value = `${Math.min(progress, total)} / ${total}`
    note = 'Checking every file against its upload fingerprint…'
  } else if (changed > 0) {
    value = changed
    note = (
      <>
        {changed === 1 ? 'File' : 'Files'} changed since upload (SHA-256 no longer matches):{' '}
        {problems.slice(0, 2).map((d, i) => (
          <span key={d.file_path}>
            {i > 0 ? '; ' : ''}
            {d.applicant_name || 'Unknown applicant'} · {getDocTypeLabel(d.document_type)}
            {(d.status || d.integrity_status) === 'missing' ? ' (missing)' : ''}
          </span>
        ))}
        {changed > 2 ? `; and ${changed - 2} more` : ''}.
      </>
    )
  } else if (verified > 0) {
    value = `${verified} / ${total}`
    note = `Unchanged since upload (SHA-256).${when ? ` Last checked ${when}.` : ''}${verified < total ? ` ${total - verified} not checked yet.` : ''}`
  } else {
    value = '—'
    note = 'Not checked yet. Files are re-checked when an applicant is opened, and daily.'
  }

  return (
    <>
      <div
        className="stat-card stat-docreview"
        onClick={onShowFlagged}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onShowFlagged()
          }
        }}
      >
        <p className="stat-label">Documents to review</p>
        {docsLoading ? (
          <p className="stat-value" aria-label="Loading">
            <Skeleton width={46} height={30} radius={7} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
          </p>
        ) : (
          <p className="stat-value">{flaggedCount}</p>
        )}
        <p className="stat-note">
          Flagged by OCR or an admin and waiting for a decision.
          {toConfirmCount > 0 ? ` Plus ${toConfirmCount} that passed the system check and wait for staff to confirm.` : ''}
        </p>
        <p className="stat-card-hint">
          <IconSearch className="w-3 h-3" /> Show applicants
        </p>
      </div>

      <div className={`stat-card stat-integrity${changed > 0 ? ' is-bad' : ''}`} style={{ cursor: 'default' }}>
        <p className="stat-label">Document integrity</p>
        {docsLoading ? (
          <p className="stat-value" aria-label="Loading">
            <Skeleton width={70} height={30} radius={7} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
          </p>
        ) : (
          <p className="stat-value" role="status">{value}</p>
        )}
        <p className="stat-note">{runError ? `Integrity check: ${runError}` : note}</p>
        <button
          type="button"
          className="stat-card-hint stat-card-action"
          onClick={verifyAll}
          disabled={running || total === 0}
          title="Re-reads every uploaded file and compares its SHA-256 fingerprint with the one saved at upload. Also runs on its own when an applicant is opened, and once a day."
        >
          ↻ {running ? 'Verifying…' : 'Verify all documents'}
        </button>
      </div>
    </>
  )
}

function DashboardPanel({
  docs,
  loading,
  error,
  onOverride,
  overriding,
  overrideError,
  eligibility,
  eligibilityLoading,
  onEligibilityOverride,
  eligibilityOverriding,
  eligibilityError,
  onRecomputeEligibility,
  recomputing,
  onProfileSaved,
}) {
  const locks = useApplicantLocks()
  const integrityCheck = useVerifyAllDocuments(docs)
  const [showForm3, setShowForm3] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'default', dir: 1 })
  const applicantListRef = useRef(null)
  // Sept 30 2026: real appeal count for the Appealed card (applicants with
  // at least one Appeal request). Best effort: 0 if it can't load.
  const [appealCount, setAppealCount] = useState(() => peek('appealCount') ?? 0)
  const [appealLoaded, setAppealLoaded] = useState(() => peek('appealCount') !== undefined)
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
        setAppealCount(keep('appealCount', who.size))
      })
      .catch(() => {})
      .finally(() => setAppealLoaded(true))
  }, [])
  // Oct 6 2026: Qualification Conflict Detection. Best effort: the table
  // still shows if this can't load.
  const [conflicts, setConflicts] = useState(() => peek('conflicts') || {})
  const loadConflicts = () => {
    fetch('/api/admin-conflicts')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setConflicts(keep('conflicts', data.conflicts || {}))
      })
      .catch(() => {})
  }
  useEffect(() => {
    loadConflicts()
  }, [docs, eligibility])

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
      const bucket = aplBucketOf(aplStatusOf(row))
      if (bucket in counts) counts[bucket] += 1
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
      const haystack = `${d.applicant_name || ''} ${d.applicant_email || ''} ${getDocTypeLabel(d.document_type)} ${eligRow?.application_number || ''} ${eligRow?.reference_number || ''}`.toLowerCase()
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

    // Oct 6 2026: applicants who haven't uploaded anything yet are listed too
    // (the All Applications card counted them, the table didn't: 9 vs 8).
    for (const row of eligibility || []) {
      const key = (row.applicant_name || '').trim().toLowerCase()
      if (!key || map.has(key)) continue
      if (programFilter !== 'all' && row.program_choice_1 !== programFilter) continue
      if (term && !`${row.applicant_name || ''} ${row.applicant_email || ''}`.toLowerCase().includes(term)) continue
      map.set(key, { name: row.applicant_name, email: row.applicant_email, docs: [] })
    }

    return Array.from(map.values()).map((g) => {
      const eligRow = eligibilityByName.get((g.name || '').trim().toLowerCase())
      const status = aplStatusOf(eligRow)
      const flagged = g.docs.some((d) => d.needs_review)
      const openConflicts = eligRow ? (conflicts[eligRow.id] || []).filter((c) => !c.checked).length : 0
      return { ...g, status, bucket: aplBucketOf(status), flagged, openConflicts, updatedAt: eligRow?.updated_at || null, appNo: eligRow?.application_number || '' }
    })
  }, [docs, search, programFilter, eligibilityByName, eligibility, conflicts])

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
    // Applicant, App. No. or Last Update header sorts by that instead.
    return list.sort((a, b) => {
      if (sort.key === 'name') return (a.name || '').localeCompare(b.name || '') * sort.dir
      // Oct 15 2026 (client): order by application number. No number yet = last.
      if (sort.key === 'appno') {
        if (a.appNo && b.appNo) return a.appNo.localeCompare(b.appNo, 'en', { numeric: true }) * sort.dir
        if (a.appNo || b.appNo) return a.appNo ? -1 : 1
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sort.key === 'updated') {
        const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return (at - bt) * sort.dir
      }
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
      if ((a.openConflicts > 0) !== (b.openConflicts > 0)) return a.openConflicts > 0 ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [searchedGroups, statusFilter, sort])

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: -prev.dir } : { key, dir: key === 'name' || key === 'appno' ? 1 : -1 }
    )
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 1 ? 'asc active' : 'active') : '')

  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            A summary of applicant statuses across the scholarship pipeline, for the Guidance Head and Guidance Staff.
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
            {/* Oct 5 2026: a skeleton until the count has loaded, instead of
                a misleading 0. */}
            {(card.key === 'appealed' ? !appealLoaded : eligibilityLoading) ? (
              <p className="stat-value" aria-label="Loading">
                <Skeleton width={46} height={30} radius={7} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              </p>
            ) : (
              <p className="stat-value">{statCardCounts[card.key]}</p>
            )}
            <p className="stat-note">{card.note}</p>
            {card.key !== 'appealed' && (
              <p className="stat-card-hint">
                <IconSearch className="w-3 h-3" /> Click to view list
              </p>
            )}
          </div>
        ))}
        <DocumentStatCards
          check={integrityCheck}
          flaggedCount={totalFlagged}
          toConfirmCount={docs.filter((d) => docState(d) === 'checked').length}
          docsLoading={loading}
          onShowFlagged={() => {
            setStatusFilter('action')
            applicantListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
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
          {(loading || eligibilityLoading) && !error && <Skeleton width={110} height={20} radius={20} />}
          {/* Oct 12 2026: the count only shows while a search, program or
              status filter is on; unfiltered it just repeated the total. */}
          {!loading && !eligibilityLoading && !error && (search.trim() || programFilter !== 'all' || statusFilter !== 'all') && (
            <span className="tag">
              {groups.length} matching applicant{groups.length === 1 ? '' : 's'}
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
              {loading || eligibilityLoading ? (
                <Skeleton width={16} height={14} radius={10} style={{ display: 'inline-block' }} />
              ) : (
                <span className="apl-tab-count">{tabCounts[tab.key] || 0}</span>
              )}
            </button>
          ))}
        </div>
        <StatusLegend />

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

        {loading || eligibilityLoading ? (
          <SkeletonRows rows={6} label="Loading applicants..." />
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
              <span className="apl-th-pair">
                <button type="button" className="apl-th apl-th-sort" onClick={() => toggleSort('name')}>
                  Applicant
                  <svg className={`sort-icon ${sortArrow('name')}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 16l-6-6h12z" /></svg>
                </button>
                <button type="button" className="apl-th apl-th-sort" onClick={() => toggleSort('appno')} title="Sort by application number (the order applications were submitted)">
                  App. No.
                  <svg className={`sort-icon ${sortArrow('appno')}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 16l-6-6h12z" /></svg>
                </button>
              </span>
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
                conflicts={conflicts[eligibilityByName.get((g.name || '').trim().toLowerCase())?.id] || []}
                onConflictsChanged={loadConflicts}
              />
            ))}
           </div>
          </div>
        )}
      </div>

      {/* Oct 12 2026: the "Reports" box (Qualified Applicants per
          Department / per Year Level) was removed from the Dashboard; the
          same breakdowns are in Statistics. */}
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
  pending_exam: { label: 'Eligible for Exam', className: 'badge-progress' },
  passer: { label: 'Qualified as a Student', className: 'badge-verified' },
  waitlisted_probationary: { label: 'Waitlisted (Probationary)', className: 'badge-orange' },
  qualified_probationary: { label: 'Qualified as a Student (Probationary)', className: 'badge-orange' },
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
    // Oct 6 2026: Appendix J rule b, re-evaluation in another program.
    if (row.exam_score != null && row.exam_score !== '' && eligibleProgramsForScore(row.exam_score, row).some((o) => !o.blockedReason)) {
      return { text: 'The score meets another program. Re-evaluate in section 1, or leave the applicant Waitlisted for an open slot.', tone: 'go' }
    }
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
  qualified_probationary: 'Qualified as a Student (Probationary)',
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
                  Exam results are hidden from applicants right now. The Guidance Head needs to turn on &ldquo;Exam Results Visible to Applicants&rdquo; in Admission Cycle first.
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
  if (scholarStatus === 'waitlisted_probationary') {
    if (row.exam_score != null && row.exam_score !== '' && eligibleProgramsForScore(row.exam_score, row).some((o) => !o.blockedReason)) {
      return 'Re-evaluate in another program'
    }
    return 'Waiting for an open slot'
  }
  if (eligStatus === 'incomplete') return 'Waiting on applicant profile'
  if (eligStatus === 'not_qualified') return 'Not qualified (exception only)'
  return 'Record exam result'
}

const RESULT_RELEASABLE = ['passer', 'waitlisted_probationary', 'qualified_probationary', 'forfeited', 'disqualified']

const EXAM_RESULT_LABELS = { passed: 'Passed', failed: 'Failed', absent: 'Absent' }

// Nov 2026: before an exam result exists, Applicant Results used to call
// everyone "Pending Exam". After the rename to "Eligible for Exam" that was
// wrong for applicants who are still incomplete or not qualified (Results
// said 34 eligible while the Dashboard said 3). Before the exam, the
// eligibility check decides the label, the same as the Dashboard.
function isEligibleForExam(row) {
  return (row.eligibility_override || row.eligibility_status) === 'pending_exam'
}
function resultsStageOf(row) {
  const s = row.scholar_status || 'pending_exam'
  if (s !== 'pending_exam') return { label: SCHOLAR_STATUS_META[s]?.label || s, cls: SCHOLAR_PILL_CLASS[s] || 'apl-pill-blue' }
  const e = row.eligibility_override || row.eligibility_status || 'incomplete'
  if (e === 'pending_exam') return { label: 'Eligible for Exam', cls: 'apl-pill-blue' }
  if (e === 'not_qualified') return { label: 'Not Qualified', cls: 'apl-pill-red' }
  if (e === 'qualified' || e === 'waitlisted') return { label: ELIGIBILITY_META[e]?.label || e, cls: e === 'qualified' ? 'apl-pill-green' : 'apl-pill-gold' }
  return { label: 'Incomplete Profile', cls: 'apl-pill-gray' }
}

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

// ---------- Eligible programs (Oct 6 2026) ----------
// Manuscript p. 10: the matching module "generates a listing of eligible
// programs for each applicant". Appendix J p. 96 rule b: an applicant who
// doesn't reach the passing grade of their priority program "will be
// re-evaluated in another program based on his/her exam result". The list
// shows every program the saved score meets (2nd choice first); rule a
// greys out BSEd Mathematics / Science when the SHS grade is below 85 or
// not given. The admin picks one; nothing changes on its own.
function EligibleProgramsBox({ row, busy, onAccept }) {
  const [pick, setPick] = useState('')
  const [confirming, setConfirming] = useState(false)
  const options = useMemo(() => eligibleProgramsForScore(row.exam_score, row), [row])
  const firstChoice = row.program_choice_1 || 'the 1st choice'
  const firstClosedByRuleA = bsedGradeBelow(row.program_choice_1, row)
  const intro = firstClosedByRuleA
    ? `${firstChoice} needs 85 or higher in every SHS Mathematics and Science subject (Appendix J, rule a), so the applicant is re-evaluated for another program based on the exam score (rule b).`
    : `A score of ${row.exam_score} is below the passing grade for ${firstChoice} (1st choice). CCC re-evaluates the applicant for another program based on the exam score (Appendix J, rule b). Pick one to accept them there.`
  return (
    <div className="ep-box">
      <div className="ep-head">
        <span className="ep-title">Programs this score qualifies for</span>
        <span className="ep-intro">{intro}</span>
      </div>
      {options.length === 0 ? (
        <div className="ep-list">
          <span className="ep-intro">No other program&rsquo;s passing grade is met. The applicant stays Waitlisted (Probationary).</span>
        </div>
      ) : (
        <>
          <div className="ep-list" role="radiogroup" aria-label="Programs this score qualifies for">
            {options.map((o) => (
              <button
                key={o.program}
                type="button"
                role="radio"
                aria-checked={pick === o.program}
                disabled={!!o.blockedReason}
                className={`ep-prog${pick === o.program ? ' on' : ''}`}
                onClick={() => setPick(o.program)}
              >
                <span className="ep-radio" aria-hidden="true" />
                <span>
                  <span className="ep-name">{o.program}</span>
                  {o.isSecondChoice && <span className="ep-tag">2nd choice</span>}
                  <span className="ep-note">{o.blockedReason ? `Not eligible: ${o.blockedReason}` : `Score ${row.exam_score} meets ${o.grade}`}</span>
                </span>
                <span className="ep-grade">passing {o.grade}</span>
              </button>
            ))}
          </div>
          <div className="ep-foot">
            <span>Or leave it: the applicant stays Waitlisted (Probationary).</span>
            <button
              type="button"
              className="rr-btn rr-btn-primary"
              disabled={!pick || busy}
              onClick={() => setConfirming(true)}
            >
              {pick ? 'Accept in this program' : 'Pick a program'}
            </button>
          </div>
        </>
      )}
      {confirming && (
        <ConfirmActionModal
          eyebrow="Confirm re-evaluation"
          title={
            <>
              Accept <span className="font-bold text-ccc-navy">{row.applicant_name || 'this applicant'}</span> in{' '}
              <span className="font-bold text-ccc-navy">{pick}</span>?
            </>
          }
          message="This sets the scholar status to Qualified as a Student and the admitted program to this one. The recorded exam result stays as entered. The result notice, CHED Form 3 and the Registrar will use the admitted program. It is logged in the Activity Log."
          onConfirm={() => {
            setConfirming(false)
            onAccept(row.id, pick)
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

function ResultRow({ row, onSaveExam, onSetScholarStatus, onAdvanceDistribution, onReevaluate, onReload, busy, lockInfo }) {
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

  // Oct 6 2026: re-evaluation (Appendix J rule b) and the BSEd rule (rule a).
  const [confirmUndoReeval, setConfirmUndoReeval] = useState(false)
  const firstIsBsed = BSED_MATH_SCIENCE_PROGRAMS.has(row.program_choice_1)
  const bsedGradeMissing = firstIsBsed && (row.shs_math_science_lowest === null || row.shs_math_science_lowest === undefined || row.shs_math_science_lowest === '')
  const showEligiblePrograms =
    !hasUnsavedExamChanges &&
    !row.admitted_program &&
    row.exam_result &&
    row.exam_result !== 'absent' &&
    row.scholar_status === 'waitlisted_probationary' &&
    reachedFirstChoice(row) !== true

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
  const { label: scholarLabel, cls: pillClass } = resultsStageOf(row)
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
          <span className="apl-main">{admittedProgramOf(row) || 'Not yet chosen'}</span>
          <span className="apl-sub">
            {row.admitted_program ? 'Re-evaluated (Appendix J, rule b)' : row.applying_as || 'Not yet specified'}
          </span>
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
                        {row.admitted_program ? `Admitted in ${row.admitted_program} (1st choice: ${row.program_choice_1})` : row.program_choice_1}
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
          {examSuggestion.threshold != null && !row.admitted_program && (
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
            Qualified as a Student, Failed becomes Waitlisted (Probationary), Absent becomes Forfeited.
          </p>
          {firstIsBsed && (bsedGradeMissing || bsedGradeBelow(row.program_choice_1, row)) && (
            <p className="ep-warn">
              {bsedGradeMissing
                ? `${row.program_choice_1} needs 85 or higher in every SHS Mathematics and Science subject (Appendix J, rule a). This applicant's lowest grade isn't on file yet: check the report card and add it with Edit (Dashboard, Educational Background).`
                : `Lowest SHS Mathematics or Science grade on file is ${row.shs_math_science_lowest}, below 85, so ${row.program_choice_1} is closed (Appendix J, rule a). A passing score is saved as Waitlisted until the applicant is re-evaluated in another program.`}
            </p>
          )}
          {row.admitted_program && (
            <div className="ep-ok">
              <RrCheck />
              <span>
                Accepted in <b>{row.admitted_program}</b> by re-evaluation (Appendix J, rule b)
                {row.admitted_program_set_by ? `, by ${row.admitted_program_set_by}` : ''}
                {row.admitted_program_set_at ? ` · ${rrDate(row.admitted_program_set_at)}` : ''}.{' '}
                <button type="button" className="qc-link" disabled={isBusy} onClick={() => setConfirmUndoReeval(true)}>
                  Undo
                </button>
              </span>
            </div>
          )}
          {showEligiblePrograms && <EligibleProgramsBox row={row} busy={isBusy} onAccept={onReevaluate} />}
          {confirmUndoReeval && (
            <ConfirmActionModal
              eyebrow="Confirm undo"
              title={
                <>
                  Undo the re-evaluation of <span className="font-bold text-ccc-navy">{row.applicant_name || 'this applicant'}</span>?
                </>
              }
              message="The admitted program is cleared and the scholar status goes back to what the exam result gives (Failed becomes Waitlisted (Probationary)). It is logged in the Activity Log."
              onConfirm={() => {
                setConfirmUndoReeval(false)
                onReevaluate(row.id, null)
              }}
              onCancel={() => setConfirmUndoReeval(false)}
            />
          )}
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
                Not applicable yet. Becomes available once this applicant is Qualified as a Student (regular or Probationary).
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
  // Nov 2026: the same groups, in the same order, as the Dashboard tabs and
  // cards (aplStatusOf / aplBucketOf), so every count matches tab for tab.
  // Qualified as a Student includes Qualified (Probationary); Not Qualified
  // includes Disqualified and Forfeited, exactly like the Dashboard.
  { key: 'pending_exam', label: 'Eligible for Exam', match: (r) => aplBucketOf(aplStatusOf(r)) === 'pending_exam' },
  { key: 'qualified', label: 'Qualified as a Student', match: (r) => aplBucketOf(aplStatusOf(r)) === 'qualified' },
  { key: 'waitlisted', label: 'Waitlisted', match: (r) => aplBucketOf(aplStatusOf(r)) === 'waitlisted' },
  { key: 'not_qualified', label: 'Not Qualified', match: (r) => aplBucketOf(aplStatusOf(r)) === 'not_qualified' },
  { key: 'incomplete', label: 'Incomplete Profile', match: (r) => aplBucketOf(aplStatusOf(r)) === 'incomplete' },
]

// Nov 2026 (panel revisions S7): exam scores by CSV. The exam is still
// face-to-face, pen and paper; staff download the score sheet, fill in the
// scores, and upload it. The server shows a preview first and saves only
// after "Save these results" (app/api/admin-results/import).
function csvCell(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function ExamCsvCard({ rows, onSaved }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const sheetRows = rows.filter((r) => (r.eligibility_override || r.eligibility_status) === 'pending_exam' || r.exam_result)

  const downloadSheet = () => {
    const lines = [['application_number', 'name', 'program_choice_1', 'exam_date', 'score', 'result']]
    for (const r of [...sheetRows].sort((a, b) => String(a.application_number || '').localeCompare(String(b.application_number || '')))) {
      lines.push([r.application_number || '', r.applicant_name || '', r.program_choice_1 || '', r.exam_date || '', r.exam_score ?? '', r.exam_result || ''])
    }
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `exam-score-sheet-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const send = async (text, apply) => {
    setWorking(true)
    setError('')
    try {
      const res = await fetch('/api/admin-results/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, apply }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'The file could not be read.')
      if (!apply) {
        setPreview(data.preview)
      } else {
        setPreview(null)
        setCsv('')
        setFileName('')
        if (fileRef.current) fileRef.current.value = ''
        const extra = data.failed?.length ? ` ${data.failed.length} could not be saved (${data.failed.map((f) => `line ${f.line}: ${f.reason}`).join('; ')}).` : ''
        showAdminNotice(`Saved ${data.saved} exam result${data.saved === 1 ? '' : 's'} from the CSV.${extra}`)
        onSaved()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  const onFile = async (file) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('The CSV file is too large (2 MB at most).')
      return
    }
    const text = await file.text()
    setFileName(file.name)
    setCsv(text)
    send(text, false)
  }

  const okCount = preview ? preview.filter((r) => r.ok).length : 0
  return (
    <div className="card">
      <div className="card-title">Exam scores by CSV</div>
      <p className="text-xs text-ccc-muted leading-relaxed mb-3">
        The entrance exam is taken face-to-face, on paper. After checking, download the score sheet, fill in the
        <b> score</b> (and <b>result</b> only for <i>absent</i>, or to override), then upload it. Blank result = from the
        1st-choice program&apos;s passing grade, same as typing it in. Nothing is saved until you review the preview.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="cm-btn cm-btn-secondary" onClick={downloadSheet} disabled={sheetRows.length === 0}>
          Download score sheet ({sheetRows.length})
        </button>
        <label className="cm-btn cm-btn-secondary" style={{ cursor: working ? 'wait' : 'pointer' }}>
          {working && !preview ? 'Reading…' : 'Upload filled sheet (.csv)'}
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" disabled={working} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-xs text-ccc-muted">{fileName}</span>}
      </div>
      {error && <div className="text-xs text-ccc-red mt-2">{error}</div>}
      {preview && (
        <div className="mt-3">
          <p className="text-xs text-ccc-navy mb-2">
            <b>{okCount}</b> row{okCount === 1 ? '' : 's'} ready to save, <b>{preview.length - okCount}</b> skipped.
          </p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-ccc-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-ccc-off sticky top-0">
                <tr>
                  <th className="text-left p-2">Line</th>
                  <th className="text-left p-2">Applicant</th>
                  <th className="text-left p-2">Score</th>
                  <th className="text-left p-2">Result</th>
                  <th className="text-left p-2">Becomes</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.line} className="border-t border-ccc-border">
                    <td className="p-2">{r.line}</td>
                    <td className="p-2">{r.name || r.number || '—'}{r.number && r.name ? <span className="text-ccc-muted"> · {r.number}</span> : null}</td>
                    {r.ok ? (
                      <>
                        <td className="p-2">{r.score ?? '—'}</td>
                        <td className="p-2">{r.result}{r.replaces ? <span className="text-ccc-muted"> (was {r.replaces})</span> : null}</td>
                        <td className="p-2">{SCHOLAR_STATUS_META[r.status]?.label || r.status}</td>
                      </>
                    ) : (
                      <td className="p-2 text-ccc-red" colSpan={3}>Skipped: {r.reason}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" className="cm-btn cm-btn-primary" disabled={working || okCount === 0} onClick={() => send(csv, true)}>
              {working ? 'Saving…' : `Save these ${okCount} result${okCount === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="cm-btn cm-btn-secondary" disabled={working} onClick={() => { setPreview(null); setCsv(''); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsPanel() {
  const locks = useApplicantLocks()
  const [rows, setRows] = useState(() => peek('results') ?? [])
  const [loading, setLoading] = useState(() => peek('results') === undefined)
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
    if (!silent && peek('results') === undefined) setLoading(true)
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
      setRows(keep('results', resultsData.applications.map((r) => ({ ...eligById.get(r.id), ...r }))))
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
      } else if (payload.field === 'reevaluate') {
        showAdminNotice(
          payload.program
            ? `${name} was accepted in ${payload.program} by re-evaluation. Scholar Status is now Qualified as a Student.`
            : `The re-evaluation of ${name} was undone.`
        )
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
  const handleReevaluate = (id, program) => runPatch({ id, field: 'reevaluate', program })

  // Sept 24 2026, per Pau's live testing feedback: a filter for whether an
  // applicant has an application_number, labeled by what that actually
  // means rather than the raw column name. Oct 6 2026: the number is now
  // given at the final Submit (which needs the sections and the required
  // documents), so the labels say "Submitted (has application no.)" and
  // "Not submitted yet" instead of "Documents Complete/Incomplete".
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

      <ExamCsvCard rows={rows} onSaved={() => load(true)} />

      {/* Oct 1 2026 reskin: same card + filter bar as the Dashboard's All
          Applicants card, so the two lists look and behave alike. Rows and
          the pop-up are unchanged. */}
      <div className="card">
        <div className="card-title">
          All Applicants
          {loading && <Skeleton width={110} height={20} radius={20} />}
          {!loading && filtered.length !== rows.length && (
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
              {loading ? <Skeleton width={16} height={14} radius={10} style={{ display: 'inline-block' }} /> : <span className="apl-tab-count">{resultTabCounts[t.key] || 0}</span>}
            </button>
          ))}
        </div>
        <StatusLegend />

        <div className="filter-bar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, email, or application number..."
            aria-label="Search applicants"
          />
          <select className="program-filter-select" value={docFilter} onChange={(e) => setDocFilter(e.target.value)} aria-label="Filter by submission">
            <option value="all">All applicants</option>
            <option value="complete">Submitted (has application no.)</option>
            <option value="incomplete">Not submitted yet</option>
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
          <SkeletonRows rows={6} label="Loading applicants..." />
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
              onReevaluate={handleReevaluate}
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
// analytics. (Oct 5 2026: Allowance Distribution Monitoring and the CHED
// Form 3 export for the LGU are now built too, in the Registrar console and
// on the Dashboard, PR #26; they don't live in this panel.)
//
// "Department" is derived from the program (DASHBOARD_DEPARTMENTS). "Year
// Level" is the applicant's classification at admission, the Applying As
// value (First Year / Transferee / Old Curriculum & ALS Completer). That is
// what CCC's own application form records ("Classification: Freshman",
// Appendix I) and how Ivy's approved admin.html groups its "per Year Level"
// table (Pau chose this on Oct 5 2026 instead of adding a separate year
// field, so the Progress Table and manuscript wording stay as they are).

// Oct 3 2026 redesign (Statistics v2, approved on the design canvas):
// one KPI strip, three status panels with a "% of applicants" column, and
// an "Applicants by program" table. The panel now refreshes on its own,
// same as the Activity Log: every 15 s while the tab is visible, when the
// admin comes back to the tab, and right after any admin action pop-up.
// Same data sources as before (/api/admin-eligibility + /api/admin-results,
// joined by id, plus the appeal count from /api/admin-reschedule).
const STAT_ELIGIBILITY = [
  { key: 'qualified', label: 'Qualified as a Student', color: '#1B6B3A' },
  { key: 'not_qualified', label: 'Not Qualified', color: '#C0392B' },
  { key: 'waitlisted', label: 'Waitlisted', color: '#C8A84B' },
  { key: 'pending_exam', label: 'Eligible for Exam', color: '#003CD0' },
  // Oct 15 2026 (client): was "Incomplete (Ongoing)".
  { key: 'incomplete', label: 'Not yet submitted', color: '#A7B4C8' },
]
const STAT_SCHOLAR = [
  { key: 'passer', label: 'Qualified as a Student', color: '#1B6B3A' },
  { key: 'qualified_probationary', label: 'Qualified as a Student (Probationary)', color: '#E07B39' },
  { key: 'waitlisted_probationary', label: 'Waitlisted (Probationary)', color: '#C8A84B' },
  { key: 'disqualified', label: 'Disqualified', color: '#C0392B' },
  { key: 'forfeited', label: 'Forfeited', color: '#5A6B85' },
  { key: 'pending_exam', label: 'Eligible for Exam', color: '#003CD0' },
]
const STAT_APPLYING_COLORS = ['#0D2F6E', '#C8A84B', '#5A6B85', '#A7B4C8']
// Oct 12 2026: one fixed color per department (the order of
// DASHBOARD_DEPARTMENTS), so a department keeps its color whatever the
// filter; same palette as the other Statistics panels.
const STAT_DEPARTMENT_COLORS = ['#0D2F6E', '#C8A84B', '#5A6B85', '#A7B4C8']
const STAT_NOT_CHOSEN_COLOR = '#E3E7EE'
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
  const [rows, setRows] = useState(() => peek('stats') ?? [])
  const [loading, setLoading] = useState(() => peek('stats') === undefined)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState(false)
  const [loadedAt, setLoadedAt] = useState(() => peek('statsAt') ?? null)
  const [now, setNow] = useState(() => Date.now())
  const [department, setDepartment] = useState('all')
  const [showEmptyPrograms, setShowEmptyPrograms] = useState(false)
  // Sept 30 2026: appeals count (progress table "... Appeals, and Waitlisted
  // Analytics"). Best effort, 0 if it can't load.
  const [appealCount, setAppealCount] = useState(() => peek('appealCount') ?? 0)

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) {
      if (peek('stats') === undefined) setLoading(true)
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
      setRows(keep('stats', resultsData.applications.map((r) => ({ ...byId.get(r.id), ...r }))))
      setLoadedAt(keep('statsAt', Date.now()))
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
        setAppealCount(keep('appealCount', who.size))
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
    const departments = new Map()
    const programs = new Map()
    let profileComplete = 0

    for (const r of visibleRows) {
      const e = r.eligibility_override || r.eligibility_status || 'incomplete'
      // Nov 2026: same rule as the Dashboard cards (after-exam status first),
      // so Statistics, the Dashboard and the counts-only dashboards agree.
      const bucket = aplBucketOf(aplStatusOf(r))
      if (bucket in elig) elig[bucket] += 1
      const s = r.scholar_status || 'pending_exam'
      // Nov 2026: "Eligible for Exam" only counts applicants who are.
      if (s in scholar && (s !== 'pending_exam' || e === 'pending_exam')) scholar[s] += 1
      const a = r.applying_as || 'Not yet specified'
      applying.set(a, (applying.get(a) || 0) + 1)
      const d = statDepartmentOf(r.program_choice_1)
      departments.set(d, (departments.get(d) || 0) + 1)
      if (PROFILE_SECTIONS.every((sec) => !!r[sec.key])) profileComplete += 1

      const program = r.program_choice_1 || 'Not yet chosen'
      if (!programs.has(program)) programs.set(program, { total: 0, ...Object.fromEntries(STAT_ELIGIBILITY.map((x) => [x.key, 0])) })
      const p = programs.get(program)
      p.total += 1
      if (bucket in p) p[bucket] += 1
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
      departments: [
        ...DASHBOARD_DEPARTMENTS.map((dep, i) => ({
          label: dep.label,
          count: departments.get(dep.label) || 0,
          color: STAT_DEPARTMENT_COLORS[i % STAT_DEPARTMENT_COLORS.length],
        })),
        ...(departments.get('Not yet chosen') ? [{ label: 'Not yet chosen', count: departments.get('Not yet chosen'), color: STAT_NOT_CHOSEN_COLOR }] : []),
      ],
      programRows,
    }
  }, [visibleRows, department])

  // Oct 5 2026: the page's own header and card shapes, with skeletons where
  // the numbers will go.
  if (loading)
    return (
      <div className="st-wrap">
        <div className="st-header">
          <div>
            <h1 className="st-title">Statistics</h1>
            <p className="st-subtitle">Scholarship applications, as of today</p>
          </div>
        </div>
        <div className="st-card st-kpis" role="status" aria-live="polite">
          <span className="sk-sr">Loading statistics...</span>
          {['Total applications', 'Profile complete', 'Eligible for Exam', 'Qualified as a Student', 'Appeals filed'].map((label) => (
            <div key={label} className="st-kpi">
              <span className="st-kpi-label">{label}</span>
              <span className="st-kpi-value">
                <Skeleton width={56} height={28} radius={7} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              </span>
              <span className="st-kpi-sub">
                <Skeleton width="70%" height={9} style={{ display: 'inline-block' }} />
              </span>
            </div>
          ))}
        </div>
        <div className="st-panels">
          {[0, 1, 2].map((i) => (
            <div key={i} className="st-card" style={{ padding: 20 }}>
              <SkeletonText lines={5} label="" />
            </div>
          ))}
        </div>
      </div>
    )
  if (error) return <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 text-sm text-ccc-red">{error}</div>

  const programRowsShown = showEmptyPrograms ? stats.programRows : stats.programRows.filter((p) => p.total > 0)
  const kpis = [
    { label: 'Total applications', value: stats.total, sub: department === 'all' ? 'All applicants this cycle' : department },
    { label: 'Profile complete', value: stats.profileComplete, sub: `${statPct(stats.profileComplete, stats.total)} of applicants` },
    { label: 'Eligible for Exam', value: stats.elig.pending_exam, sub: `${statPct(stats.elig.pending_exam, stats.total)} of applicants` },
    { label: 'Qualified as a Student', value: stats.elig.qualified, sub: `${statPct(stats.elig.qualified, stats.total)} of applicants` },
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
          foot="Not yet submitted includes accounts that started an application but never finished it."
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
          title="Year Level (Applying As)"
          keyLabel="Applying as"
          total={stats.total}
          items={stats.applying.map(([label, count], i) => ({
            label,
            count,
            color: STAT_APPLYING_COLORS[i % STAT_APPLYING_COLORS.length],
          }))}
          foot="Year level at admission: First Year, Transferee, or Old Curriculum & ALS Completer, as chosen on the application form."
        />
        {/* Oct 12 2026 (manuscript Ch. 1: "demographic distribution charts
            by course, program, department, and year level"). */}
        <StatSplitPanel
          title="Department"
          keyLabel="Department (1st choice)"
          total={stats.total}
          items={stats.departments}
          foot="Department of the applicant's first-choice program."
        />
      </div>

      <section className="st-card">
        <div className="st-card-head st-card-head-wrap">
          <div>
            <h2 className="st-card-title">Applicants by program</h2>
            <span className="st-meta">
              Grouped by 1st choice program. Eligibility status per program. Applicants also counts those who have not submitted yet.
            </span>
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
                <th className="r">Qualified as a Student</th>
                <th className="r">Not Qualified</th>
                <th className="r">Waitlisted</th>
                <th className="r">Eligible for Exam</th>
              </tr>
            </thead>
            <tbody>
              {programRowsShown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="st-empty">No applicants in this department yet.</td>
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
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="st-footnote">
        Department is derived from the program. Year Level is the applicant&apos;s classification at admission (Applying
        As).
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

function IconCheckRead() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12l5 5L18 6" />
      <path d="M12 16l1 1L22 8" />
    </svg>
  )
}

function CommunicationsPanel() {
  const [items, setItems] = useState(() => peek('announcements') ?? [])
  const [loading, setLoading] = useState(() => peek('announcements') === undefined)
  const [error, setError] = useState('')
  const [applicants, setApplicants] = useState(() => peek('commApplicants') ?? [])

  // Oct 12 2026: opens on Announcement with its fields showing, like Exam
  // Schedules' New Exam Batch (Ivy's Suggestions Log); Message is one click.
  const [commType, setCommType] = useState('announcement')
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
  // Oct 16 2026: who confirmed reading each post { [id]: [{ name, at }] }.
  const [acks, setAcks] = useState(() => peek('announcementAcks') ?? {})
  const [ackOpenIds, setAckOpenIds] = useState([])

  const load = async () => {
    if (peek('announcements') === undefined) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/announcements')
      const data = await res.json()
      if (data.success) {
        setItems(keep('announcements', data.announcements))
        setAcks(keep('announcementAcks', data.acknowledgments || {}))
      } else setError(data.error || 'Failed to load announcements.')
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
        if (data.success) setApplicants(keep('commApplicants', data.applications))
      })
      .catch(() => {})
    // Oct 16 2026: read confirmations come in while the admin is looking,
    // so the list refreshes by itself (every 5 s while the tab is visible,
    // and when the admin comes back to the tab), like Statistics. A check
    // never starts while the last one is still running.
    let busy = false
    const refresh = () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      fetch('/api/announcements')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setItems(keep('announcements', data.announcements))
            setAcks(keep('announcementAcks', data.acknowledgments || {}))
          }
        })
        .catch(() => {})
        .finally(() => { busy = false })
    }
    const poll = setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setCommType('announcement')
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
                  {label}{' '}
                  {loading ? (
                    <Skeleton width={16} height={14} radius={10} style={{ display: 'inline-block' }} />
                  ) : (
                    <span className="cm-tab-count">{feedTypeCount(key)}</span>
                  )}
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
            <SkeletonList items={4} label="Loading posts..." />
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
                        {item.requires_ack === true && (
                          <button
                            type="button"
                            className="cm-ack"
                            aria-expanded={ackOpenIds.includes(item.id)}
                            onClick={() =>
                              setAckOpenIds((prev) => (prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]))
                            }
                          >
                            <IconCheckRead />
                            {(acks[item.id] || []).length === 0
                              ? 'Not confirmed by anyone yet'
                              : `Read and confirmed by ${(acks[item.id] || []).length} applicant${(acks[item.id] || []).length === 1 ? '' : 's'}`}
                          </button>
                        )}
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
                      {item.requires_ack === true && ackOpenIds.includes(item.id) && (
                        <div className="cm-acklist">
                          {(acks[item.id] || []).length === 0 ? (
                            <span className="cm-ack-none">
                              Applicants see this as a pop-up the next time they open their portal, and must tick &ldquo;I have read and
                              understood this message&rdquo; to continue.
                            </span>
                          ) : (
                            (acks[item.id] || []).map((a, k) => (
                              <span className="cm-ack-row" key={`${a.name}-${k}`}>
                                <b>{a.name}</b>
                                <span>{formatWhen(a.at)}</span>
                              </span>
                            ))
                          )}
                        </div>
                      )}
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
// Nov 2026 (panel revisions S8): roles by function. The System Admin runs
// the system; the Guidance Head and Registrar are unit admins.
const ADMIN_ROLE_OPTIONS = [
  { key: 'admin', label: 'Guidance Staff', desc: 'Processes applicants: documents, results, exam schedules, requests and communications.' },
  { key: 'guidance_head', label: 'Guidance Head', desc: 'Everything Guidance Staff does, plus opening/closing applications, releasing results and the archive.' },
  { key: 'registrar', label: 'Office of the Registrar', desc: 'Posts allowances for scholars. Sees Dashboard counts only.' },
  { key: 'super_admin', label: 'System Admin', desc: 'Manages accounts and the Activity Log. Sees Dashboard counts only, no applicant details.' },
]
// Oct 15 2026 (client): the LGU (view only) role was removed; CCC sends the
// exported CHED Form 3 to the LGU itself. An old LGU account still shows
// in the list (it can't sign in) until it is removed.
const ADMIN_ROLE_LABEL = { ...Object.fromEntries(ADMIN_ROLE_OPTIONS.map((r) => [r.key, r.label])), lgu: 'LGU (no longer used)' }
const ADMIN_ROLE_PHRASE = {
  admin: 'a Guidance Staff account',
  guidance_head: 'the Guidance Head',
  super_admin: 'a System Admin',
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
  const [accounts, setAccounts] = useState(() => peek('accounts') ?? [])
  const [loading, setLoading] = useState(() => peek('accounts') === undefined)
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
    if (peek('accounts') === undefined) setLoading(true)
    fetch('/api/admin-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAccounts(keep('accounts', data.accounts))
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
      desc: `Re-enter your password to invite ${newName.trim()} (${newEmail.trim()}) as ${ADMIN_ROLE_PHRASE[newRole]}.`,
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
  const headCount = accounts.filter((a) => roleOf(a) === 'guidance_head').length
  const registrarCount = accounts.filter((a) => roleOf(a) === 'registrar').length
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
            password and choose their own when they first sign in. Inviting, resetting and
            removing accounts all ask for your password first.
          </p>
        </div>
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

      {loading && <SkeletonStatGrid cards={6} label="" />}
      {!loading && !error && (
        <div className="cm-card cm-kpis">
          <div className="cm-kpi">
            <span className="cm-kpi-label">System Admins</span>
            <span className="cm-kpi-value">{superCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Guidance Head</span>
            <span className="cm-kpi-value">{headCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Guidance Staff</span>
            <span className="cm-kpi-value">{adminCount}</span>
          </div>
          <div className="cm-kpi">
            <span className="cm-kpi-label">Registrar</span>
            <span className="cm-kpi-value">{registrarCount}</span>
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
            </div>
          </div>
          {loading ? (
            <SkeletonRows rows={4} label="Loading accounts..." />
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
                        ended: isLgu ? 'LGU accounts are no longer used and cannot sign in. Remove this account.' : 'Their access has ended.',
                        active: 'Signed in with their own password.',
                      }[status]
                      const onlyRegistrar = role === 'registrar' && registrarCount <= 1
                      const onlyHead = role === 'guidance_head' && headCount <= 1
                      const removeOff = isSelf || onlyRegistrar || onlyHead
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
                            <span className="aa-role-cell">
                              <span className={`aa-chip ${role === 'super_admin' ? 'super' : role === 'admin' || role === 'guidance_head' ? 'admin' : 'limited'}`}>
                                {ADMIN_ROLE_LABEL[role]}
                              </span>
                              {isLgu && <span className="aa-access">Can&apos;t sign in. Remove this account.</span>}
                            </span>
                          </td>
                          <td>
                            <span className={`aa-chip status ${status}`} title={statusTitle}>
                              <span className="aa-dot" />
                              {statusLabel}
                            </span>
                          </td>
                          <td className="r">
                            <span className="aa-actions">
                              {!isLgu && <button
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
                              </button>}
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
                                      : onlyHead
                                        ? 'This is the only Guidance Head account. Invite another Guidance Head first.'
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
                You can&apos;t reset or remove your own account, the last System Admin, the only Guidance Head, or the only Registrar account.{' '}
                <b>Pending setup</b> means they haven&apos;t signed in to choose a password yet; <b>Invite expired</b> means use
                Reset password to send a new one.
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

const ACTIVITY_CATEGORIES = ['Applicants', 'Documents', 'Eligibility', 'Results', 'Communications', 'Allowance', 'Reports', 'Admin Accounts', 'System']

function CycleSettingsCard() {
  const [settings, setSettings] = useState(() => peek('settings') ?? null)
  const [draft, setDraft] = useState(() => peek('settings') ?? null)
  const [loading, setLoading] = useState(() => peek('settings') === undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState(false)

  useEffect(() => {
    const shownFirst = peek('settings')
    fetch('/api/system-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          keep('settings', data.settings)
          setSettings(data.settings)
          // Don't overwrite changes the admin already started making to the
          // remembered copy while the fresh one was loading.
          setDraft((current) =>
            current && shownFirst && JSON.stringify(current) !== JSON.stringify(shownFirst) ? current : data.settings
          )
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
      setSettings(keep('settings', data.settings))
      setDraft(data.settings)
      setSavedNote(true)
      window.dispatchEvent(new CustomEvent('cycle-settings-saved'))
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
        <SkeletonForm fields={3} label="Loading cycle settings..." />
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

      {/* Nov 2026 redesign (Pau's request): each setting is its own tile with
          a clear On / Off tag, larger switch and roomier text, so a setting
          that is off isn't overlooked. Same settings and saving as before. */}
      <div className="cycle-settings">
        <CycleToggle
          title="Applications Open"
          on={!!draft.applications_open}
          onChange={(v) => setDraft((d) => ({ ...d, applications_open: v }))}
          description="When off, applicants can no longer submit new applications. When on, applicants can only submit between the acceptance dates below, and only until the applicant slots are filled. Leave a field blank for no limit."
        >
          {draft.applications_open && (
            <div className="cycle-fields">
              <div className="cycle-field">
                <label htmlFor="cycle-slots">Total applicant slots (whole cycle)</label>
                <input
                  id="cycle-slots"
                  type="number"
                  min="0"
                  placeholder="Blank = no limit (e.g. 3000)"
                  value={draft.applicant_slots ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, applicant_slots: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                />
                {/* Nov 2026 (panel revisions S8): the panel read the demo's "100"
                    as a yearly cap. 100 is the size of one exam batch (Exam
                    Schedules); this field is the whole cycle's total. */}
                <span className="cycle-hint">
                  CCC receives about 1,500&ndash;3,000 applicants a year, so leave this blank or set the cycle&apos;s total.
                  This is not the exam batch size: each exam batch holds up to 100 applicants and is set up in Exam Schedules.
                </span>
              </div>
              <div className="cycle-field">
                <label htmlFor="cycle-start">Acceptance start date</label>
                <input
                  id="cycle-start"
                  type="date"
                  value={draft.acceptance_start_date || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, acceptance_start_date: e.target.value || null }))}
                />
              </div>
              <div className="cycle-field">
                <label htmlFor="cycle-end">Acceptance end date</label>
                <input
                  id="cycle-end"
                  type="date"
                  value={draft.acceptance_end_date || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, acceptance_end_date: e.target.value || null }))}
                />
              </div>
            </div>
          )}
        </CycleToggle>

        <CycleToggle
          title="Document Uploads Enabled"
          on={!!draft.document_uploads_enabled}
          onChange={(v) => setDraft((d) => ({ ...d, document_uploads_enabled: v }))}
          description="When off, applicants cannot upload or re-upload documents."
        />

        <CycleToggle
          title="Exam Results Visible to Applicants"
          on={!!draft.exam_results_visible}
          onChange={(v) => setDraft((d) => ({ ...d, exam_results_visible: v }))}
          description="When on, an applicant sees their result on their dashboard and in Messages once an admin has sent it to them from Applicant Results. When off, all results are hidden from applicants and results cannot be sent."
        />
      </div>

      {dirty && <div className="cycle-unsaved">You have unsaved changes. Click Save Changes to apply them.</div>}

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

// Nov 2026: one setting tile for Application Cycle Settings.
function CycleToggle({ title, description, on, onChange, children }) {
  const id = `cycle-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <div className={`cycle-tile${on ? ' is-on' : ''}`}>
      <div className="cycle-tile-head">
        <div className="cycle-tile-info">
          <div className="cycle-tile-title">
            <h4 id={`${id}-label`}>{title}</h4>
            <span className={`cycle-state ${on ? 'on' : 'off'}`}>{on ? 'On' : 'Off'}</span>
          </div>
          <p>{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          className={`cycle-switch${on ? ' on' : ''}`}
          onClick={() => onChange(!on)}
        >
          <span className="cycle-switch-knob" />
        </button>
      </div>
      {children}
    </div>
  )
}

// Nov 2026 (panel revisions S8): what each status means, under the tabs.
function StatusLegend() {
  return (
    <details className="status-legend">
      <summary>What do these statuses mean?</summary>
      <dl>
        {STATUS_DEFINITIONS.map((d) => (
          <div key={d.label} className="status-legend-row">
            <dt>{d.label}</dt>
            <dd>{d.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
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
  const [entries, setEntries] = useState(() => peek('audit:all') ?? [])
  const [loading, setLoading] = useState(() => peek('audit:all') === undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [, setTick] = useState(0)
  const filterRef = useRef(categoryFilter)
  filterRef.current = categoryFilter

  const load = async ({ quiet = false } = {}) => {
    const want = filterRef.current
    if (quiet) setRefreshing(true)
    else if (peek(`audit:${want}`) === undefined) setLoading(true)
    else setEntries(peek(`audit:${want}`))
    try {
      const params = new URLSearchParams()
      if (want !== 'all') params.set('category', want)
      const qs = params.toString()
      const res = await fetch(`/api/audit-log${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      if (want !== filterRef.current) return // the filter changed meanwhile
      if (data.success) {
        setEntries(keep(`audit:${want}`, data.entries))
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
        <SkeletonRows rows={6} avatar={false} label="Loading activity..." />
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

// ---------- End of cycle: archive applicants (Oct 5 2026) ----------
// Progress Table row 74 (archive part). Ivy's cell comment: a Super Admin
// option to archive all applicants once admissions work is done, shown only
// when Applications Open is off. Pau's conditions: archive, never delete;
// only after this cycle's CHED Form 3 was released to the LGU; typed
// confirmation plus the Super Admin's password. Oct 15 2026: "released to
// the LGU" is now "CHED Form 3 exported" (the LGU login was removed). The server checks all of it
// again (app/api/archive-cycle/route.js).
function ArchiveCycleCard() {
  const [data, setData] = useState(() => peek('archive') ?? null)
  const [loading, setLoading] = useState(() => peek('archive') === undefined)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewCycle, setViewCycle] = useState(null)
  const [viewList, setViewList] = useState(null)
  // Nov 2026 (panel revisions S4): remove non-accepted applicants' data.
  const [purge, setPurge] = useState(null)
  const [purgeText, setPurgeText] = useState('')
  const [purgePassword, setPurgePassword] = useState('')
  const [purgeError, setPurgeError] = useState('')
  const [purgeBusy, setPurgeBusy] = useState(false)

  const submitPurge = async (e) => {
    e.preventDefault()
    if (!purgePassword) return setPurgeError('Please enter your password.')
    setPurgeBusy(true)
    setPurgeError('')
    try {
      const res = await fetch('/api/archive-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-non-accepted', cycle: purge.cycle, confirmText: purgeText, confirmPassword: purgePassword }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setPurgeError(result.error || 'Could not remove the data.')
        return
      }
      setPurge(null)
      showAdminNotice(
        `The data of ${result.removed} non-accepted applicant${result.removed === 1 ? ' was' : 's were'} removed from cycle ${result.cycle}. Accepted applicants were kept.`
      )
    } catch (err) {
      setPurgeError(err.message)
    } finally {
      setPurgeBusy(false)
    }
  }

  const load = async () => {
    if (peek('archive') === undefined) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/archive-cycle')
      const result = await res.json()
      if (result.success) setData(keep('archive', result))
      else setError(result.error || 'Could not load the archive status.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // Re-check when Cycle Settings are saved (the Applications Open switch)
    // and after any admin action.
    const onChange = () => load()
    window.addEventListener('admin-notice', onChange)
    window.addEventListener('cycle-settings-saved', onChange)
    return () => {
      window.removeEventListener('admin-notice', onChange)
      window.removeEventListener('cycle-settings-saved', onChange)
    }
  }, [])

  const ready = !!data && !data.applicationsOpen && !!data.exported && data.toArchive > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!confirmPassword) return setConfirmError('Please enter your password.')
    setBusy(true)
    setConfirmError('')
    try {
      const res = await fetch('/api/archive-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText, confirmPassword }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setConfirmError(result.error || 'Could not archive the applicants.')
        return
      }
      setConfirmOpen(false)
      setConfirmText('')
      setConfirmPassword('')
      showAdminNotice(
        `${result.count} applicant${result.count === 1 ? ' was' : 's were'} archived as cycle ${result.cycle}. They no longer appear in the admin lists, and they can still view their application, read-only.`
      )
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const openList = async (cycle) => {
    setViewCycle(cycle)
    setViewList(null)
    try {
      const res = await fetch(`/api/archive-cycle?cycle=${encodeURIComponent(cycle)}`)
      const result = await res.json()
      setViewList(result.success ? result.applicants : [])
    } catch {
      setViewList([])
    }
  }

  const checks = data
    ? [
        {
          ok: !data.applicationsOpen,
          title: data.applicationsOpen ? 'Applications Open is still on' : 'Applications Open is turned off',
          note: data.applicationsOpen ? 'Turn it off in Cycle Settings above first.' : 'Turned off in Cycle Settings.',
        },
        {
          ok: !!data.exported,
          title: data.exported ? 'CHED Form 3 exported' : 'CHED Form 3 not exported yet',
          note: data.exported
            ? `Downloaded by ${data.exported.by}, ${new Date(data.exported.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
            : 'Download it from Dashboard, Export CHED Form 3.',
        },
      ]
    : []

  return (
    <section className="cm-card ac-card">
      <div className="cm-head">
        <h2 className="cm-title">End of cycle: archive applicants</h2>
      </div>
      {loading && !data ? (
        <SkeletonText lines={4} label="Loading archive status..." />
      ) : error && !data ? (
        <p className="text-sm text-ccc-red text-center py-8">{error}</p>
      ) : (
        <div className="ac-body">
          <div className="ac-text">
            <p>
              When admissions work for this cycle is done, archive every applicant so the next cycle starts clean.{' '}
              <b>Nothing is deleted.</b> Archived applicants, their documents and their history are kept and can still be
              opened from Archived cycles below, read-only.
            </p>
            <p>
              After archiving, they no longer appear in the Dashboard, Applicant Results, Statistics, Exam Schedules, Appeals
              &amp; Reschedules or the Registrar&apos;s scholar list. Applicants can still sign in and see their application,
              read-only.
            </p>
            <p>
              Applicant data is temporary. Once a cycle is archived, you can remove the data of applicants who were{' '}
              <b>not accepted</b> from Archived cycles below. Accepted applicants (Passer, Qualified Probationary) stay as a
              permanent record.
            </p>
          </div>
          <div className="ac-checks">
            <span className="cm-label">Before you can archive</span>
            {checks.map((c) => (
              <div className="ac-check" key={c.title}>
                <span className={`ac-dot ${c.ok ? 'ok' : 'no'}`} aria-hidden="true">
                  {c.ok ? '✓' : '✕'}
                </span>
                <span className="ac-check-text">
                  <span className="ac-check-title">{c.title}</span>
                  <span className="ac-check-note">{c.note}</span>
                </span>
              </div>
            ))}
            <div className="ac-go">
              <span>
                <b>{data?.toArchive ?? 0}</b> applicant{data?.toArchive === 1 ? '' : 's'} will be archived.
              </span>
              <button
                type="button"
                className="cm-btn cm-btn-danger"
                disabled={!ready}
                onClick={() => {
                  setConfirmText('')
                  setConfirmPassword('')
                  setConfirmError('')
                  setConfirmOpen(true)
                }}
              >
                Archive all applicants
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ac-archived">
        <span className="cm-label">Archived cycles</span>
        {!data?.archived?.length ? (
          <p className="ac-none">No cycle has been archived yet.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table ac-table">
              <thead>
                <tr>
                  <th>Cycle</th><th>Applicants</th><th>Accepted (kept)</th><th>Archived by</th><th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.archived.map((c) => (
                  <tr key={c.cycle}>
                    <td className="cf-strong">Applications {c.cycle}</td>
                    <td>{c.count}</td>
                    <td>{c.kept}</td>
                    <td>
                      {c.archivedBy || 'Unknown'}, {new Date(c.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="r">
                      <button type="button" className="aa-act" onClick={() => openList(c.cycle)}>View list</button>
                      {c.removable > 0 ? (
                        <button
                          type="button"
                          className="aa-act ac-remove"
                          onClick={() => {
                            setPurge(c)
                            setPurgeText('')
                            setPurgePassword('')
                            setPurgeError('')
                          }}
                        >
                          Remove non-accepted data ({c.removable})
                        </button>
                      ) : (
                        <span className="ac-cleaned">Only accepted kept</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmOpen && data && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !busy && setConfirmOpen(false)}>
          <form className="aa-confirm" role="dialog" aria-modal="true" aria-label="Archive all applicants" onSubmit={submit}>
            <div className="aa-confirm-body">
              <h3 className="aa-confirm-title">Archive all {data.toArchive} applicants?</h3>
              <p className="aa-confirm-desc">
                They leave every list and count in the admin console and move to Archived cycles. Nothing is deleted. This
                can&apos;t be undone from the console.
              </p>
              <label className="cm-label" htmlFor="acType">Type {data.confirmPhrase} to confirm</label>
              <input id="acType" className="cm-input" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                placeholder={data.confirmPhrase} autoComplete="off" autoFocus />
              <label className="cm-label" htmlFor="acPw">Your password</label>
              <input id="acPw" className="cm-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Your password" autoComplete="current-password" />
              {confirmError && <p className="aa-confirm-error">{confirmError}</p>}
            </div>
            <div className="aa-confirm-foot">
              <button type="button" className="cm-btn cm-btn-secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                type="submit"
                className="cm-btn cm-btn-danger"
                disabled={busy || confirmText.trim().toUpperCase() !== data.confirmPhrase.toUpperCase()}
              >
                {busy ? 'Archiving...' : 'Archive applicants'}
              </button>
            </div>
          </form>
        </div>
      )}

      {purge && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !purgeBusy && setPurge(null)}>
          <form className="aa-confirm" role="dialog" aria-modal="true" aria-label="Remove non-accepted applicants' data" onSubmit={submitPurge}>
            <div className="aa-confirm-body">
              <h3 className="aa-confirm-title">Remove the data of {purge.removable} non-accepted applicant{purge.removable === 1 ? '' : 's'}?</h3>
              <p className="aa-confirm-desc">
                From cycle {purge.cycle}, this permanently deletes the applications, uploaded documents, requests, private messages
                and sign-in accounts of applicants who were not accepted (Waitlisted, Not Qualified, Disqualified, Forfeited, or
                never finished). The {purge.kept} accepted applicant{purge.kept === 1 ? '' : 's'} (Passer, Qualified Probationary)
                stay. <b>This can&apos;t be undone.</b> CHED Form 3 was already exported before this cycle was archived.
              </p>
              <label className="cm-label" htmlFor="rmType">Type REMOVE {purge.cycle} to confirm</label>
              <input id="rmType" className="cm-input" type="text" value={purgeText} onChange={(e) => setPurgeText(e.target.value)}
                placeholder={`REMOVE ${purge.cycle}`} autoComplete="off" autoFocus />
              <label className="cm-label" htmlFor="rmPw">Your password</label>
              <input id="rmPw" className="cm-input" type="password" value={purgePassword} onChange={(e) => setPurgePassword(e.target.value)}
                placeholder="Your password" autoComplete="current-password" />
              {purgeError && <p className="aa-confirm-error">{purgeError}</p>}
            </div>
            <div className="aa-confirm-foot">
              <button type="button" className="cm-btn cm-btn-secondary" disabled={purgeBusy} onClick={() => setPurge(null)}>Cancel</button>
              <button
                type="submit"
                className="cm-btn cm-btn-danger"
                disabled={purgeBusy || purgeText.trim().toUpperCase() !== `REMOVE ${purge.cycle}`.toUpperCase()}
              >
                {purgeBusy ? 'Removing...' : 'Remove data'}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewCycle && (
        <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && setViewCycle(null)}>
          <div className="cf-dialog ac-list" role="dialog" aria-modal="true" aria-label={`Archived applicants, ${viewCycle}`}>
            <div className="cf-head">
              <h2 className="cf-title">Archived applicants: Applications {viewCycle}</h2>
              <p className="cf-sub">Read-only. These applications can no longer be changed.</p>
            </div>
            <div className="cf-released">
              {viewList === null ? (
                <SkeletonRows rows={4} label="Loading archived applicants..." />
              ) : viewList.length === 0 ? (
                <p className="text-sm text-ccc-muted text-center py-8">No applicants found.</p>
              ) : (
                <div className="st-scroll">
                  <table className="st-table">
                    <thead>
                      <tr><th>Applicant</th><th>Application no.</th><th>Program</th><th>Scholar status</th></tr>
                    </thead>
                    <tbody>
                      {viewList.map((a) => (
                        <tr key={a.id}>
                          <td className="cf-strong">{a.applicant_name || 'Unnamed applicant'}</td>
                          <td>{a.application_number || ''}</td>
                          <td>{a.program_choice_1 || ''}</td>
                          <td>{SCHOLAR_STATUS_META[a.scholar_status]?.label || 'Eligible for Exam'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="cf-foot cf-foot-end">
              <button type="button" className="cm-btn cm-btn-secondary" onClick={() => setViewCycle(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Nov 2026 (panel revisions S8): the old "System & Activity" panel is split
// by function. The Guidance Head owns the admission cycle; the System Admin
// keeps the Activity Log (and Admin Accounts).
function AdmissionCyclePanel() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Admission Cycle
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          Guidance Head only. Open or close applications, set the slots and acceptance dates, release exam results to
          applicants, and archive the cycle when admissions are done. Guidance Staff decisions reach applicants only
          when these switches allow it.
        </p>
      </div>

      <CycleSettingsCard />
      <ArchiveCycleCard />
    </div>
  )
}

function ActivityLogPanel() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Activity Log
        </h1>
        <p className="text-xs text-ccc-muted mt-0.5">
          System Admin only. An automatic, read-only record of what happens in the system: sign-ins, account changes,
          document uploads and overrides, cycle changes and announcements. Entries cannot be edited or deleted.
        </p>
      </div>

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
  const [data, setData] = useState(() => peek('exams') ?? null)
  const [loading, setLoading] = useState(() => peek('exams') === undefined)
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
      setData(keep('exams', json))
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

      {!data && loading && <SkeletonStatGrid cards={4} label="" />}
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
            <SkeletonList items={3} label="Loading exam batches..." />
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
  const [requests, setRequests] = useState(() => peek('requests') ?? [])
  const [loading, setLoading] = useState(() => peek('requests') === undefined)
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
        if (data.success) setRequests(keep('requests', data.requests))
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
              {loading ? (
                <Skeleton width={16} height={14} radius={10} style={{ display: 'inline-block' }} />
              ) : (
                <span className="apl-tab-count">
                  {key === 'all' ? requests.length : requests.filter((r) => r.status === key).length}
                </span>
              )}
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
          <SkeletonList items={4} label="Loading requests..." />
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

const VALID_PANELS = ['dashboard', 'communications', 'reschedule', 'cycle']

// ---------- Office of the Registrar console (Oct 5 2026) ----------
// Progress Table row 78, Allowance Distribution Monitoring. Behavior from
// Ivy's admin.html Registrar view (Dashboard counts view-only, an Allowance
// Distribution page in place of Announcements), rebuilt on real data with
// Pau's changes: pick the scholar from a list, a Remove button on posts, and
// a portal message (plus an email if opted in) to the scholar on each post.
// Design: canvas page "Registrar, LGU and archive (Oct 5)".

const REGISTRAR_STAT_CARDS = DASHBOARD_STAT_CARDS

function RegistrarDashboardPanel({ data, loading, error, onGoAllowance, who = 'The Registrar' }) {
  return (
    <div>
      <div className="portal-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            A summary of where applicants are this cycle. {who} can view these counts only. Applicant details stay
            with the Guidance Office.
          </p>
        </div>
      </div>
      {loading ? (
        <SkeletonStatGrid cards={4} label="Loading the summary..." />
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
          {onGoAllowance && <div className="cm-card ra-info">
            <IconAlert className="w-4 h-4 shrink-0" />
            <span>
              To post an allowance, open{' '}
              <button type="button" className="ra-link" onClick={onGoAllowance}>
                Allowance Distribution
              </button>
              . Students Qualified as a Student (regular or Probationary) are listed there.
            </span>
          </div>}
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
      const what = type === 'Other' ? `An allowance (${description.trim()})` : 'A Wi-Fi allowance'
      const told = result.emailSent
        ? 'They were sent a portal message and an email.'
        : result.emailOptIn
          ? 'They were sent a portal message. The email could not be sent.'
          : 'They were sent a portal message. They did not opt in to email updates.'
      showAdminNotice(
        `${what} dated ${formatYmd(date)} was posted to ${picked.name}${
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
            Post allowance distributions for scholars. Only students Qualified as a Student (regular or Probationary) whose
            result was already sent to them are listed. Each post appears right away on the scholar&apos;s Allowance page.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <SkeletonRows rows={5} label="Loading scholars..." />
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
                              No scholars yet. Scholars appear here once their result (Qualified as a Student, regular or Probationary)
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
                The {removeTarget.allowance_type === 'Other' ? `allowance (${removeTarget.description})` : 'Wi-Fi allowance'} dated{' '}
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
// layout).
// Oct 15 2026 (client, interview of Oct 15): "Release to LGU", the
// "Released to LGU" tab and the LGU (view only) login are removed. CCC
// downloads the PDF and sends the file to the LGU itself. Each download is
// recorded in the Activity Log, which the end-of-cycle archive checks.
function ChedForm3Dialog({ onClose }) {
  const [data, setData] = useState(() => peek('form3') ?? null)
  const [loading, setLoading] = useState(() => peek('form3') === undefined)
  const [error, setError] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [formDate, setFormDate] = useState(() => manilaTodayYmd())
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const load = async () => {
    if (peek('form3') === undefined) setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ched-form3')
      const result = await res.json()
      if (result.success) setData(keep('form3', result))
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

  return (
    <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cf-dialog" role="dialog" aria-modal="true" aria-label="Export CHED Form 3">
        <div className="cf-head">
          <h2 className="cf-title">Export CHED Form 3</h2>
          <p className="cf-sub">Free Higher Education Billing Details, admission fees (Section 7, Rule II of the IRR of RA 10931).</p>
        </div>

        {loading && !data ? (
          <SkeletonRows rows={5} avatar={false} label="Loading the report..." />
        ) : error && !data ? (
          <p className="text-sm text-ccc-red text-center py-10">{error}</p>
        ) : (
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
                    Everyone with a recorded pass or fail exam result, plus applicants Qualified as a Student (Probationary).
                    {data?.leftOut ? ` ${data.leftOut} applicant${data.leftOut === 1 ? '' : 's'} marked Absent or with no exam result yet ${data.leftOut === 1 ? 'is' : 'are'} left out.` : ''}
                  </span>
                </div>
              </div>
              <div className="cf-preview">
                <span className="cm-label">
                  Preview {rows.length > 0 ? `(first ${Math.min(rows.length, 8)} of ${rows.length} rows, in application number order)` : ''}
                </span>
                {rows.length === 0 ? (
                  <p className="text-sm text-ccc-muted py-6">No rows yet. Rows appear once exam results are recorded in Applicant Results.</p>
                ) : (
                  <div className="st-scroll cf-table-wrap">
                    <table className="st-table cf-table">
                      <thead>
                        <tr>
                          <th>No.</th><th>Last name</th><th>Given name</th><th>Middle name</th><th>Sex at birth</th><th>Birthdate</th>
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
                  Students Qualified as a Student (regular or Probationary) show as <b>passed</b>: <b>passed-enrolled</b> once Distribution
                  Status reached Enrollment complete, otherwise <b>passed-did not enrol</b>. The PDF is landscape A4 with the
                  Form 3 header and no signatures or seals. Sign the printed copy.
                </span>
              </div>
            </div>
            <div className="cf-foot">
              <span className="cf-foot-note">
                Download saves the PDF for you. Send that file to the LGU directly (for example by email). Downloading it also
                completes the &ldquo;CHED Form 3 exported&rdquo; step for the end-of-cycle archive.
              </span>
              <span className="cf-foot-actions">
                <button type="button" className="cm-btn cm-btn-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="cm-btn cm-btn-primary" onClick={download} disabled={downloading}>
                  {downloading ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- Limited consoles: shell (Oct 5 2026) ----------
// Office of the Registrar accounts see this instead of the full console.
// (Oct 15 2026: the LGU view-only console was removed.) Same header, sidebar look and log-out confirm.
// Nov 2026 (panel revisions S8): the System Admin uses this shell too. It
// runs the system (Admin Accounts, Activity Log) and sees Dashboard counts
// only, never applicant details.
function LimitedConsole({ session }) {
  const role = session.role
  const isSystemAdmin = role === 'super_admin'
  const [activePanel, setActivePanel] = useState(isSystemAdmin ? 'dashboard' : 'allowance')
  const [sysData, setSysData] = useState(null)
  const [sysError, setSysError] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [regData, setRegData] = useState(null)
  const [regLoading, setRegLoading] = useState(role === 'registrar')
  const [regError, setRegError] = useState('')

  const handleLogout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    forgetAll()
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
    if (role === 'super_admin') {
      fetch('/api/console-summary')
        .then(async (res) => {
          if (res.status === 401) {
            window.location.href = '/admin/login'
            return
          }
          const data = await res.json()
          if (data.success) setSysData(data)
          else setSysError(data.error || 'Could not load the summary.')
        })
        .catch((err) => setSysError(err.message))
    }
  }, [role])

  const sessionLabel = isSystemAdmin ? 'System Admin Session' : 'Registrar Session'

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
          {isSystemAdmin && activePanel === 'dashboard' && (
            <RegistrarDashboardPanel data={sysData} loading={!sysData && !sysError} error={sysError} who="The System Admin" />
          )}
          {isSystemAdmin && activePanel === 'admins' && <AdminAccountsPanel />}
          {isSystemAdmin && activePanel === 'system' && <ActivityLogPanel />}
          {role === 'registrar' && activePanel === 'dashboard' && (
            <RegistrarDashboardPanel data={regData} loading={regLoading && !regData} error={regError} onGoAllowance={() => setActivePanel('allowance')} />
          )}
          {role === 'registrar' && activePanel === 'allowance' && (
            <RegistrarAllowancePanel data={regData} loading={regLoading} error={regError} onReload={loadRegistrar} />
          )}
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

  // Oct 5 2026: the branded loading screen while the session check runs
  // (it used to be a blank page for that moment).
  if (session === undefined) return <LoadingScreen />
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
                forgetAll()
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
  if (session.loggedIn && (session.role === 'registrar' || session.role === 'super_admin')) {
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
  // Oct 5 2026: false until the first eligibility load finishes, so the
  // Dashboard shows skeletons instead of counts of 0 in the meantime.
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false)
  const [eligibilityOverriding, setEligibilityOverriding] = useState(null)
  const [eligibilityError, setEligibilityError] = useState('')
  const [recomputing, setRecomputing] = useState(false)
  const [adminName, setAdminName] = useState('')
  // Nov 2026 (panel revisions S8): 'guidance_head' or 'admin' (Guidance Staff).
  const [role, setRole] = useState('')
  const isGuidanceHead = role === 'guidance_head'
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
          setRole(data.role || 'admin')
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
    } finally {
      setEligibilityLoaded(true)
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
    if (role && !isGuidanceHead && activePanel === 'cycle') {
      setActivePanel('dashboard')
    }
  }, [role, isGuidanceHead, activePanel])

  const handleLogout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    forgetAll()
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
            {isGuidanceHead ? 'Guidance Head Session' : 'Guidance Staff Session'}
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
          isSuperAdmin={false}
          role={role || 'admin'}
          flaggedCount={totalFlagged}
          onLogout={() => setConfirmLogout(true)}
          portalLink
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
              eligibilityLoading={!eligibilityLoaded}
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
          {activePanel === 'cycle' && isGuidanceHead && <AdmissionCyclePanel />}
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