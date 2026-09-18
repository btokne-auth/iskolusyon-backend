'use client'
import { useState, useEffect, useRef } from 'react'
import SiteHeader from './components/SiteHeader'
import DocumentStatusTable from './components/DocumentStatusTable'
import { DOCUMENT_TYPE_OPTIONS, getDocTypeLabel } from './lib/documentTypes'

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

// Maps an `applications` row (snake_case DB columns) back to the camelCase
// personalInfo shape the Step 1 cards use — needed when resuming a draft
// that already has Personal Information saved from a previous session.
function mapDbRowToPersonalInfo(row) {
  return {
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    suffix: row.suffix || '',
    dateOfBirth: row.date_of_birth || '',
    placeOfBirth: row.place_of_birth || '',
    sex: row.sex || '',
    citizenship: row.citizenship || '',
    religion: row.religion || '',
    civilStatus: row.civil_status || '',
    spouseName: row.spouse_name || '',
    spouseOccupation: row.spouse_occupation || '',
    spouseContact: row.spouse_contact || '',
    contactNumber: row.contact_number || '',
    address: row.address || '',
    voterPrecinct: row.voter_precinct || '',
    emailUpdatesOptIn: !!row.email_updates_opt_in,
    smsUpdatesOptIn: !!row.sms_updates_opt_in,
    lgbtqi: row.lgbtqi_member || '',
    disability: row.disability || '',
    hobbies: row.hobbies || '',
    organizations:
      Array.isArray(row.organizations) && row.organizations.length > 0
        ? row.organizations
        : [{ name: '', position: '', nature: '', year: '' }],
    motivation: row.motivation || '',
    selfDescription: row.self_description || '',
    tenYears: row.ten_years_plan || '',
  }
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

// Document type list moved to app/lib/documentTypes.js (Sept 16 Patch 2
// port) — was duplicated here, in admin/page.js, and in history/page.js;
// now one shared source so the three can't drift out of sync again.
// See that file's header comment for what changed in this patch.

// Three-step progress indicator for the applicant wizard. Purely visual —
// doesn't gate anything itself, `step` state in the page component decides
// what's shown. TEMP NOTE: styling here reuses the existing ccc- design
// tokens from the approved reskin; CCC's live site changed recently, so
// this visual layer is expected to get a pass once the mockup files are
// updated to match — functionality here is unaffected by that later change.
function StepProgress({ step }) {
  const steps = [
    { n: 1, label: 'Your Info' },
    { n: 2, label: 'Upload Documents' },
    { n: 3, label: 'Review & Submit' },
  ]
  return (
    <div className="flex items-center justify-between mb-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${step === s.n
                  ? 'bg-ccc-blue border-ccc-blue text-white'
                  : step > s.n
                  ? 'bg-ccc-green/10 border-ccc-green text-ccc-green'
                  : 'bg-white border-ccc-border text-ccc-muted'}`}
            >
              {step > s.n ? <IconCheck className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${step === s.n ? 'text-ccc-navy' : 'text-ccc-muted'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 -mt-4 ${step > s.n ? 'bg-ccc-green' : 'bg-ccc-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// Small reusable form controls for the Personal Information cards (Step 1,
// cards 2-3) — kept local to this file since they're only used here, styled
// to match the existing Applicant Name / Email inputs above.
function TextField({ label, required, type = 'text', value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
      />
    </div>
  )
}

function SelectField({ label, required, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
      >
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextAreaField({ label, required, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text placeholder:text-ccc-muted focus:outline-none focus:ring-2 focus:ring-ccc-blue/40 resize-y"
      />
    </div>
  )
}

// Organizational Involvement (card 5): dynamic row table. Ported behavior
// contract from Ivy's org-table (only the last row shows "+"; clicking it
// appends a row and turns that row into a removable "\u00d7" row) \u2014 backed by
// the organizations array in personalInfo/updateOrgRow/addOrgRow/removeOrgRow
// above instead of her direct DOM mutation. Optional section, so nothing
// here is required.
function OrganizationsTable({ rows, onChangeRow, onAddRow, onRemoveRow }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ccc-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-ccc-off/80 text-[10px] text-ccc-muted font-bold uppercase tracking-wide">
            <th className="text-left px-3 py-2">Name of Organization</th>
            <th className="text-left px-3 py-2">Position</th>
            <th className="text-left px-3 py-2">Nature of Organization</th>
            <th className="text-left px-3 py-2">Year of Joining</th>
            <th className="px-2 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1
            return (
              <tr key={i} className="border-t border-ccc-border">
                <td className="px-2 py-1.5">
                  <input type="text" value={row.name} onChange={(e) => onChangeRow(i, 'name', e.target.value)} placeholder="e.g. N/A" className="w-full rounded-md border border-ccc-border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ccc-blue/40" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" value={row.position} onChange={(e) => onChangeRow(i, 'position', e.target.value)} placeholder="e.g. N/A" className="w-full rounded-md border border-ccc-border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ccc-blue/40" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" value={row.nature} onChange={(e) => onChangeRow(i, 'nature', e.target.value)} placeholder="e.g. N/A" className="w-full rounded-md border border-ccc-border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ccc-blue/40" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" value={row.year} onChange={(e) => onChangeRow(i, 'year', e.target.value)} placeholder="e.g. 2025-2026" className="w-full rounded-md border border-ccc-border bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ccc-blue/40" />
                </td>
                <td className="px-2 py-1.5 text-center">
                  {isLast ? (
                    <button type="button" onClick={onAddRow} title="Add row" className="w-6 h-6 rounded-full bg-blue-50 text-ccc-blue font-bold hover:bg-ccc-blue hover:text-white transition-colors">+</button>
                  ) : (
                    <button type="button" onClick={() => onRemoveRow(i)} title="Remove row" className="w-6 h-6 rounded-full bg-red-50 text-red-600 font-bold hover:bg-red-600 hover:text-white transition-colors">&times;</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Inline document upload row used inside the Personal Information cards
// (Profile Picture / Birth Certificate / Voter's ID) — a compact version of
// the Step 2 dropzone, since these three uploads now happen right next to
// the fields they relate to instead of in the separate upload step. Calls
// straight into the shared uploadDocument() helper below.
function InlineUploadRow({ label, sublabel, required, status, onFileSelected }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-ccc-border bg-ccc-off/60 px-3 py-3">
      <IconUpload className="w-5 h-5 text-ccc-blue shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-ccc-navy">
          {label} {required && <span className="text-red-600">*</span>}
        </div>
        {sublabel && <div className="text-[11px] text-ccc-muted">{sublabel}</div>}
        {status === 'uploading' && <div className="text-[11px] text-ccc-blue mt-0.5">Uploading&hellip;</div>}
        {status === 'done' && <div className="text-[11px] text-ccc-green mt-0.5">Uploaded &#x2713;</div>}
        {status === 'flagged' && <div className="text-[11px] text-ccc-gold mt-0.5">Uploaded, flagged for review</div>}
        {status === 'rejected' && <div className="text-[11px] text-red-600 mt-0.5">Photo rejected &mdash; see details below</div>}
        {status === 'error' && <div className="text-[11px] text-red-600 mt-0.5">Upload failed &mdash; try again</div>}
      </div>
      <label className="shrink-0 text-[11px] font-bold text-ccc-blue border border-ccc-blue rounded-lg px-3 py-1.5 cursor-pointer hover:bg-ccc-blue hover:text-white transition-colors">
        Upload
        <input
          type="file"
          className="hidden"
          onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
        />
      </label>
    </div>
  )
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
  const [step, setStep] = useState(1) // 1 = Your Info, 2 = Upload Documents, 3 = Review & Submit
  const [submitted, setSubmitted] = useState(false)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [draftFound, setDraftFound] = useState(null) // application row found for this name, or null
  const [draftDismissed, setDraftDismissed] = useState(false)
  // ---- Personal Information (Step 1, cards 2-3) ----
  // Card 1 (Profile Picture), card 2 (Identity & Civil Status), and card 3
  // (Contact & Residency) fields, ported from Ivy's applicant.html Personal
  // Information section. These map to new columns on `applications` (see
  // personalInfoToColumns() in app/api/application/route.js) — everything
  // here is nullable/optional at the DB level, required-ness is enforced in
  // this component's own validation before "Continue" is enabled.
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '', middleName: '', lastName: '', suffix: '',
    dateOfBirth: '', placeOfBirth: '', sex: '', citizenship: '', religion: '', civilStatus: '',
    spouseName: '', spouseOccupation: '', spouseContact: '',
    contactNumber: '', address: '', voterPrecinct: '',
    emailUpdatesOptIn: false, smsUpdatesOptIn: false,
    // ---- Card 4 (Additional Information) ----
    lgbtqi: '', disability: '', hobbies: '',
    // ---- Card 5 (Organizational Involvement) ---- one blank row to start,
    // matching Ivy's org-table markup (a single seed row with only a '+').
    organizations: [{ name: '', position: '', nature: '', year: '' }],
    // ---- Card 6 (Motivation and Aspirations Questions) ----
    motivation: '', selfDescription: '', tenYears: '',
  })
  const updatePI = (field, value) => setPersonalInfo((p) => ({ ...p, [field]: value }))

  // Card 5 (Organizational Involvement) row helpers — mirrors Ivy's
  // addOrgRow/removeOrgRow behavior contract (only the last row offers
  // "+", earlier rows get a remove "\u00d7" once they're no longer last),
  // backed by real React state instead of her DOM-mutation approach.
  // Optional section: no required-ness enforced on these fields.
  const updateOrgRow = (index, field, value) => {
    setPersonalInfo((p) => {
      const organizations = [...p.organizations]
      organizations[index] = { ...organizations[index], [field]: value }
      return { ...p, organizations }
    })
  }
  const addOrgRow = () => {
    setPersonalInfo((p) => ({
      ...p,
      organizations: [...p.organizations, { name: '', position: '', nature: '', year: '' }],
    }))
  }
  const removeOrgRow = (index) => {
    setPersonalInfo((p) => ({
      ...p,
      organizations: p.organizations.filter((_, i) => i !== index),
    }))
  }

  // Inline upload state for the three document types now uploaded directly
  // inside the Personal Information cards, instead of via the Step 2 form.
  // 'idle' also covers "not attempted yet this session" — hasUploaded()
  // below (via myDocs/docHistory) is what actually confirms a prior upload
  // exists, so a returning applicant sees "Uploaded" without re-uploading.
  const [profilePicStatus, setProfilePicStatus] = useState('idle')
  const [birthCertStatus, setBirthCertStatus] = useState('idle')
  const [voterIdStatus, setVoterIdStatus] = useState('idle')
  // Holds the specific rejection message (e.g. "too small", "too blurry")
  // when an inline upload gets rejected by the quality precheck — status
  // alone only says 'error', this is what actually tells the applicant
  // what to fix. Cleared on every new upload attempt for that row.
  const [profilePicRejection, setProfilePicRejection] = useState(null)
  const [birthCertRejection, setBirthCertRejection] = useState(null)
  const [voterIdRejection, setVoterIdRejection] = useState(null)

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

  // Has this applicant (by name) already uploaded a document of this type?
  // Drives the "Uploaded" state on the three inline Personal Information
  // uploads (cards 1-3) so a returning applicant doesn't see them as empty.
  const hasUploaded = (type) => myDocs.some((doc) => doc.document_type === type)

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

  // Saves current progress (name/email/step) as a draft. Called both
  // automatically when the applicant moves to the next step, and manually
  // by the "Save progress" button — the applicant never has to think about
  // which one is happening.
  const saveProgress = async (targetStep) => {
    if (!applicantName.trim()) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          step: targetStep,
          action: 'save',
          personalInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Save failed')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (err) {
      console.error('Auto-save failed (non-blocking):', err)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  // Flips the application row to 'submitted'. Called only from the Step 3
  // Submit button.
  const submitApplication = async () => {
    setSaveState('saving')
    try {
      const res = await fetch('/api/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          step: 3,
          action: 'submit',
          personalInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Submit failed')
      setSaveState('idle')
      setSubmitted(true)
    } catch (err) {
      console.error('Submit failed:', err)
      setSaveState('error')
    }
  }

  // Looks up whether this name already has a draft sitting in the database
  // — called when the applicant leaves the name field on Step 1. If found,
  // a small banner offers to resume it instead of starting over.
  const checkForDraft = async () => {
    const name = applicantName.trim()
    if (!name || draftDismissed) return
    try {
      const res = await fetch(`/api/application?name=${encodeURIComponent(name)}`)
      const data = await res.json()
      if (data.application && data.application.status === 'draft' && data.application.current_step > 1) {
        setDraftFound(data.application)
      } else {
        setDraftFound(null)
      }
    } catch (err) {
      console.error('Draft lookup failed (non-blocking):', err)
    }
  }

  // If the name field gets cleared, hide the status table again — next time
  // requires a deliberate click, same as the first time.
  useEffect(() => {
    if (applicantName.trim().length === 0 && statusRequested) {
      setStatusRequested(false)
    }
  }, [applicantName, statusRequested])

  // Gates the Step 1 "Continue" button — requires the required Personal
  // Information fields (cards 2-3) plus all three inline uploads (cards
  // 1-3), on top of the pre-existing name requirement. Doesn't require
  // email or the two update opt-in checkboxes, which stay optional.
  const requiredPersonalInfoComplete =
    personalInfo.firstName.trim() &&
    personalInfo.lastName.trim() &&
    personalInfo.dateOfBirth &&
    personalInfo.placeOfBirth.trim() &&
    personalInfo.sex &&
    personalInfo.citizenship.trim() &&
    personalInfo.civilStatus &&
    personalInfo.contactNumber.trim() &&
    personalInfo.address.trim() &&
    personalInfo.voterPrecinct.trim() &&
    personalInfo.lgbtqi &&
    personalInfo.disability.trim() &&
    personalInfo.hobbies.trim() &&
    personalInfo.motivation.trim() &&
    personalInfo.selfDescription.trim() &&
    personalInfo.tenYears.trim()

  const requiredInlineUploadsComplete =
    (profilePicStatus === 'done' || profilePicStatus === 'flagged' || hasUploaded('profilepic')) &&
    (birthCertStatus === 'done' || birthCertStatus === 'flagged' || hasUploaded('birthcert')) &&
    (voterIdStatus === 'done' || voterIdStatus === 'flagged' || hasUploaded('voterid'))

  const canContinueFromStep1 =
    !!applicantName.trim() && !!requiredPersonalInfoComplete && requiredInlineUploadsComplete

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

  // Shared upload call used by both the Step 2 upload form (below) and the
  // three inline uploads in the Step 1 Personal Information cards (Profile
  // Picture, Birth Certificate, Voter's ID) — previously duplicated inline
  // inside handleUpload only. Throws on failure; callers decide how to
  // surface that (full status/qualityRejection UI in Step 2, a compact
  // per-row status in the inline cards).
  const uploadDocument = async (docType, uploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('applicantName', applicantName.trim())
    formData.append('applicantEmail', applicantEmail.trim())
    formData.append('documentType', docType)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      const err = new Error(data.error || 'Upload failed')
      err.rejected = data.rejected
      err.reason = data.reason
      err.rejectionMessage = data.message
      throw err
    }
    return data
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file || !documentType || !applicantName.trim()) return

    setLoading(true)
    setStatus('Scanning document, running OCR, and generating SHA-256 hash...')
    setQualityRejection(null)

    try {
      const data = await uploadDocument(documentType, file)
      setStatus(
        data.needsReview
          ? 'Document uploaded, but flagged for review.'
          : 'Document uploaded and verified successfully.'
      )
      setDetails(data)
      fetchHistory()
      setFile(null)
      setDocumentType('')
    } catch (err) {
      if (err.rejected) {
        // Image-quality precheck rejection: nothing was stored, so there's
        // no `details` to show — just the reason, and the file stays
        // cleared so the applicant picks a fresh (better) photo.
        setStatus('')
        setDetails(null)
        setQualityRejection({ reason: err.reason, message: err.rejectionMessage })
        setFile(null)
      } else {
        setDetails(null)
        setStatus(`Error: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Inline upload handler for the Personal Information cards — same
  // uploadDocument() call as Step 2, but reports through a compact
  // per-field status instead of the shared status/qualityRejection state
  // (three of these can be in flight independently across cards 1-3).
  const handleInlineUpload = async (docType, uploadFile, setInlineStatus, setInlineRejection) => {
    if (!uploadFile || !applicantName.trim()) return
    setInlineStatus('uploading')
    setInlineRejection(null)
    try {
      const data = await uploadDocument(docType, uploadFile)
      setInlineStatus(data.needsReview ? 'flagged' : 'done')
      fetchHistory()
    } catch (err) {
      if (err.rejected) {
        // A specific, actionable quality-precheck rejection (too small,
        // too blurry, etc.) — not a real failure, nothing was stored.
        // Surface the actual reason instead of a blind "try again."
        setInlineStatus('rejected')
        setInlineRejection(err.rejectionMessage)
      } else {
        setInlineStatus('error')
      }
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

      {/* Upload card — now a 3-step wizard: Your Info → Upload Documents →
          Review & Submit. TEMP NOTE: the card styling below still comes
          from the previously-approved CCC reskin; CCC's live site changed
          recently, so this visual layer is due for an update pass later —
          doesn't affect the wizard logic itself. */}
      <div ref={formCardRef} className="w-full max-w-xl mx-auto px-4 py-8">
        <div className="bg-white border border-ccc-border rounded-3xl shadow-md p-8 sm:p-10 space-y-7">
          <StepProgress step={step} />

          {/* ---------- Step 1: Your Info ---------- */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="applicantName" className="text-[10px] text-ccc-muted font-bold uppercase tracking-widest block">
                    Applicant name
                  </label>
                  <input
                    id="applicantName"
                    type="text"
                    value={applicantName}
                    onChange={(e) => { setApplicantName(e.target.value); setDraftFound(null); setDraftDismissed(false) }}
                    onBlur={checkForDraft}
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

              {/* ---------- Card 1: Profile Picture ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-3">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">1 &middot; Profile Picture</div>
                <p className="text-[11px] text-ccc-muted">This photo is used across your application and account.</p>
                <InlineUploadRow
                  label="Profile Picture"
                  sublabel="A clear, recent 2x2 photo of yourself (white background)"
                  required
                  status={profilePicStatus === 'idle' && hasUploaded('profilepic') ? 'done' : profilePicStatus}
                  onFileSelected={(f) => handleInlineUpload('profilepic', f, setProfilePicStatus, setProfilePicRejection)}
                />
                {profilePicRejection && <QualityRejectionAlert message={profilePicRejection} />}
              </div>

              {/* ---------- Card 2: Identity & Civil Status ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-4">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">2 &middot; Identity &amp; Civil Status</div>
                <p className="text-[11px] text-ccc-muted">Document text extraction isn&rsquo;t always perfect &mdash; you can correct any field manually.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField label="First Name" required value={personalInfo.firstName} onChange={(v) => updatePI('firstName', v)} placeholder="e.g. Juan" />
                  <TextField label="Middle Name (if any)" value={personalInfo.middleName} onChange={(v) => updatePI('middleName', v)} placeholder="e.g. Santos" />
                  <TextField label="Last Name" required value={personalInfo.lastName} onChange={(v) => updatePI('lastName', v)} placeholder="e.g. Dela Cruz" />
                  <TextField label="Suffix (if any)" value={personalInfo.suffix} onChange={(v) => updatePI('suffix', v)} placeholder="e.g. Jr., III" />
                  <TextField label="Date of Birth" type="date" required value={personalInfo.dateOfBirth} onChange={(v) => updatePI('dateOfBirth', v)} />
                  <TextField label="Place of Birth" required value={personalInfo.placeOfBirth} onChange={(v) => updatePI('placeOfBirth', v)} placeholder="e.g. Calamba City, Laguna" />
                  <SelectField label="Sex" required value={personalInfo.sex} onChange={(v) => updatePI('sex', v)} options={['Male', 'Female']} />
                  <TextField label="Citizenship" required value={personalInfo.citizenship} onChange={(v) => updatePI('citizenship', v)} placeholder="e.g. Filipino" />
                  <TextField label="Religion" value={personalInfo.religion} onChange={(v) => updatePI('religion', v)} placeholder="e.g. Roman Catholic" />
                  <SelectField label="Civil Status" required value={personalInfo.civilStatus} onChange={(v) => updatePI('civilStatus', v)} options={['Single', 'Married', 'Widowed', 'Separated']} />
                </div>
                {personalInfo.civilStatus === 'Married' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-ccc-border">
                    <div className="sm:col-span-2 text-[10px] font-bold text-ccc-navy uppercase tracking-widest">If Married</div>
                    <TextField label="Spouse's Name" value={personalInfo.spouseName} onChange={(v) => updatePI('spouseName', v)} placeholder="e.g. Maria Dela Cruz" />
                    <TextField label="Spouse's Occupation" value={personalInfo.spouseOccupation} onChange={(v) => updatePI('spouseOccupation', v)} placeholder="e.g. Teacher" />
                    <div className="sm:col-span-2">
                      <TextField label="Spouse's Contact Number" value={personalInfo.spouseContact} onChange={(v) => updatePI('spouseContact', v)} placeholder="e.g. 0917 123 4567" />
                    </div>
                  </div>
                )}
                <InlineUploadRow
                  label="Birth Certificate / PSA / NSO"
                  sublabel="Issued by the Philippine Statistics Authority"
                  required
                  status={birthCertStatus === 'idle' && hasUploaded('birthcert') ? 'done' : birthCertStatus}
                  onFileSelected={(f) => handleInlineUpload('birthcert', f, setBirthCertStatus, setBirthCertRejection)}
                />
                {birthCertRejection && <QualityRejectionAlert message={birthCertRejection} />}
              </div>

              {/* ---------- Card 3: Contact & Residency ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-4">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">3 &middot; Contact &amp; Residency</div>
                <p className="text-[11px] text-ccc-muted">Your address and precinct number can be corrected manually after review.</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <TextField label="Contact Number" required value={personalInfo.contactNumber} onChange={(v) => updatePI('contactNumber', v)} placeholder="e.g. 0917 123 4567" />
                    <label className="flex items-center gap-2 text-[11px] text-ccc-text cursor-pointer mt-1.5">
                      <input type="checkbox" checked={personalInfo.smsUpdatesOptIn} onChange={(e) => updatePI('smsUpdatesOptIn', e.target.checked)} className="accent-ccc-blue w-3.5 h-3.5" />
                      I want to receive SMS updates.
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] text-ccc-text cursor-pointer">
                      <input type="checkbox" checked={personalInfo.emailUpdatesOptIn} onChange={(e) => updatePI('emailUpdatesOptIn', e.target.checked)} className="accent-ccc-blue w-3.5 h-3.5" />
                      I want to receive email updates{applicantEmail.trim() ? ` at ${applicantEmail.trim()}.` : '.'}
                    </label>
                  </div>
                  <TextField label="Present Home Address" required value={personalInfo.address} onChange={(v) => updatePI('address', v)} placeholder="House No., Street, Barangay, City, Province" />
                  <TextField label="Voter's Precinct No." required value={personalInfo.voterPrecinct} onChange={(v) => updatePI('voterPrecinct', v)} placeholder="e.g. 0142A" />
                </div>
                <InlineUploadRow
                  label="Voter's ID / Certification of Applicant"
                  sublabel="Issued by the Commission on Elections (COMELEC)"
                  required
                  status={voterIdStatus === 'idle' && hasUploaded('voterid') ? 'done' : voterIdStatus}
                  onFileSelected={(f) => handleInlineUpload('voterid', f, setVoterIdStatus, setVoterIdRejection)}
                />
                {voterIdRejection && <QualityRejectionAlert message={voterIdRejection} />}
              </div>

              {/* ---------- Card 4: Additional Information ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-4">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">4 &middot; Additional Information</div>
                <p className="text-[11px] text-ccc-muted">Used to help match you to special scholarship categories and accommodations. No document needed here.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField label="Are you a LGBTQI+ community member?" required value={personalInfo.lgbtqi} onChange={(v) => updatePI('lgbtqi', v)} options={['Yes', 'No']} />
                  <TextField label="Do you have a physical or behavioral condition/disability?" required value={personalInfo.disability} onChange={(v) => updatePI('disability', v)} placeholder="e.g. None" />
                  <div className="sm:col-span-2">
                    <TextField label="What are your hobbies and interests?" required value={personalInfo.hobbies} onChange={(v) => updatePI('hobbies', v)} placeholder="e.g. Reading, basketball, drawing" />
                  </div>
                </div>
              </div>

              {/* ---------- Card 5: Organizational Involvement ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-4">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">5 &middot; Organizational Involvement <span className="text-ccc-muted font-semibold normal-case">(Optional)</span></div>
                <p className="text-[11px] text-ccc-muted">List any organization/s you are or were part of. This section is optional &mdash; leave it blank if not applicable.</p>
                <OrganizationsTable
                  rows={personalInfo.organizations}
                  onChangeRow={updateOrgRow}
                  onAddRow={addOrgRow}
                  onRemoveRow={removeOrgRow}
                />
              </div>

              {/* ---------- Card 6: Motivation and Aspirations Questions ---------- */}
              <div className="rounded-2xl border border-ccc-border p-5 space-y-4">
                <div className="text-xs font-bold text-ccc-navy uppercase tracking-wide">6 &middot; Motivation and Aspirations Questions</div>
                <p className="text-[11px] text-ccc-muted">Help us get to know you better. All questions in this section are required.</p>
                <div className="grid grid-cols-1 gap-3">
                  <TextAreaField label="What motivates you to apply to this institution (City College of Calamba)?" required value={personalInfo.motivation} onChange={(v) => updatePI('motivation', v)} placeholder="Share what motivates you to apply&hellip;" />
                  <TextAreaField label="How would you describe yourself, including both your physical and personal characteristics?" required value={personalInfo.selfDescription} onChange={(v) => updatePI('selfDescription', v)} placeholder="Describe yourself&hellip;" />
                  <TextAreaField label="Where do you see yourself 10 years from now, both personally and professionally?" required value={personalInfo.tenYears} onChange={(v) => updatePI('tenYears', v)} placeholder="Share your aspirations&hellip;" />
                </div>
              </div>

              {draftFound && (
                <div className="p-4 rounded-xl border border-ccc-blue/30 bg-blue-50 flex items-start justify-between gap-3">
                  <div className="text-xs text-ccc-text/90">
                    <p className="font-bold text-ccc-navy mb-0.5">Welcome back, {applicantName.trim()}!</p>
                    <p>You have an application in progress (Step {draftFound.current_step} of 3). Want to pick up where you left off?</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setPersonalInfo(mapDbRowToPersonalInfo(draftFound)); setStep(draftFound.current_step) }}
                      className="text-xs font-bold text-white bg-ccc-blue hover:bg-ccc-navy rounded-lg px-3 py-1.5 whitespace-nowrap"
                    >
                      Resume draft
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDraftFound(null); setDraftDismissed(true) }}
                      className="text-[11px] font-semibold text-ccc-muted hover:text-ccc-navy underline underline-offset-2"
                    >
                      Start fresh
                    </button>
                  </div>
                </div>
              )}

              {!canContinueFromStep1 && applicantName.trim() && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Fill in the required fields and upload your Profile Picture, Birth Certificate, and Voter&rsquo;s ID above to continue.
                </p>
              )}
              <button
                type="button"
                onClick={() => { saveProgress(2); setStep(2) }}
                disabled={!canContinueFromStep1}
                className="w-full py-4 px-4 bg-ccc-blue hover:bg-ccc-navy disabled:bg-ccc-border disabled:text-ccc-muted text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-montserrat)' }}
              >
                Continue to document upload
              </button>
            </div>
          )}

          {/* ---------- Step 2: Upload Documents ---------- */}
          {step === 2 && (
          <div className="space-y-6">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-ccc-muted hover:text-ccc-navy underline underline-offset-2"
              >
                &larr; Back to your info
              </button>
              <div className="flex items-center gap-2">
                {saveState === 'saved' && <span className="text-[11px] font-semibold text-ccc-green">Progress saved &#x2713;</span>}
                {saveState === 'error' && <span className="text-[11px] font-semibold text-red-600">Couldn&rsquo;t save &mdash; try again</span>}
                <button
                  type="button"
                  onClick={() => saveProgress(2)}
                  disabled={saveState === 'saving'}
                  className="text-[11px] font-bold text-ccc-blue hover:text-ccc-navy underline underline-offset-2 disabled:opacity-50"
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save progress'}
                </button>
              </div>
            </div>

            <div className="-mt-2 space-y-4">
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

            <button
              type="button"
              onClick={() => { saveProgress(3); setStep(3) }}
              disabled={myDocs.length === 0}
              className="w-full py-3.5 px-4 bg-ccc-navy hover:bg-ccc-blue disabled:bg-ccc-border disabled:text-ccc-muted text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-montserrat)' }}
            >
              {myDocs.length === 0 ? 'Upload at least one document to continue' : `Continue to review (${myDocs.length} uploaded)`}
            </button>
          </div>
          )}

          {/* ---------- Step 3: Review & Submit ---------- */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-ccc-muted hover:text-ccc-navy underline underline-offset-2"
                >
                  &larr; Back to document upload
                </button>
                {!submitted && (
                  <div className="flex items-center gap-2">
                    {saveState === 'saved' && <span className="text-[11px] font-semibold text-ccc-green">Progress saved &#x2713;</span>}
                    {saveState === 'error' && <span className="text-[11px] font-semibold text-red-600">Couldn&rsquo;t save &mdash; try again</span>}
                    <button
                      type="button"
                      onClick={() => saveProgress(3)}
                      disabled={saveState === 'saving'}
                      className="text-[11px] font-bold text-ccc-blue hover:text-ccc-navy underline underline-offset-2 disabled:opacity-50"
                    >
                      {saveState === 'saving' ? 'Saving…' : 'Save progress'}
                    </button>
                  </div>
                )}
              </div>

              {submitted ? (
                <div className="p-5 rounded-xl border border-ccc-green/40 bg-green-50 text-center space-y-1.5">
                  <IconCheck className="w-6 h-6 text-ccc-green mx-auto" />
                  <p className="text-sm font-bold text-ccc-green">Application submitted for review</p>
                  <p className="text-xs text-ccc-text/80">
                    {applicantName.trim()}, your documents are on file. Check the History button above anytime for their status.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
                      Review before submitting
                    </h3>
                    <p className="text-xs text-ccc-muted">
                      Applying as <strong>{applicantName.trim()}</strong>{applicantEmail.trim() ? ` · ${applicantEmail.trim()}` : ''}. Double-check the statuses below — anything marked "Needs review" or "Not uploaded" can still be fixed after submitting.
                    </p>
                  </div>

                  <DocumentStatusTable
                    groups={DOCUMENT_TYPE_OPTIONS}
                    docs={myDocs}
                    applicantName={applicantName}
                    onReupload={(typeValue) => { setStep(2); jumpToUploadFor(typeValue) }}
                  />

                  <button
                    type="button"
                    onClick={submitApplication}
                    disabled={saveState === 'saving'}
                    className="w-full py-4 px-4 bg-ccc-green hover:bg-ccc-navy disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer"
                    style={{ fontFamily: 'var(--font-montserrat)' }}
                  >
                    {saveState === 'saving' ? 'Submitting…' : 'Submit application'}
                  </button>
                  <p className="text-[10px] text-ccc-muted text-center">
                    Note: this confirms your documents are ready for review. Draft saving and a locked final-submission state are coming in a follow-up update.
                  </p>
                </>
              )}
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