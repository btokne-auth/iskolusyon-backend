'use client'
import { useEffect, useState } from 'react'
import SiteHeader from '../../components/SiteHeader'

// ---------- Global Audit Logs (admin-facing) ----------
// Matches the "Recent Activity Log" timeline from the approved admin
// mockup (admin (6).html — addActivity()/renderActivity()), but backed
// by a real, persisted `audit_log` table instead of an in-memory array
// that resets on page reload.
//
// Entries are currently written by the upload route only (System actor —
// every upload becomes "auto-verified" or "flagged for review"). Real
// admin-triggered actions (add/remove admin, manual status overrides,
// etc.) can insert into the same table later using the same shape:
// { actor, action, kind: 'done' | 'warn' }.

function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

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

export default function AuditLogPage() {
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
    <main className="min-h-screen bg-ccc-off">
      <SiteHeader topbarLabel="Iskolusyon Admin Console" portalBadge="Global Audit Logs" />

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Global Audit Logs
          </h1>
          <p className="text-sm text-ccc-muted">
            A running, auto-recorded timeline of system activity — currently every document upload, verified or flagged.
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
    </main>
  )
}