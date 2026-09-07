'use client'
import { useState, useEffect, useRef } from 'react'
import SiteHeader from './components/SiteHeader'
import DocumentStatusTable from './components/DocumentStatusTable'

// ---------- Small building blocks ----------

function IconUpload(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}
function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}
function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEyeOff(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.11A10.6 10.6 0 0112 5c6 0 9.5 7 9.5 7a13.6 13.6 0 01-3.13 3.94M6.6 6.6C4.16 8.2 2.5 10.5 2.5 12c0 0 3.5 7 9.5 7 1.13 0 2.19-.19 3.17-.53" />
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

// Shows the OCR/text-detection result in a scrollable box, with a copy button.
function ExtractedTextField({ text, method }) {
  const [copied, setCopied] = useState(false)

  const methodLabel = {
    'pdf-embedded-text': 'Read from PDF text layer',
    'ocr-scanned-pdf': 'Detected via OCR (scanned PDF)',
    'ocr-image': 'Detected via OCR (image)',
  }[method] || null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      // clipboard unavailable — silently ignore
    }
  }

  if (!text) {
    return (
      <div className="rounded-lg border border-ccc-border bg-ccc-off px-3 py-3 text-xs text-ccc-muted italic">
        No text detected in this document.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {methodLabel && <span className="text-[10px] text-ccc-muted">{methodLabel}</span>}
        <button
          type="button"
          onClick={copy}
          className="ml-auto flex items-center gap-1 text-[10px] text-ccc-muted hover:text-ccc-navy transition-colors"
        >
          {copied ? <IconCheck className="w-3 h-3 text-ccc-green" /> : <IconCopy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-ccc-border bg-ccc-off p-3 text-xs text-ccc-text whitespace-pre-wrap leading-relaxed">
        {text}
      </div>
    </div>
  )
}

// Password-style hash field: masked by default, toggle to reveal, click to copy.
function HashField({ hash, dim = false }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const masked = '•'.repeat(28)

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
    <div className={`flex items-center gap-1.5 rounded-lg border ${dim ? 'border-ccc-border bg-ccc-off' : 'border-ccc-border bg-white'} pl-3 pr-1.5 py-1.5`}>
      <span className={`flex-1 min-w-0 font-mono text-[11px] tracking-tight ${dim ? 'text-ccc-muted' : 'text-ccc-blue'} ${revealed ? 'truncate' : ''}`}>
        {revealed ? hash : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="shrink-0 p-1.5 rounded-md text-ccc-muted hover:text-ccc-navy hover:bg-ccc-off transition-colors"
        aria-label={revealed ? 'Hide hash' : 'Reveal hash'}
        title={revealed ? 'Hide hash' : 'Reveal hash'}
      >
        {revealed ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 p-1.5 rounded-md text-ccc-muted hover:text-ccc-navy hover:bg-ccc-off transition-colors"
        aria-label="Copy hash"
        title="Copy hash"
      >
        {copied ? <IconCheck className="w-3.5 h-3.5 text-ccc-green" /> : <IconCopy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// Small status pill used on the current result panel and in the history list —
// the visible surface of the Deficiency Alert flow. A document is either
// confidently verified, or flagged so a human (applicant re-upload / admin
// review) makes the call instead of the system silently trusting garbled OCR.
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

// The Deficiency Alert itself: shown in place of the plain success banner
// when the uploaded document's OCR confidence came back too low to trust.
// Gives the applicant a concrete next step (re-upload) instead of leaving
// a silently-degraded document in the system.
function DeficiencyAlert({ confidence, onReupload }) {
  return (
    <div className="p-4 rounded-xl border border-ccc-orange/50 bg-orange-50 space-y-3">
      <div className="flex items-start gap-3">
        <IconAlertTriangle className="w-5 h-5 text-ccc-orange shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-ccc-orange">Document flagged for review</p>
          <p className="text-xs text-ccc-text/80 leading-relaxed">
            The document uploaded successfully, but text detection confidence was low
            {typeof confidence === 'number' ? ` (${Math.round(confidence)}%)` : ''} — the
            detected text above may be incomplete or inaccurate. This usually happens with
            blurry photos, glare, or an angled shot. It's been marked <strong>needs review</strong> so
            an admin can check it before it's used for verification. You can continue, or
            re-upload a clearer copy now to avoid delays.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReupload}
        className="text-xs font-semibold text-ccc-orange hover:text-ccc-navy underline underline-offset-2"
      >
        Re-upload a clearer copy
      </button>
    </div>
  )
}

// Shown when the image-quality precheck rejects a file outright, before OCR
// or storage ever ran. Deliberately distinct from DeficiencyAlert: that one
// means "we read it but aren't confident" (document is stored, flagged,
// admin can still review it); this one means "we couldn't even attempt to
// read it" (nothing was stored — there is no record to review, just a photo
// to retake).
function QualityRejectionAlert({ message }) {
  return (
    <div className="p-4 rounded-xl border border-ccc-red/40 bg-red-50 space-y-1">
      <div className="flex items-start gap-3">
        <IconAlertTriangle className="w-5 h-5 text-ccc-red shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-ccc-red">Photo couldn't be processed</p>
          <p className="text-xs text-ccc-text/80 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  )
}

const getCleanFileName = (path) => {
  if (!path) return 'Unknown File'
  const parts = path.split('-')
  return parts.length > 1 ? parts.slice(1).join('-') : path
}

// Matches the admin mockup's CATEGORY_DEFS keys (admin (6).html) exactly —
// same 10 required-document types, same order, grouped the same way.
const DOCUMENT_TYPE_OPTIONS = [
  { group: 'Personal Information', options: [
    { value: 'birthcert', label: 'Birth Certificate / PSA' },
    { value: 'voterid', label: "Voter's ID" },
  ]},
  { group: 'Academic Profile', options: [
    { value: 'form138', label: 'Grades (Form 138 / Report Card)' },
    { value: 'enrollmentcert', label: 'Certificate of Enrollment' },
    { value: 'goodmoral', label: 'Good Moral Character' },
    { value: 'currentscholarship', label: 'Proof of Current Availed Scholarship/s' },
  ]},
  { group: 'Financial & Employment', options: [
    { value: 'indigency', label: 'Proof of Income (Family / Guardian)' },
    { value: 'employmentcert', label: 'Certificate of Employment' },
  ]},
  { group: 'Special Demographics & Legal', options: [
    { value: 'supportdoc', label: 'Supporting Document (per classification)' },
  ]},
  { group: 'Health & Wellness', options: [
    { value: 'medcert', label: 'Current Medical Status' },
  ]},
]

const DOC_TYPE_LABEL_MAP = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.flatMap((g) => g.options).map((o) => [o.value, o.label])
)
function getDocTypeLabel(value) {
  return DOC_TYPE_LABEL_MAP[value] || value
}

// ---------- Page ----------

export default function Home() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState(null)
  const [qualityRejection, setQualityRejection] = useState(null)
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [docHistory, setDocHistory] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [statusRequested, setStatusRequested] = useState(false)
  const panelRef = useRef(null)
  const formCardRef = useRef(null)

  // Documents already uploaded under the name currently typed in the form —
  // drives the "Documents & Status" checklist below. Purely a client-side
  // filter over docHistory (already fetched from GET /api/upload); no new
  // request, no new columns.
  const myDocs = docHistory.filter(
    (doc) =>
      doc.applicant_name &&
      applicantName.trim() &&
      doc.applicant_name.trim().toLowerCase() === applicantName.trim().toLowerCase()
  )

  // The History drawer reuses this same filtered list — it should only ever
  // show documents matching the name currently typed in, not every
  // applicant's uploads. Note: this is a UX/privacy-hygiene fix, not real
  // access control — anyone could type someone else's name. Real security
  // needs a login system (Ivy's User Account Module), which doesn't exist
  // yet. This just stops the careless "show everyone by default" behavior.
  const visibleHistory = myDocs
  const flaggedCount = visibleHistory.filter((doc) => doc.needs_review).length

  // Used by the status table's "Upload" / "Re-upload" buttons: pre-selects
  // that document type in the form below and scrolls it into view.
  const jumpToUploadFor = (typeValue) => {
    setDocumentType(typeValue)
    setFile(null)
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // If the name field gets cleared, hide the status table again — next time
  // requires a deliberate click, same as the first time.
  useEffect(() => {
    if (applicantName.trim().length === 0 && statusRequested) {
      setStatusRequested(false)
    }
  }, [applicantName, statusRequested])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/upload')
      const data = await res.json()
      if (data.success) {
        setDocHistory(data.documents)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Close the history drawer on outside click / Escape
  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e) => e.key === 'Escape' && setHistoryOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true)
    else if (e.type === 'dragleave') setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file || !documentType || !applicantName.trim()) return

    setLoading(true)
    setStatus('Scanning document, running OCR, and generating SHA-256 hash...')
    setQualityRejection(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('applicantName', applicantName.trim())
    formData.append('applicantEmail', applicantEmail.trim())
    formData.append('documentType', documentType)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setStatus(
          data.needsReview
            ? 'Document uploaded, but flagged for review.'
            : 'Document uploaded and verified successfully.'
        )
        setDetails(data)
        fetchHistory()
        setFile(null)
        setDocumentType('')
      } else if (data.rejected) {
        // Image-quality precheck rejection: nothing was stored, so there's
        // no `details` to show — just the reason, and the file stays
        // cleared so the applicant picks a fresh (better) photo.
        setStatus('')
        setDetails(null)
        setQualityRejection({ reason: data.reason, message: data.message })
        setFile(null)
      } else {
        setDetails(null)
        setStatus(`Error: ${data.error}`)
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader topbarLabel="Iskolusyon Applicant Portal" portalBadge="Applicant Portal" />

      {/* Top bar */}
      <div className="w-full max-w-xl mx-auto px-4 pt-8 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-extrabold tracking-tight text-ccc-navy"
            style={{ fontFamily: 'var(--font-montserrat)' }}
          >
            Iskolusyon
          </h1>
          <p className="text-xs text-ccc-muted mt-0.5">Secure scholarship document verification & storage</p>
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-ccc-border text-ccc-text hover:text-ccc-navy hover:border-ccc-blue/40 transition-colors text-xs font-semibold shadow-sm"
        >
          <IconClock className="w-4 h-4" />
          History
          {applicantName.trim() && visibleHistory.length > 0 && (
            <span className="ml-0.5 bg-ccc-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {visibleHistory.length}
            </span>
          )}
          {flaggedCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ccc-gold text-ccc-navy text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-ccc-off"
              title={`${flaggedCount} document${flaggedCount === 1 ? '' : 's'} need review`}
            >
              {flaggedCount}
            </span>
          )}
        </button>
      </div>

      {/* Documents & Status now renders inside the upload form, right below
          the "View my document status" button — see below. */}


      {/* Upload card */}
      <div ref={formCardRef} className="w-full max-w-xl mx-auto px-4 py-8">
        <div className="bg-white border border-ccc-border rounded-3xl shadow-md p-8 sm:p-10 space-y-7">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="applicantName" className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
                  Applicant name
                </label>
                <input
                  id="applicantName"
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="applicantEmail" className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
                  Applicant email <span className="normal-case font-normal text-ccc-muted">(optional)</span>
                </label>
                <input
                  id="applicantEmail"
                  type="email"
                  value={applicantEmail}
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  placeholder="juan.delacruz@example.com"
                  className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
                />
              </div>
            </div>

            {applicantName.trim().length > 1 && (
              <div className="-mt-3 space-y-4">
                {statusRequested ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatusRequested(false)}
                      className="text-xs font-semibold text-ccc-muted hover:text-ccc-navy underline underline-offset-2"
                    >
                      Hide document status
                    </button>
                    <DocumentStatusTable
                      groups={DOCUMENT_TYPE_OPTIONS}
                      docs={myDocs}
                      applicantName={applicantName}
                      onReupload={jumpToUploadFor}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatusRequested(true)}
                    className="text-xs font-semibold text-ccc-blue hover:text-ccc-navy underline underline-offset-2"
                  >
                    View my document status
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="documentType" className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
                Document type
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
              >
                <option value="" disabled>Select which document this is&hellip;</option>
                {DOCUMENT_TYPE_OPTIONS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4
                  ${isDragging ? 'border-ccc-blue bg-blue-50' : 'border-ccc-border bg-ccc-off hover:border-ccc-blue/50 hover:bg-blue-50/40'}`}
              >
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="w-16 h-16 rounded-full bg-white border border-ccc-border flex items-center justify-center text-ccc-navy shadow-sm mb-2">
                  <IconUpload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-semibold text-ccc-navy">Click to upload or drag and drop</p>
                  <p className="text-sm text-ccc-muted mt-1">Supports PDF, PNG, and JPG formats up to 10MB</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 bg-blue-50 border border-ccc-blue/30 rounded-2xl">
                <div className="flex items-center space-x-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-white border border-ccc-blue/30 flex items-center justify-center text-ccc-blue shrink-0">
                    <IconFile className="w-6 h-6" />
                  </div>
                  <div className="truncate pr-4">
                    <p className="text-sm font-semibold text-ccc-text truncate">{file.name}</p>
                    <p className="text-xs text-ccc-muted mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-2 rounded-lg hover:bg-white text-ccc-muted hover:text-ccc-navy transition-colors shrink-0"
                  aria-label="Remove file"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file || !documentType || !applicantName.trim()}
              className="w-full py-4 px-4 bg-ccc-blue hover:bg-ccc-navy disabled:bg-ccc-border disabled:text-ccc-muted text-white font-bold rounded-xl transition-all shadow-md text-sm flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Securing & uploading...</span>
                </>
              ) : (
                <span>Upload & verify document</span>
              )}
            </button>
          </form>

          {qualityRejection && (
            <QualityRejectionAlert message={qualityRejection.message} />
          )}

          {status && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-3 ${
              details
                ? (details.needsReview
                    ? 'bg-orange-50 border border-ccc-orange/40 text-ccc-orange'
                    : 'bg-green-50 border border-ccc-green/40 text-ccc-green')
                : 'bg-ccc-off border border-ccc-border text-ccc-text'
            }`}>
              {details && (details.needsReview
                ? <IconAlertTriangle className="w-5 h-5 text-ccc-orange shrink-0" />
                : <IconCheck className="w-5 h-5 text-ccc-green shrink-0" />)}
              <span>{status}</span>
            </div>
          )}

          {details && details.needsReview && (
            <DeficiencyAlert
              confidence={details.extractionConfidence}
              onReupload={() => { setDetails(null); setStatus(''); setFile(null) }}
            />
          )}

          {details && (
            <div className="bg-ccc-off border border-ccc-border rounded-2xl p-6 space-y-5">
              <div className="space-y-1.5">
                <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">Storage path</span>
                <span className="text-ccc-text font-mono text-xs bg-white p-3 rounded-lg block break-all border border-ccc-border">
                  {details.filePath}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">SHA-256 integrity hash</span>
                <HashField hash={details.sha256Hash} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">Detected text</span>
                  <ReviewStatusBadge needsReview={details.needsReview} />
                </div>
                <ExtractedTextField text={details.extractedText} method={details.extractionMethod} />
              </div>

              <a
                href={details.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-full py-3 bg-ccc-navy hover:bg-ccc-blue text-white font-semibold rounded-xl transition-colors space-x-2 text-sm"
              >
                <span>View uploaded document</span>
                <IconExternal className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* History drawer — tucked away, opened deliberately */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative w-full max-w-md h-full bg-white border-l border-ccc-border shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-ccc-border">
              <div>
                <h3 className="text-base font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>Recent uploads</h3>
                <p className="text-xs text-ccc-muted mt-0.5">
                  {applicantName.trim()
                    ? `${visibleHistory.length} document${visibleHistory.length === 1 ? '' : 's'} for "${applicantName.trim()}"`
                    : 'Type your name above to see your documents'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-lg hover:bg-ccc-off text-ccc-muted hover:text-ccc-navy transition-colors"
                aria-label="Close history"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!applicantName.trim() ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-16">
                  <IconFile className="w-12 h-12 text-ccc-muted mb-4" />
                  <p className="text-sm text-ccc-muted">Type your name in the field above,<br />then reopen History to view your documents.</p>
                </div>
              ) : visibleHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-16">
                  <IconFile className="w-12 h-12 text-ccc-muted mb-4" />
                  <p className="text-sm text-ccc-muted">No documents found for "{applicantName.trim()}".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleHistory.map((doc, index) => (
                    <div
                      key={index}
                      className={`p-4 bg-ccc-off border rounded-xl space-y-3 ${
                        doc.needs_review ? 'border-l-4 border-l-ccc-orange border-y-ccc-border border-r-ccc-border' : 'border-ccc-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-white border border-ccc-border flex items-center justify-center shrink-0">
                            <IconFile className="w-4.5 h-4.5 text-ccc-muted" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-ccc-text font-medium truncate" title={doc.file_path}>
                              {getCleanFileName(doc.file_path)}
                            </p>
                            {(doc.applicant_name || doc.document_type) && (
                              <p className="text-[11px] text-ccc-muted truncate">
                                {doc.applicant_name || 'Unknown applicant'}
                                {doc.document_type ? ` · ${getDocTypeLabel(doc.document_type)}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <a
                          href={doc.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-blue-50 text-ccc-blue rounded-lg hover:bg-blue-100 hover:text-ccc-navy transition-colors shrink-0"
                          title="View document"
                          aria-label="View document"
                        >
                          <IconExternal className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <HashField hash={doc.sha256_hash} dim />
                      </div>
                      <ReviewStatusBadge needsReview={doc.needs_review} />
                      <ExtractedTextField text={doc.extracted_text} method={doc.extraction_method} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </main>
  )
}