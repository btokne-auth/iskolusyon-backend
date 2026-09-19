'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import { getDocTypeLabel } from '../lib/documentTypes'

// ---------- Application History & Activity Logs ----------
// A dedicated page version of what the History drawer already does on the
// applicant page, reusing the exact same GET /api/upload data — no new API
// route, no new DB columns.
//
// Re-gated Sept 19: this used to be a type-your-own-name page with no real
// access control — anyone could see anyone's documents by typing their
// name (it said so in its own header comment: "a temporary stand-in for
// real per-user history until Ivy's User Account Module exists"). That
// module exists now, so this checks a real applicant session instead of
// asking for a typed name, and no longer needs to filter client-side —
// GET /api/upload already scopes to the logged-in applicant server-side
// (see the Sept 19 re-key in app/api/upload/route.js), the same way the
// main portal's own history drawer does.
//
// This used to duplicate a label map that also lived in app/page.js and
// admin/page.js — moved to app/lib/documentTypes.js (Sept 16 Patch 2 port)
// so the fast-follow this comment used to point at is now done.

function getCleanFileName(path) {
  if (!path) return 'Unknown file'
  const parts = path.split('-')
  return parts.length > 1 ? parts.slice(1).join('-') : path
}

function formatWhen(doc) {
  // Supabase tables typically include created_at automatically; if this
  // table doesn't have it, fall back gracefully instead of crashing.
  if (!doc.created_at) return 'Date not recorded'
  try {
    return new Date(doc.created_at).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return 'Date not recorded'
  }
}

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

function StatusBadge({ needsReview }) {
  if (needsReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-ccc-orange/50 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-orange shrink-0">
        <IconAlertTriangle className="w-3 h-3" />
        Needs review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ccc-green/40 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ccc-green shrink-0">
      <IconCheck className="w-3 h-3" />
      Verified
    </span>
  )
}

export default function HistoryPage() {
  // undefined = still checking, null = logged out, object = logged in.
  // Same three-state pattern as app/page.js's own auth gate.
  const [accountSession, setAccountSession] = useState(undefined)
  const [docHistory, setDocHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/applicant-session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setAccountSession(data && data.loggedIn ? data : null)
      })
      .catch(() => {
        if (!cancelled) setAccountSession(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!accountSession) {
      setLoading(false)
      return
    }
    // No name filter needed anymore — the server already scopes this to
    // just the logged-in applicant's own documents.
    fetch('/api/upload')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDocHistory(data.documents)
      })
      .catch((err) => console.error('Failed to fetch history:', err))
      .finally(() => setLoading(false))
  }, [accountSession])

  // Server already returns newest-first; keep a client-side sort too as a
  // harmless safety net in case that ever changes.
  const myActivity = [...docHistory].sort((a, b) => {
    if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at)
    return 0
  })

  if (accountSession === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ccc-off text-ccc-muted text-sm">
        Loading…
      </div>
    )
  }

  if (accountSession === null) {
    return (
      <main className="min-h-screen bg-ccc-off">
        <SiteHeader topbarLabel="Iskolusyon Applicant Portal" portalBadge="Application History" />
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <IconFile className="w-12 h-12 text-ccc-muted mx-auto mb-4" />
          <h1 className="text-lg font-extrabold text-ccc-navy mb-2" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Log in to view your history
          </h1>
          <p className="text-sm text-ccc-muted mb-5">
            Your application history is tied to your account now — log in to see it.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8]"
          >
            Go to Log In
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-ccc-off">
      <SiteHeader topbarLabel="Iskolusyon Applicant Portal" portalBadge="Application History" />

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Application History & Activity Log
          </h1>
          <p className="text-sm text-ccc-muted">
            A running log of every document you've submitted and its current status.
          </p>
        </div>

        {/* Activity list */}
        {loading ? (
          <p className="text-sm text-ccc-muted text-center py-10">Loading...</p>
        ) : myActivity.length === 0 ? (
          <div className="text-center opacity-60 py-16">
            <IconFile className="w-12 h-12 text-ccc-muted mx-auto mb-4" />
            <p className="text-sm text-ccc-muted">No activity found for your account yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myActivity.map((doc, index) => (
              <div
                key={index}
                className={`bg-white p-4 border rounded-xl flex items-start justify-between gap-3 ${
                  doc.needs_review ? 'border-l-4 border-l-ccc-orange border-y-ccc-border border-r-ccc-border' : 'border-ccc-border'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-ccc-off border border-ccc-border flex items-center justify-center shrink-0 mt-0.5">
                    <IconFile className="w-4.5 h-4.5 text-ccc-muted" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-ccc-text font-medium truncate">
                      {getCleanFileName(doc.file_path)}
                    </p>
                    <p className="text-[11px] text-ccc-muted mt-0.5">
                      {getDocTypeLabel(doc.document_type)} &middot; Uploaded {formatWhen(doc)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge needsReview={doc.needs_review} />
                  {doc.publicUrl && (
                    <a
                      href={doc.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-blue-50 text-ccc-blue rounded-lg hover:bg-blue-100 hover:text-ccc-navy transition-colors"
                      title="View document"
                      aria-label="View document"
                    >
                      <IconExternal className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}