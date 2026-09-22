'use client'
import { useState, useEffect, useRef } from 'react'
import './portal-theme.css'
import SiteHeader from './components/SiteHeader'
import DocumentStatusTable from './components/DocumentStatusTable'
import PortalSidebar from './components/PortalSidebar'
import ApplicantAuth from './components/ApplicantAuth'
import { DOCUMENT_TYPE_OPTIONS, getDocTypeLabel } from './lib/documentTypes'
import {
  saveDraftLocal,
  loadDraftLocal,
  clearDraftLocal,
  queueUpload,
  getQueuedUploads,
  removeQueuedUpload,
  onConnectivityChange,
  isNetworkError,
} from './lib/offlineSync'

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
    barangay: row.barangay || '',
    residencyYears: row.residency_years ?? '',
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
    termsCertified: !!row.terms_certified,
    privacyAgreed: !!row.privacy_agreed,
  }
}

// Maps an `applications` row back to the camelCase healthInfo shape the
// Health & Wellness panel uses — same pattern as mapDbRowToPersonalInfo()
// above, needed when resuming a draft.
function mapDbRowToHealthInfo(row) {
  return {
    medicalStatus: row.health_condition || '',
  }
}

// Maps an `applications` row back to the camelCase familyInfo shape the
// Family & Financial Information panel uses — same pattern as
// mapDbRowToPersonalInfo() above, needed when resuming a draft. Falls back
// to 3 blank sibling-income columns (matching the panel's own default)
// when fam_siblings is empty, same reasoning as mapDbRowToPersonalInfo()'s
// organizations fallback above.
function mapDbRowToFamilyInfo(row) {
  return {
    motherName: row.fam_mother_name || '',
    motherCitizenship: row.fam_mother_citizenship || '',
    motherDob: row.fam_mother_dob || '',
    motherContact: row.fam_mother_contact || '',
    motherEducation: row.fam_mother_education || '',
    motherEmployment: row.fam_mother_employment || '',
    fatherName: row.fam_father_name || '',
    fatherCitizenship: row.fam_father_citizenship || '',
    fatherDob: row.fam_father_dob || '',
    fatherContact: row.fam_father_contact || '',
    fatherEducation: row.fam_father_education || '',
    fatherEmployment: row.fam_father_employment || '',
    guardianName: row.fam_guardian_name || '',
    guardianCitizenship: row.fam_guardian_citizenship || '',
    guardianDob: row.fam_guardian_dob || '',
    guardianContact: row.fam_guardian_contact || '',
    guardianEducation: row.fam_guardian_education || '',
    guardianEmployment: row.fam_guardian_employment || '',
    onlyChild: row.fam_only_child || '',
    numSiblings: row.fam_num_siblings ?? '',
    siblingCurrentStudent: row.fam_sibling_currentstudent || '',
    siblingGraduate: row.fam_sibling_graduate || '',
    emergencyContact: row.fam_emergency_contact || '',
    emergencyContactNumber: row.fam_emergency_contact_number || '',
    workingStudent: row.fam_working_student || '',
    siblings:
      Array.isArray(row.fam_siblings) && row.fam_siblings.length > 0
        ? row.fam_siblings
        : [
            { name: '', dob: '', civilStatus: '', contact: '', education: '' },
            { name: '', dob: '', civilStatus: '', contact: '', education: '' },
            { name: '', dob: '', civilStatus: '', contact: '', education: '' },
          ],
  }
}

// Maps an `applications` row back to the camelCase academicInfo shape the
// Educational Background panel uses — same pattern as
// mapDbRowToPersonalInfo() above, needed when resuming a draft.
function mapDbRowToAcademicInfo(row) {
  return {
    applyingAs: row.applying_as || '',
    termApplying: row.term_applying || '',
    choice1: row.program_choice_1 || '',
    choice2: row.program_choice_2 || '',
    edu: {
      prim: {
        school: row.edu_prim_school || '',
        address: row.edu_prim_address || '',
        section: row.edu_prim_section || '',
        year: row.edu_prim_year || '',
        honors: row.edu_prim_honors || '',
      },
      sec: {
        school: row.edu_sec_school || '',
        address: row.edu_sec_address || '',
        section: row.edu_sec_section || '',
        year: row.edu_sec_year || '',
        honors: row.edu_sec_honors || '',
      },
      tert: {
        school: row.edu_tert_school || '',
        address: row.edu_tert_address || '',
        section: row.edu_tert_section || '',
        year: row.edu_tert_year || '',
        honors: row.edu_tert_honors || '',
      },
    },
    techVoc: row.tech_voc || '',
    techVocSchool: row.tech_voc_school || '',
    techVocCourse: row.tech_voc_course || '',
    techVocAddress: row.tech_voc_address || '',
    // Sept 20 2026: Scholarship Matching & Filtering — only meaningful when
    // applyingAs === 'Transferee'. See app/lib/matching.js.
    transfereeGwa: row.transferee_gwa ?? '',
    transfereeUnitsPassed: row.transferee_units_passed ?? '',
    transfereeFailingGrade: row.transferee_failing_grade || '',
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

// Real "Application History & Activity Log" (Documents & Status panel,
// design-parity pass 8, Sept 19 2026) — spec's own version
// (applicant.html's #panel-status) is scripted fake data ("Account
// created and verified", "Deficiency flagged on Proof of Employment"),
// but this app actually has enough real data to build a genuine one
// instead: every document's upload time and needs_review flag, and the
// four section-submitted timestamps now that Family & Financial and
// Health & Wellness are real panels. No account-creation timestamp is
// available to this component (the applicant-session cookie doesn't
// carry one), so unlike spec this log starts from the first real event
// instead of an "Account created" entry — everything after that is real.
function buildActivityLog({ myDocs, personalSubmittedAt, academicSubmittedAt, healthSubmittedAt, financialSubmittedAt, submittedAt }) {
  const events = []

  myDocs.forEach((doc) => {
    if (!doc.created_at) return
    const label = getDocTypeLabel(doc.document_type)
    events.push(
      doc.needs_review
        ? { date: doc.created_at, dot: 'warn', title: `Deficiency flagged on ${label}`, body: 'Needs your attention — see Documents & Status above.' }
        : { date: doc.created_at, dot: 'done', title: `${label} uploaded`, body: 'Received and on file.' }
    )
  })

  const sectionEvents = [
    { at: personalSubmittedAt, title: 'Personal Information submitted' },
    { at: academicSubmittedAt, title: 'Educational Background submitted' },
    { at: financialSubmittedAt, title: 'Family & Financial Information submitted' },
    { at: healthSubmittedAt, title: 'Health & Wellness submitted' },
  ]
  sectionEvents.forEach(({ at, title }) => {
    if (!at) return
    events.push({ date: at, dot: 'done', title, body: 'Section checkpoint reached — you can still edit and re-submit any time.' })
  })

  if (submittedAt) {
    events.push({ date: submittedAt, dot: 'done', title: 'Application submitted for review', body: 'Your documents are on file and being tracked here.' })
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date))

  // Trailing "what's next" entry, same role as spec's own undated last
  // timeline item — only shown while something is still outstanding.
  if (!submittedAt) {
    const missing = sectionEvents.filter((s) => !s.at).map((s) => s.title.replace(' submitted', ''))
    if (missing.length) {
      events.push({
        date: null,
        dot: null,
        title: 'Awaiting remaining profile sections',
        body: `Complete ${missing.join(', ')} to proceed.`,
      })
    } else if (myDocs.length === 0) {
      events.push({ date: null, dot: null, title: 'Awaiting document uploads', body: 'Upload at least one document, then submit your application below.' })
    } else {
      events.push({ date: null, dot: null, title: 'Ready to submit', body: 'All profile sections are checkpointed — submit your application below when ready.' })
    }
  }

  return events
}

function ActivityLog({ events }) {
  if (events.length === 0) {
    return <p className="topic-card-intro" style={{ marginTop: 0 }}>Nothing on file yet — upload a document or fill in a profile section to start your activity log.</p>
  }
  return (
    <div className="timeline">
      {events.map((ev, i) => (
        <div key={i} className="timeline-item">
          <div className={`timeline-dot${ev.dot ? ` ${ev.dot}` : ''}`}>{ev.dot ? '' : '…'}</div>
          <div className="timeline-body">
            <h4>{ev.title}</h4>
            <p>{ev.date ? new Date(ev.date).toLocaleString() : ev.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sept 19 2026: Contact Number and Date of Birth fields throughout
// Personal Information and Family & Financial Information were plain text
// inputs with no format enforcement — they'd accept letters, symbols,
// anything typable, which is exactly the kind of "obviously wrong input"
// an applicant shouldn't be able to submit. Rather than only validate on
// submit (which still lets garbage sit in the field until then), these
// strip disallowed characters as the applicant types, the same way a
// phone number field on a real form behaves.
// Sept 20 2026: the Guardian column of the Parent/Guardian table is the one
// place in this form where "N/A" is a legitimate, expected answer — Ivy's
// own spec only marks Mother/Father as required, Guardian is optional and
// its own placeholders already say "e.g. N/A". But sanitizePhoneInput/
// sanitizeDateTextInput strip anything that isn't a digit (or digit+slash),
// so an applicant with no guardian could never actually type "N/A" into
// Guardian's Contact No. or Date of Birth — the letters vanished as fast as
// they were typed. Checked against every partial prefix ("n", "n/", "n/a")
// so the real-time sanitizer doesn't eat each keystroke while it's still
// being typed out. The moment the input stops looking like "N/A" (real
// digits typed instead), it falls back to normal phone/date sanitizing —
// so a guardian with a real contact number still gets the same formatting
// help Mother/Father get. Mother and Father stay digits-only, since those
// two are required and "N/A" was never a valid answer for them.
function isNAInProgress(value) {
  const v = value.trim().toLowerCase()
  return v === '' || 'n/a'.startsWith(v)
}
function sanitizePhoneInput(value, allowNA) {
  // Sept 19 2026, second pass: the first version only stripped
  // non-digit characters and left spacing up to whatever the applicant
  // typed — but typing digits straight through a numeric-feeling field
  // rarely includes manual spaces, so numbers that used to end up spaced
  // out on their own (typing "0917", pausing, "123", pausing, "4567")
  // came out as one unbroken string once the field started filtering
  // every keystroke. Auto-grouping the digits into the same 4-3-4 shape
  // every placeholder in this app already shows ("0917 123 4567") means
  // it's always readable regardless of how the applicant types it.
  if (allowNA && isNAInProgress(value)) return value
  const leadingPlus = value.trim().startsWith('+') ? '+' : ''
  const digits = value.replace(/\D/g, '')
  if (leadingPlus) {
    // Don't try to guess a grouping for an arbitrary country code —
    // just keep the digits together after the +.
    return leadingPlus + digits
  }
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ')
}
function sanitizeDateTextInput(value, allowNA) {
  // For the free-text "MM/DD/YYYY" Date of Birth fields in the Family &
  // Financial tables below (Parent/Guardian, Sibling Income) — Personal
  // Information's own Date of Birth field uses a native <input
  // type="date"> picker already, so it can't accept invalid text at all.
  if (allowNA && isNAInProgress(value)) return value
  return value.replace(/[^\d/]/g, '')
}

// Small reusable form controls for the Personal Information cards (Step 1,
// cards 2-3) — kept local to this file since they're only used here, styled
// to match the existing Applicant Name / Email inputs above.
// .mfield/.req-mark/.full from portal-theme.css (design-parity pass 5,
// Sept 19 2026) — was muted-gray Tailwind labels/inputs; spec's labels are
// navy, not gray, and inputs use a 6px radius + inset focus glow instead of
// an outer ring. `full` lets a caller span both columns of a parent
// .form-grid without a separate wrapper div (spec's .mfield.full).
function TextField({ label, required, type = 'text', value, onChange, placeholder, disabled, full }) {
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && <span className="req-mark">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function SelectField({ label, required, value, onChange, options, disabled, full }) {
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && <span className="req-mark">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextAreaField({ label, required, value, onChange, placeholder, full }) {
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && <span className="req-mark">*</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  )
}

// Organizational Involvement (card 5): dynamic row table. Ported behavior
// contract from Ivy's org-table (only the last row shows "+"; clicking it
// appends a row and turns that row into a removable "\u00d7" row) \u2014 backed by
// the organizations array in personalInfo/updateOrgRow/addOrgRow/removeOrgRow
// above instead of her direct DOM mutation. Optional section, so nothing
// here is required.
// Uses applicant.html's .edu-table/.org-table/.org-row-btn classes
// (design-parity pass 5, Sept 19 2026) — was a plain gray-header Tailwind
// table with none of spec's full cell grid, navy header text, or inset
// focus highlight.
function OrganizationsTable({ rows, onChangeRow, onAddRow, onRemoveRow }) {
  return (
    <div className="edu-table-wrap">
      <table className="edu-table org-table">
        <thead>
          <tr>
            <th>Name of Organization</th>
            <th>Position in Organization</th>
            <th>Nature of Organization</th>
            <th>Year of Joining</th>
            <th className="org-table-action-th" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1
            return (
              <tr key={i}>
                <td>
                  <input type="text" value={row.name} onChange={(e) => onChangeRow(i, 'name', e.target.value)} placeholder="e.g. Organization Name" />
                </td>
                <td>
                  <input type="text" value={row.position} onChange={(e) => onChangeRow(i, 'position', e.target.value)} placeholder="e.g. President" />
                </td>
                <td>
                  <input type="text" value={row.nature} onChange={(e) => onChangeRow(i, 'nature', e.target.value)} placeholder="e.g. Non-profit Organization" />
                </td>
                <td>
                  <input type="text" value={row.year} onChange={(e) => onChangeRow(i, 'year', e.target.value)} placeholder="e.g. 2025-2026" />
                </td>
                <td className="org-row-action">
                  {isLast ? (
                    <button type="button" onClick={onAddRow} title="Add row" className="org-row-btn org-row-add">+</button>
                  ) : (
                    <button type="button" onClick={() => onRemoveRow(i)} title="Remove row" className="org-row-btn org-row-remove">&times;</button>
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

// 3-tier school history table (Educational Background panel) — ported
// directly from Ivy's edu-table markup: one row per field, one column per
// level (Primary/Elementary, Secondary/Senior High, Tertiary/College).
// Only Primary/Elementary is required (per her spec); Secondary and
// Tertiary are fully optional, including Honors at every level.
const EDU_ROWS = [
  { field: 'school', label: 'Name of School', placeholders: ['e.g. Elementary School', 'e.g. Integrated School', 'e.g. City College of Calamba'] },
  { field: 'address', label: 'Address of School', placeholders: ['e.g. Bunggo, Calamba City', 'e.g. Bunggo, Calamba City', 'e.g. Calamba City, Laguna'] },
  { field: 'section', label: 'Section / Strands / Program', placeholders: ['e.g. Osme\u00f1a', 'e.g. HUMSS - Hope', 'e.g. BS Information Technology'] },
  { field: 'year', label: 'Graduation / Completion Year', placeholders: ['e.g. 2020', 'e.g. 2026', 'e.g. 2030'] },
  { field: 'honors', label: 'Honors / Awards Received', placeholders: ['e.g. N/A', 'e.g. Honors', 'e.g. N/A'] },
]
const EDU_LEVELS = ['prim', 'sec', 'tert']

// Uses applicant.html's .edu-table classes (design-parity pass 5,
// Sept 19 2026) — was a plain gray-header Tailwind table with none of
// spec's full cell grid, navy header text, or inset focus highlight.
function EduTable({ edu, onChangeCell, disabled }) {
  return (
    <div className="edu-table-wrap">
      <table className="edu-table">
        <thead>
          <tr>
            <th></th>
            <th>Primary / Elementary <span className="req-mark">*</span></th>
            <th>Secondary / Senior High</th>
            <th>Tertiary / College</th>
          </tr>
        </thead>
        <tbody>
          {EDU_ROWS.map((row) => (
            <tr key={row.field}>
              <th>{row.label}</th>
              {EDU_LEVELS.map((level, i) => (
                <td key={level}>
                  <input
                    type="text"
                    value={edu[level][row.field]}
                    onChange={(e) => onChangeCell(level, row.field, e.target.value)}
                    placeholder={row.placeholders[i]}
                    required={level === 'prim' && row.field !== 'honors'}
                    disabled={disabled}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Parent/Guardian table (Family & Financial Information panel) — one row
// per field, one column per person, ported from Ivy's fam-mother-*/
// fam-father-*/fam-guardian-* markup. Mother and Father are required;
// Guardian is not (matches spec's own required attrs — only the mother/
// father <td>s have `required`).
const PARENT_ROWS = [
  { field: 'Name', placeholders: ['e.g. Juana Dela Cruz', 'e.g. Juan Dela Cruz', 'e.g. N/A'] },
  { field: 'Citizenship', placeholders: ['e.g. Filipino', 'e.g. Filipino', 'e.g. N/A'] },
  { field: 'Dob', label: 'Date of Birth', placeholders: ['e.g. MM/DD/YYYY', 'e.g. MM/DD/YYYY', 'e.g. N/A'] },
  { field: 'Contact', label: 'Contact No.', placeholders: ['e.g. 0917 123 4567', 'e.g. 0917 123 4567', 'e.g. N/A'] },
  { field: 'Education', label: 'Highest Educational Attainment', placeholders: ['e.g. College Graduate', 'e.g. College Graduate', 'e.g. N/A'] },
  { field: 'Employment', label: 'Employment Status', placeholders: ['e.g. Employed', 'e.g. Employed', 'e.g. N/A'] },
]
const PARENT_PEOPLE = ['mother', 'father', 'guardian']

function ParentGuardianTable({ familyInfo, onChange, disabled }) {
  return (
    <div className="edu-table-wrap">
      <table className="edu-table">
        <thead>
          <tr>
            <th></th>
            <th>Mother <span className="req-mark">*</span></th>
            <th>Father <span className="req-mark">*</span></th>
            <th>Guardian</th>
          </tr>
        </thead>
        <tbody>
          {PARENT_ROWS.map((row) => (
            <tr key={row.field}>
              <th>{row.label || row.field}</th>
              {PARENT_PEOPLE.map((person, i) => {
                const key = `${person}${row.field}`
                return (
                  <td key={person}>
                    <input
                      type="text"
                      inputMode={row.field === 'Contact' ? 'tel' : row.field === 'Dob' ? 'numeric' : undefined}
                      value={familyInfo[key]}
                      onChange={(e) => {
                        let v = e.target.value
                        const allowNA = person === 'guardian'
                        if (row.field === 'Contact') v = sanitizePhoneInput(v, allowNA)
                        if (row.field === 'Dob') v = sanitizeDateTextInput(v, allowNA)
                        onChange(key, v)
                      }}
                      placeholder={row.placeholders[i]}
                      required={person !== 'guardian'}
                      disabled={disabled}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Sibling income table (Family & Financial Information panel, inside the
// "Family's Annual Income" card) — one row per field, one column per
// sibling, ported from Ivy's #sibling-income-table + addSiblingColumn()/
// removeSiblingColumn() JS. Same add/remove-the-newest-column contract as
// OrganizationsTable's add/remove-the-newest-row above: only the last
// column offers "+", every earlier column offers "×" once it's no
// longer last. Starts with 3 columns, matching spec's own default.
const SIBLING_ROWS = [
  { field: 'name', label: 'Name', placeholder: 'e.g. N/A', type: 'text' },
  { field: 'dob', label: 'Date of Birth', placeholder: 'e.g. MM/DD/YYYY', type: 'text' },
  { field: 'civilStatus', label: 'Civil Status', type: 'select', options: ['Single', 'Married', 'Widowed', 'Separated'] },
  { field: 'contact', label: 'Contact Number', placeholder: 'e.g. 0917 123 4567', type: 'text' },
  { field: 'education', label: 'Highest Educational Attainment', placeholder: 'e.g. College Graduate', type: 'text' },
]

function SiblingIncomeTable({ siblings, onChangeCell, onAddColumn, onRemoveColumn, disabled }) {
  return (
    <div className="edu-table-wrap">
      <table className="edu-table" id="sibling-income-table">
        <thead>
          <tr>
            <th>Eldest to Youngest</th>
            {siblings.map((_, i) => {
              const isLast = i === siblings.length - 1
              return (
                <th key={i} className="sib-col">
                  Sibling {i + 1} <span className="req-mark">*</span>{' '}
                  {isLast ? (
                    <button type="button" className="org-row-btn org-row-add sib-col-btn" onClick={onAddColumn} title="Add sibling" disabled={disabled}>+</button>
                  ) : (
                    <button type="button" className="org-row-btn org-row-remove sib-col-btn" onClick={() => onRemoveColumn(i)} title="Remove sibling" disabled={disabled}>&times;</button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {SIBLING_ROWS.map((row) => (
            <tr key={row.field}>
              <th>{row.label}</th>
              {siblings.map((sib, i) =>
                row.type === 'select' ? (
                  <td key={i}>
                    <select value={sib[row.field]} onChange={(e) => onChangeCell(i, row.field, e.target.value)} required disabled={disabled}>
                      <option value="">Select&hellip;</option>
                      {row.options.map((opt) => <option key={opt}>{opt}</option>)}
                    </select>
                  </td>
                ) : (
                  <td key={i}>
                    <input
                      type="text"
                      inputMode={row.field === 'contact' ? 'tel' : row.field === 'dob' ? 'numeric' : undefined}
                      value={sib[row.field]}
                      onChange={(e) => {
                        let v = e.target.value
                        if (row.field === 'contact') v = sanitizePhoneInput(v)
                        if (row.field === 'dob') v = sanitizeDateTextInput(v)
                        onChangeCell(i, row.field, v)
                      }}
                      placeholder={row.placeholder}
                      required
                      disabled={disabled}
                    />
                  </td>
                )
              )}
            </tr>
          ))}
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
// Uses applicant.html's .upload-row / .upload-info / .upload-btn-label
// classes (design-parity pass 4, Sept 19 2026) — including its red-dashed
// (needs action) -> green-solid (has-file) traffic-light affordance,
// which the previous neutral-gray version never had. Spec's own
// .upload-icon is display:none (no icon actually shown), so the icon
// that used to sit here was dropped rather than kept as an extra
// element spec doesn't have.
function InlineUploadRow({ label, sublabel, required, status, onFileSelected, disabled }) {
  const hasFile = ['done', 'flagged', 'uploading', 'queued'].includes(status)
  return (
    <div
      className={`upload-row${hasFile ? ' has-file' : ''}${required ? ' required' : ''}`}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <div className="upload-info">
        <div className="u-title">
          {label} {required && <span className="req-mark">*</span>}
        </div>
        {sublabel && <div className="u-sub">{sublabel}</div>}
        {status === 'uploading' && <div className="u-sub" style={{ color: 'var(--ccc-blue)' }}>Uploading&hellip;</div>}
        {status === 'done' && <div className="u-filename">Uploaded &#x2713;</div>}
        {status === 'flagged' && <div className="u-sub" style={{ color: 'var(--gold)' }}>Uploaded, flagged for review</div>}
        {status === 'rejected' && <div className="u-sub" style={{ color: 'var(--red)' }}>Photo rejected &mdash; see details below</div>}
        {status === 'error' && <div className="u-sub" style={{ color: 'var(--red)' }}>Upload failed &mdash; try again</div>}
        {status === 'queued' && (
          <div className="u-sub" style={{ color: 'var(--gold)' }}>
            No connection &mdash; saved on this device, will upload automatically once you&rsquo;re back online
          </div>
        )}
      </div>
      <label className="upload-btn-label" style={disabled ? { cursor: 'not-allowed' } : undefined}>
        {/* Re-selecting a file here always worked (nothing blocked a second
            upload), but the button still said "Upload" even once one
            already existed, reading like a first-time action rather than
            a replace. Now says "Change" once there's something to change. */}
        {status === 'done' || status === 'flagged' ? 'Change' : 'Upload'}
        <input
          type="file"
          disabled={disabled}
          onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
        />
      </label>
    </div>
  )
}

// Per-panel "Save as Draft" / "Submit Section" footer — matches
// applicant.html's .form-actions pair on Personal Information and
// Educational Background. "Save as Draft" reuses the same save call the
// old single "Save progress" button used (renamed to match spec's label);
// "Submit Section" is the new real per-section checkpoint (see
// submitSection() above) with its own transient "Submitted ✓" state.
// Both buttons are .mbtn.mbtn-primary in spec (applicant.html's
// Save-as-Draft is NOT a secondary/ghost button — both are solid blue;
// confirmed against every instance of .form-actions in the mockup).
function SectionFormActions({ saveState, sectionState, error, disabled, submitDisabled, submitLabel, onSaveDraft, onSubmit }) {
  return (
    <div>
      {error && <p className="save-note" style={{ color: 'var(--red)', whiteSpace: 'pre-line' }}>{error}</p>}
      {saveState === 'saved' && <p className="save-note" style={{ color: 'var(--green)' }}>Progress saved &#x2713;</p>}
      {saveState === 'error' && <p className="save-note" style={{ color: 'var(--red)' }}>Couldn&rsquo;t save &mdash; try again</p>}
      {saveState === 'offline' && <p className="save-note" style={{ color: 'var(--gold)' }}>No connection &mdash; saved on this device, will sync automatically</p>}
      {sectionState === 'submitted' && <p className="save-note" style={{ color: 'var(--green)' }}>Submitted &#x2713;</p>}
      {sectionState === 'error' && <p className="save-note" style={{ color: 'var(--red)' }}>Couldn&rsquo;t submit &mdash; try again</p>}
      <div className="form-actions">
        <button type="button" onClick={onSaveDraft} disabled={disabled || saveState === 'saving'} className="mbtn mbtn-primary">
          {saveState === 'saving' ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || submitDisabled || sectionState === 'submitting'}
          className="mbtn mbtn-primary"
        >
          {sectionState === 'submitting' ? 'Submitting…' : sectionState === 'submitted' ? 'Submitted ✓' : submitLabel || 'Submit Section'}
        </button>
      </div>
    </div>
  )
}

// Log-out confirmation modal — ported 1:1 from applicant.html's
// #logoutOverlay/.confirm-box markup (design-parity pass 4, Sept 19 2026).
// Previously "Log Out" logged the applicant out immediately with no
// confirmation step at all; spec always confirms first.
function LogoutConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null
  return (
    <div
      className="confirm-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
        <div className="confirm-icon" aria-hidden="true" />
        <h3 id="logoutTitle">Log out of Iskolusyon?</h3>
        <p>You&rsquo;ll need to sign in again to access your applicant page.</p>
        <div className="confirm-actions">
          <button type="button" className="mbtn mbtn-ghost" onClick={onCancel}>
            No, Stay
          </button>
          <button type="button" className="mbtn mbtn-danger" onClick={onConfirm}>
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Page ----------

// ---------- Real auth gate (User Account Module) ----------
// Was formally Ivy's scope; built Sept 19, 2026 since she isn't. Checks
// for a valid applicant session cookie before rendering the portal at all
// — logged-out visitors see ApplicantAuth (Login / 4-step Signup) instead.
// The actual portal is PortalApp below (renamed from the old default
// export `Home`), now receiving the verified account as `accountSession`
// instead of applicants free-typing their own name/email.
export default function Home() {
  const [accountSession, setAccountSession] = useState(undefined) // undefined = checking, null = logged out, object = logged in

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

  if (accountSession === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ccc-off text-ccc-muted text-sm">
        Loading…
      </div>
    )
  }

  if (!accountSession) {
    return <ApplicantAuth onAuthenticated={(session) => setAccountSession(session)} />
  }

  return (
    <PortalApp
      accountSession={accountSession}
      onLogout={async () => {
        await fetch('/api/applicant-logout', { method: 'POST' }).catch(() => {})
        setAccountSession(null)
      }}
    />
  )
}

function PortalApp({ accountSession, onLogout }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState(null)
  const [qualityRejection, setQualityRejection] = useState(null)
  const [applicantName, setApplicantName] = useState(accountSession.name || '')
  const [applicantEmail, setApplicantEmail] = useState(accountSession.email || '')
  const [documentType, setDocumentType] = useState('')
  const [docHistory, setDocHistory] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [statusRequested, setStatusRequested] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('personal') // sidebar panel key — replaces the old linear step wizard
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState(null) // for the real Application History & Activity Log, below
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error' | 'offline'

  // Per-section "Submit Section" state (design-parity pass 3) — separate
  // from personalInfo/academicInfo so those objects stay a clean 1:1 map to
  // their DB columns. Only Educational Background actually locks once
  // submitted (matches applicant.html's submitSection()/lockPanelFields());
  // Personal Information's submit is just a checkpoint marker, fields stay
  // editable indefinitely like the rest of the profile.
  const [personalSubmittedAt, setPersonalSubmittedAt] = useState(null)
  const [academicSubmittedAt, setAcademicSubmittedAt] = useState(null)
  const [healthSubmittedAt, setHealthSubmittedAt] = useState(null)
  const [financialSubmittedAt, setFinancialSubmittedAt] = useState(null)
  // Sept 20 2026: the sidebar's "Applicant No." — null until
  // /api/application reports every required document type is on file
  // (see maybeAssignApplicationNumber() in app/api/application/route.js
  // for the real required set and why it's a one-way assignment). Set
  // from both the initial GET on load and whatever save/submit response
  // comes back, same as every other *SubmittedAt state above.
  const [applicationNumber, setApplicationNumber] = useState(null)
  const [personalSectionState, setPersonalSectionState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'submitting' | 'submitted' | 'error'
  const [academicSectionState, setAcademicSectionState] = useState('idle')
  const [healthSectionState, setHealthSectionState] = useState('idle')
  const [financialSectionState, setFinancialSectionState] = useState('idle')
  const [sectionErrors, setSectionErrors] = useState({ personal: '', academic: '', health: '', financial: '' })
  const [draftFound, setDraftFound] = useState(null) // application row found for this name, or null
  const [draftDismissed, setDraftDismissed] = useState(false)
  const [localDraftFound, setLocalDraftFound] = useState(null) // draft found in IndexedDB only (offline fallback), separate from draftFound above
  const [queuedUploadCount, setQueuedUploadCount] = useState(0) // uploads waiting in IndexedDB for a connection
  const [isOffline, setIsOffline] = useState(false) // proactive connectivity state, not just reactive to a failed save/upload
  const [justSynced, setJustSynced] = useState(false) // brief confirmation once queued items finish uploading after reconnecting
  const [justReconnected, setJustReconnected] = useState(false) // brief "you're back online" confirmation, independent of whether anything was queued
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
    contactNumber: '', address: '', barangay: '', residencyYears: '', voterPrecinct: '',
    emailUpdatesOptIn: false, smsUpdatesOptIn: false, termsCertified: false, privacyAgreed: false,
    // ---- Card 4 (Additional Information) ----
    lgbtqi: '', disability: '', hobbies: '',
    // ---- Card 5 (Organizational Involvement) ---- one blank row to start,
    // matching Ivy's org-table markup (a single seed row with only a '+').
    organizations: [{ name: '', position: '', nature: '', year: '' }],
    // ---- Card 6 (Motivation and Aspirations Questions) ----
    motivation: '', selfDescription: '', tenYears: '',
  })
  const updatePI = (field, value) => setPersonalInfo((p) => ({ ...p, [field]: value }))

  // Once logged in, `applicantName` (the key everything else in this file
  // matches applications/documents against) is derived from the verified
  // Personal Information fields instead of being free-typed — keeps the
  // "Applicant name" field above in sync as First/Middle/Last Name change.
  useEffect(() => {
    if (!accountSession) return
    const derived = [personalInfo.firstName, personalInfo.lastName].filter((v) => v && v.trim()).join(' ').trim()
    if (derived && derived !== applicantName) {
      setApplicantName(derived)
      setDraftFound(null)
      setDraftDismissed(false)
    }
  }, [accountSession, personalInfo.firstName, personalInfo.lastName])

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

  // ---- Educational Background panel ----
  // Program Application, Preferred Program, the 3-tier school table, and
  // Tech-Voc — ported from Ivy's applicant.html academic panel. Maps to new
  // columns on `applications` (see academicInfoToColumns() in
  // app/api/application/route.js). Only Applying As, Term Applying In, both
  // program choices, and the Primary/Elementary row are required — Secondary,
  // Tertiary, and Tech-Voc are fully optional, matching her spec.
  const [academicInfo, setAcademicInfo] = useState({
    applyingAs: '', termApplying: '', choice1: '', choice2: '',
    edu: {
      prim: { school: '', address: '', section: '', year: '', honors: '' },
      sec: { school: '', address: '', section: '', year: '', honors: '' },
      tert: { school: '', address: '', section: '', year: '', honors: '' },
    },
    techVoc: '', techVocSchool: '', techVocCourse: '', techVocAddress: '',
    transfereeGwa: '', transfereeUnitsPassed: '', transfereeFailingGrade: '',
  })
  const updateAI = (field, value) => setAcademicInfo((a) => ({ ...a, [field]: value }))

  // ---- Health & Wellness panel ---- Ivy's spec has exactly one field here
  // (Medical Status, free text) plus the Medical Examination Results/
  // Certificate upload, which reuses the existing `medcert` document type —
  // no required-ness on either, matching spec.
  const [healthInfo, setHealthInfo] = useState({ medicalStatus: '' })
  const updateHI = (field, value) => setHealthInfo((h) => ({ ...h, [field]: value }))

  // ---- Family & Financial Information panel ---- ported from Ivy's
  // panel-financial: Parent/Guardian table, the only-child branch (number
  // of siblings + the two CCC sibling questions), emergency contact, the
  // working-student branch, and the sibling income table. `siblings`
  // starts with 3 blank columns, matching spec's own default before the
  // "+" button is used — see addSiblingColumn/removeSiblingColumn below,
  // same add/remove-column contract as her addSiblingColumn() JS.
  const [familyInfo, setFamilyInfo] = useState({
    motherName: '', motherCitizenship: '', motherDob: '', motherContact: '', motherEducation: '', motherEmployment: '',
    fatherName: '', fatherCitizenship: '', fatherDob: '', fatherContact: '', fatherEducation: '', fatherEmployment: '',
    guardianName: '', guardianCitizenship: '', guardianDob: '', guardianContact: '', guardianEducation: '', guardianEmployment: '',
    onlyChild: '', numSiblings: '',
    siblingCurrentStudent: '', siblingGraduate: '',
    emergencyContact: '', emergencyContactNumber: '',
    workingStudent: '',
    siblings: [
      { name: '', dob: '', civilStatus: '', contact: '', education: '' },
      { name: '', dob: '', civilStatus: '', contact: '', education: '' },
      { name: '', dob: '', civilStatus: '', contact: '', education: '' },
    ],
  })
  const updateFI = (field, value) => setFamilyInfo((f) => ({ ...f, [field]: value }))
  const updateSiblingCell = (index, field, value) => {
    setFamilyInfo((f) => {
      const siblings = [...f.siblings]
      siblings[index] = { ...siblings[index], [field]: value }
      return { ...f, siblings }
    })
  }
  const addSiblingColumn = () => {
    setFamilyInfo((f) => ({
      ...f,
      siblings: [...f.siblings, { name: '', dob: '', civilStatus: '', contact: '', education: '' }],
    }))
  }
  const removeSiblingColumn = (index) => {
    setFamilyInfo((f) => ({
      ...f,
      siblings: f.siblings.filter((_, i) => i !== index),
    }))
  }
  const updateEduCell = (level, field, value) =>
    setAcademicInfo((a) => ({ ...a, edu: { ...a.edu, [level]: { ...a.edu[level], [field]: value } } }))

  // Program lists, ported verbatim from Ivy's <option> lists (order
  // matters for the "None of the above" entry, which only appears on the
  // second choice).
  const PROGRAM_OPTIONS = [
    'Bachelor of Science in Accounting Information System',
    'Bachelor of Science in Accountancy',
    'Bachelor of Early Childhood Education',
    'Bachelor of Secondary Education Major in Filipino',
    'Bachelor of Secondary Education Major in English',
    'Bachelor of Elementary Education',
    'Bachelor of Secondary Education Major in Social Studies',
    'Bachelor of Secondary Education Major in Science',
    'Bachelor of Secondary Education Major in Mathematics',
    'Bachelor of Science in Computer Science',
    'Bachelor of Science in Information Technology',
    'Bachelor of Science in Psychology',
  ]

  const requiredAcademicInfoComplete =
    academicInfo.applyingAs &&
    academicInfo.termApplying &&
    academicInfo.choice1 &&
    academicInfo.choice2 &&
    academicInfo.edu.prim.school.trim() &&
    academicInfo.edu.prim.address.trim() &&
    academicInfo.edu.prim.section.trim() &&
    academicInfo.edu.prim.year.trim() &&
    // Sept 20 2026: Scholarship Matching & Filtering needs these three to
    // evaluate Appendix J's transferee rule (see app/lib/matching.js) —
    // only required when actually applying as a Transferee.
    (academicInfo.applyingAs !== 'Transferee' ||
      (String(academicInfo.transfereeGwa).trim() &&
        String(academicInfo.transfereeUnitsPassed).trim() &&
        academicInfo.transfereeFailingGrade))

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
  // "Click-to-Upload Profile Picture with Live Name Sync" (User Account
  // Module, Profile Management) — a local object-URL preview of whatever
  // photo was just picked, shown as a small avatar next to the applicant's
  // name as typed in Card 2, updating live with no upload/save round trip.
  // Revoked on replacement/unmount to avoid leaking blob URLs.
  const [profilePicPreviewUrl, setProfilePicPreviewUrl] = useState(null)
  // Grades / Form 138 upload, now living in the Educational Background
  // panel (moved out of the generic Documents & Status dropdown) — optional
  // per Ivy's spec, so no rejection-message state needed beyond the shared
  // inline status the row already surfaces.
  const [form138Status, setForm138Status] = useState('idle')
  // Medical Examination Results/Certificate upload, Health & Wellness panel.
  // Optional per Ivy's spec (its copy just notes it's meant to be completed
  // "only once you have passed the applicant examination" — descriptive,
  // not an actual gate/disable in her markup either).
  const [medcertStatus, setMedcertStatus] = useState('idle')
  // Family & Financial panel uploads — parentid (required), employmentcert
  // (required only when workingStudent === 'Yes'), indigency (optional).
  // Same idle/uploading/done/flagged/rejected/error/queued contract as
  // every other inline upload row in this file.
  const [parentIdStatus, setParentIdStatus] = useState('idle')
  const [parentIdRejection, setParentIdRejection] = useState(null)
  const [employmentCertStatus, setEmploymentCertStatus] = useState('idle')
  const [indigencyStatus, setIndigencyStatus] = useState('idle')

  // ---- Appeals & Rescheduling panel (Rescheduling half only — see
  // app/api/reschedule/route.js header comment for why "Appeal for
  // Retake/Re-application" is deliberately excluded) ----
  const [rescheduleType, setRescheduleType] = useState('')
  const [rescheduleDetails, setRescheduleDetails] = useState('')
  const [rescheduleSaveState, setRescheduleSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [rescheduleHistory, setRescheduleHistory] = useState([])
  const [supportDocStatus, setSupportDocStatus] = useState('idle')
  const [supportDocRejection, setSupportDocRejection] = useState(null)
  // Messages panel — Sept 22 2026: wired to the real /api/portal-messages
  // feed now that the admin-side Communications panel can actually author
  // announcements/messages (see app/api/announcements/route.js and
  // app/api/portal-messages/route.js). messagesFilter still just controls
  // which of the fetched posts show (All/Announcements/Messages), same as
  // before. Deliberately left out: her mockup's per-item read/unread
  // tracking (isNotifRead, a localStorage concept in her version) — this
  // shows every post every time rather than half-building a read-state
  // feature; can come back as its own pass if that's wanted.
  const [messagesFilter, setMessagesFilter] = useState('all')
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState('')

  useEffect(() => {
    fetch('/api/portal-messages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMessages(data.posts)
        else setMessagesError(data.error || 'Failed to load messages.')
      })
      .catch((err) => setMessagesError(err.message))
      .finally(() => setMessagesLoading(false))
  }, [])

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

  // The persisted profile photo's signed URL, if one exists — GET
  // /api/upload now orders newest-first, so .find() here always picks the
  // current photo even after a re-upload/replace, not a stale earlier one.
  // Shared by Card 1's Live Name Sync preview and the sidebar avatar so
  // both actually show the same photo, matching Card 1's own "used across
  // your application and account" copy.
  const persistedProfilePicUrl = myDocs.find((d) => d.document_type === 'profilepic')?.publicUrl

  // The History drawer reuses this same filtered list — it should only ever
  // show documents matching the name currently typed in, not every
  // applicant's uploads. Note: this is a UX/privacy-hygiene fix, not real
  // access control — anyone could type someone else's name. Real security
  // needs a login system (Ivy's User Account Module), which doesn't exist
  // yet. This just stops the careless "show everyone by default" behavior.
  const visibleHistory = myDocs

  // Sept 19 2026 fix: this used to count `needs_review` across every
  // upload in history, including superseded re-upload attempts — so a
  // document that was flagged once and then successfully re-uploaded
  // (verified) still counted as "needs review" here forever, because the
  // original flagged attempt was still sitting in the list. Dedupe down
  // to the latest attempt per document type first (visibleHistory is
  // already newest-first, same as DocumentStatusTable's own
  // findLatestForType() fix), so this only reflects the CURRENT status of
  // each document, matching what the Documents & Status table shows.
  const latestDocsByType = (() => {
    const seen = new Set()
    const latest = []
    for (const doc of visibleHistory) {
      if (seen.has(doc.document_type)) continue
      seen.add(doc.document_type)
      latest.push(doc)
    }
    return latest
  })()
  const flaggedCount = latestDocsByType.filter((doc) => doc.needs_review).length

  // Same required-field bar as submitSection('financial')'s own missing-
  // fields check further down — kept in sync by hand since that check
  // also needs to build a human-readable missing-items list, which this
  // boolean doesn't. Used by the Dashboard's Profile Completion count.
  const requiredFamilyInfoComplete =
    familyInfo.motherName.trim() &&
    familyInfo.fatherName.trim() &&
    familyInfo.onlyChild &&
    (familyInfo.onlyChild !== 'No' || (String(familyInfo.numSiblings).trim() && familyInfo.siblingCurrentStudent && familyInfo.siblingGraduate)) &&
    familyInfo.emergencyContact.trim() &&
    (parentIdStatus === 'done' || hasUploaded('parentid')) &&
    familyInfo.workingStudent &&
    (familyInfo.workingStudent !== 'Yes' || employmentCertStatus === 'done' || hasUploaded('employmentcert'))

  // Used by the status table's "Upload" / "Re-upload" buttons: pre-selects
  // that document type in the form below and scrolls it into view.
  const jumpToUploadFor = (typeValue) => {
    setDocumentType(typeValue)
    setFile(null)
    setActivePanel('status')
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
          academicInfo,
          healthInfo,
          familyInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Save failed')
      if (data.application?.application_number) setApplicationNumber(data.application.application_number)
      setSaveState('saved')
      // The server copy is now current — the local safety-net copy for
      // this applicant is no longer needed until something changes again
      // (the autosave effect below will recreate it on the next edit).
      clearDraftLocal(applicantName)
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (err) {
      console.error('Auto-save failed:', err)
      if (isNetworkError(err)) {
        // Couldn't reach the server at all — the autosave effect already
        // keeps a local copy up to date, so nothing is actually lost.
        // Say so plainly instead of showing a generic "couldn't save".
        await saveDraftLocal(applicantName, { personalInfo, academicInfo, healthInfo, familyInfo, applicantEmail, step: targetStep })
        setSaveState('offline')
        setTimeout(() => setSaveState('idle'), 4000)
      } else {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      }
    }
  }

  // "Submit Section" — the per-panel button next to "Save as Draft" on
  // Personal Info / Educational Background, matching applicant.html's
  // submitSection(). Marks that one section as explicitly submitted
  // (personal_info_submitted_at / academic_submitted_at) without touching
  // the application's overall status. Mirrors the spec's own validation:
  // Personal Information requires its three inline uploads to be in before
  // it'll submit; Educational Background has no such gate but is the one
  // section that locks for good afterward (see the `disabled` props wired
  // to academicSubmittedAt throughout its panel above).
  const submitSection = async (section) => {
    if (!applicantName.trim()) return
    setSectionErrors((e) => ({ ...e, [section]: '' }))

    if (section === 'personal') {
      const missing = []
      if (!(profilePicStatus === 'done' || hasUploaded('profilepic'))) missing.push('Profile Picture')
      if (!(birthCertStatus === 'done' || hasUploaded('birthcert'))) missing.push('Birth Certificate / PSA / NSO')
      if (!(voterIdStatus === 'done' || hasUploaded('voterid'))) missing.push("Voter's ID / Certification of Applicant")
      if (missing.length) {
        setSectionErrors((e) => ({
          ...e,
          personal: `Please upload the following required document(s) before submitting: ${missing.join(', ')}`,
        }))
        return
      }
    }

    if (section === 'financial') {
      const missing = []
      if (!familyInfo.motherName.trim()) missing.push("Mother's Name")
      if (!familyInfo.fatherName.trim()) missing.push("Father's Name")
      if (!familyInfo.onlyChild) missing.push('Are you an only child?')
      if (familyInfo.onlyChild === 'No') {
        if (!String(familyInfo.numSiblings).trim()) missing.push('Number of Siblings')
        if (!familyInfo.siblingCurrentStudent) missing.push('Sibling currently a CCC student?')
        if (!familyInfo.siblingGraduate) missing.push('Sibling graduated from CCC?')
      }
      if (!familyInfo.emergencyContact.trim()) missing.push('Person to be Notified in Case of Emergency')
      if (!(parentIdStatus === 'done' || hasUploaded('parentid'))) missing.push("Voter's ID / Certification of Parent/Guardian")
      if (!familyInfo.workingStudent) missing.push('Are you a working student?')
      if (familyInfo.workingStudent === 'Yes' && !(employmentCertStatus === 'done' || hasUploaded('employmentcert'))) {
        missing.push('Proof of Employment')
      }
      if (missing.length) {
        setSectionErrors((e) => ({
          ...e,
          financial: `Please complete the following before submitting: ${missing.join(', ')}`,
        }))
        return
      }
    }

    const setState =
      section === 'personal' ? setPersonalSectionState
      : section === 'academic' ? setAcademicSectionState
      : section === 'health' ? setHealthSectionState
      : setFinancialSectionState
    setState('submitting')
    try {
      const res = await fetch('/api/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          step: section === 'personal' ? 1 : section === 'academic' ? 2 : section === 'financial' ? 5 : 4,
          action: 'submit-section',
          section,
          personalInfo,
          academicInfo,
          healthInfo,
          familyInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Submit failed')
      if (section === 'personal') setPersonalSubmittedAt(data.application.personal_info_submitted_at)
      if (section === 'academic') setAcademicSubmittedAt(data.application.academic_submitted_at)
      if (section === 'health') setHealthSubmittedAt(data.application.health_submitted_at)
      if (section === 'financial') setFinancialSubmittedAt(data.application.fam_financial_submitted_at)
      // Not scoped to a particular section — the required-documents check
      // runs on every save regardless of which section was just submitted,
      // so this section's submit could be the one that pushes an
      // already-complete document set over the line.
      if (data.application.application_number) setApplicationNumber(data.application.application_number)
      setState('submitted')
      setTimeout(() => setState('idle'), 1800)
    } catch (err) {
      console.error('Submit section failed:', err)
      setSectionErrors((e) => ({ ...e, [section]: 'Could not submit this section — try again.' }))
      setState('error')
      setTimeout(() => setState('idle'), 3000)
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
          academicInfo,
          healthInfo,
          familyInfo,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Submit failed')
      setSaveState('idle')
      setSubmitted(true)
      setSubmittedAt(data.application.submitted_at || null)
      if (data.application.application_number) setApplicationNumber(data.application.application_number)
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
        setLocalDraftFound(null)
        return
      }
      setDraftFound(null)
    } catch (err) {
      // Couldn't reach Supabase to check for a draft — this is exactly
      // the "closed the browser while offline, came back" case the local
      // copy exists for. Offer that instead, rather than silently
      // looking like there's nothing to resume.
      console.error('Draft lookup failed, checking local copy instead:', err)
      setDraftFound(null)
      const local = await loadDraftLocal(name)
      setLocalDraftFound(local)
      return
    }
    // Even when the DB check succeeds cleanly with nothing to resume,
    // still check locally — covers the case where a save attempt failed
    // partway through and was never confirmed by Supabase.
    const local = await loadDraftLocal(name)
    setLocalDraftFound(local)
  }

  // Once logged in, this is your own verified data, not an ambiguous "does
  // this name belong to you?" situation — so instead of showing the
  // "resume draft?" banner and waiting for a click (see checkForDraft /
  // draftFound above, kept as-is for the fallback offline-local-draft
  // path), auto-load whatever's already saved under this account the
  // moment the session is known.
  // Sept 19 2026, second pass: this used to bail out entirely whenever
  // `applicantName` was blank ("nothing to look up yet") — but a blank
  // name is exactly the state a logged-in applicant could get stuck in if
  // the name baked into their session ever drifted from what their row is
  // actually saved under (see the POST handler's comment for the chain of
  // bugs that caused that). The account's own email is known the moment
  // you're logged in, whether or not the name is right, so it's now
  // always sent too and /api/application matches on whichever of
  // name/email/account-id actually finds the row.
  useEffect(() => {
    if (!accountSession) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (applicantName.trim()) params.set('name', applicantName.trim())
        if (accountSession.email) params.set('email', accountSession.email)
        const res = await fetch(`/api/application?${params.toString()}`)
        const data = await res.json()
        if (cancelled || !data.application) return
        setPersonalInfo(mapDbRowToPersonalInfo(data.application))
        setAcademicInfo(mapDbRowToAcademicInfo(data.application))
        setHealthInfo(mapDbRowToHealthInfo(data.application))
        setFamilyInfo(mapDbRowToFamilyInfo(data.application))
        setPersonalSubmittedAt(data.application.personal_info_submitted_at || null)
        setAcademicSubmittedAt(data.application.academic_submitted_at || null)
        setHealthSubmittedAt(data.application.health_submitted_at || null)
        setFinancialSubmittedAt(data.application.fam_financial_submitted_at || null)
        setApplicationNumber(data.application.application_number || null)
        // Keeps `applicantName` in sync with whatever this row is actually
        // saved under, so every save/submit for the rest of this session
        // targets the exact same row instead of depending on the name
        // having been right at mount time.
        if (data.application.applicant_name && data.application.applicant_name.trim() !== applicantName.trim()) {
          setApplicantName(data.application.applicant_name.trim())
        }
        // Resumed applications weren't restoring the final-submission state
        // at all before — a returning applicant who'd already submitted
        // saw the Submit button again instead of the "submitted" message.
        // Needed here anyway for the Activity Log below to be accurate on
        // reload, not just right after clicking Submit.
        setSubmitted(data.application.status === 'submitted')
        setSubmittedAt(data.application.submitted_at || null)
      } catch (err) {
        console.error('Auto-load of saved application failed (will retry via manual resume banner if needed):', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accountSession])

  // Keeps a local (IndexedDB) copy of the current draft in sync with every
  // edit, debounced so it's not writing on every keystroke. This is the
  // actual safety net — by the time a "Save progress" click or connection
  // failure happens, the local copy is already current.
  useEffect(() => {
    if (!applicantName.trim()) return
    const timer = setTimeout(() => {
      saveDraftLocal(applicantName, { personalInfo, academicInfo, healthInfo, familyInfo, applicantEmail, step: activePanel })
    }, 1200)
    return () => clearTimeout(timer)
  }, [applicantName, applicantEmail, personalInfo, academicInfo, healthInfo, familyInfo, activePanel])

  // Keeps the "documents waiting to upload" count current, and retries
  // everything queued once the browser reports it's back online. Runs
  // once on mount (in case there was already a queue from a previous,
  // now-closed session) and again on every online event.
  useEffect(() => {
    let cancelled = false

    const refreshQueueCount = async () => {
      const queued = await getQueuedUploads(applicantName)
      if (!cancelled) setQueuedUploadCount(queued.length)
    }
    refreshQueueCount()

    const retryQueue = async () => {
      const queued = await getQueuedUploads()
      const hadQueued = queued.length > 0
      for (const entry of queued) {
        try {
          await uploadDocument(entry.docType, entry.file)
          await removeQueuedUpload(entry.id)
        } catch (err) {
          // Still can't reach the server (a brief "online" flicker that
          // didn't actually hold) — leave it queued, it'll retry on the
          // next online event.
          console.error('Retrying queued upload failed, will try again later:', err)
        }
      }
      if (!cancelled) {
        fetchHistory()
        const remaining = await getQueuedUploads(applicantName)
        setQueuedUploadCount(remaining.length)
        if (hadQueued && remaining.length === 0) {
          setJustSynced(true)
          setTimeout(() => setJustSynced(false), 5000)
        }
      }
    }

    const unsubscribe = onConnectivityChange((online) => {
      setIsOffline(!online)
      if (online) {
        // Acknowledge the reconnect immediately, independent of whether
        // there's anything queued to sync — without this, coming back
        // online after a stretch with nothing queued was silent, which
        // read as "did it even notice I'm back?"
        setJustReconnected(true)
        setTimeout(() => setJustReconnected(false), 4000)
        retryQueue()
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applicantName])

  // Set the initial offline state on mount — onConnectivityChange only
  // fires on a *change*, so this catches "already offline when the page
  // loaded" (e.g. opening the app with no signal at all).
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOffline(!navigator.onLine)
  }, [])

  // If the name field gets cleared, hide the status table again — next time
  // requires a deliberate click, same as the first time.
  useEffect(() => {
    if (applicantName.trim().length === 0 && statusRequested) {
      setStatusRequested(false)
    }
  }, [applicantName, statusRequested])

  // Release the profile-picture preview's blob URL on unmount so it isn't
  // leaked — replacement already revokes the previous one inline (see
  // InlineUploadRow's onFileSelected for Card 1).
  useEffect(() => {
    return () => {
      if (profilePicPreviewUrl) URL.revokeObjectURL(profilePicPreviewUrl)
    }
  }, [profilePicPreviewUrl])

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

  // Sept 20 2026: Grades (Form 138) is now a required upload — CCC's own
  // guidelines (Appendix J) list a Grade 11/12 report card as required for
  // freshmen, and this was previously left optional by mistake. Kept as its
  // own const (not folded into requiredAcademicInfoComplete above) because
  // form138Status/hasUploaded aren't defined yet at that point in the file.
  const requiredAcademicUploadsComplete =
    form138Status === 'done' || form138Status === 'flagged' || hasUploaded('form138')

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

  // Reschedule request history — fetched whenever the Appeals panel is open
  // and a name is typed in, same lazy-fetch pattern as the rest of the app
  // (no accounts, so there's nothing to fetch until a name exists).
  const fetchRescheduleHistory = async () => {
    if (!applicantName.trim()) {
      setRescheduleHistory([])
      return
    }
    try {
      const res = await fetch(`/api/reschedule?name=${encodeURIComponent(applicantName.trim())}`)
      const data = await res.json()
      if (data.success) setRescheduleHistory(data.requests)
    } catch (err) {
      console.error('Failed to fetch reschedule history (non-blocking):', err)
    }
  }

  useEffect(() => {
    if (activePanel === 'appeals') fetchRescheduleHistory()
  }, [activePanel, applicantName])

  const submitReschedule = async () => {
    if (!applicantName.trim() || !rescheduleType || !rescheduleDetails.trim()) return
    setRescheduleSaveState('saving')
    try {
      const res = await fetch('/api/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: applicantName.trim(),
          applicantEmail: applicantEmail.trim(),
          requestType: rescheduleType,
          details: rescheduleDetails.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Submit failed')
      setRescheduleSaveState('saved')
      setRescheduleType('')
      setRescheduleDetails('')
      fetchRescheduleHistory()
      setTimeout(() => setRescheduleSaveState('idle'), 2500)
    } catch (err) {
      console.error('Reschedule submit failed:', err)
      setRescheduleSaveState('error')
      setTimeout(() => setRescheduleSaveState('idle'), 3000)
    }
  }

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
      } else if (isNetworkError(err)) {
        // Couldn't reach the server at all — hold onto the actual file and
        // retry automatically once back online, instead of making the
        // applicant notice the failure and redo it later.
        await queueUpload({ docType: documentType, file, applicantName: applicantName.trim(), applicantEmail: applicantEmail.trim() })
        setQueuedUploadCount((c) => c + 1)
        setDetails(null)
        setStatus('No connection right now — this file is saved on your device and will upload automatically once you\u2019re back online.')
        setFile(null)
        setDocumentType('')
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
      } else if (isNetworkError(err)) {
        // Same as the Step 2 form: hold the file locally and retry
        // automatically once connectivity returns.
        await queueUpload({ docType, file: uploadFile, applicantName: applicantName.trim(), applicantEmail: applicantEmail.trim() })
        setQueuedUploadCount((c) => c + 1)
        setInlineStatus('queued')
      } else {
        setInlineStatus('error')
      }
    }
  }

  return (
    <main className="applicant-portal min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader
        topbarLabel="(049) 559-8900 to 8907 / (02) 8-539-5170 to 5171"
        topbarLink={{ href: 'https://www.ccc.edu.ph', label: 'www.ccc.edu.ph' }}
        subtitle="Scholarship Portal"
        logos={[
          { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
          { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
          { src: '/LOGO_CCC_Registrar.png', alt: 'CCC Registrar Logo' },
        ]}
      />

      {isOffline && (
        <div className="w-full bg-red-50 border-b border-red-200 text-center py-2.5 px-4">
          <p className="text-xs font-semibold text-red-700">
            You&rsquo;re currently offline. Anything you type or upload is being saved on this device &mdash;
            keep this tab open, or reopen it once you have a signal, and it will finish saving automatically.
          </p>
        </div>
      )}

      {!isOffline && queuedUploadCount > 0 && (
        <div className="w-full bg-ccc-gold/15 border-b border-ccc-gold/30 text-center py-2 px-4">
          <p className="text-xs font-semibold text-ccc-navy">
            {queuedUploadCount} document{queuedUploadCount === 1 ? '' : 's'} saved on this device, waiting for a connection to upload automatically.
          </p>
        </div>
      )}

      {!isOffline && queuedUploadCount === 0 && justSynced && (
        <div className="w-full bg-green-50 border-b border-ccc-green/30 text-center py-2 px-4">
          <p className="text-xs font-semibold text-ccc-green">
            You&rsquo;re back online &mdash; everything saved on this device has finished uploading.
          </p>
        </div>
      )}

      {!isOffline && queuedUploadCount === 0 && !justSynced && justReconnected && (
        <div className="w-full bg-green-50 border-b border-ccc-green/30 text-center py-2 px-4">
          <p className="text-xs font-semibold text-ccc-green">
            You&rsquo;re back online.
          </p>
        </div>
      )}

      <div className="portal-shell">
        <PortalSidebar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          displayName={applicantName.trim() || `${personalInfo.firstName} ${personalInfo.lastName}`.trim()}
          avatarInitials={
            (personalInfo.firstName?.[0] || applicantName.trim()?.[0] || '').toUpperCase() +
            (personalInfo.lastName?.[0] || applicantName.trim().split(' ')[1]?.[0] || '').toUpperCase()
          }
          avatarUrl={profilePicPreviewUrl || persistedProfilePicUrl}
          applicationNumber={applicationNumber}
          messagesCount={messages.length}
          flaggedCount={flaggedCount}
          onLogout={() => setLogoutConfirmOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          historyCount={applicantName.trim() ? visibleHistory.length : 0}
        />

        <LogoutConfirmModal
          open={logoutConfirmOpen}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={() => {
            setLogoutConfirmOpen(false)
            onLogout()
          }}
        />

        <div ref={formCardRef} className="portal-main space-y-6">
          {/* ══════════ DASHBOARD — rebuilt to applicant.html's exact structure
              (design-parity pass 4, Sept 19 2026): .status-hero card,
              .section-divider chip, .stat-grid with locked/unlocked cards,
              .tab-connector arrow, and the "Complete Your Profile"
              .timeline stepper. Still real/data-driven underneath, same as
              before — no fake numbers. Profile Completion and Document
              Verification are real and clickable; Exam Schedule / Medical
              Status / Admission stay honestly locked — those depend on
              Ivy's Applicant Info & Results / Scholarship Matching
              modules, which don't exist yet. Only Profile Completion is
              wired as the connector's "active" card (spec's own default
              state): Document Verification links out to its own real
              panel instead of driving the connector, since it doesn't have
              a matching stepper to show. ══════════ */}
          {activePanel === 'dashboard' && (() => {
            const personalDone = requiredPersonalInfoComplete && requiredInlineUploadsComplete
            const academicDone = requiredAcademicInfoComplete && requiredAcademicUploadsComplete
            const familyDone = !!requiredFamilyInfoComplete
            // Health & Wellness has no required fields in Ivy's spec (Medical
            // Status and the exam-gated upload are both optional), so there's
            // no field-completeness bar to clear like the other three —
            // "done" here just means the applicant explicitly submitted it.
            const healthDone = !!healthSubmittedAt
            const allProfileDone = personalDone && academicDone && familyDone && healthDone
            const profileSectionsDone = [personalDone, academicDone, familyDone, healthDone].filter(Boolean).length
            const stepNum = !allProfileDone ? 2 : !submitted ? 3 : 3
            const stepLabel = !allProfileDone ? 'Filling Out Profile' : !submitted ? 'Uploading Documents' : 'Awaiting Document Verification'
            const nextAction = !personalDone
              ? { label: 'Complete your Personal Information', panel: 'personal' }
              : !academicDone
              ? { label: 'Complete your Educational Background', panel: 'academic' }
              : !familyDone
              ? { label: 'Complete your Family & Financial Information', panel: 'financial' }
              : !healthDone
              ? { label: 'Complete your Health & Wellness section', panel: 'health' }
              : !submitted
              ? { label: 'Submit your documents for review', panel: 'status' }
              : null

            return (
              <div>
                <div className="portal-header">
                  <h1>Welcome back{applicantName.trim() ? `, ${applicantName.trim().split(' ')[0]}` : ''}!</h1>
                  <p>Here&rsquo;s a quick look at your scholarship application progress with the City College of Calamba.</p>
                </div>

                <div className="card status-hero">
                  <p className="status-hero-eyebrow">Application Status</p>
                  <div className="status-hero-value">
                    <span className="badge badge-progress">Step {stepNum} of 6 &middot; {stepLabel}</span>
                  </div>
                  <p className="status-hero-desc">
                    {submitted
                      ? "Your application is submitted and on file. You'll see document statuses update on the Documents & Status panel as they're reviewed."
                      : myDocs.length > 0
                      ? "You've started your application. Keep working through the sections below, then submit from Documents & Status when you're ready."
                      : "You've created and verified your account. You're now completing your applicant profile."}
                  </p>
                  {nextAction && (
                    <div className="status-hero-next">
                      <div>
                        <div className="next-label">Next Step</div>
                        <div className="next-action">{nextAction.label}</div>
                      </div>
                      <a
                        href="#"
                        className="next-action-btn"
                        onClick={(e) => {
                          e.preventDefault()
                          setActivePanel(nextAction.panel)
                        }}
                      >
                        Continue &rarr;
                      </a>
                    </div>
                  )}
                </div>

                <div className="section-divider">
                  <div className="section-divider-chip">
                    <span className="divider-icon">&#128275;</span> Progress Milestones
                  </div>
                </div>
                <p className="section-divider-sub">Each milestone below unlocks as you clear the corresponding step in the application process.</p>

                <div className="stat-grid">
                  {/* Profile Completion — real, and the connector's active card */}
                  <div className="stat-card unlocked-clickable tab-active" onClick={() => setActivePanel('personal')} role="button" tabIndex={0}>
                    <div className="stat-label">Profile Completion</div>
                    <div className="stat-value">{profileSectionsDone} of 4 sections done</div>
                    <div className="stat-progress">
                      <div className="stat-progress-bar" style={{ width: `${(profileSectionsDone / 4) * 100}%` }} />
                    </div>
                    <div className="stat-note">Personal Information, Educational Background, Family &amp; Financial Information, and Health &amp; Wellness.</div>
                    <div className="stat-card-hint">&#9660; Viewing details below</div>
                  </div>

                  {/* Document Verification — real */}
                  <div className="stat-card unlocked-clickable" onClick={() => setActivePanel('status')} role="button" tabIndex={0}>
                    <div className="stat-label">Document Verification</div>
                    {myDocs.length === 0 ? (
                      <div className="stat-value stat-locked">No documents yet</div>
                    ) : (
                      <div className="stat-value">
                        {latestDocsByType.length - flaggedCount} verified{flaggedCount > 0 ? `, ${flaggedCount} needs review` : ''}
                      </div>
                    )}
                    <div className="stat-note">View and manage your uploaded documents.</div>
                  </div>

                  {/* Locked — genuinely blocked on Ivy's modules, not built anywhere */}
                  <div className="stat-card locked">
                    <div className="stat-lock-badge">&#128274;</div>
                    <div className="stat-label">Exam Schedule</div>
                    <div className="stat-value stat-locked">Locked</div>
                    <div className="stat-note">Blocked on Ivy&rsquo;s Applicant Information &amp; Results Module (exam score entry) &mdash; not built.</div>
                  </div>

                  <div className="stat-card locked">
                    <div className="stat-lock-badge">&#128274;</div>
                    <div className="stat-label">Medical Status</div>
                    <div className="stat-value stat-locked">Locked</div>
                    <div className="stat-note">Unlocks once you&rsquo;ve passed the applicant examination.</div>
                  </div>

                  <div className="stat-card locked">
                    <div className="stat-lock-badge">&#128274;</div>
                    <div className="stat-label">Admission</div>
                    <div className="stat-value stat-locked">Locked</div>
                    <div className="stat-note">Blocked on Ivy&rsquo;s Scholarship Matching &amp; Filtering Module &mdash; not built.</div>
                  </div>
                </div>

                <div className="tab-connector">
                  <div className="tab-connector-arrow" />
                </div>

                <div className="card tab-content-card">
                  <div className="card-title">
                    Complete Your Profile <span className="tag">Required for matching</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '12.45px', color: 'var(--muted)', marginBottom: '15px' }}>
                      Fill out the sections below so Iskolusyon can automatically match you to scholarship programs you qualify for.
                    </p>
                    <div className="timeline">
                      <div className="timeline-item">
                        <div className={`timeline-dot ${personalDone ? 'step-done' : 'step-ongoing'}`}>{personalDone ? '✓' : 1}</div>
                        <div className="timeline-body">
                          <h4>Account Setup &amp; Personal Information</h4>
                          <p>
                            {personalDone ? (
                              'Completed.'
                            ) : (
                              <>
                                Currently ongoing &mdash;{' '}
                                <a href="#" style={{ color: 'var(--ccc-blue)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActivePanel('personal') }}>
                                  continue &rarr;
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`timeline-dot ${academicDone ? 'step-done' : personalDone ? 'step-ongoing' : 'step-notstarted'}`}>
                          {academicDone ? '✓' : 2}
                        </div>
                        <div className="timeline-body">
                          <h4>Educational Background</h4>
                          <p>
                            {academicDone ? (
                              'Completed.'
                            ) : (
                              <>
                                {personalDone ? 'Currently ongoing' : 'Not yet started'} &mdash;{' '}
                                <a href="#" style={{ color: 'var(--ccc-blue)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActivePanel('academic') }}>
                                  {personalDone ? 'continue' : 'complete now'} &rarr;
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`timeline-dot ${familyDone ? 'step-done' : academicDone ? 'step-ongoing' : 'step-notstarted'}`}>
                          {familyDone ? '✓' : 3}
                        </div>
                        <div className="timeline-body">
                          <h4>Family &amp; Financial Information</h4>
                          <p>
                            {familyDone ? (
                              'Completed.'
                            ) : (
                              <>
                                {academicDone ? 'Currently ongoing' : 'Not yet started'} &mdash;{' '}
                                <a href="#" style={{ color: 'var(--ccc-blue)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActivePanel('financial') }}>
                                  {academicDone ? 'continue' : 'complete now'} &rarr;
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`timeline-dot ${healthDone ? 'step-done' : familyDone ? 'step-ongoing' : 'step-notstarted'}`}>
                          {healthDone ? '✓' : 4}
                        </div>
                        <div className="timeline-body">
                          <h4>Health &amp; Wellness</h4>
                          <p>
                            {healthDone ? (
                              'Completed.'
                            ) : (
                              <>
                                {familyDone ? 'Currently ongoing' : 'Not yet started'} &mdash;{' '}
                                <a href="#" style={{ color: 'var(--ccc-blue)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActivePanel('health') }}>
                                  {familyDone ? 'continue' : 'complete now'} &rarr;
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ══════════ MESSAGES (Sept 22 2026: now wired to the real feed
              from /api/portal-messages, now that the admin side has a
              real Communications panel to author from) ══════════ */}
          {activePanel === 'messages' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow eyebrow-yellow">Notifications</p>
                <h1>Messages</h1>
                <p>Updates on exam schedules, results, and requirements from the Guidance (GCTCDO) office. And allowance from the Office of the Registrar.</p>
              </div>

              <div className="card">
                <div className="post-type-toggle">
                  {[['all', 'All'], ['announcement', 'Announcements'], ['message', 'Messages']].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMessagesFilter(key)}
                      className={`post-type-btn${messagesFilter === key ? ' active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="comm-scope-note">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <span>
                    {messagesFilter === 'all' && (
                      <>
                        Showing everything received &mdash; <b>Announcements</b> sent to all applicants (and posted on the guest page), plus <b>Messages</b> sent to you individually or to your applicant category.
                      </>
                    )}
                    {messagesFilter === 'announcement' && (
                      <>
                        Showing <b>Announcements</b> only &mdash; these are sent to all applicants and also posted on the guest (public) page.
                      </>
                    )}
                    {messagesFilter === 'message' && (
                      <>
                        Showing <b>Messages</b> only &mdash; these are private, sent to you individually or to your applicant category, and never shown on the guest page.
                      </>
                    )}
                  </span>
                </div>
                {(() => {
                  const filtered = messages.filter((m) => messagesFilter === 'all' || m.type === messagesFilter)
                  if (messagesLoading) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px 15px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Loading…</p>
                      </div>
                    )
                  }
                  if (messagesError) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px 15px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ccc-red)' }}>{messagesError}</p>
                      </div>
                    )
                  }
                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px 15px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
                          No {messagesFilter === 'all' ? 'messages' : messagesFilter + 's'} yet.
                        </p>
                        <p style={{ fontSize: '11.25px', color: 'var(--muted)', marginTop: '6px' }}>
                          You&rsquo;ll get an email confirmation when you submit your application, and anything the
                          Guidance office sends you will show up here.
                        </p>
                      </div>
                    )
                  }
                  return filtered.map((m) => (
                    <div key={m.id} className="message-item">
                      <div className="message-dot">{m.type === 'message' ? '✉️' : '📣'}</div>
                      <div className="message-body">
                        <h4>{m.title}</h4>
                        <p>{m.body}</p>
                        <span className="message-date">
                          {m.created_at
                            ? new Date(m.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                            : ''}
                          {m.category ? ` · ${m.category}` : ''}
                        </span>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* ══════════ PERSONAL INFORMATION (built — cards 1-6 ported as-is) ══════════ */}
          {activePanel === 'personal' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Personal Information</h1>
                <p>This section establishes your legal identity and residency to qualify as CCC&rsquo;s scholar.</p>
              </div>

              {/* The old top-of-panel "Applicant name"/"Applicant email" block
                  (not part of Ivy's spec — this panel only renders inside
                  PortalApp, which is only reached once accountSession exists,
                  so those fields were always disabled/read-only in practice)
                  has been removed. Email now lives where the spec puts it —
                  inside Card 3, Contact & Residency, below. Name still comes
                  from the account + Card 2's First/Middle/Last Name fields. */}

              {/* ---------- Card 1: Profile Picture ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">1</span> Profile Picture
                  </span>
                </div>
                <p className="topic-card-intro">This photo is used across your application and account.</p>
                {(() => {
                  // Falls back to the persisted photo's signed URL when
                  // there's no fresh local pick this visit — otherwise a
                  // returning applicant who uploaded their photo in an
                  // earlier session saw a blank placeholder icon here
                  // instead of their actual photo (found testing Sept 19).
                  const displayUrl = profilePicPreviewUrl || persistedProfilePicUrl
                  if (!displayUrl && !personalInfo.firstName && !personalInfo.lastName) return null
                  return (
                    <div className="flex items-center gap-3 rounded-lg bg-ccc-off/60 px-3 py-2.5">
                      <div className="w-11 h-11 rounded-full bg-white border border-ccc-border overflow-hidden shrink-0 flex items-center justify-center">
                        {displayUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={displayUrl} alt="Profile preview" className="w-full h-full object-cover" />
                        ) : (
                          <IconUpload className="w-4 h-4 text-ccc-muted" />
                        )}
                      </div>
                      <div className="text-sm font-bold text-ccc-navy truncate">
                        {[personalInfo.firstName, personalInfo.middleName, personalInfo.lastName].filter(Boolean).join(' ') ||
                          'Your name will appear here as you type it below'}
                      </div>
                    </div>
                  )
                })()}
                <InlineUploadRow
                  label="Profile Picture"
                  sublabel="A clear, recent 2x2 photo of yourself (white background)"
                  required
                  status={profilePicStatus === 'idle' && hasUploaded('profilepic') ? 'done' : profilePicStatus}
                  onFileSelected={(f) => {
                    setProfilePicPreviewUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev)
                      return URL.createObjectURL(f)
                    })
                    handleInlineUpload('profilepic', f, setProfilePicStatus, setProfilePicRejection)
                  }}
                />
                {profilePicRejection && <QualityRejectionAlert message={profilePicRejection} />}
              </div>

              {/* ---------- Card 2: Identity & Civil Status ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">2</span> Identity &amp; Civil Status
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <p className="topic-card-intro">These fields auto-fill once you upload your Birth Certificate below. Document text extraction isn&rsquo;t always perfect, so you can still correct any field manually.</p>
                <div className="form-grid">
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
                  <div className="form-grid">
                    <div className="mfield full" style={{ marginBottom: '6px' }}>
                      <p style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: '11.25px', letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--navy)', margin: 0 }}>
                        If Married
                      </p>
                    </div>
                    <TextField label="Spouse's Name" value={personalInfo.spouseName} onChange={(v) => updatePI('spouseName', v)} placeholder="e.g. Maria Dela Cruz" />
                    <TextField label="Spouse's Occupation" value={personalInfo.spouseOccupation} onChange={(v) => updatePI('spouseOccupation', v)} placeholder="e.g. Teacher" />
                    <TextField full label="Spouse's Contact Number" type="tel" value={personalInfo.spouseContact} onChange={(v) => updatePI('spouseContact', sanitizePhoneInput(v))} placeholder="e.g. 0917 123 4567" />
                  </div>
                )}
                <div className="topic-doc-section">
                  <div className="topic-doc-label">
                    Verifying Document <span className="tdl-count">1 required</span>
                  </div>
                  <InlineUploadRow
                    label="Birth Certificate / PSA / NSO"
                    sublabel="Issued by the Philippine Statistics Authority"
                    required
                    status={birthCertStatus === 'idle' && hasUploaded('birthcert') ? 'done' : birthCertStatus}
                    onFileSelected={(f) => handleInlineUpload('birthcert', f, setBirthCertStatus, setBirthCertRejection)}
                  />
                  {birthCertRejection && <QualityRejectionAlert message={birthCertRejection} />}
                </div>
              </div>

              {/* ---------- Card 3: Contact & Residency ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">3</span> Contact &amp; Residency
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <p className="topic-card-intro">Your address and precinct number auto-fill once you upload your Voter&rsquo;s ID below.</p>
                <div className="form-grid">
                  <div className="mfield full">
                    <TextField label="Email Address" type="email" required value={applicantEmail} onChange={() => {}} placeholder="e.g. juandelacruz@gmail.com" disabled />
                    <p className="field-note">Your account&rsquo;s verified sign-in email.</p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={personalInfo.emailUpdatesOptIn} onChange={(e) => updatePI('emailUpdatesOptIn', e.target.checked)} style={{ width: '15px', height: '15px', margin: 0, accentColor: 'var(--ccc-blue)', cursor: 'pointer' }} />
                      I want to receive email updates.
                    </label>
                  </div>
                  <div className="mfield full">
                    <TextField label="Contact Number" type="tel" required value={personalInfo.contactNumber} onChange={(v) => updatePI('contactNumber', sanitizePhoneInput(v))} placeholder="e.g. 0917 123 4567" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', color: 'var(--text)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={personalInfo.smsUpdatesOptIn} onChange={(e) => updatePI('smsUpdatesOptIn', e.target.checked)} style={{ width: '15px', height: '15px', margin: 0, accentColor: 'var(--ccc-blue)', cursor: 'pointer' }} />
                      I want to receive SMS updates.
                    </label>
                  </div>
                  <TextField full label="Present Home Address" required value={personalInfo.address} onChange={(v) => updatePI('address', v)} placeholder="House No., Street, Barangay, City, Province" />
                  <TextField full label="Voter's Precinct No." required value={personalInfo.voterPrecinct} onChange={(v) => updatePI('voterPrecinct', v)} placeholder="e.g. 0142A" />
                </div>
                <div className="topic-doc-section">
                  <div className="topic-doc-label">
                    Verifying Document <span className="tdl-count">1 required</span>
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
              </div>

              {/* ---------- Card 4: Additional Information ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">4</span> Additional Information
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <p className="topic-card-intro">Used to help match you to special scholarship categories and accommodations. No document needed here.</p>
                <div className="form-grid">
                  <SelectField label="Are you a LGBTQI+ community member?" required value={personalInfo.lgbtqi} onChange={(v) => updatePI('lgbtqi', v)} options={['Yes', 'No']} />
                  <TextField label="Do you have a physical or behavioral condition/disability?" required value={personalInfo.disability} onChange={(v) => updatePI('disability', v)} placeholder="e.g. None" />
                  <TextField full label="What are your hobbies and interests?" required value={personalInfo.hobbies} onChange={(v) => updatePI('hobbies', v)} placeholder="e.g. Reading, basketball, drawing" />
                </div>
              </div>

              {/* ---------- Card 5: Organizational Involvement ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">5</span> Organizational Involvement
                  </span>{' '}
                  <span className="tag">Optional</span>
                </div>
                <p className="topic-card-intro">List any organization/s you are or were part of. This section is optional &mdash; leave it blank if not applicable.</p>
                <OrganizationsTable
                  rows={personalInfo.organizations}
                  onChangeRow={updateOrgRow}
                  onAddRow={addOrgRow}
                  onRemoveRow={removeOrgRow}
                />
              </div>

              {/* ---------- Card 6: Motivation and Aspirations Questions ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">6</span> Motivation and Aspirations Questions
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <p className="topic-card-intro">Help us get to know you better. All questions in this section are required.</p>
                <div className="form-grid">
                  <TextAreaField full label="What motivates you to apply to this institution (City College of Calamba)?" required value={personalInfo.motivation} onChange={(v) => updatePI('motivation', v)} placeholder="Share what motivates you to apply&hellip;" />
                  <TextAreaField full label="How would you describe yourself, including both your physical and personal characteristics?" required value={personalInfo.selfDescription} onChange={(v) => updatePI('selfDescription', v)} placeholder="Describe yourself&hellip;" />
                  <TextAreaField full label="Where do you see yourself 10 years from now, both personally and professionally?" required value={personalInfo.tenYears} onChange={(v) => updatePI('tenYears', v)} placeholder="Share your aspirations&hellip;" />
                </div>
              </div>
              {draftFound && (
                <div className="p-4 rounded-xl border border-ccc-blue/30 bg-blue-50 flex items-start justify-between gap-3">
                  <div className="text-xs text-ccc-text/90">
                    <p className="font-bold text-ccc-navy mb-0.5">Welcome back, {applicantName.trim()}!</p>
                    <p>You have an application in progress. Want to pick up where you left off?</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setPersonalInfo(mapDbRowToPersonalInfo(draftFound)); setAcademicInfo(mapDbRowToAcademicInfo(draftFound)); setHealthInfo(mapDbRowToHealthInfo(draftFound)); setFamilyInfo(mapDbRowToFamilyInfo(draftFound)) }}
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

              {!draftFound && localDraftFound && (
                <div className="p-4 rounded-xl border border-ccc-gold/40 bg-yellow-50 flex items-start justify-between gap-3">
                  <div className="text-xs text-ccc-text/90">
                    <p className="font-bold text-ccc-navy mb-0.5">We couldn&rsquo;t reach the server, but found saved progress on this device.</p>
                    <p>This is from earlier and hasn&rsquo;t synced yet. Want to pick up where you left off?</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPersonalInfo(localDraftFound.personalInfo)
                        setAcademicInfo(localDraftFound.academicInfo)
                        if (localDraftFound.healthInfo) setHealthInfo(localDraftFound.healthInfo)
                        if (localDraftFound.familyInfo) setFamilyInfo(localDraftFound.familyInfo)
                        if (localDraftFound.applicantEmail) setApplicantEmail(localDraftFound.applicantEmail)
                        setLocalDraftFound(null)
                      }}
                      className="text-xs font-bold text-white bg-ccc-gold hover:bg-ccc-navy rounded-lg px-3 py-1.5 whitespace-nowrap"
                    >
                      Resume saved progress
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalDraftFound(null)}
                      className="text-[11px] font-semibold text-ccc-muted hover:text-ccc-navy underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {!requiredPersonalInfoComplete && applicantName.trim() && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Fill in the required fields and upload your Profile Picture, Birth Certificate, and Voter&rsquo;s ID above &mdash; this section saves independently of the others.
                </p>
              )}
              {personalSubmittedAt && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Submitted {new Date(personalSubmittedAt).toLocaleString()}. You can still edit and re-submit this section any time.
                </p>
              )}

              <SectionFormActions
                saveState={saveState}
                sectionState={personalSectionState}
                error={sectionErrors.personal}
                disabled={!applicantName.trim()}
                onSaveDraft={() => saveProgress(1)}
                onSubmit={() => submitSection('personal')}
              />
            </div>
          )}

          {/* ══════════ EDUCATIONAL BACKGROUND (built — Program Application,
              Preferred Program, 3-tier school table, Tech-Voc, and the
              Grades/Form 138 upload, ported from Ivy's academic panel) ══════════ */}
          {activePanel === 'academic' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Educational Background</h1>
                <p>This information is used for qualification matching and cross-referenced against your submitted documents.</p>
              </div>

              {/* ---------- Card 1: Program Application ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">1</span> Program Application
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <div className="form-grid">
                  <SelectField label="Applying As" required value={academicInfo.applyingAs} onChange={(v) => updateAI('applyingAs', v)} options={['First Year', 'Transferee', 'Old Curriculum and ALS Completer']} disabled={!!academicSubmittedAt} />
                  <SelectField label="Term Applying In" required value={academicInfo.termApplying} onChange={(v) => updateAI('termApplying', v)} options={['Term 1', 'Term 2']} disabled={!!academicSubmittedAt} />
                </div>

                {/* Sept 20 2026: Scholarship Matching & Filtering — CCC only
                    accepts transferees who (a) have no failing grade in any
                    semester from their previous school(s), (b) have passed
                    at least 26 units, and (c) have a GWA of 2.25 or better
                    (Appendix J, "Transferees" section). Only shown/required
                    when actually applying as a Transferee. */}
                {academicInfo.applyingAs === 'Transferee' && (
                  <>
                    <p className="topic-card-intro" style={{ marginTop: '15px' }}>
                      As a transferee, CCC also requires your academic standing from your previous school(s).
                    </p>
                    <div className="form-grid">
                      <TextField
                        label="General Weighted Average (GWA)"
                        required
                        type="number"
                        value={academicInfo.transfereeGwa}
                        onChange={(v) => updateAI('transfereeGwa', v)}
                        placeholder="e.g. 1.75 (2.25 or better required)"
                        disabled={!!academicSubmittedAt}
                      />
                      <TextField
                        label="Total Academic Units Passed"
                        required
                        type="number"
                        value={academicInfo.transfereeUnitsPassed}
                        onChange={(v) => updateAI('transfereeUnitsPassed', v)}
                        placeholder="e.g. 30 (at least 26 required)"
                        disabled={!!academicSubmittedAt}
                      />
                      <SelectField
                        label="Did you get a failing grade in any semester at your previous school(s)?"
                        required
                        value={academicInfo.transfereeFailingGrade}
                        onChange={(v) => updateAI('transfereeFailingGrade', v)}
                        options={['Yes', 'No']}
                        disabled={!!academicSubmittedAt}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ---------- Card 2: Preferred Program ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">2</span> Preferred Program
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <div className="form-grid">
                  <SelectField label="First Priority Program" required value={academicInfo.choice1} onChange={(v) => updateAI('choice1', v)} options={PROGRAM_OPTIONS} disabled={!!academicSubmittedAt} />
                  <SelectField label="Second Priority Program" required value={academicInfo.choice2} onChange={(v) => updateAI('choice2', v)} options={[...PROGRAM_OPTIONS, 'None of the above']} disabled={!!academicSubmittedAt} />
                </div>
              </div>

              {/* ---------- Card 3: Educational Background (school table + Tech-Voc + Grades upload) ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">3</span> Educational Background
                  </span>{' '}
                  <span className="tag">Editable</span>
                </div>
                <p className="topic-card-intro">
                  Fill in your school details for each level you&rsquo;ve completed. <strong>Primary / Elementary is required for all applicants.</strong> Secondary / Senior High and Tertiary / College are optional (except Honors / Awards Received, which is optional for all levels).
                </p>

                <EduTable edu={academicInfo.edu} onChangeCell={updateEduCell} disabled={!!academicSubmittedAt} />

                <div className="form-grid" style={{ marginTop: '15px' }}>
                  <SelectField
                    label="Have you taken a Technical or Vocational Course?"
                    value={academicInfo.techVoc}
                    onChange={(v) => updateAI('techVoc', v)}
                    options={['Yes', 'No']}
                    disabled={!!academicSubmittedAt}
                  />
                </div>

                {academicInfo.techVoc === 'Yes' && (
                  <div className="form-grid">
                    <TextField label="Name of School in Technical/Vocational" value={academicInfo.techVocSchool} onChange={(v) => updateAI('techVocSchool', v)} placeholder="e.g. Calamba Technical Vocational School" disabled={!!academicSubmittedAt} />
                    <TextField label="Name of Course in Technical/Vocational" value={academicInfo.techVocCourse} onChange={(v) => updateAI('techVocCourse', v)} placeholder="e.g. Computer Systems Servicing NC II" disabled={!!academicSubmittedAt} />
                    <TextField full label="Address of School in Technical/Vocational" value={academicInfo.techVocAddress} onChange={(v) => updateAI('techVocAddress', v)} placeholder="e.g. Brgy. Real, Calamba City, Laguna" disabled={!!academicSubmittedAt} />
                  </div>
                )}

                <div className="topic-doc-section">
                  <div className="topic-doc-label">
                    Verifying Documents <span className="tdl-count">1 required</span>
                  </div>
                  <InlineUploadRow
                    label="Grades (Proof of Grades / Form 138 / Report Card)"
                    sublabel="Latest grading period / semester, certified true copy"
                    required
                    status={form138Status === 'idle' && hasUploaded('form138') ? 'done' : form138Status}
                    onFileSelected={(f) => handleInlineUpload('form138', f, setForm138Status, () => {})}
                    disabled={!!academicSubmittedAt}
                  />
                </div>
              </div>

              {(!requiredAcademicInfoComplete || !requiredAcademicUploadsComplete) && applicantName.trim() && !academicSubmittedAt && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Applying As, Term Applying In, both Priority Programs, the Primary/Elementary row, and the Grades (Form 138) upload are required (plus GWA, Units Passed, and the failing-grade question if applying as a Transferee) &mdash; this section saves independently of the others.
                </p>
              )}
              {academicSubmittedAt && (
                <p className="text-[11px] font-semibold text-red-600 -mt-2">
                  This section has been submitted and can no longer be edited.
                </p>
              )}

              <SectionFormActions
                saveState={saveState}
                sectionState={academicSectionState}
                error={sectionErrors.academic}
                disabled={!applicantName.trim() || !!academicSubmittedAt}
                submitDisabled={!!academicSubmittedAt}
                submitLabel={academicSubmittedAt ? 'Submitted — Locked' : 'Submit Section'}
                onSaveDraft={() => saveProgress(2)}
                onSubmit={() => submitSection('academic')}
              />
            </div>
          )}

          {/* ══════════ FAMILY & FINANCIAL INFORMATION (built — Parent/
              Guardian table, only-child branch, emergency contact,
              working-student branch, sibling income table, ported from
              Ivy's panel-financial) ══════════ */}
          {activePanel === 'financial' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Family &amp; Financial Information</h1>
                <p>Used to assess financial need for scholarship qualification matching.</p>
              </div>

              {/* ---------- Card 1: Family Information ---------- */}
              <div className="card">
                <div className="card-title">Family Information</div>

                <p style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: '11.25px', letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--navy)', margin: '0 0 12.75px' }}>
                  Parent&rsquo;s / Guardian&rsquo;s Information
                </p>
                <ParentGuardianTable familyInfo={familyInfo} onChange={updateFI} />

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '21px 0 18.75px' }} />

                <p style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: '11.25px', letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--navy)', margin: '0 0 12.75px' }}>
                  Sibling&rsquo;s Information
                </p>
                <div className="form-grid">
                  <SelectField
                    label="Are you an only child?"
                    required
                    value={familyInfo.onlyChild}
                    onChange={(v) => updateFI('onlyChild', v)}
                    options={['Yes', 'No']}
                  />
                  {familyInfo.onlyChild === 'No' && (
                    <TextField
                      label="Number of Siblings"
                      required
                      type="number"
                      value={familyInfo.numSiblings}
                      onChange={(v) => updateFI('numSiblings', v)}
                      placeholder="e.g. 2"
                    />
                  )}
                </div>
                {familyInfo.onlyChild === 'No' && (
                  <div className="edu-table-wrap">
                    <table className="edu-table">
                      <tbody>
                        <tr>
                          <th style={{ whiteSpace: 'normal' }}>
                            Do you have a brother or sister who is currently a student at the City College of Calamba? <span className="req-mark">*</span>
                          </th>
                          <td>
                            <select
                              value={familyInfo.siblingCurrentStudent}
                              onChange={(e) => updateFI('siblingCurrentStudent', e.target.value)}
                              required
                            >
                              <option value="">Select&hellip;</option>
                              <option>Yes</option>
                              <option>No</option>
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <th style={{ whiteSpace: 'normal' }}>
                            Do you have a brother or sister who graduated from the City College of Calamba? <span className="req-mark">*</span>
                          </th>
                          <td>
                            <select
                              value={familyInfo.siblingGraduate}
                              onChange={(e) => updateFI('siblingGraduate', e.target.value)}
                              required
                            >
                              <option value="">Select&hellip;</option>
                              <option>Yes</option>
                              <option>No</option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '21px 0 18.75px' }} />

                <div className="form-grid">
                  <TextAreaField
                    label="Person to be Notified in Case of Emergency"
                    required
                    value={familyInfo.emergencyContact}
                    onChange={(v) => updateFI('emergencyContact', v)}
                    placeholder="e.g. Full Name, Relationship, Address, Contact Number"
                  />
                  <TextField
                    label="Emergency Contact Number"
                    type="tel"
                    value={familyInfo.emergencyContactNumber}
                    onChange={(v) => updateFI('emergencyContactNumber', sanitizePhoneInput(v))}
                    placeholder="e.g. 09XX XXX XXXX"
                  />
                </div>

                <div className="topic-doc-section">
                  <div className="topic-doc-label">Verifying Document <span className="tdl-count">1 required</span></div>
                  <InlineUploadRow
                    label="Voter's ID / Certification of Parent/Guardian"
                    sublabel="Issued by the Commission on Elections (COMELEC)"
                    required
                    status={parentIdStatus === 'idle' && hasUploaded('parentid') ? 'done' : parentIdStatus}
                    onFileSelected={(f) => handleInlineUpload('parentid', f, setParentIdStatus, setParentIdRejection)}
                  />
                  {parentIdRejection && <QualityRejectionAlert message={parentIdRejection} />}
                </div>
              </div>

              {/* ---------- Card 2: Applicant's Employment ---------- */}
              <div className="card">
                <div className="card-title">Applicant&rsquo;s Employment</div>
                <div className="form-grid">
                  <SelectField
                    label="Are you a working student?"
                    required
                    value={familyInfo.workingStudent}
                    onChange={(v) => updateFI('workingStudent', v)}
                    options={['Yes', 'No']}
                  />
                </div>
                {familyInfo.workingStudent === 'Yes' && (
                  <div className="topic-doc-section">
                    <div className="topic-doc-label">Verifying Document <span className="tdl-count">1 required</span></div>
                    <InlineUploadRow
                      label="Proof of Employment"
                      sublabel="Accepted documents include an ID, certificate, or any document provided by your employer"
                      required
                      status={employmentCertStatus === 'idle' && hasUploaded('employmentcert') ? 'done' : employmentCertStatus}
                      onFileSelected={(f) => handleInlineUpload('employmentcert', f, setEmploymentCertStatus, () => {})}
                    />
                  </div>
                )}
              </div>

              {/* ---------- Card 3: Family's Annual Income (only when there are siblings) ---------- */}
              {familyInfo.onlyChild === 'No' && (
                <div className="card">
                  <div className="card-title">Family&rsquo;s Annual Income</div>
                  <p className="topic-card-intro">
                    List each sibling from eldest to youngest. Use the &plus; button to add another sibling.
                  </p>
                  <SiblingIncomeTable
                    siblings={familyInfo.siblings}
                    onChangeCell={updateSiblingCell}
                    onAddColumn={addSiblingColumn}
                    onRemoveColumn={removeSiblingColumn}
                  />
                  <div className="topic-doc-section">
                    <div className="topic-doc-label">Verifying Document <span className="tdl-count">Optional</span></div>
                    <InlineUploadRow
                      label="Proof of Income (Family / Guardian)"
                      sublabel="Certificate of Indigency / Income issued by your Barangay or the City Social Welfare Office"
                      status={indigencyStatus === 'idle' && hasUploaded('indigency') ? 'done' : indigencyStatus}
                      onFileSelected={(f) => handleInlineUpload('indigency', f, setIndigencyStatus, () => {})}
                    />
                  </div>
                </div>
              )}

              {financialSubmittedAt && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Submitted {new Date(financialSubmittedAt).toLocaleString()}. You can still edit and re-submit this section any time.
                </p>
              )}

              <SectionFormActions
                saveState={saveState}
                sectionState={financialSectionState}
                error={sectionErrors.financial}
                disabled={!applicantName.trim()}
                onSaveDraft={() => saveProgress(5)}
                onSubmit={() => submitSection('financial')}
              />
            </div>
          )}

          {/* ══════════ APPEALS & RESCHEDULING (Rescheduling half built — the
              Appeal-for-Retake half is deliberately left out; see
              app/api/reschedule/route.js header comment for why) ══════════ */}
          {activePanel === 'appeals' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; Application</p>
                <h1>Appeals &amp; Rescheduling</h1>
                <p>
                  Request to reschedule your exam if you&rsquo;ll be absent. (Appeals for retakes/
                  re-applications aren&rsquo;t handled here yet &mdash; that item&rsquo;s ownership is still
                  unresolved between modules.)
                </p>
              </div>

              <div className="card">
                <div className="card-title">Submit a Request</div>
                <div className="form-grid">
                  <SelectField
                    label="Request Type"
                    value={rescheduleType}
                    onChange={setRescheduleType}
                    options={['Reschedule Examination (Absence)', 'Other Concern']}
                    full
                  />
                  <TextAreaField
                    label="Details"
                    value={rescheduleDetails}
                    onChange={setRescheduleDetails}
                    placeholder="e.g. I was unable to attend the scheduled exam due to a medical emergency."
                    full
                  />
                </div>
                <InlineUploadRow
                  label="Supporting Document"
                  sublabel="e.g. Medical certificate, affidavit, or proof of conflict"
                  status={supportDocStatus === 'idle' && hasUploaded('supportdoc') ? 'done' : supportDocStatus}
                  onFileSelected={(f) => handleInlineUpload('supportdoc', f, setSupportDocStatus, setSupportDocRejection)}
                />
                {supportDocRejection && <QualityRejectionAlert message={supportDocRejection} />}

                <div className="form-actions">
                  <div className="save-note">
                    {rescheduleSaveState === 'saved' && <span style={{ color: 'var(--green)' }}>Request submitted &#x2713;</span>}
                    {rescheduleSaveState === 'error' && <span style={{ color: 'var(--red)' }}>Couldn&rsquo;t submit &mdash; try again</span>}
                  </div>
                  <button
                    type="button"
                    onClick={submitReschedule}
                    disabled={rescheduleSaveState === 'saving' || !applicantName.trim() || !rescheduleType || !rescheduleDetails.trim()}
                    className="mbtn mbtn-primary"
                  >
                    {rescheduleSaveState === 'saving' ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </div>

              {rescheduleHistory.length > 0 && (
                <div className="card">
                  <div className="card-title">Your Past Requests</div>
                  <div className="timeline">
                    {rescheduleHistory.map((r) => (
                      <div key={r.id} className="timeline-item">
                        <div className="timeline-dot">&#8230;</div>
                        <div className="timeline-body">
                          <h4>{r.request_type} <span style={{ color: 'var(--blue)', fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{r.status}</span></h4>
                          <p>{r.details}</p>
                          <p>{new Date(r.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ HEALTH & WELLNESS (built — Medical Status + the
              Medical Examination Results/Certificate upload, ported from
              Ivy's health panel) ══════════ */}
          {activePanel === 'health' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Scholarship Services &middot; During Enrollment</p>
                <h1>Health &amp; Wellness Information</h1>
                <p>Used for emergency contact purposes and reasonable accommodations during examinations.</p>
              </div>

              <div className="card">
                <div className="card-title">Health Details</div>
                <div className="form-grid">
                  <TextAreaField
                    label="Medical Status"
                    value={healthInfo.medicalStatus}
                    onChange={(v) => updateHI('medicalStatus', v)}
                    placeholder="e.g. Physically fit for any work, unfit or unsafe for any type of employment, etc."
                    full
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  Required Document <span className="tag">After applicant examination</span>
                </div>
                <InlineUploadRow
                  label="Medical Examination Results / Certificate"
                  sublabel="To be completed only once you have passed the applicant examination"
                  status={medcertStatus === 'idle' && hasUploaded('medcert') ? 'done' : medcertStatus}
                  onFileSelected={(f) => handleInlineUpload('medcert', f, setMedcertStatus, () => {})}
                />
              </div>

              {healthSubmittedAt && (
                <p className="text-[11px] text-ccc-muted -mt-2">
                  Submitted {new Date(healthSubmittedAt).toLocaleString()}. You can still edit and re-submit this section any time.
                </p>
              )}

              <SectionFormActions
                saveState={saveState}
                sectionState={healthSectionState}
                error={sectionErrors.health}
                disabled={!applicantName.trim()}
                onSaveDraft={() => saveProgress(4)}
                onSubmit={() => submitSection('health')}
              />
            </div>
          )}

          {/* ══════════ ALLOWANCE (stub — not built yet) ══════════ */}
          {activePanel === 'allowance' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Scholarship Services &middot; Enrolled</p>
                <h1>Allowance</h1>
                <p>Once your scholarship is approved, your allowance distribution schedule and history will appear here.</p>
              </div>
              <div className="card">
                <div className="card-title">Distribution Status</div>
                <p style={{ fontSize: '12.75px', color: 'var(--muted)' }}>
                  You don&rsquo;t have an active allowance disbursement yet. This becomes available once your
                  application is approved and endorsed.
                </p>
              </div>
            </div>
          )}

          {/* ══════════ DOCUMENTS & STATUS (built — status table is real; the
              upload dropzone below is an interim home for document types
              whose real panel (Academic/Financial/Health/Appeals) isn't
              built yet, so nothing is blocked while those are being built) ══════════ */}
          {activePanel === 'status' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; Application</p>
                <h1>Documents &amp; Verification Status</h1>
                <p>Track the review status of every document you&rsquo;ve submitted.</p>
              </div>

              <DocumentStatusTable
                groups={DOCUMENT_TYPE_OPTIONS}
                docs={myDocs}
                applicantName={applicantName}
                onReupload={jumpToUploadFor}
              />

              {/* Application History & Activity Log — spec has this card
                  right here too, but scripted with fake data; this one is
                  built from real events (see buildActivityLog() above). */}
              <div className="card">
                <div className="card-title">Application History &amp; Activity Log</div>
                <ActivityLog
                  events={buildActivityLog({
                    myDocs,
                    personalSubmittedAt,
                    academicSubmittedAt,
                    healthSubmittedAt,
                    financialSubmittedAt,
                    submittedAt,
                  })}
                />
              </div>

              {/* Real upload form — no direct spec equivalent (spec's version is
                  a single static upload row); wrapped in a .card shell so it
                  sits visually consistent with the rest of the panel, but the
                  dropzone/preview/OCR-detail internals below keep their own
                  Tailwind styling since there's nothing in applicant.html to
                  match them against. */}
              <div className="card" style={{ marginTop: '18.75px' }}>
                <div className="card-title">Upload a Document</div>
                <p className="topic-card-intro" style={{ marginTop: '-6px' }}>
                  Profile Picture, Birth Certificate, and Voter&rsquo;s ID upload from the Personal
                  Information panel; Grades from Educational Background; Parent/Guardian ID, Proof of
                  Employment, and Proof of Income from Family &amp; Financial Information; Medical
                  Certificate from Health &amp; Wellness. Supporting Document uploads here or from
                  Appeals &amp; Rescheduling.
                </p>

                <form onSubmit={handleUpload} className="space-y-5">
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

                {qualityRejection && <QualityRejectionAlert message={qualityRejection.message} />}

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

              <div className="card" style={{ marginTop: '18.75px' }}>
                <div className="card-title">Submit Application</div>
                {submitted ? (
                  <p style={{ fontSize: '12.75px', color: 'var(--green)', fontWeight: 700 }}>
                    &#x2713; Application submitted for review &mdash; {applicantName.trim()}, your documents are on file. This panel will keep tracking their status.
                  </p>
                ) : (
                  <>
                    <p className="topic-card-intro" style={{ marginTop: 0 }}>
                      This confirms your documents are ready for review. A per-section Save/Submit flow
                      like Ivy&rsquo;s (instead of one final submit) is a possible future refinement, not built yet.
                    </p>
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={submitApplication}
                        disabled={saveState === 'saving' || myDocs.length === 0}
                        className="mbtn mbtn-secondary"
                      >
                        {saveState === 'saving' ? 'Submitting…' : myDocs.length === 0 ? 'Upload at least one document to submit' : 'Submit Application'}
                      </button>
                    </div>
                  </>
                )}
              </div>
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