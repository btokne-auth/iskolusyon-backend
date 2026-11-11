'use client'
import { STATUS_DEFINITIONS } from '@/app/lib/statusDefinitions'
import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { docState } from '../lib/documentState'
import { screeningResult } from '../lib/screening'
import { useRouter } from 'next/navigation'
import '../portal-theme.css'
import SiteHeader from '../components/SiteHeader'
import ManilaClock from '../components/ManilaClock'
import DocumentStatusTable from '../components/DocumentStatusTable'
import PortalSidebar from '../components/PortalSidebar'
import LoadingScreen from '../components/LoadingScreen'
import { Skeleton, SkeletonRows, SkeletonList, SkeletonText } from '../components/Skeleton'
import { DOCUMENT_TYPE_OPTIONS, getDocTypeLabel } from '../lib/documentTypes'
import { BSED_MATH_SCIENCE_PROGRAMS } from '../lib/matching'
import { formatMobileInput, withCalambaCity, toDateInputValue, ageOn, latestBirthdate, earliestBirthdate, MIN_APPLICANT_AGE, MAX_APPLICANT_AGE, validatePersonalInfo, validateAcademicInfo, validateFamilyInfo, errorSummary } from '../lib/fieldValidation'
import {
  saveDraftLocal,
  loadDraftLocal,
  clearDraftLocal,
  queueUpload,
  getQueuedUploads,
  removeQueuedUpload,
  onConnectivityChange,
  isNetworkError,
} from '../lib/offlineSync'

// ---------- Small building blocks ----------

// Oct 5 2026: Allowance page (Progress Table row 78). Ivy's applicant.html
// Allowance panel (Date of Distribution / Type / Description table, empty
// note until the scholarship is approved), now reading the real posts the
// Office of the Registrar makes in the admin console.
function formatAllowanceDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return String(ymd || '')
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Oct 5 2026: while the saved application is still loading, the profile
// sections show this instead of empty fields. Besides looking better, it
// stops someone from typing into a field that the saved answer would then
// overwrite a second later.
const PROFILE_PANEL_HEADERS = {
  personal: ['Admission \u00b7 My Profile (Softcopy)', 'Personal Information'],
  academic: ['Admission \u00b7 My Profile (Softcopy)', 'Educational Background'],
  financial: ['Admission \u00b7 My Profile (Softcopy)', 'Family & Financial Information'],
  health: ['Scholarship Services \u00b7 During Enrollment', 'Health & Wellness'],
}

function ProfilePanelSkeleton({ panel }) {
  const [eyebrow, title] = PROFILE_PANEL_HEADERS[panel] || ['', '']
  return (
    <div>
      <div className="portal-header">
        <p className="portal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {[6, 4].map((fields, c) => (
        <div className="card" key={c} role={c === 0 ? 'status' : undefined} aria-live={c === 0 ? 'polite' : undefined}>
          {c === 0 && <span className="sk-sr">Loading your saved answers...</span>}
          <div className="card-title">
            <Skeleton width={c === 0 ? 180 : 140} height={14} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px 16px' }} aria-hidden="true">
            {Array.from({ length: fields }, (_, i) => (
              <div className="sk-field" key={i}>
                <Skeleton width={[90, 120, 70, 110, 100, 80][i % 6]} height={10} />
                <Skeleton width="100%" height={40} radius={8} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AllowancePanel() {
  const [state, setState] = useState({ loading: true, error: '', posts: [], isScholar: false })
  useEffect(() => {
    let cancelled = false
    fetch('/api/allowance')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) setState({ loading: false, error: '', posts: data.posts || [], isScholar: !!data.isScholar })
        else setState({ loading: false, error: data.error || 'Could not load your allowance.', posts: [], isScholar: false })
      })
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, posts: [], isScholar: false }))
    return () => {
      cancelled = true
    }
  }, [])

  const { loading, error, posts } = state
  return (
    <div>
      <div className="portal-header">
        <p className="portal-eyebrow">Scholarship Services &middot; Enrolled</p>
        <h1>Allowance</h1>
        <p>Your allowance distributions from the Office of the College Registrar appear here.</p>
      </div>
      <div className="card">
        <div className="card-title">
          Allowance Distribution
          {posts.length > 0 && <span className="tag">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>}
        </div>
        {loading ? (
          <SkeletonRows rows={3} avatar={false} label="Loading your allowance..." />
        ) : error ? (
          <p style={{ fontSize: '12.75px', color: 'var(--red)' }}>{error}</p>
        ) : posts.length === 0 ? (
          <p style={{ fontSize: '12.75px', color: 'var(--muted)' }}>
            You don&rsquo;t have an active allowance disbursement yet. This becomes available once your application is
            approved and endorsed.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="doc-table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Date of Distribution</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td>{formatAllowanceDate(p.distribution_date)}</td>
                      <td style={{ fontWeight: 600 }}>{p.allowance_type}</td>
                      <td style={p.description ? undefined : { color: 'var(--muted)' }}>{p.description || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 14 }}>
              Newest first. For questions about your allowance, contact the Office of the College Registrar.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

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
    lgbtqi: row.lgbtqi_member || '',
    disability: row.disability || '',
    soloParent: row.solo_parent || '',
    indigenousMember: row.indigenous_member || '',
    underprivileged: row.underprivileged || '',
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
    // Nov 2026 (panel revisions S2): First Year grade question.
    shsFailingGrade: row.shs_failing_grade || '',
    // Oct 6 2026: Appendix J p. 96 rule a (BSEd Mathematics / Science).
    shsMathScienceLowest: row.shs_math_science_lowest ?? '',
  }
}

// Sept 29: the applicant-side HashField (masked SHA-256 with reveal/copy)
// was removed. The hash meant nothing to applicants, a revealed hash
// overflowed the Recent uploads panel, and Ivy's applicant.html spec never
// shows it. Every upload is still hashed and stored server-side, and admins
// still see it (Copy hash in the admin applicant window).

// Shown when the image-quality precheck rejects a file outright, before OCR
// or storage ever ran. Deliberately distinct from a flagged upload: that one
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
  // Only the file's own name (sign-up checks sit in a signup-check/<id>/ folder).
  const parts = path.split('/').pop().split('-')
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
        ? { date: doc.created_at, dot: 'warn', title: `${label} needs review`, body: 'Needs your attention. See Document Verification Status above.', status: 'review' }
        : doc.review_status === 'processing'
          ? { date: doc.created_at, dot: 'info', title: `${label} uploaded`, body: 'We are reading it now. This updates by itself.', status: 'processing' }
          : docState(doc) === 'checked'
            ? { date: doc.created_at, dot: 'done', title: `${label} uploaded`, body: 'Passed the system check. Waiting for the Guidance Office to confirm it.', status: 'checked' }
            : { date: doc.created_at, dot: 'done', title: `${label} verified`, body: 'Confirmed by the Guidance Office.', status: 'verified' }
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
    events.push({ date: at, dot: 'section', title, body: 'Saved and sent to the Guidance Office.' })
  })

  if (submittedAt) {
    events.push({ date: submittedAt, dot: 'submit', title: 'Application submitted for review', body: 'Your documents are on file and being tracked here.' })
  }

  // Oct 1 2026: newest first, so the latest activity is what they see.
  events.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Trailing "what's next" entry, same role as spec's own undated last
  // timeline item — only shown while something is still outstanding.
  if (!submittedAt) {
    const missing = sectionEvents.filter((s) => !s.at).map((s) => s.title.replace(' submitted', ''))
    if (missing.length) {
      events.unshift({
        date: null,
        dot: null,
        title: 'Awaiting remaining profile sections',
        body: `Complete ${missing.join(', ')} to proceed.`,
      })
    } else if (myDocs.length === 0) {
      events.unshift({ date: null, dot: null, title: 'Awaiting document uploads', body: 'Upload at least one document, then submit your application below.' })
    } else {
      events.unshift({ date: null, dot: null, title: 'Ready to submit', body: 'All profile sections are checkpointed. Submit your application below when ready.' })
    }
  }

  return events
}

// Oct 1 2026 redesign (Pau's request): newest first, grouped by day, each
// entry with an icon, its time, a short note and (for documents) a status
// pill. The first 8 show by default so a long upload history doesn't bury
// the page; "Show all" expands it.
const LOG_ICON = { done: '\u2713', warn: '!', info: '\u2026', section: '\u2713', submit: '\u2605' }
const LOG_STATUS = {
  verified: { label: 'Verified', cls: 'is-good' },
  checked: { label: 'System check passed', cls: 'is-info' },
  processing: { label: 'Processing', cls: 'is-info' },
  review: { label: 'Needs review', cls: 'is-warn' },
}

function portalDayLabel(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

function ActivityLog({ events }) {
  const [showAll, setShowAll] = useState(false)
  if (events.length === 0) {
    return <p className="topic-card-intro" style={{ marginTop: 0 }}>Nothing on file yet. Upload a document or fill in a profile section to start your activity log.</p>
  }
  const LIMIT = 8
  const visible = showAll ? events : events.slice(0, LIMIT)
  const groups = []
  for (const ev of visible) {
    const label = ev.date ? portalDayLabel(ev.date) : 'Next step'
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(ev)
    else groups.push({ label, items: [ev] })
  }
  return (
    <div className="plog">
      {groups.map((g) => (
        <div key={g.label} className="plog-group">
          <div className="plog-day">{g.label}</div>
          {g.items.map((ev, i) => (
            <div key={i} className={`plog-item plog-${ev.dot || 'next'}`}>
              <div className="plog-icon">{LOG_ICON[ev.dot] || '\u2192'}</div>
              <div className="plog-main">
                <div className="plog-top">
                  <span className="plog-title">{ev.title}</span>
                  {ev.status && <span className={`plog-pill ${LOG_STATUS[ev.status].cls}`}>{LOG_STATUS[ev.status].label}</span>}
                </div>
                <div className="plog-note">{ev.body}</div>
              </div>
              {ev.date && (
                <div className="plog-time" title={new Date(ev.date).toLocaleString('en-PH')}>
                  {new Date(ev.date).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {events.length > LIMIT && (
        <button type="button" className="plog-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `Show all ${events.length} entries`}
        </button>
      )}
    </div>
  )
}

// ---------- Messages list (Oct 1 2026 redesign) ----------
// Each item is its own plain card: an icon for its type, the title with a
// small dot if it arrived in the last 2 days, the date on the right, a
// "Message to you / Announcement · category" line, then the full body.

// Oct 16 2026 (client recommendation, Registrar interview of Oct 15):
// "the applicant didn't read it, but CCC has no proof". A new announcement
// or message opens as this pop-up the next time the applicant opens the
// portal. It can't be closed or skipped: the checkbox unlocks after the same
// 3 seconds as the other pop-ups, then Confirm saves the date and time,
// which admins see in Communications. One post at a time, oldest first.
function AckDialog({ post, index, total, onConfirm }) {
  const [secondsLeft, setSecondsLeft] = useState(NOTICE_LOCK_SECONDS)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setSecondsLeft(NOTICE_LOCK_SECONDS)
    setChecked(false)
    setError('')
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [post.id])
  const locked = secondsLeft > 0
  const isMessage = post.type === 'message'
  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm(post.id)
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="confirm-overlay open">
      <div className="confirm-box ack-box" role="dialog" aria-modal="true" aria-labelledby="ackTitle">
        <div className="ack-top">
          <span className={`pmsg-icon ${isMessage ? 'is-message' : 'is-announcement'}`}>{isMessage ? '\u2709' : '\uD83D\uDCE3'}</span>
          <span className="ack-kind">
            {isMessage ? 'New message for you' : 'New announcement'}
            {post.category ? ` \u00b7 ${post.category}` : ''}
          </span>
          {total > 1 && <span className="ack-count">{index} of {total}</span>}
        </div>
        <h3 id="ackTitle">{post.title}</h3>
        <span className="ack-date">
          {post.created_at ? new Date(post.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
        </span>
        <div className="ack-body">{post.body}</div>
        <label className={`ack-check${locked ? ' locked' : ''}`}>
          <input type="checkbox" checked={checked} disabled={locked || busy} onChange={(e) => setChecked(e.target.checked)} />
          <span>I have read and understood this {isMessage ? 'message' : 'announcement'}.</span>
        </label>
        <p className="ack-hint">
          {locked
            ? `Please read it first. You can confirm in ${secondsLeft} second${secondsLeft === 1 ? '' : 's'}.`
            : 'The Guidance Office will see the date and time you confirmed. You can read it again anytime in Messages.'}
        </p>
        {error && <p className="ack-error">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="mbtn mbtn-primary" onClick={confirm} disabled={locked || !checked || busy}>
            {busy ? 'Saving...' : locked ? `Confirm (${secondsLeft})` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageCard({ m, acknowledgedAt }) {
  const isMessage = m.type === 'message'
  const isNew = m.created_at && Date.now() - new Date(m.created_at).getTime() < 2 * 24 * 60 * 60 * 1000
  return (
    <div className={`pmsg${isNew ? ' is-new' : ''}`}>
      <div className={`pmsg-icon ${isMessage ? 'is-message' : 'is-announcement'}`}>{isMessage ? '\u2709' : '\uD83D\uDCE3'}</div>
      <div className="pmsg-main">
        <div className="pmsg-top">
          <h4 className="pmsg-title">
            {isNew && <span className="pmsg-new-dot" aria-label="New" />}
            {m.title}
          </h4>
          <span className="pmsg-date">
            {m.created_at ? new Date(m.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
          </span>
        </div>
        <div className="pmsg-sub">
          {isMessage ? 'Message to you' : 'Announcement'}
          {m.category ? ` \u00b7 ${m.category}` : ''}
        </div>
        <p className="pmsg-body">{m.body}</p>
        {acknowledgedAt && (
          <p className="pmsg-ack">
            &#10003; You confirmed reading this on {new Date(acknowledgedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------- Past request card (Oct 1 2026 redesign) ----------
// Plain card with the status pill at the top right, and the outcome spelled
// out in a tinted box at the bottom ("Approved by the Guidance Office on ...",
// plus the office's note), so it can't be overlooked.
const REQUEST_STATUS_VIEW = {
  submitted: { label: 'Awaiting review', cls: 'st-wait' },
  approved: { label: 'Approved', cls: 'st-ok' },
  declined: { label: 'Declined', cls: 'st-no' },
}

function PastRequestCard({ r }) {
  const st = REQUEST_STATUS_VIEW[r.status] || REQUEST_STATUS_VIEW.submitted
  const fmt = (d) => new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  const decided = r.status === 'approved' || r.status === 'declined'
  return (
    <div className="preq">
      <div className="preq-head">
        <div style={{ minWidth: 0 }}>
          <div className="preq-type">{r.request_type}</div>
          <div className="preq-meta">Sent {fmt(r.created_at)}</div>
        </div>
        <span className={`preq-status ${st.cls}`}>{st.label}</span>
      </div>
      <p className="preq-details">{r.details}</p>
      <div className={`preq-doc${r.supporting_document_path ? ' has-doc' : ''}`}>
        {r.supporting_document_path ? '\u{1F4CE} Supporting document attached' : 'No supporting document attached'}
      </div>
      <div className={`preq-outcome ${st.cls}`}>
        <span className="preq-outcome-icon">{r.status === 'approved' ? '\u2713' : r.status === 'declined' ? '\u2715' : '\u23F3'}</span>
        <div style={{ minWidth: 0 }}>
          <div className="preq-outcome-title">
            {decided
              ? `${st.label} by the Guidance Office${r.decided_at ? ` on ${fmt(r.decided_at)}` : ''}`
              : 'Waiting for the Guidance Office to review this'}
          </div>
          {decided && r.decision_note ? (
            <div className="preq-outcome-note">&ldquo;{r.decision_note}&rdquo;</div>
          ) : !decided ? (
            <div className="preq-outcome-note">You&rsquo;ll get a message here once it&rsquo;s decided.</div>
          ) : null}
        </div>
      </div>
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
  // Oct 21 2026: always a PH mobile number starting with 09 (+63 is
  // converted), see formatMobileInput in app/lib/fieldValidation.js.
  return formatMobileInput(value)
}

// Small reusable form controls for the Personal Information cards (Step 1,
// cards 2-3) — kept local to this file since they're only used here, styled
// to match the existing Applicant Name / Email inputs above.
// .mfield/.req-mark/.full from portal-theme.css (design-parity pass 5,
// Sept 19 2026) — was muted-gray Tailwind labels/inputs; spec's labels are
// navy, not gray, and inputs use a 6px radius + inset focus glow instead of
// an outer ring. `full` lets a caller span both columns of a parent
// .form-grid without a separate wrapper div (spec's .mfield.full).
// Oct 6 2026: after the final Submit, Personal Information, Educational
// Background and Family & Financial Information are read-only (the server
// refuses changes too, see app/api/application/route.js). Each of those
// panels wraps its fields in this provider, so every field inside turns
// read-only without passing a prop to each one. Upload rows don't use it,
// so re-upload requests still work.
const FieldsLockedContext = createContext(false)

// Nov 2026 (panel revisions S6): the age is worked out from the date of
// birth (ages 15 to 65 only, as the calendar already allows).
function ageHint(dateOfBirth) {
  const info = ageOn(dateOfBirth)
  if (!info || info.isFutureOrToday) return 'Pick from the calendar. Applicants must be 15 to 65 years old.'
  return `Age: ${info.age} years old`
}

function TextField({ label, required, type = 'text', value, onChange, placeholder, disabled, full, hint, max, min }) {
  const locked = useContext(FieldsLockedContext)
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && <span className="req-mark">*</span>}
      </label>
      <input
        type={type}
        value={value}
        max={max}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || locked}
      />
      {hint && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{hint}</div>}
    </div>
  )
}

// ---------- Eligibility Check card (Oct 12 2026) ----------
// Chapter 1 p. 15: applicants get "a verified scholarship eligibility
// listing"; Objective 2: matching runs "without administrative
// intervention". So this shows the automatic check right away, and says
// Verified once an admin has set the applicant's status. It never says
// Qualified or Waitlisted: results still come only through Send Result.
const ELIGIBILITY_SUMMARY = {
  meets: { badge: 'badge-verified', text: 'You meet the requirements' },
  not_met: { badge: 'badge-deficient', text: 'A requirement is not met' },
  not_checked: { badge: 'badge-pending', text: 'Not fully checked yet' },
}
const ELIGIBILITY_ITEM_ICON = { met: '\u2713', not_met: '\u2715', not_checked: '\u2026' }

function EligibilityCard({ eligibility, resultReleased }) {
  const summary = ELIGIBILITY_SUMMARY[eligibility.status] || ELIGIBILITY_SUMMARY.not_checked
  const items = Array.isArray(eligibility.items) ? eligibility.items : []
  let desc
  if (eligibility.status === 'meets') {
    desc = eligibility.verified
      ? 'Verified by the Guidance Office.'
      : "Checked automatically against CCC's Scholar Guidelines. The Scholarship Office will verify it."
    desc += resultReleased ? ' Your exam result is in the Admission card below.' : ' Final admission still depends on the entrance exam.'
  } else if (eligibility.status === 'not_met') {
    desc = eligibility.verified
      ? 'The Guidance Office reviewed your application. Check Messages, or contact the Guidance Office for details.'
      : 'Fix the item marked below. If you think this is wrong, contact the Guidance Office.'
  } else {
    desc = 'Each item is checked once you submit the section it comes from.'
  }
  return (
    <div className="card elig-card">
      <div className="card-title">
        Eligibility Check
        <span className={`tag${eligibility.verified ? ' tag-verified' : ''}`}>{eligibility.verified ? 'Verified' : 'Automatic check'}</span>
      </div>
      <div className="elig-summary">
        <span className={`badge ${summary.badge}`}>{summary.text}</span>
      </div>
      <p className="elig-desc">{desc}</p>
      <ul className="elig-list">
        {items.map((item) => (
          <li key={item.key} className={`elig-item elig-${item.state}`}>
            <span className="elig-icon" aria-hidden="true">{ELIGIBILITY_ITEM_ICON[item.state] || ELIGIBILITY_ITEM_ICON.not_checked}</span>
            <span>
              <span className="elig-label">{item.label}</span>
              <span className="elig-detail">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {eligibility.note && <p className="elig-note">{eligibility.note}</p>}
    </div>
  )
}

// Nov 2026 (panel revisions, priority 4 / S4): shown in place of Personal
// Information, Family & Financial and Health until the eligibility
// screening is passed, so nothing lengthy is asked of someone who doesn't
// qualify.
function ScreeningLockCard({ screening, onGo }) {
  const failed = screening.state === 'failed'
  return (
    <div>
      <div className="portal-header">
        <p className="portal-eyebrow">Admission &middot; Step 2</p>
        <h1>{failed ? 'Not eligible to continue' : 'Finish the eligibility screening first'}</h1>
        <p>
          {failed
            ? 'Based on your answers, you do not meet a requirement of the CCC Scholar Guidelines, so the rest of the application is not open.'
            : 'The rest of the application opens once you pass the eligibility screening in Educational Background. This way, nobody is asked for personal, family and financial details before we know they qualify.'}
        </p>
      </div>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {screening.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="mbtn mbtn-primary" onClick={onGo}>Go to Educational Background</button>
        </div>
      </div>
    </div>
  )
}

function ScreeningResultCard({ screening, onNext }) {
  if (screening.grandfathered || screening.state === 'not_started') {
    if (screening.grandfathered) return null
    return (
      <div className="card">
        <div className="card-title">Confirm your eligibility</div>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          You passed the eligibility check at sign-up. {screening.reasons[0]} Your Personal Information and Family &amp;
          Financial Information open once your grades pass the system check.
        </p>
      </div>
    )
  }
  if (screening.state === 'passed') {
    return (
      <div className="card">
        <div className="card-title">You passed the eligibility screening</div>
        <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
          You can now fill in your Personal Information and Family &amp; Financial Information. The Guidance Office still
          checks every document before your application is final.
        </p>
        <button type="button" className="mbtn mbtn-primary" onClick={onNext}>Continue to Personal Information</button>
      </div>
    )
  }
  if (screening.state === 'failed') {
    return (
      <div className="card">
        <div className="card-title">Not eligible to continue</div>
        <ul style={{ margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.7 }}>
          {screening.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          If an answer was a mistake, or you think this is wrong, contact the GCTCDO (1st Floor, Admin Building) or file a
          request in Appeals &amp; Rescheduling. No further details are collected from you.
        </p>
      </div>
    )
  }
  return (
    <div className="card">
      <div className="card-title">Eligibility screening: almost done</div>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        {screening.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  )
}

function SelectField({ label, required, value, onChange, options, disabled, full }) {
  const locked = useContext(FieldsLockedContext)
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && !(locked && !value) && <span className="req-mark">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || locked}>
        {/* Oct 12 2026: a locked section with no answer (e.g. a question added
            after the applicant submitted) reads "Not answered", not an
            empty "Select" with a red asterisk that looks like a mistake. */}
        <option value="">{locked ? 'Not answered' : 'Select'}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextAreaField({ label, required, value, onChange, placeholder, full }) {
  const locked = useContext(FieldsLockedContext)
  return (
    <div className={`mfield${full ? ' full' : ''}`}>
      <label>
        {label} {required && <span className="req-mark">*</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} disabled={locked} />
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
  const locked = useContext(FieldsLockedContext)
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
                  <input type="text" value={row.name} disabled={locked} onChange={(e) => onChangeRow(i, 'name', e.target.value)} placeholder="e.g. Organization Name" />
                </td>
                <td>
                  <input type="text" value={row.position} disabled={locked} onChange={(e) => onChangeRow(i, 'position', e.target.value)} placeholder="e.g. President" />
                </td>
                <td>
                  <input type="text" value={row.nature} disabled={locked} onChange={(e) => onChangeRow(i, 'nature', e.target.value)} placeholder="e.g. Non-profit Organization" />
                </td>
                <td>
                  <input type="text" value={row.year} disabled={locked} onChange={(e) => onChangeRow(i, 'year', e.target.value)} placeholder="e.g. 2025-2026" />
                </td>
                <td className="org-row-action">
                  {isLast ? (
                    <button type="button" onClick={onAddRow} title="Add row" className="org-row-btn org-row-add" disabled={locked}>+</button>
                  ) : (
                    <button type="button" onClick={() => onRemoveRow(i)} title="Remove row" className="org-row-btn org-row-remove" disabled={locked}>&times;</button>
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
function hasCollegeData(edu) {
  return EDU_ROWS.some((row) => {
    const v = String(edu?.tert?.[row.field] || '').trim().toLowerCase()
    return v && v !== 'n/a' && v !== 'na' && v !== 'none'
  })
}

function EduTable({ edu, onChangeCell, disabled: disabledProp, transferee }) {
  const lockedByPanel = useContext(FieldsLockedContext)
  const disabled = disabledProp || lockedByPanel
  // Oct 25 2026: same idea as the Guardian column. A First Year applicant
  // who hasn't attended college answers No and the column is cleared and
  // locked; a Transferee always has a college, so it's Yes and required.
  const [attendedCollege, setAttendedCollege] = useState(() => (transferee || hasCollegeData(edu) ? 'Yes' : 'No'))
  const collegeOn = transferee || attendedCollege === 'Yes'
  const chooseCollege = (value) => {
    setAttendedCollege(value)
    if (value === 'No') for (const row of EDU_ROWS) onChangeCell('tert', row.field, '')
  }
  return (
    <>
    <div className="mfield" style={{ maxWidth: 520, marginBottom: 12 }}>
      <label>Have you attended college before?</label>
      <select value={collegeOn ? 'Yes' : 'No'} onChange={(e) => chooseCollege(e.target.value)} disabled={disabled || transferee}>
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
      {transferee && <div className="text-[11px] text-ccc-muted mt-1">Transferees fill in their previous college.</div>}
    </div>
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
                    // Oct 25 2026: the year cells take digits only, 4 at most.
                    inputMode={row.field === 'year' ? 'numeric' : undefined}
                    maxLength={row.field === 'year' ? 4 : undefined}
                    onChange={(e) => onChangeCell(level, row.field, row.field === 'year' ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
                    placeholder={level === 'tert' && !collegeOn ? 'Not applicable' : row.placeholders[i]}
                    required={(level === 'prim' || (level === 'tert' && collegeOn)) && row.field !== 'honors'}
                    disabled={disabled || (level === 'tert' && !collegeOn)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
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
  { field: 'Dob', label: 'Date of Birth', placeholders: ['', '', ''] },
  { field: 'Contact', label: 'Contact No.', placeholders: ['e.g. 0917 123 4567', 'e.g. 0917 123 4567', 'e.g. N/A'] },
  { field: 'Education', label: 'Highest Educational Attainment', placeholders: ['e.g. College Graduate', 'e.g. College Graduate', 'e.g. N/A'] },
  { field: 'Employment', label: 'Employment Status', placeholders: ['e.g. Employed', 'e.g. Employed', 'e.g. N/A'] },
]
const PARENT_PEOPLE = ['mother', 'father', 'guardian']

const GUARDIAN_FIELDS = PARENT_ROWS.map((row) => `guardian${row.field}`)
function hasGuardianData(familyInfo) {
  return GUARDIAN_FIELDS.some((key) => {
    const v = String(familyInfo[key] || '').trim().toLowerCase()
    return v && v !== 'n/a' && v !== 'na' && v !== 'none'
  })
}

function ParentGuardianTable({ familyInfo, onChange, disabled: disabledProp }) {
  const lockedByPanel = useContext(FieldsLockedContext)
  const disabled = disabledProp || lockedByPanel
  // Oct 25 2026: the Guardian column used to take any text ("N/asdasd").
  // Now the applicant first says whether they have a guardian other than
  // their parents; if not, the column is cleared and locked.
  const [hasGuardian, setHasGuardian] = useState(() => (hasGuardianData(familyInfo) ? 'Yes' : 'No'))
  const chooseGuardian = (value) => {
    setHasGuardian(value)
    if (value === 'No') for (const key of GUARDIAN_FIELDS) onChange(key, '')
  }
  return (
    <>
    <div className="mfield" style={{ maxWidth: 520, marginBottom: 12 }}>
      <label>Do you have a guardian other than your parents?</label>
      <select value={hasGuardian} onChange={(e) => chooseGuardian(e.target.value)} disabled={disabled}>
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
    </div>
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
                      // Oct 25 2026: birthdates use the same calendar picker as
                      // the applicant's own (no typed MM/DD/YYYY, no future dates).
                      type={row.field === 'Dob' ? 'date' : 'text'}
                      max={row.field === 'Dob' ? latestBirthdate(15) : undefined}
                      min={row.field === 'Dob' ? earliestBirthdate(110) : undefined}
                      inputMode={row.field === 'Contact' ? 'tel' : undefined}
                      value={row.field === 'Dob' ? toDateInputValue(familyInfo[key]) : familyInfo[key]}
                      onChange={(e) => {
                        let v = e.target.value
                        const allowNA = person === 'guardian'
                        if (row.field === 'Contact') v = sanitizePhoneInput(v, allowNA)
                        onChange(key, v)
                      }}
                      placeholder={person === 'guardian' && hasGuardian === 'No' ? 'Not applicable' : row.placeholders[i]}
                      required={person !== 'guardian' || hasGuardian === 'Yes'}
                      disabled={disabled || (person === 'guardian' && hasGuardian === 'No')}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
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

function SiblingIncomeTable({ siblings, onChangeCell, onAddColumn, onRemoveColumn, disabled: disabledProp }) {
  const lockedByPanel = useContext(FieldsLockedContext)
  const disabled = disabledProp || lockedByPanel
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
                      type={row.field === 'dob' ? 'date' : 'text'}
                      max={row.field === 'dob' ? latestBirthdate() : undefined}
                      inputMode={row.field === 'contact' ? 'tel' : undefined}
                      value={row.field === 'dob' ? toDateInputValue(sib[row.field]) : sib[row.field]}
                      onChange={(e) => {
                        let v = e.target.value
                        if (row.field === 'contact') v = sanitizePhoneInput(v)
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
// Oct 6 2026: the row now shows the real steps of an upload as they happen:
// Checking file (type and size, in the browser), Securing (the browser
// computes the file's SHA-256 fingerprint), Uploading (the server checks
// photo quality, computes its own SHA-256 and saves the file), then Reading
// (the OCR worker) for documents that get read. The upload only counts as
// Secured when the two fingerprints match, i.e. the file arrived unchanged.
// The fingerprint itself is never shown to the applicant (it stays on the
// admin side).
const UPLOAD_STEPS = [
  { key: 'checking', now: 'Checking file', done: 'Checked' },
  { key: 'securing', now: 'Securing', done: 'Secured' },
  { key: 'uploading', now: 'Uploading', done: 'Uploaded' },
  { key: 'reading', now: 'Reading', done: 'Read' },
]
const NOT_READ_TYPES = ['profilepic'] // saved as verified right away, nothing to read
const CLIENT_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] // same list as /api/upload
const CLIENT_MAX_FILE_SIZE = 10 * 1024 * 1024 // same 10MB limit as /api/upload

// SHA-256 of a file, computed in the browser. Returns null if the browser
// can't (very old browsers, or a page not served over HTTPS); the upload
// still goes through and the server still fingerprints it.
async function sha256OfFile(file) {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

// Which section each document is uploaded in (the Documents & Status links
// go there now that the separate upload card is gone).
const DOC_UPLOAD_PLACE = {
  profilepic: { panel: 'personal', label: 'Personal Information' },
  birthcert: { panel: 'personal', label: 'Personal Information' },
  voterid: { panel: 'personal', label: 'Personal Information' },
  form138: { panel: 'academic', label: 'Educational Background' },
  parentid: { panel: 'personal', label: 'Personal Information' },
  employmentcert: { panel: 'financial', label: 'Family & Financial Information' },
  indigency: { panel: 'financial', label: 'Family & Financial Information' },
  supportdoc: { panel: 'appeals', label: 'Appeals & Rescheduling' },
  medcert: { panel: 'health', label: 'Health & Wellness' },
}

function UploadSteps({ phase, readable }) {
  const steps = readable ? UPLOAD_STEPS : UPLOAD_STEPS.slice(0, 3)
  const at = steps.findIndex((s) => s.key === phase)
  return (
    <div className="up-steps" role="status" aria-live="polite">
      {steps.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo'
        return (
          <span key={s.key} className="up-step-wrap">
            {i > 0 && <span className={`up-sep${i <= at ? ' done' : ''}`} aria-hidden="true" />}
            <span className={`up-step ${state}`}>
              <span className="up-dot" aria-hidden="true">
                {state === 'done' && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                )}
              </span>
              {state === 'done' ? s.done : s.now}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function SecuredChip() {
  return (
    <span className="up-chip" title="We saved a digital fingerprint of this file when it arrived. CCC uses it to confirm the document hasn't been changed.">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12.2l2.4 2.3 4.6-4.8" /></svg>
      Secured
    </span>
  )
}

function formatUploadedAt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  } catch {
    return ''
  }
}

// Oct 6 2026: replaces the old History drawer. Each upload row shows its own
// file (with View in a popup), the earlier uploads of the same document
// folded underneath, and what was read from it.
function UploadRowFiles({ files, onView }) {
  const [showOld, setShowOld] = useState(false)
  const [showText, setShowText] = useState(false)
  const latest = files[0]
  const older = files.slice(1)
  const hasText = !!(latest?.extracted_text || '').trim()
  if (!older.length && !hasText) return null
  return (
    <div className="up-files">
      <div className="up-file-links">
        {older.length > 0 && (
          <button type="button" className="up-fold" aria-expanded={showOld} onClick={() => setShowOld((v) => !v)}>
            {showOld ? 'Hide' : 'Show'} earlier uploads ({older.length})
          </button>
        )}
        {hasText && (
          <button type="button" className="up-fold" aria-expanded={showText} onClick={() => setShowText((v) => !v)}>
            {showText ? 'Hide what we read' : 'See what we read'}
          </button>
        )}
      </div>
      {showOld && older.length > 0 && (
        <>
          <ul className="up-old-list">
            {older.map((doc) => (
              <li key={doc.file_path}>
                <span className="up-old-name" title={getCleanFileName(doc.file_path)}>{getCleanFileName(doc.file_path)}</span>
                <span className="up-old-when">{formatUploadedAt(doc.created_at)}</span>
                <span className="up-old-tag">Replaced</span>
                <button type="button" className="up-view" onClick={() => onView(doc, true)}>
                  View
                </button>
              </li>
            ))}
          </ul>
          <p className="up-files-note">Only your latest upload is reviewed. Earlier ones stay on file for CCC&rsquo;s records.</p>
        </>
      )}
      {showText && hasText && (
        <>
          <div className="up-read-text">{latest.extracted_text}</div>
          <p className="up-files-note">
            This is the text we read to fill in your details. If something looks wrong, correct the field above or upload a
            clearer copy.
          </p>
        </>
      )}
    </div>
  )
}

function InlineUploadRow({ label, sublabel, required, status: statusProp, onFileSelected, disabled, docType, progress, reading, rejectionInside, id, files = [], onView }) {
  // Oct 21 2026: once reading finishes, the latest file's own review state
  // decides the card. Before, a file flagged after reading (or by the
  // content check) still showed as green "done".
  const latestFlagged = !!files[0]?.needs_review && files[0]?.review_status !== 'processing'
  const status = statusProp === 'done' && latestFlagged ? 'flagged' : statusProp
  const contentIssue = files[0]?.content_issue || ''
  const hasFile = ['done', 'flagged', 'uploading', 'queued'].includes(status)
  const readable = !NOT_READ_TYPES.includes(docType)
  const busy = status === 'uploading'
  const stillReading = !busy && reading && (status === 'done' || status === 'flagged')
  const justSecured = progress?.phase === 'done'
  const rowClass = busy ? ' is-busy' : stillReading ? ' is-reading' : status === 'flagged' ? ' is-flagged' : hasFile ? ' has-file' : ''
  return (
    <div id={id} className="upload-row-wrap">
      <div
        className={`upload-row${rowClass}${required ? ' required' : ''}`}
        style={disabled ? { opacity: 0.6 } : undefined}
      >
        <div className="upload-info">
          <div className="u-title">
            {label} {required && <span className="req-mark">*</span>}
          </div>
          {sublabel && !busy && !stillReading && status !== 'done' && status !== 'flagged' && <div className="u-sub">{sublabel}</div>}
          {busy && <UploadSteps phase={progress?.phase || 'checking'} readable={readable} />}
          {stillReading && <UploadSteps phase="reading" readable />}
          {status === 'done' && !stillReading && (
            <div className="up-done">
              <span className="u-filename">
                {files[0] ? `${getCleanFileName(files[0].file_path)} \u00b7 ${formatUploadedAt(files[0].created_at)}` : 'Uploaded \u2713'}
              </span>
              <SecuredChip />
            </div>
          )}
          {status === 'flagged' && !stillReading && (
            <div className="up-done">
              <span className="u-sub" style={{ color: 'var(--gold)', marginTop: 0 }}>
                {contentIssue
                  ? `Needs review: ${contentIssue} An admin will check it. If this is the wrong file, upload the correct one.`
                  : 'Uploaded. The text was hard to read, so an admin will check it. A clearer copy avoids delays.'}
              </span>
              <SecuredChip />
            </div>
          )}
          {status === 'rejected' && (
            rejectionInside && progress?.message
              ? <div className="u-sub" style={{ color: 'var(--red)', fontWeight: 600 }}>{progress.message}</div>
              : <div className="u-sub" style={{ color: 'var(--red)' }}>Not accepted. See the note below.</div>
          )}
          {status === 'error' && (
            <div className="u-sub" style={{ color: 'var(--red)' }}>{progress?.message || 'Upload failed. Please try again.'}</div>
          )}
          {status === 'queued' && (
            <div className="u-sub" style={{ color: 'var(--gold)' }}>
              No connection. Saved on this device, will upload automatically once you&rsquo;re back online.
            </div>
          )}
        </div>
        {!busy && files[0]?.publicUrl && onView && (status === 'done' || status === 'flagged' || stillReading) && (
          <button type="button" className="up-view" onClick={() => onView(files[0], false)}>
            View
          </button>
        )}
        {!busy && (
          <label className="upload-btn-label" style={disabled ? { cursor: 'not-allowed' } : undefined}>
            {/* Says "Change" once a file is already there, so it reads as a
                replace rather than a first upload. */}
            {status === 'done' || status === 'flagged' ? 'Change' : status === 'rejected' || status === 'error' ? 'Try again' : 'Upload'}
            <input
              type="file"
              accept={docType === 'profilepic' ? '.jpg,.jpeg,.png,image/jpeg,image/png' : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'}
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files[0]
                e.target.value = ''
                if (f) onFileSelected(f)
              }}
            />
          </label>
        )}
      </div>
      {!busy && files.length > 0 && onView && <UploadRowFiles files={files} onView={onView} />}
      {justSecured && !stillReading && (status === 'done' || status === 'flagged') && (
        <p className="up-secured-note">
          <b>Secured</b> means we saved a digital fingerprint of this file when it arrived and checked that it matches the
          file you sent. CCC uses it to confirm the document hasn&rsquo;t been changed.
        </p>
      )}
      {stillReading && (
        <p className="up-secured-note">
          Your file is saved and secured. Reading it can take up to a minute; this updates by itself, and you can keep
          filling in the form meanwhile.
        </p>
      )}
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
// Auto-fill (Sept 29): which extracted_fields value goes into which
// Personal Information input, per document. Keeps Ivy's applicant.html
// behavior contract (birth certificate -> name, birth date, birth place,
// sex; voter's ID -> address, precinct) with real OCR values instead of her
// hardcoded DOC_EXTRACTED_DATA. Citizenship and religion are on the same
// card and the same certificate, so they're filled too.
const AUTOFILL_FIELD_MAP = {
  birthcert: {
    first_name: 'firstName',
    middle_name: 'middleName',
    last_name: 'lastName',
    suffix: 'suffix',
    date_of_birth: 'dateOfBirth',
    place_of_birth: 'placeOfBirth',
    sex: 'sex',
    citizenship: 'citizenship',
    religion: 'religion',
  },
  voterid: {
    address: 'address',
    voter_precinct: 'voterPrecinct',
  },
}
const AUTOFILL_DOC_LABEL = { birthcert: 'Birth Certificate', voterid: "Voter's ID" }
const AUTOFILL_POLL_MS = 4000
const AUTOFILL_MAX_WAIT_MS = 150000 // the worker can take ~1.5 min to wake up

function AutofillNote({ note }) {
  if (!note) return null
  const color = { info: 'var(--muted)', done: 'var(--green)', warn: 'var(--gold)' }[note.tone] || 'var(--muted)'
  return <p className="field-note" style={{ color, marginTop: '8px' }}>{note.text}</p>
}


// Sept 30 2026: short save/submit feedback now pops up as a toast in the
// bottom-right corner (the toast from Ivy's admin.html mockup) instead of a
// line of text squeezed next to the buttons. Each state already resets to
// 'idle' after a few seconds, which is what makes the toast go away.
function StatusToast({ tone, children }) {
  if (!children) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast${tone === 'success' ? ' success' : tone === 'error' ? ' error' : ''}`}>{children}</div>
    </div>
  )
}

// ---------- Upload / submit pop-up (Oct 1 2026) ----------
// Pau's request: after an upload or the final Submit, applicants should get a
// clear "please wait" pop-up instead of a toast they might miss. The OK
// button stays locked for a few seconds so they actually read it
// (Oct 12 2026: 3 seconds, was 7).
//  - Birth Certificate / Voter's ID: shows "Reading your document..." and
//    switches to the auto-fill result as soon as it arrives (reading takes
//    about 15-30 seconds, up to a minute if the reading service was asleep).
//  - Other documents: says it's being checked and that Documents & Status
//    updates by itself (the page re-checks every few seconds, no refresh).
//  - Final Submit: confirms the application was submitted.
const UPLOAD_DOC_LABEL = {
  profilepic: 'Profile Picture',
  birthcert: 'Birth Certificate',
  voterid: "Voter's ID",
  form138: 'Grades (Form 138)',
  parentid: "Parent/Guardian's Voter's ID",
  employmentcert: 'Proof of Employment',
  indigency: 'Certificate of Indigency',
  medcert: 'Medical Certificate',
  supportdoc: 'Supporting Document',
}
const NOTICE_LOCK_SECONDS = 3
const SECTION_LABEL = {
  personal: 'Personal Information',
  academic: 'Educational Background',
  financial: 'Family & Financial Information',
  health: 'Health & Wellness',
}

function UploadNoticeDialog({ notice, autofillNote, onClose }) {
  const lockFor = notice.lockSeconds ?? NOTICE_LOCK_SECONDS
  const [secondsLeft, setSecondsLeft] = useState(lockFor)
  useEffect(() => {
    setSecondsLeft(lockFor)
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [notice])
  const locked = secondsLeft > 0

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !locked && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, onClose])

  const label = UPLOAD_DOC_LABEL[notice.docType] || 'document'
  const isAutofill = notice.kind === 'upload' && notice.autofill !== false && Boolean(AUTOFILL_FIELD_MAP[notice.docType])
  const stillReading = isAutofill && (!autofillNote || (autofillNote.tone === 'info' && /^Reading/.test(autofillNote.text)))

  let icon = '\u2713'
  let iconStyle = { background: '#E3F4EA', color: '#1E8E5A' }
  let title
  let body
  if (notice.kind === 'section') {
    const sectionLabel = SECTION_LABEL[notice.section] || 'Section'
    title = `${sectionLabel} submitted`
    body = (
      <>
        Your {sectionLabel} answers were saved and sent to the Guidance Office.{' '}
        {notice.section === 'health'
          ? 'You can still edit and re-submit this section any time.'
          : 'You can still edit and re-submit this section until you submit your application.'}
        {notice.newApplicationNumber ? (
          <>
            {'\n\n'}All your required documents are in. Your application number is <b>{notice.newApplicationNumber}</b>.
          </>
        ) : null}
      </>
    )
  } else if (notice.kind === 'autofill-result') {
    const warn = notice.note?.tone === 'warn'
    if (warn) {
      icon = '!'
      iconStyle = { background: '#FDF3E1', color: '#B7791F' }
    }
    title = warn ? (notice.note?.slow ? `Still reading your ${label}` : `We couldn\u2019t read your ${label}`) : `${label} read`
    body = notice.note?.text
  } else if (notice.kind === 'submit') {
    title = 'Application submitted'
    body = (
      <>
        {notice.applicationNumber ? (
          <>
            Your application number is <b>{notice.applicationNumber}</b>.{' '}
          </>
        ) : null}
        The Guidance Office will now review your documents. Please check <b>Messages</b> for your exam schedule and other
        updates.
      </>
    )
  } else if (isAutofill && stillReading) {
    icon = <span className="notice-spinner" aria-hidden="true" />
    iconStyle = { background: '#EAF0FB', color: 'var(--blue)' }
    title = `Reading your ${label}`
    body = locked ? (
      <>
        We&rsquo;re reading your {label} to fill in your details. This usually takes 15 to 30 seconds, sometimes up to a
        minute. Please stay on this page.
      </>
    ) : (
      <>
        Still reading your {label}. You can close this now; your details will fill in automatically when it&rsquo;s done.
        Please stay on this page.
      </>
    )
  } else if (isAutofill) {
    const warn = autofillNote?.tone === 'warn'
    if (warn) {
      icon = '!'
      iconStyle = { background: '#FDF3E1', color: '#B7791F' }
    }
    title = warn ? (autofillNote?.slow ? `Still reading your ${label}` : `We couldn\u2019t read your ${label}`) : `${label} read`
    body = autofillNote?.text
  } else if (notice.reviewStatus === 'processing') {
    title = `${label} uploaded`
    body = (
      <>
        We&rsquo;re checking it now. In <b>Documents &amp; Status</b> it shows as <b>Processing</b> for about a minute, then
        updates by itself. You don&rsquo;t need to refresh the page.
      </>
    )
  } else {
    title = `${label} uploaded`
    body = <>Your {label} was uploaded and saved.</>
  }

  return (
    <div className="confirm-overlay open" onClick={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div className="confirm-box" role="dialog" aria-modal="true" aria-live="polite" aria-label={title} style={{ maxWidth: 420 }}>
        <div className="confirm-icon" style={iconStyle}>
          {icon}
        </div>
        <h3>{title}</h3>
        <p style={{ whiteSpace: 'pre-line' }}>{body}</p>
        <div className="confirm-actions">
          <button type="button" className="mbtn mbtn-primary" onClick={onClose} disabled={locked}>
            {locked ? `OK (${secondsLeft})` : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Oct 6 2026: the note under a profile section's buttons. Before the final
// Submit a submitted section can still be edited and re-submitted; after
// it, Personal / Educational / Family & Financial are read-only.
// The small tag on each profile card: "Editable", or "Locked" after the
// final Submit (same FieldsLockedContext as the fields).
function EditableTag() {
  const locked = useContext(FieldsLockedContext)
  return locked ? <span className="tag tag-locked">Locked</span> : <span className="tag">Editable</span>
}

function SectionSubmittedNote({ at, locked, extra }) {
  if (locked) {
    return (
      <p className="text-[11px] font-semibold text-ccc-navy leading-snug">
        Your application has been submitted, so this section can no longer be changed here. If something needs to change,
        please contact the CCC Guidance Office.{extra ? <> {extra}</> : null}
      </p>
    )
  }
  if (!at) return null
  return (
    <p className="text-[11px] text-ccc-muted leading-snug">
      Submitted {new Date(at).toLocaleString()}. You can still edit and re-submit this section until you submit your
      application.
    </p>
  )
}

function SectionFormActions({ saveState, sectionState, error, disabled, saveDisabled, saveLabel, submitDisabled, submitLabel, onSaveDraft, onSubmit }) {
  return (
    <div>
      {/* The missing-fields error can be a multi-line list, so it stays
          above the buttons. The short status notes are toasts (Sept 30),
          so nothing appears or disappears next to the buttons. */}
      {error && <p className="save-note" style={{ color: 'var(--red)', whiteSpace: 'pre-line' }}>{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={onSaveDraft} disabled={disabled || saveDisabled || saveState === 'saving'} className="mbtn mbtn-primary">
          {saveState === 'saving' ? 'Saving…' : saveLabel || 'Save as Draft'}
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
      {saveState === 'saved' && <StatusToast tone="success">&#x2713; Progress saved</StatusToast>}
      {saveState === 'error' && <StatusToast tone="error">Couldn&rsquo;t save, please try again.</StatusToast>}
      {saveState === 'offline' && <StatusToast tone="info">No connection. Saved on this device, will sync automatically.</StatusToast>}
      {/* Oct 1 2026: a submitted section now gets the pop-up instead of this toast. */}
      {sectionState === 'error' && <StatusToast tone="error">Couldn&rsquo;t submit, please try again.</StatusToast>}
    </div>
  )
}

// Log-out confirmation modal — ported 1:1 from applicant.html's
// #logoutOverlay/.confirm-box markup (design-parity pass 4, Sept 19 2026).
// Previously "Log Out" logged the applicant out immediately with no
// confirmation step at all; spec always confirms first.
// Oct 6 2026: the final step of the application, at the top of Documents &
// Status. Shows what's left before Submit Application (the server checks the
// same things), and the confirmation popup before it's sent.
function FinalSubmitCard({ submitted, submittedAt, checks, blocked, saving, error, onSubmit }) {
  const ready = checks.every((c) => c.ok)
  if (submitted) {
    return (
      <div className="card final-card is-done">
        <div className="card-title">
          Application submitted <span className="tag">Final step</span>
        </div>
        <div className="final-done">
          <span className="final-done-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <div>
            <div className="final-done-title">
              Application submitted
              {submittedAt
                ? ` on ${new Date(submittedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}`
                : ''}
            </div>
            <div className="final-done-sub">Your documents are on file. This page keeps tracking their review status.</div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className={`card final-card${ready && !blocked ? ' is-ready' : ''}`}>
      <div className="card-title">
        Submit your application <span className="tag">Final step</span>
      </div>
      <div className="final-grid">
        <ul className="final-checks">
          {checks.map((c) => (
            <li key={c.title} className={c.ok ? 'ok' : ''}>
              <span className="final-mark" aria-hidden="true">{c.ok ? '\u2713' : '\u2022'}</span>
              <span>
                <b>{c.title}</b>
                <span className="final-note"> &middot; {c.note}</span>
                {!c.ok && c.onGo && (
                  <>
                    {' '}
                    <button type="button" className="final-go" onClick={c.onGo}>
                      Go there &rarr;
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="final-action">
          <button type="button" className="mbtn final-submit" disabled={!ready || blocked || saving} onClick={onSubmit}>
            {saving ? 'Submitting\u2026' : 'Submit Application'}
          </button>
          <span className="final-hint">
            {blocked
              ? 'Paused while applications are closed.'
              : ready
                ? 'Health & Wellness is completed during enrollment, so it isn\u2019t needed here.'
                : 'Finish the items on the left first.'}
          </span>
        </div>
      </div>
      {error && <p className="final-error" role="alert">{error}</p>}
    </div>
  )
}

// Oct 6 2026: View opens the file in a popup inside the portal instead of
// sending the applicant to the storage link. Same idea as the admin's
// document preview: images show as images, PDFs in a frame.
function FilePreviewModal({ preview, onClose }) {
  useEffect(() => {
    if (!preview) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onClose])
  if (!preview) return null
  const { doc, old } = preview
  const name = getCleanFileName(doc.file_path)
  const isPdf = /\.pdf$/i.test(doc.file_path || '')
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(doc.file_path || '')
  const status = old
    ? { label: 'Replaced', cls: 'is-old' }
    : doc.review_status === 'processing' && !doc.needs_review
      ? { label: 'Processing', cls: 'is-wait' }
      : doc.needs_review
        ? { label: 'Needs review', cls: 'is-warn' }
        : docState(doc) === 'checked'
          ? { label: 'System check passed', cls: 'is-wait' }
          : { label: 'Verified', cls: 'is-ok' }
  return (
    <div
      className="fp-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="fp-box" role="dialog" aria-modal="true" aria-labelledby="fpTitle">
        <div className="fp-head">
          <div className="fp-titles">
            <span id="fpTitle" className="fp-title">{getDocTypeLabel(doc.document_type)}</span>
            <span className="fp-sub">
              {name} &middot; {formatUploadedAt(doc.created_at)} <span className={`fp-chip ${status.cls}`}>{status.label}</span>
            </span>
          </div>
          {doc.publicUrl && (
            <a className="fp-download" href={doc.publicUrl} download={name} target="_blank" rel="noreferrer">
              Download
            </a>
          )}
          <button type="button" className="fp-close" aria-label="Close" onClick={onClose}>
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="fp-body">
          {isImage && doc.publicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.publicUrl} alt={name} className="fp-img" />
          ) : isPdf && doc.publicUrl ? (
            <iframe src={doc.publicUrl} title={name} className="fp-frame" />
          ) : (
            <div className="fp-none">
              <IconFile className="w-10 h-10" />
              <span>Preview isn&rsquo;t available for this file. You can still download it.</span>
            </div>
          )}
        </div>
        <div className="fp-foot">
          {old
            ? 'An earlier copy, kept for CCC\u2019s records. Only your latest upload is reviewed.'
            : 'This is the copy CCC reviews. Press Esc or click outside to close.'}
        </div>
      </div>
    </div>
  )
}

function SubmitConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null
  return (
    <div
      className="confirm-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="submitConfirmTitle">
        <div className="confirm-icon confirm-icon-submit" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
        </div>
        <h3 id="submitConfirmTitle">Submit your application?</h3>
        <p>
          Please check your answers and documents first. Once you submit, CCC will review your application and place you
          in the next exam schedule. This can&rsquo;t be undone.
        </p>
        <div className="confirm-actions">
          <button type="button" className="mbtn mbtn-ghost" onClick={onCancel}>
            Go back and check
          </button>
          <button type="button" className="mbtn mbtn-primary" onClick={onConfirm}>
            Yes, submit
          </button>
        </div>
      </div>
    </div>
  )
}

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
// for a valid applicant session cookie before rendering the portal at all.
//
// Sept 23, 2026: this used to render ApplicantAuth (Login / 4-step Signup)
// inline for logged-out visitors, because this file lived at the site
// root ("/") and there was no public welcome page in front of it. Now
// that a real public welcome page exists at "/" (see app/page.js) and
// login/signup has its own dedicated route (app/login/page.js), a
// logged-out visitor here gets redirected to /login instead — this route
// (/portal) is applicant-account-only from here on.
// Sept 30 2026: what the dashboard's Admission card says once a result has
// been released to the applicant. Details are in the result message itself.
const ADMISSION_RESULT_TEXT = {
  passer: { label: 'Qualified as a Student', note: 'Check Messages for your medical exam and pre-registration steps.' },
  waitlisted_probationary: { label: 'Waitlisted (Probationary)', note: 'You are on the waiting list. Check Messages for details.' },
  qualified_probationary: { label: 'Qualified as a Student (Probationary)', note: 'Check Messages for how to sign your probationary contract.' },
  forfeited: { label: 'Forfeited', note: 'Check Messages for what to do next.' },
  disqualified: { label: 'Not Qualified', note: 'Check Messages for details.' },
}

// Oct 16 2026: the dashboard's "Step N of 6" follows the applicant's real
// progress. It used to stop at Step 3 (Awaiting Document Verification) for
// everyone who had submitted, even after the exam and enrollment.
//   1 Account created (never shown here: the dashboard needs an account)
//   2 Filling out the profile / Ready to Submit
//   3 Documents still being checked (or one flagged for re-upload)
//   4 All documents verified: waiting for, or scheduled for, the exam
//   5 Exam result released to this applicant
//   6 Enrollment complete
// Steps 5 and 6 only use what /api/application sends once a result is
// released (releasedStatus, releasedDistribution), so the card never shows
// a result before the Guidance Office sends it.
function applicationStep({ submitted, readyToSubmit, needsAttention, hasDocs, flagged, processing, eligibilityStatus, examDate, releasedStatus, releasedDistribution }) {
  if (!submitted && needsAttention) {
    return {
      num: 2,
      label: 'Needs Attention',
      tone: 'warn',
      desc: `${needsAttention}. You can submit your application once it is verified: upload the correct file, or wait for the Guidance Office to verify it.`,
    }
  }
  if (!submitted) {
    return {
      num: 2,
      label: readyToSubmit ? 'Ready to Submit' : 'Filling Out Profile',
      desc: readyToSubmit
        ? 'Everything needed is in. Submit your application from Documents & Status to be counted for the exam schedule.'
        : hasDocs
        ? "You've started your application. Keep working through the sections below, then submit from Documents & Status when you're ready."
        : "You've created and verified your account. You're now completing your applicant profile.",
    }
  }
  const result = releasedStatus ? ADMISSION_RESULT_TEXT[releasedStatus] : null
  if (result) {
    const admitted = releasedStatus === 'passer' || releasedStatus === 'qualified_probationary'
    if (admitted && releasedDistribution === 'enrollment_complete') {
      return {
        num: 6,
        label: 'Enrollment Complete',
        desc: "You're enrolled as a CCC scholar. Allowance updates from the Office of the College Registrar will appear in Messages.",
      }
    }
    return { num: 5, label: `Result: ${result.label}`, desc: `Your exam result has been released. ${result.note}` }
  }
  if (flagged > 0) {
    return {
      num: 3,
      label: 'Awaiting Document Verification',
      desc: `${flagged === 1 ? 'One of your documents needs' : `${flagged} of your documents need`} attention. Open Documents & Status to see which, and upload a clearer or corrected copy.`,
    }
  }
  if (processing > 0) {
    return {
      num: 3,
      label: 'Awaiting Document Verification',
      desc: "Your application is submitted and on file. You'll see document statuses update on the Documents & Status panel as they're reviewed.",
    }
  }
  if (eligibilityStatus === 'not_met') {
    return {
      num: 3,
      label: 'Requirement Not Met',
      desc: "One of the automatic requirements isn't met. See the Eligibility Check below for what to fix, or contact the Guidance Office.",
    }
  }
  if (examDate) {
    return {
      num: 4,
      label: 'Exam Scheduled',
      desc: `Your documents are verified. Your entrance exam is on ${examDate}. Details are in Messages.`,
    }
  }
  return {
    num: 4,
    label: 'Awaiting Entrance Exam',
    desc: 'Your documents are verified. The Guidance Office will send your entrance exam schedule in Messages.',
  }
}

export default function PortalPage() {
  const router = useRouter()
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

  useEffect(() => {
    if (accountSession === null) {
      router.replace('/login')
    }
  }, [accountSession, router])

  if (accountSession === undefined || accountSession === null) {
    return <LoadingScreen />
  }

  return (
    <PortalApp
      accountSession={accountSession}
      onLogout={async () => {
        await fetch('/api/applicant-logout', { method: 'POST' }).catch(() => {})
        router.replace('/login')
      }}
    />
  )
}

function PortalApp({ accountSession, onLogout }) {
  const [applicantName, setApplicantName] = useState(accountSession.name || '')
  const [applicantEmail, setApplicantEmail] = useState(accountSession.email || '')
  const [docHistory, setDocHistory] = useState([])
  // Oct 5 2026: false until the first document and application loads have
  // finished, so the Dashboard shows skeletons instead of briefly showing
  // "Step 2 of 6" and every milestone Locked before the real progress loads.
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [appLoaded, setAppLoaded] = useState(false)
  // Oct 6 2026: the file shown in the View popup ({ doc, old }).
  const [preview, setPreview] = useState(null)
  const openPreview = (doc, old) => setPreview({ doc, old })
  const [statusRequested, setStatusRequested] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('personal') // sidebar panel key — replaces the old linear step wizard
  const [submitted, setSubmitted] = useState(false)
  const [submittedAt, setSubmittedAt] = useState(null) // for the real Application History & Activity Log, below
  // Oct 6 2026: once the final Submit is done, Personal, Educational and
  // Family & Financial are read-only (see FieldsLockedContext). Health &
  // Wellness and uploads stay open.
  const profileLocked = submitted
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error' | 'offline'

  // Per-section "Submit Section" state (design-parity pass 3) — separate
  // from personalInfo/academicInfo so those objects stay a clean 1:1 map to
  // their DB columns. Only Educational Background actually locks once
  // submitted (matches applicant.html's submitSection()/lockPanelFields());
  // Personal Information's submit is just a checkpoint marker, fields stay
  // editable indefinitely like the rest of the profile.
  const [personalSubmittedAt, setPersonalSubmittedAt] = useState(null)
  const [academicSubmittedAt, setAcademicSubmittedAt] = useState(null)
  const [savedScreening, setSavedScreening] = useState({})
  const [healthSubmittedAt, setHealthSubmittedAt] = useState(null)
  const [financialSubmittedAt, setFinancialSubmittedAt] = useState(null)
  // Sept 20 2026: the sidebar's "Applicant No." — null until
  // /api/application reports every required document type is on file
  // (see maybeAssignApplicationNumber() in app/api/application/route.js
  // for the real required set and why it's a one-way assignment). Set
  // from both the initial GET on load and whatever save/submit response
  // comes back, same as every other *SubmittedAt state above.
  const [applicationNumber, setApplicationNumber] = useState(null)
  const [referenceNo, setReferenceNo] = useState(null)
  // Sept 30 2026: the applicant's released result, if any. /api/application
  // only includes scholar_status once "Exam Results Visible to Applicants"
  // is on AND an admin has sent this applicant their result.
  const [releasedStatus, setReleasedStatus] = useState(null)
  // Oct 16 2026: the released distribution status (only sent with a
  // released result), for the dashboard's Step 6 (Enrollment Complete).
  const [releasedDistribution, setReleasedDistribution] = useState(null)
  // Oct 12 2026: the applicant's own eligibility checklist (see
  // applicantEligibility in app/lib/matching.js), sent by /api/application.
  const [eligibility, setEligibility] = useState(null)
  // Sept 30 2026: the applicant's exam schedule, once an admin has sent it.
  const [examSchedule, setExamSchedule] = useState(null)
  // Oct 5 2026: end-of-cycle archive. The application is read-only.
  const [archived, setArchived] = useState(false)
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
    emailUpdatesOptIn: false, termsCertified: false, privacyAgreed: false,
    // ---- Card 4 (Additional Information) ----
    lgbtqi: '', disability: '', soloParent: '', indigenousMember: '', underprivileged: '', hobbies: '',
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
    // Sept 29: only follow the form once BOTH names are filled in. While one
    // is blank (being retyped, or cleared), keep the last full name, so an
    // upload made in that moment isn't filed under just "Aragon" and shown
    // as a separate applicant on the admin side.
    const first = personalInfo.firstName.trim()
    const last = personalInfo.lastName.trim()
    if (!first || !last) return
    const derived = `${first} ${last}`
    if (derived !== applicantName) {
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
    transfereeGwa: '', transfereeUnitsPassed: '', transfereeFailingGrade: '', shsFailingGrade: '',
    shsMathScienceLowest: '',
  })
  // Oct 6 2026: Appendix J p. 96 rule a. BSEd Mathematics / Science need 85
  // or higher in every SHS Mathematics and Science subject, so the lowest of
  // those grades is asked when either choice is one of them.
  const bsedChoiceNames = [academicInfo.choice1, academicInfo.choice2]
    .filter((v) => BSED_MATH_SCIENCE_PROGRAMS.has(v))
    .map((v) => (v.endsWith('Mathematics') ? 'BSEd Mathematics' : 'BSEd Science'))
  const needsShsGrade = bsedChoiceNames.length > 0
  const shsGradeText = String(academicInfo.shsMathScienceLowest ?? '').trim()
  const shsGradeValid = /^\d{2,3}(\.\d{1,2})?$/.test(shsGradeText) && Number(shsGradeText) >= 60 && Number(shsGradeText) <= 100
  // Oct 15 2026 (client): the 2nd priority program can't repeat the 1st.
  // Picking a 1st choice that matches the 2nd clears the 2nd.
  const updateAI = (field, value) =>
    setAcademicInfo((a) => ({ ...a, [field]: value, ...(field === 'choice1' && value && value === a.choice2 ? { choice2: '' } : {}) }))

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
    academicInfo.choice2 !== academicInfo.choice1 &&
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
        academicInfo.transfereeFailingGrade)) &&
    // Nov 2026: an Educational Background submitted before the First Year
    // grade question existed still counts as done (the question can still be
    // answered once); new applicants answer it at sign-up.
    (academicInfo.applyingAs !== 'First Year' || !!academicInfo.shsFailingGrade || !!academicSubmittedAt) &&
    (!needsShsGrade || shsGradeValid)

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
  // Family & Financial panel uploads — employmentcert
  // (required only when workingStudent === 'Yes'), indigency (optional).
  // Same idle/uploading/done/flagged/rejected/error/queued contract as
  // every other inline upload row in this file.
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
  // Oct 6 2026: the current step of each section upload, per document type:
  // { phase: 'checking' | 'securing' | 'uploading' | 'done' | null, message }
  const [uploadProgress, setUploadProgress] = useState({})
  // Oct 6 2026: why the final Submit is closed right now (Applications Open
  // off, outside the acceptance dates, or slots full), from /api/application.
  const [submitBlocked, setSubmitBlocked] = useState(null)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [uploadNotice, setUploadNotice] = useState(null) // Oct 1 2026: { kind: 'upload' | 'autofill-result' | 'section' | 'submit', ... }
  const uploadNoticeRef = useRef(null)
  useEffect(() => { uploadNoticeRef.current = uploadNotice }, [uploadNotice])
  const [rescheduleError, setRescheduleError] = useState('')
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
  // Oct 16 2026: { [postId]: acknowledgedAt } for this applicant.
  const [acknowledged, setAcknowledged] = useState({})

  useEffect(() => {
    fetch('/api/portal-messages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMessages(data.posts)
          setAcknowledged(data.acknowledged || {})
        }
        else setMessagesError(data.error || 'Failed to load messages.')
      })
      .catch((err) => setMessagesError(err.message))
      .finally(() => setMessagesLoading(false))
    // Oct 16 2026: a new announcement or message shows up (and pops up for
    // confirmation) without a refresh: checked every 5 s while the tab is
    // visible, and when the applicant comes back to the tab. Hidden tabs
    // don't check, and a check never starts while the last one is running.
    let busy = false
    const refresh = () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      fetch('/api/portal-messages')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMessages(data.posts)
            setAcknowledged((prev) => ({ ...(data.acknowledged || {}), ...prev }))
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
  }, [])

  // Posts still waiting for "I have read and understood", oldest first.
  const pendingAcks = messages
    .filter((m) => m.requires_ack === true && !acknowledged[m.id])
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  const confirmAck = async (id) => {
    const res = await fetch('/api/portal-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not save. Please try again.')
    setAcknowledged((prev) => ({ ...prev, [id]: data.acknowledgedAt || new Date().toISOString() }))
  }

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

  // Nov 2026 (panel revisions, priority 4 / S4): the eligibility screening
  // (app/lib/screening.js). Same rules as the server; GET /api/upload only
  // returns this applicant's own documents, so docHistory is used as is.
  const screening = screeningResult(
    {
      academic_submitted_at: academicSubmittedAt,
      personal_info_submitted_at: personalSubmittedAt,
      fam_financial_submitted_at: financialSubmittedAt,
      status: profileLocked ? 'submitted' : null,
      applying_as: academicInfo.applyingAs,
      shs_failing_grade: academicInfo.shsFailingGrade,
      transferee_gwa: academicInfo.transfereeGwa,
      transferee_units_passed: academicInfo.transfereeUnitsPassed,
      transferee_failing_grade: academicInfo.transfereeFailingGrade,
    },
    docHistory
  )
  // The screening answers saved at sign-up are locked (an empty one can be
  // filled in once, e.g. on an application from before this change).
  const screeningLocked = !profileLocked && !!savedScreening.applying_as

  // Has this applicant (by name) already uploaded a document of this type?
  // Drives the "Uploaded" state on the three inline Personal Information
  // uploads (cards 1-3) so a returning applicant doesn't see them as empty.
  const hasUploaded = (type) => myDocs.some((doc) => doc.document_type === type)
  // Oct 1 2026: a Supporting Document counts for the next request only if it
  // was uploaded after their last request and isn't attached to one yet (same
  // rule as /api/reschedule's POST), so an old file doesn't show as ready.
  const lastRequestAt = rescheduleHistory.reduce((max, r) => (r.created_at > max ? r.created_at : max), '')
  const attachedPaths = new Set(rescheduleHistory.map((r) => r.supporting_document_path).filter(Boolean))
  const hasUnattachedSupportDoc = myDocs.some(
    (doc) =>
      doc.document_type === 'supportdoc' &&
      !attachedPaths.has(doc.file_path) &&
      (!lastRequestAt || new Date(doc.created_at) > new Date(lastRequestAt))
  )

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
  // Oct 6 2026: every upload per document type, newest first (myDocs is
  // already newest first). Shown in each section's upload row.
  const docsByType = {}
  for (const doc of myDocs) {
    if (!doc.document_type) continue
    ;(docsByType[doc.document_type] = docsByType[doc.document_type] || []).push(doc)
  }

  // Oct 6 2026: what's left before the final Submit Application. Mirrors the
  // server's check in /api/application (sections submitted + required
  // documents, Proof of Employment only for a working student).
  // Oct 15 2026 (client): one Voter's ID box. The applicant's own, or a
  // parent's/guardian's if they aren't a registered voter yet. Files from the
  // former separate parent/guardian slot (parentid) still count, and show
  // here only when there is no upload in the Voter's ID box itself.
  const voterIdFiles = (docsByType.voterid || []).length > 0 ? docsByType.voterid : docsByType.parentid || []
  const hasVoterIdOnFile = hasUploaded('voterid') || hasUploaded('parentid')
  const requiredDocsForSubmit = ['profilepic', 'birthcert', 'voterid', 'form138']
  if (familyInfo.workingStudent === 'Yes') requiredDocsForSubmit.push('employmentcert')
  const missingDocsForSubmit = requiredDocsForSubmit.filter((t) => !(t === 'voterid' ? hasVoterIdOnFile : hasUploaded(t)))
  // Oct 26 2026 (panel): a required document whose latest upload is flagged
  // or still being read blocks the final Submit, so no application with an
  // unverified document reaches the office. Re-uploading the right file, or
  // an admin verifying it, unblocks it. Mirrors the server check.
  const latestFileFor = (t) => (t === 'voterid' ? voterIdFiles[0] : (docsByType[t] || [])[0])
  const reviewDocsForSubmit = requiredDocsForSubmit
    .filter((t) => !missingDocsForSubmit.includes(t))
    .map((t) => ({ type: t, doc: latestFileFor(t) }))
    .filter(({ doc }) => doc && (doc.needs_review || doc.review_status === 'processing'))
  const reviewNote = reviewDocsForSubmit.length
    ? reviewDocsForSubmit
        .map(({ type, doc }) =>
          doc.review_status === 'processing' && !doc.needs_review
            ? `${getDocTypeLabel(type)} is still being read`
            : `${getDocTypeLabel(type)} needs review${doc.content_issue ? ` (${doc.content_issue.replace(/\.$/, '')})` : ''}`
        )
        .join('; ')
    : ''
  const goToSection = (panel) => () => {
    setActivePanel(panel)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const finalSubmitChecks = [
    { title: 'Personal Information', ok: !!personalSubmittedAt, note: personalSubmittedAt ? 'submitted' : 'not submitted yet', onGo: goToSection('personal') },
    { title: 'Educational Background', ok: !!academicSubmittedAt, note: academicSubmittedAt ? 'submitted' : 'not submitted yet', onGo: goToSection('academic') },
    { title: 'Family & Financial Information', ok: !!financialSubmittedAt, note: financialSubmittedAt ? 'submitted' : 'not submitted yet', onGo: goToSection('financial') },
    {
      title: 'Required documents',
      ok: missingDocsForSubmit.length === 0 && reviewDocsForSubmit.length === 0,
      note:
        missingDocsForSubmit.length
          ? `still needed: ${missingDocsForSubmit.map((t) => getDocTypeLabel(t)).join(', ')}`
          : reviewDocsForSubmit.length
          ? `${reviewNote}. Upload the correct file, or wait for the Guidance Office to verify it.`
          : 'all uploaded and verified',
      onGo: missingDocsForSubmit.length
        ? () => jumpToUploadFor(missingDocsForSubmit[0])
        : reviewDocsForSubmit.length
        ? () => jumpToUploadFor(reviewDocsForSubmit[0].type)
        : null,
    },
  ]

  // Oct 6 2026: Documents & Status rows for documents that don't apply to
  // this applicant (yet). Their upload areas only show when they apply:
  // Proof of Employment for a working student, Proof of Income in the
  // siblings' income card (not an only child). Neither is in CCC's list of
  // requirements (Appendix D, interview #2). The medical certificate comes
  // after passing the exam; a supporting document only with a request.
  // Oct 15 2026: Documents & Status shows one Voter's ID row. A file in the
  // former parent/guardian slot (parentid) is shown on that row only when
  // nothing was uploaded in the Voter's ID box.
  const statusTableGroups = DOCUMENT_TYPE_OPTIONS.map((g) => ({ ...g, options: g.options.filter((o) => o.value !== 'parentid') })).filter(
    (g) => g.options.length > 0
  )
  const statusTableDocs = hasUploaded('voterid')
    ? myDocs.filter((d) => d.document_type !== 'parentid')
    : myDocs.map((d) => (d.document_type === 'parentid' ? { ...d, document_type: 'voterid' } : d))

  const docRowRules = {
    employmentcert:
      familyInfo.workingStudent === 'Yes'
        ? {}
        : { badge: 'Not needed', note: 'Only for working students.', noLink: true, notCounted: true },
    indigency: { badge: 'Optional', note: "Optional. You can add it under Applicant's Employment.", notCounted: true },
    medcert: { badge: 'Later', note: 'After you pass the exam, during enrollment.', notCounted: true },
    supportdoc: { badge: 'Optional', note: 'Only for appeals or reschedule requests.', notCounted: true },
  }

  // Oct 6 2026: document types whose latest upload is still being read, so
  // each section's upload row can show its Reading step.
  const readingTypes = new Set(
    latestDocsByType.filter((d) => d.review_status === 'processing' && !d.needs_review).map((d) => d.document_type)
  )
  const flaggedCount = latestDocsByType.filter((doc) => doc.needs_review).length
  // Sept 29: still waiting on the OCR worker, so neither verified nor flagged yet.
  const processingCount = latestDocsByType.filter((doc) => doc.review_status === 'processing' && !doc.needs_review).length

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
    familyInfo.workingStudent &&
    (familyInfo.workingStudent !== 'Yes' || employmentCertStatus === 'done' || hasUploaded('employmentcert'))

  // Used by the status table's "Upload" / "Re-upload" buttons: pre-selects
  // that document type in the form below and scrolls it into view.
  // Oct 6 2026: the Documents & Status "Upload" links open the section the
  // document belongs to and scroll to its upload row (the separate upload
  // card was removed; every document has its own spot in its section).
  const jumpToUploadFor = (typeValue) => {
    const place = DOC_UPLOAD_PLACE[typeValue]
    if (!place) return
    setActivePanel(place.panel)
    setTimeout(() => {
      const row = document.getElementById(`up-${typeValue}`)
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
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
      if (data.application?.reference_number) setReferenceNo(data.application.reference_number)
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
  // it'll submit. Oct 6 2026: Educational Background no longer locks after
  // its own Submit Section (that lock only greyed out the screen and came
  // from the HTML mockup). Instead, Personal, Educational and Family &
  // Financial all become read-only once the final Submit is done
  // (profileLocked / FieldsLockedContext), and the server enforces it.
  const submitSection = async (section) => {
    if (!applicantName.trim()) return
    setSectionErrors((e) => ({ ...e, [section]: '' }))

    if (section === 'personal') {
      const missing = []
      if (!(profilePicStatus === 'done' || hasUploaded('profilepic'))) missing.push('Profile Picture')
      if (!(birthCertStatus === 'done' || hasUploaded('birthcert'))) missing.push('Birth Certificate / PSA / NSO')
      if (!(voterIdStatus === 'done' || hasVoterIdOnFile)) missing.push("Voter's ID / Certification of Applicant or Parent/Guardian")
      if (missing.length) {
        setSectionErrors((e) => ({
          ...e,
          personal: `Please upload the following required document(s) before submitting: ${missing.join(', ')}`,
        }))
        return
      }
    }

    if (section === 'academic' && academicInfo.choice1 && academicInfo.choice1 === academicInfo.choice2) {
      setSectionErrors((e) => ({ ...e, academic: 'Your Second Priority Program must be different from your First Priority Program.' }))
      return
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

    // Oct 21 2026: format rules (app/lib/fieldValidation.js), the same ones
    // the server checks when the section is submitted.
    const formatProblems =
      section === 'personal' ? validatePersonalInfo(personalInfo)
      : section === 'academic' ? validateAcademicInfo(academicInfo)
      : section === 'financial' ? validateFamilyInfo(familyInfo)
      : []
    if (formatProblems.length) {
      setSectionErrors((e) => ({ ...e, [section]: `Please fix the following before submitting: ${errorSummary(formatProblems)}` }))
      return
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
      if (data.application && 'eligibility' in data.application) setEligibility(data.application.eligibility || null)
      if (section === 'personal') setPersonalSubmittedAt(data.application.personal_info_submitted_at)
      if (section === 'academic') setAcademicSubmittedAt(data.application.academic_submitted_at)
      if (section === 'health') setHealthSubmittedAt(data.application.health_submitted_at)
      if (section === 'financial') setFinancialSubmittedAt(data.application.fam_financial_submitted_at)
      // Not scoped to a particular section — the required-documents check
      // runs on every save regardless of which section was just submitted,
      // so this section's submit could be the one that pushes an
      // already-complete document set over the line.
      const newNumber = data.application.application_number && data.application.application_number !== applicationNumber
        ? data.application.application_number
        : null
      if (data.application.application_number) setApplicationNumber(data.application.application_number)
      setState('submitted')
      setTimeout(() => setState('idle'), 1800)
      setUploadNotice({ kind: 'section', section, newApplicationNumber: newNumber })
    } catch (err) {
      console.error('Submit section failed:', err)
      // Oct 21 2026: show the server's reason (e.g. a format rule) instead
      // of a generic message when there is one.
      const reason = err?.message && !['Submit failed', 'Failed to fetch'].includes(err.message) ? err.message : null
      setSectionErrors((e) => ({ ...e, [section]: reason || 'Could not submit this section. Please try again.' }))
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
      if (!res.ok || data.error) {
        // Oct 6 2026: show the server's reason (closed, missing sections or
        // documents) on the Submit card instead of failing silently.
        setSubmitError(res.status >= 400 && res.status < 500 && data.error ? data.error : 'Something went wrong while submitting. Please try again.')
        if (res.status === 403) setSubmitBlocked(data.error || null)
        throw new Error(data.error || 'Submit failed')
      }
      setSubmitError('')
      setSaveState('idle')
      setSubmitted(true)
      if ('eligibility' in data.application) setEligibility(data.application.eligibility || null)
      setSubmittedAt(data.application.submitted_at || null)
      if (data.application.application_number) setApplicationNumber(data.application.application_number)
      setUploadNotice({ kind: 'submit', applicationNumber: data.application.application_number || null })
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
        if (!cancelled) setSubmitBlocked(data.submitBlocked || null)
        if (cancelled || !data.application) return
        setPersonalInfo(mapDbRowToPersonalInfo(data.application))
        setAcademicInfo(mapDbRowToAcademicInfo(data.application))
        setSavedScreening({
          applying_as: data.application.applying_as || '',
          shs_failing_grade: data.application.shs_failing_grade || '',
          transferee: data.application.transferee_failing_grade || '',
        })
        setHealthInfo(mapDbRowToHealthInfo(data.application))
        setFamilyInfo(mapDbRowToFamilyInfo(data.application))
        setPersonalSubmittedAt(data.application.personal_info_submitted_at || null)
        setAcademicSubmittedAt(data.application.academic_submitted_at || null)
        setHealthSubmittedAt(data.application.health_submitted_at || null)
        setFinancialSubmittedAt(data.application.fam_financial_submitted_at || null)
        setApplicationNumber(data.application.application_number || null)
        setReferenceNo(data.application.reference_number || null)
        setReleasedStatus(data.application.scholar_status || null)
        setReleasedDistribution(data.application.distribution_status || null)
        setEligibility(data.application.eligibility || null)
        setExamSchedule(data.application.exam_schedule || null)
        setArchived(!!data.application.archived)
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
      } finally {
        if (!cancelled) setAppLoaded(true)
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

  // Oct 21 2026: a rejected photo (not square, not a white background)
  // was never saved, so stop showing it as the avatar.
  useEffect(() => {
    if (profilePicStatus === 'rejected' || profilePicStatus === 'error') setProfilePicPreviewUrl(null)
  }, [profilePicStatus])

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
    personalInfo.soloParent &&
    personalInfo.indigenousMember &&
    personalInfo.underprivileged &&
    personalInfo.hobbies.trim() &&
    personalInfo.motivation.trim() &&
    personalInfo.selfDescription.trim() &&
    personalInfo.tenYears.trim()

  const requiredInlineUploadsComplete =
    (profilePicStatus === 'done' || profilePicStatus === 'flagged' || hasUploaded('profilepic')) &&
    (birthCertStatus === 'done' || birthCertStatus === 'flagged' || hasUploaded('birthcert')) &&
    (voterIdStatus === 'done' || voterIdStatus === 'flagged' || hasVoterIdOnFile)

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
    } finally {
      setHistoryLoaded(true)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Oct 1 2026: while any document is still Processing (the reading service
  // hasn't finished it yet), re-check every 5 seconds so its status changes
  // to Verified / Needs review by itself, with no page refresh. Stops once
  // nothing is processing, or after 3 minutes in case the service is down.
  const hasProcessingDoc = myDocs.some((doc) => doc.review_status === 'processing' && !doc.needs_review)
  useEffect(() => {
    if (!hasProcessingDoc) return undefined
    const startedAt = Date.now()
    const t = setInterval(() => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        clearInterval(t)
        return
      }
      fetchHistory()
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProcessingDoc])

  // Oct 6 2026: if a document is still being read after about 30 seconds,
  // send the reading service another wake-up call (and once more at about
  // 90 seconds). The upload already wakes it once; this covers the times
  // that first call doesn't get through, so documents never sit waiting
  // until someone restarts the service. /api/ocr-wake only does anything
  // when this applicant really has a document waiting.
  useEffect(() => {
    if (!hasProcessingDoc) return undefined
    const nudge = () => fetch('/api/ocr-wake', { method: 'POST' }).catch(() => {})
    const first = setTimeout(nudge, 30000)
    const second = setTimeout(nudge, 90000)
    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, [hasProcessingDoc])


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
    setRescheduleError('')
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
      if (!res.ok || data.error) {
        // Show the server's reason (e.g. the missing supporting document)
        // and keep what they typed.
        setRescheduleError(data.error || 'Couldn\u2019t submit, please try again.')
        setRescheduleSaveState('error')
        setTimeout(() => setRescheduleSaveState('idle'), 6000)
        return
      }
      setRescheduleSaveState('saved')
      setRescheduleType('')
      setRescheduleDetails('')
      setSupportDocStatus('idle')
      fetchRescheduleHistory()
      setTimeout(() => setRescheduleSaveState('idle'), 2500)
    } catch (err) {
      console.error('Reschedule submit failed:', err)
      setRescheduleSaveState('error')
      setTimeout(() => setRescheduleSaveState('idle'), 3000)
    }
  }

  // Close the history drawer on outside click / Escape

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
      err.status = res.status
      err.rejected = data.rejected
      err.reason = data.reason
      err.rejectionMessage = data.message
      throw err
    }
    return data
  }



  // Inline upload handler for the Personal Information cards — same
  // uploadDocument() call as Step 2, but reports through a compact
  // per-field status instead of the shared status/qualityRejection state
  // (three of these can be in flight independently across cards 1-3).
  // ---- Auto-fill from uploaded documents (Sept 29) ----
  // personalInfoRef mirrors the latest form values so the watcher below can
  // tell which inputs are still empty when the OCR result arrives, even
  // though it was started from an older render.
  const personalInfoRef = useRef(personalInfo)
  useEffect(() => { personalInfoRef.current = personalInfo }, [personalInfo])
  const [autofillNotes, setAutofillNotes] = useState({}) // { birthcert: { tone, text }, voterid: ... }
  const autofillRunRef = useRef({}) // latest upload per doc type; an older poll stops if replaced
  const setAutofillNote = (docType, note) => setAutofillNotes((n) => ({ ...n, [docType]: note }))

  const watchAutofill = async (docType, filePath) => {
    const map = AUTOFILL_FIELD_MAP[docType]
    if (!map || !filePath) return
    autofillRunRef.current[docType] = filePath
    setAutofillNote(docType, { tone: 'info', text: 'Reading your document to fill in the fields above. This can take up to a minute.' })

    const startedAt = Date.now()
    while (Date.now() - startedAt < AUTOFILL_MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, AUTOFILL_POLL_MS))
      if (autofillRunRef.current[docType] !== filePath) return // a newer upload took over
      let data
      try {
        const res = await fetch(`/api/extracted-fields?file=${encodeURIComponent(filePath)}`)
        if (!res.ok) { setAutofillNote(docType, null); return }
        data = await res.json()
      } catch {
        continue // brief connection drop; try again on the next tick
      }
      if (data.status === 'processing') continue

      const fields = data.fields || {}
      const current = personalInfoRef.current
      const toFill = {}
      let readCount = 0
      for (const [fieldName, formKey] of Object.entries(map)) {
        const value = fields[fieldName]
        if (!value) continue
        readCount++
        if (!String(current[formKey] ?? '').trim()) toFill[formKey] = value
      }

      const fillKeys = Object.keys(toFill)
      if (fillKeys.length) {
        // Re-check emptiness at write time too, in case the applicant typed
        // into a field in the last few milliseconds.
        setPersonalInfo((p) => {
          const next = { ...p }
          for (const k of fillKeys) if (!String(p[k] ?? '').trim()) next[k] = toFill[k]
          return next
        })
      }

      const label = AUTOFILL_DOC_LABEL[docType]
      let resultNote
      if (fillKeys.length) {
        resultNote = { tone: 'done', text: `Filled in ${fillKeys.length} empty field${fillKeys.length === 1 ? '' : 's'} from your ${label}. Please check them, then save.` }
      } else if (readCount) {
        resultNote = { tone: 'info', text: `Your ${label} was read. The fields above were already filled in, so nothing was changed.` }
      } else {
        resultNote = { tone: 'warn', text: `We couldn't read the details from your ${label}. Please fill in the fields above manually.` }
      }
      setAutofillNote(docType, resultNote)
      showAutofillResult(docType, resultNote)
      return
    }
    if (autofillRunRef.current[docType] === filePath) {
      // Oct 6 2026: "still reading", not "couldn't read": the document is
      // saved and the reading service finishes it later by itself.
      const slowNote = { tone: 'warn', slow: true, text: 'Reading your document is taking longer than usual. It is saved and will finish by itself; you can fill in the fields above yourself meanwhile.' }
      setAutofillNote(docType, slowNote)
      showAutofillResult(docType, slowNote)
    }
  }

  // Oct 1 2026: if the applicant already closed the "Reading..." pop-up, show
  // the result in its own pop-up so it isn't missed. If that pop-up is still
  // open, it already switches to the result by itself.
  const showAutofillResult = (docType, note) => {
    const open = uploadNoticeRef.current
    if (open && open.kind === 'upload' && open.docType === docType) return
    setUploadNotice({ kind: 'autofill-result', docType, note, lockSeconds: 3 })
  }

  const handleInlineUpload = async (docType, uploadFile, setInlineStatus, setInlineRejection) => {
    if (!uploadFile || !applicantName.trim()) return
    const setStep = (value) => setUploadProgress((m) => ({ ...m, [docType]: value }))
    setInlineStatus('uploading')
    setInlineRejection(null)

    // 1. Checking file: the same type and size rules as the server, so a
    // wrong file is caught right away with a clear reason.
    setStep({ phase: 'checking' })
    let notAccepted = ''
    if (!CLIENT_ALLOWED_TYPES.includes(uploadFile.type)) notAccepted = 'This file type isn\u2019t accepted. Please upload a PDF, JPG or PNG.'
    else if (uploadFile.size > CLIENT_MAX_FILE_SIZE) notAccepted = 'This file is larger than 10MB. Please upload a smaller copy.'
    if (notAccepted) {
      setInlineStatus('rejected')
      setInlineRejection(notAccepted)
      setStep({ phase: null, message: notAccepted })
      return
    }

    try {
      // 2. Securing: the browser's own SHA-256 of the file.
      setStep({ phase: 'securing' })
      const clientHash = await sha256OfFile(uploadFile)

      // 3. Uploading: the server checks photo quality, computes its own
      // SHA-256 and saves the file.
      setStep({ phase: 'uploading' })
      const data = await uploadDocument(docType, uploadFile)

      // Secured only if both fingerprints match (the file arrived unchanged).
      if (clientHash && data.sha256Hash && clientHash !== data.sha256Hash) {
        const msg = 'Your file didn\u2019t arrive exactly as sent. Please upload it again.'
        setStep({ phase: null, message: msg })
        setInlineStatus('error')
        fetchHistory()
        return
      }
      setStep({ phase: 'done' })
      setInlineStatus(data.needsReview ? 'flagged' : 'done')
      fetchHistory()
      // Oct 6 2026: after the final Submit the Personal Information fields
      // are read-only, so a re-uploaded Birth Certificate / Voter's ID is
      // still read for the admins but doesn't fill anything in here.
      const fillFields = !profileLocked && AUTOFILL_FIELD_MAP[docType] && data.filePath
      setUploadNotice({ kind: 'upload', docType, reviewStatus: data.reviewStatus, autofill: !!fillFields })
      if (fillFields) watchAutofill(docType, data.filePath)
    } catch (err) {
      if (err.rejected) {
        // A specific, actionable quality-precheck rejection (too small,
        // too blurry, etc.) — not a real failure, nothing was stored.
        // Surface the actual reason instead of a blind "try again."
        setStep({ phase: null, message: err.rejectionMessage })
        setInlineStatus('rejected')
        setInlineRejection(err.rejectionMessage)
      } else if (isNetworkError(err)) {
        // Same as the Step 2 form: hold the file locally and retry
        // automatically once connectivity returns.
        await queueUpload({ docType, file: uploadFile, applicantName: applicantName.trim(), applicantEmail: applicantEmail.trim() })
        setQueuedUploadCount((c) => c + 1)
        setStep(null)
        setInlineStatus('queued')
      } else {
        // Only the server's own plain messages (wrong type, too large,
        // uploads closed) are shown; anything unexpected stays generic.
        setStep({ phase: null, message: err.status >= 400 && err.status < 500 && err.message !== 'Upload failed' ? err.message : '' })
        setInlineStatus('error')
      }
    }
  }

  return (
    <main className="applicant-portal min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader
        topbarLabel="Official scholarship portal of the City College of Calamba"
        topbarRight={<ManilaClock className="font-bold" />}
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
            You&rsquo;re currently offline. Anything you type or upload is being saved on this device.
            Keep this tab open, or reopen it once you have a signal, and it will finish saving automatically.
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
            You&rsquo;re back online. Everything saved on this device has finished uploading.
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
          referenceNumber={referenceNo}
          messagesCount={messages.length}
          flaggedCount={flaggedCount}
          onLogout={() => setLogoutConfirmOpen(true)}
        />

        <SubmitConfirmModal
          open={submitConfirmOpen}
          onCancel={() => setSubmitConfirmOpen(false)}
          onConfirm={() => {
            setSubmitConfirmOpen(false)
            submitApplication()
          }}
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
          {archived && (
            <div className="card" role="status" style={{ borderColor: '#F0D9A8', background: '#FDF6E7', color: '#6b4e00', fontSize: '12.75px', lineHeight: 1.6 }}>
              <strong style={{ display: 'block', fontFamily: "'Montserrat', sans-serif", marginBottom: 4 }}>This application cycle has closed</strong>
              Your application was archived at the end of the cycle. You can still view everything here, but it can no
              longer be changed. For questions, contact the CCC Guidance Office.
            </div>
          )}
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
            // Oct 6 2026: Health & Wellness is done during enrollment, after
            // passing the exam (Appendix D: passers are recommended for the
            // medical exam and enrollment), so it isn't counted here.
            const profileSectionsDone = [personalDone, academicDone, familyDone].filter(Boolean).length
            // Oct 6 2026: the status line and Next step follow the final
            // Submit's own checklist (finalSubmitChecks, same as the Final
            // step card), not Health & Wellness, which is only needed during
            // enrollment. Once everything is in, the next step is to submit.
            const readyToSubmit = finalSubmitChecks.every((c) => c.ok)
            const examDate = examSchedule?.exam_date
              ? (() => {
                  try {
                    return new Date(`${examSchedule.exam_date}T00:00:00+08:00`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
                  } catch {
                    return examSchedule.exam_date
                  }
                })()
              : null
            const step = applicationStep({
              submitted,
              readyToSubmit,
              needsAttention: reviewNote,
              hasDocs: myDocs.length > 0,
              flagged: flaggedCount,
              processing: processingCount,
              eligibilityStatus: eligibility?.status,
              examDate,
              releasedStatus,
              releasedDistribution,
            })
            // Nov 2026: Educational Background (the eligibility screening)
            // comes first; Personal Information opens after it is passed.
            const nextAction = submitted
              ? null
              : !screening.stage2Open
              ? { label: screening.state === 'failed' ? 'See your eligibility screening result' : 'Complete the eligibility screening (Educational Background)', panel: 'academic' }
              : !personalSubmittedAt
              ? { label: 'Complete and submit your Personal Information', panel: 'personal' }
              : !academicSubmittedAt
              ? { label: 'Complete and submit your Educational Background', panel: 'academic' }
              : !financialSubmittedAt
              ? { label: 'Complete and submit your Family & Financial Information', panel: 'financial' }
              : missingDocsForSubmit.length
              ? { label: `Upload your ${getDocTypeLabel(missingDocsForSubmit[0])}`, panel: DOC_UPLOAD_PLACE[missingDocsForSubmit[0]]?.panel || 'status' }
              : reviewDocsForSubmit.length
              ? { label: `Check your ${getDocTypeLabel(reviewDocsForSubmit[0].type)}`, panel: DOC_UPLOAD_PLACE[reviewDocsForSubmit[0].type]?.panel || 'status' }
              : { label: 'Submit your application', panel: 'status' }

            if (!appLoaded || !historyLoaded) {
              return (
                <div>
                  <div className="portal-header">
                    <h1>Welcome back{applicantName.trim() ? `, ${applicantName.trim().split(' ')[0]}` : ''}!</h1>
                    <p>Here&rsquo;s a quick look at your application to the City College of Calamba.</p>
                  </div>
                  <div className="card status-hero" role="status" aria-live="polite">
                    <span className="sk-sr">Loading your application progress...</span>
                    <p className="status-hero-eyebrow">Application Status</p>
                    <div className="status-hero-value">
                      <Skeleton width={250} height={28} radius={20} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 21 }}>
                      <Skeleton width="85%" height={11} />
                      <Skeleton width="62%" height={11} />
                    </div>
                    <div className="status-hero-next">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Skeleton width={70} height={9} />
                        <Skeleton width={220} height={13} />
                      </div>
                      <Skeleton width={110} height={38} radius={8} />
                    </div>
                  </div>
                  <div className="section-divider">
                    <div className="section-divider-chip">
                      <span className="divider-icon">&#128275;</span> Progress Milestones
                    </div>
                  </div>
                  <p className="section-divider-sub">Each milestone below unlocks as you clear the corresponding step in the application process.</p>
                  <div className="stat-grid" aria-hidden="true">
                    {['Profile Completion', 'Document Verification', 'Exam Schedule', 'Medical Status', 'Admission'].map((label) => (
                      <div key={label} className="stat-card">
                        <div className="stat-label">{label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                          <Skeleton width={150} height={18} />
                          <Skeleton width="90%" height={10} />
                          <Skeleton width="60%" height={10} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <div>
                <div className="portal-header">
                  <h1>Welcome back{applicantName.trim() ? `, ${applicantName.trim().split(' ')[0]}` : ''}!</h1>
                  <p>Here&rsquo;s a quick look at your application to the City College of Calamba.</p>
                </div>

                <div className="card status-hero">
                  <p className="status-hero-eyebrow">Application Status</p>
                  <div className="status-hero-value">
                    <span className={`badge ${step.tone === 'warn' ? 'badge-pending' : 'badge-progress'}`}>Step {step.num} of 6 &middot; {step.label}</span>
                  </div>
                  <p className="status-hero-desc">{step.desc}</p>
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
                  {/* Nov 2026 (panel revisions S8): what each status means. */}
                  <details className="status-legend-portal">
                    <summary>What do the application statuses mean?</summary>
                    <dl>
                      {STATUS_DEFINITIONS.filter((d) => d.label !== 'Disqualified').map((d) => (
                        <div key={d.label}>
                          <dt>{d.label}</dt>
                          <dd>{d.meaning}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </div>

                {eligibility && <EligibilityCard eligibility={eligibility} resultReleased={!!releasedStatus} />}

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
                    <div className="stat-value">{profileSectionsDone} of 3 required sections done</div>
                    <div className="stat-progress">
                      <div className="stat-progress-bar" style={{ width: `${(profileSectionsDone / 3) * 100}%` }} />
                    </div>
                    <div className="stat-note">Personal Information, Educational Background, and Family &amp; Financial Information. Health &amp; Wellness comes later, during enrollment.</div>
                    <div className="stat-card-hint">&#9660; Viewing details below</div>
                  </div>

                  {/* Document Verification — real */}
                  <div className="stat-card unlocked-clickable" onClick={() => setActivePanel('status')} role="button" tabIndex={0}>
                    <div className="stat-label">Document Verification</div>
                    {myDocs.length === 0 ? (
                      <div className="stat-value stat-locked">No documents yet</div>
                    ) : (
                      <div className="stat-value">
                        {latestDocsByType.length - flaggedCount - processingCount} verified{processingCount > 0 ? `, ${processingCount} processing` : ''}{flaggedCount > 0 ? `, ${flaggedCount} needs review` : ''}
                      </div>
                    )}
                    <div className="stat-note">View and manage your uploaded documents.</div>
                  </div>

                  {/* Locked cards. Sept 29: the notes used to say these were blocked on
                      Ivy's modules (stale, and not something applicants should
                      see). Making them real is a separate task. */}
                  {/* Exam Schedule -- Sept 30 2026: unlocks once an admin has
                      sent this applicant's exam batch (Exam Schedules panel).
                      Same card, just filled in. */}
                  {examSchedule ? (
                    <div className="stat-card unlocked-clickable" onClick={() => setActivePanel('messages')} role="button" tabIndex={0}>
                      <div className="stat-label">Exam Schedule</div>
                      <div className="stat-value">
                        {(() => {
                          try {
                            return new Date(`${examSchedule.exam_date}T00:00:00+08:00`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
                          } catch {
                            return examSchedule.exam_date
                          }
                        })()}
                      </div>
                      <div className="stat-note">
                        {[examSchedule.exam_time, examSchedule.venue].filter(Boolean).join(', ') || examSchedule.batch_label}. Details are in Messages.
                      </div>
                    </div>
                  ) : (
                    <div className="stat-card locked">
                      <div className="stat-lock-badge">&#128274;</div>
                      <div className="stat-label">Exam Schedule</div>
                      <div className="stat-value stat-locked">Locked</div>
                      <div className="stat-note">Available once exam schedules are posted.</div>
                    </div>
                  )}

                  <div className="stat-card locked">
                    <div className="stat-lock-badge">&#128274;</div>
                    <div className="stat-label">Medical Status</div>
                    <div className="stat-value stat-locked">Locked</div>
                    <div className="stat-note">Unlocks once you&rsquo;ve passed the applicant examination.</div>
                  </div>

                  {/* Admission -- Sept 30 2026: unlocks with the applicant's
                      result once it has been released to them (see
                      releasedStatus above). Same card, just filled in. */}
                  {releasedStatus && ADMISSION_RESULT_TEXT[releasedStatus] ? (
                    <div className="stat-card unlocked-clickable" onClick={() => setActivePanel('messages')} role="button" tabIndex={0}>
                      <div className="stat-label">Admission</div>
                      <div className="stat-value">{ADMISSION_RESULT_TEXT[releasedStatus].label}</div>
                      <div className="stat-note">{ADMISSION_RESULT_TEXT[releasedStatus].note}</div>
                    </div>
                  ) : (
                    <div className="stat-card locked">
                      <div className="stat-lock-badge">&#128274;</div>
                      <div className="stat-label">Admission</div>
                      <div className="stat-value stat-locked">Locked</div>
                      <div className="stat-note">Available once your application has been evaluated.</div>
                    </div>
                  )}
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
                      Fill out the sections below so the Guidance Office can check your eligibility and process your application.
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
                                Currently ongoing ,{' '}
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
                                {personalDone ? 'Currently ongoing' : 'Not yet started'} ,{' '}
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
                                {academicDone ? 'Currently ongoing' : 'Not yet started'} ,{' '}
                                <a href="#" style={{ color: 'var(--ccc-blue)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setActivePanel('financial') }}>
                                  {academicDone ? 'continue' : 'complete now'} &rarr;
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="timeline-item">
                        <div className={`timeline-dot ${healthDone ? 'step-done' : 'step-notstarted'}`}>
                          {healthDone ? '✓' : 4}
                        </div>
                        <div className="timeline-body">
                          <h4>Health &amp; Wellness</h4>
                          <p>
                            {/* Oct 6 2026: not needed to submit; it comes during
                                enrollment, after passing the exam. */}
                            {healthDone ? 'Completed.' : 'During enrollment, after you pass the exam. Not needed to submit your application.'}
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
                        Showing everything received: <b>Announcements</b> sent to all applicants (and posted on the guest page), plus <b>Messages</b> sent to you individually or to your applicant category.
                      </>
                    )}
                    {messagesFilter === 'announcement' && (
                      <>
                        Showing <b>Announcements</b> only. These are sent to all applicants and also posted on the guest (public) page.
                      </>
                    )}
                    {messagesFilter === 'message' && (
                      <>
                        Showing <b>Messages</b> only. These are private, sent to you individually or to your applicant category, and never shown on the guest page.
                      </>
                    )}
                  </span>
                </div>
                {(() => {
                  const filtered = messages.filter((m) => messagesFilter === 'all' || m.type === messagesFilter)
                  if (messagesLoading) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px 15px' }}>
                        <SkeletonList items={3} chips={false} label="Loading your messages..." />
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
                  return (
                    <div className="pmsg-list">
                      {filtered.map((m) => (
                        <MessageCard key={m.id} m={m} acknowledgedAt={acknowledged[m.id]} />
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ══════════ PERSONAL INFORMATION (built — cards 1-6 ported as-is) ══════════ */}
          {/* Nov 2026: the screening needs the documents too, so wait for
              both; otherwise the lock card flashes on reload before the
              report card has loaded. */}
          {(!appLoaded || (!historyLoaded && activePanel !== 'academic')) && PROFILE_PANEL_HEADERS[activePanel] && <ProfilePanelSkeleton panel={activePanel} />}

          {['personal', 'financial', 'health'].includes(activePanel) && appLoaded && historyLoaded && !screening.stage2Open && (
            <ScreeningLockCard screening={screening} onGo={() => setActivePanel('academic')} />
          )}
          {activePanel === 'personal' && appLoaded && historyLoaded && screening.stage2Open && (
            <FieldsLockedContext.Provider value={profileLocked}>
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Personal Information</h1>
                <p>This section confirms your identity and Calamba residency for your application to CCC.</p>
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
                  id="up-profilepic"
                  docType="profilepic"
                  files={docsByType.profilepic || []}
                  onView={openPreview}
                  progress={uploadProgress.profilepic}
                  reading={readingTypes.has('profilepic')}
                  label="Profile Picture"
                  sublabel="A recent 2x2 ID photo (square, at least 600×600px, JPG or PNG) on a plain white background"
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
                  <EditableTag />
                </div>
                <p className="topic-card-intro">These fields auto-fill once you upload your Birth Certificate below. Document text extraction isn&rsquo;t always perfect, so you can still correct any field manually.</p>
                <div className="form-grid">
                  <TextField label="First Name" required value={personalInfo.firstName} onChange={(v) => updatePI('firstName', v)} placeholder="e.g. Juan" />
                  <TextField label="Middle Name (if any)" value={personalInfo.middleName} onChange={(v) => updatePI('middleName', v)} placeholder="e.g. Santos" />
                  <TextField label="Last Name" required value={personalInfo.lastName} onChange={(v) => updatePI('lastName', v)} placeholder="e.g. Dela Cruz" />
                  <TextField label="Suffix (if any)" value={personalInfo.suffix} onChange={(v) => updatePI('suffix', v)} placeholder="e.g. Jr., III" />
                  <TextField label="Date of Birth" type="date" required max={latestBirthdate(MIN_APPLICANT_AGE)} min={earliestBirthdate(MAX_APPLICANT_AGE)} value={personalInfo.dateOfBirth} onChange={(v) => updatePI('dateOfBirth', v)} hint={ageHint(personalInfo.dateOfBirth)} />
                  <TextField label="Place of Birth" required value={personalInfo.placeOfBirth} onChange={(v) => updatePI('placeOfBirth', v)} placeholder="e.g. Calamba City, Laguna" />
                  <SelectField label="Sex at birth" required value={personalInfo.sex} onChange={(v) => updatePI('sex', v)} options={['Male', 'Female']} />
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
                    id="up-birthcert"
                    docType="birthcert"
                    files={docsByType.birthcert || []}
                    onView={openPreview}
                    progress={uploadProgress.birthcert}
                    reading={readingTypes.has('birthcert')}
                    label="Birth Certificate / PSA / NSO"
                    sublabel="Issued by the Philippine Statistics Authority"
                    required
                    status={birthCertStatus === 'idle' && hasUploaded('birthcert') ? 'done' : birthCertStatus}
                    onFileSelected={(f) => handleInlineUpload('birthcert', f, setBirthCertStatus, setBirthCertRejection)}
                  />
                  {birthCertRejection && <QualityRejectionAlert message={birthCertRejection} />}
                  <AutofillNote note={autofillNotes.birthcert} />
                </div>
              </div>

              {/* ---------- Card 3: Contact & Residency ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">3</span> Contact &amp; Residency
                  </span>{' '}
                  <EditableTag />
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
                    <TextField label="Contact Number" type="tel" required value={personalInfo.contactNumber} onChange={(v) => updatePI('contactNumber', sanitizePhoneInput(v))} placeholder="e.g. 0917 123 4567" hint="Used by the Guidance Office to call you about your application. The system does not send text messages. If you can&rsquo;t check your email often, the Guidance Office can reach you at this number." />
                    {/* Oct 7 2026: the "I want to receive SMS updates" checkbox was
                        removed. Nothing ever sent texts, and SMS is not in the
                        manuscript: in interview #2 (Appendix D) the client asked about
                        SMS, the per-message cost was explained, and email was agreed.
                        Suggested as future work in Chapter 5 instead. */}
                  </div>
                  {/* Oct 21 2026 (panel): Calamba City only; the city and
                      barangay are added when saved (see withCalambaCity). */}
                  <TextField full label="Present Home Address (Calamba City only)" required value={personalInfo.address} onChange={(v) => updatePI('address', v)} placeholder="House No. and Street / Subdivision, e.g. 123 Rizal St." />
                  {personalInfo.address?.trim() && (
                    <div className="full text-[12px] text-ccc-muted -mt-1 mb-1">
                      Saved as: <span className="text-ccc-text">{withCalambaCity(personalInfo.address, personalInfo.barangay)}</span>
                    </div>
                  )}
                  <TextField full label="Voter's Precinct No." required value={personalInfo.voterPrecinct} onChange={(v) => updatePI('voterPrecinct', v)} placeholder="e.g. 0142A" hint="Yours, or your parent's/guardian's if you are using their Voter's ID." />
                </div>
                <div className="topic-doc-section">
                  <div className="topic-doc-label">
                    Verifying Document <span className="tdl-count">1 required</span>
                  </div>
                  <InlineUploadRow
                    id="up-voterid"
                    docType="voterid"
                    files={voterIdFiles}
                    onView={openPreview}
                    progress={uploadProgress.voterid}
                    reading={readingTypes.has('voterid')}
                    label="Voter's ID / Certification of Applicant or Parent/Guardian"
                    sublabel="Issued by COMELEC. Upload your own if you are a registered voter. If not yet, upload your parent's or guardian's."
                    required
                    status={voterIdStatus === 'idle' && hasVoterIdOnFile ? 'done' : voterIdStatus}
                    onFileSelected={(f) => handleInlineUpload('voterid', f, setVoterIdStatus, setVoterIdRejection)}
                  />
                  {voterIdRejection && <QualityRejectionAlert message={voterIdRejection} />}
                  <AutofillNote note={autofillNotes.voterid} />
                </div>
              </div>

              {/* ---------- Card 4: Additional Information ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">4</span> Additional Information
                  </span>{' '}
                  <EditableTag />
                </div>
                <p className="topic-card-intro">Used to help match you to special categories and accommodations. No document needed here.</p>
                <div className="form-grid">
                  <SelectField label="Are you a LGBTQI+ community member?" required value={personalInfo.lgbtqi} onChange={(v) => updatePI('lgbtqi', v)} options={['Yes', 'No']} />
                  <TextField label="Do you have a physical or behavioral condition/disability?" required value={personalInfo.disability} onChange={(v) => updatePI('disability', v)} placeholder="e.g. None" />
                  <SelectField label="Are you a solo parent?" required value={personalInfo.soloParent} onChange={(v) => updatePI('soloParent', v)} options={['Yes', 'No']} />
                  <SelectField label="Are you a member of an Indigenous Peoples (IP) community?" required value={personalInfo.indigenousMember} onChange={(v) => updatePI('indigenousMember', v)} options={['Yes', 'No']} />
                  <SelectField label="Does your family belong to a homeless or underprivileged sector?" required value={personalInfo.underprivileged} onChange={(v) => updatePI('underprivileged', v)} options={['Yes', 'No']} />
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
                <p className="topic-card-intro">List any organization/s you are or were part of. This section is optional, so leave it blank if not applicable.</p>
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
                  <EditableTag />
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

              {!requiredPersonalInfoComplete && applicantName.trim() && !profileLocked && (
                <p className="text-[11px] text-ccc-muted leading-snug">
                  Fill in the required fields and upload your Profile Picture, Birth Certificate, and Voter&rsquo;s ID above. This section saves independently of the others.
                </p>
              )}
              <SectionSubmittedNote
                at={personalSubmittedAt}
                locked={profileLocked}
                extra="You can still change your email update choice above and save it."
              />

              <SectionFormActions
                saveState={saveState}
                sectionState={personalSectionState}
                error={sectionErrors.personal}
                disabled={!applicantName.trim()}
                saveLabel={profileLocked ? 'Save update choices' : undefined}
                submitDisabled={profileLocked}
                submitLabel={profileLocked ? 'Submitted (Locked)' : 'Submit Section'}
                onSaveDraft={() => saveProgress(1)}
                onSubmit={() => submitSection('personal')}
              />
            </div>
            </FieldsLockedContext.Provider>
          )}

          {/* ══════════ EDUCATIONAL BACKGROUND (built — Program Application,
              Preferred Program, 3-tier school table, Tech-Voc, and the
              Grades/Form 138 upload, ported from Ivy's academic panel) ══════════ */}
          {activePanel === 'academic' && appLoaded && (
            <FieldsLockedContext.Provider value={profileLocked}>
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Educational Background</h1>
                <p>This information is used for qualification matching and cross-referenced against your submitted documents.</p>
              </div>

              <ScreeningResultCard screening={screening} onNext={() => setActivePanel('personal')} />

              {/* ---------- Card 1: Program Application ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">1</span> Program Application
                  </span>{' '}
                  <EditableTag />
                </div>
                <div className="form-grid">
                  <SelectField label="Applying As" required value={academicInfo.applyingAs} onChange={(v) => updateAI('applyingAs', v)} options={['First Year', 'Transferee', 'Old Curriculum and ALS Completer']} disabled={screeningLocked} />
                  <SelectField label="Term Applying In" required value={academicInfo.termApplying} onChange={(v) => updateAI('termApplying', v)} options={['Term 1', 'Term 2']} />
                </div>

                {/* Sept 20 2026: Scholarship Matching & Filtering — CCC only
                    accepts transferees who (a) have no failing grade in any
                    semester from their previous school(s), (b) have passed
                    at least 26 units, and (c) have a GWA of 2.25 or better
                    (Appendix J, "Transferees" section). Only shown/required
                    when actually applying as a Transferee. */}
                {/* Nov 2026 (panel revisions S2): the First Year grade rule
                    (client interview, Appendix B). Old Curriculum / ALS
                    completers are not asked; staff check their proof of
                    grades. Locked once Educational Background is submitted. */}
                {academicInfo.applyingAs === 'First Year' && (
                  <div className="form-grid" style={{ marginTop: '15px' }}>
                    <SelectField
                      label="Do you have any grade below 75 in your latest Senior High report card (Form 138)?"
                      required
                      full
                      value={academicInfo.shsFailingGrade}
                      onChange={(v) => updateAI('shsFailingGrade', v)}
                      options={['No', 'Yes']}
                      disabled={screeningLocked && !!savedScreening.shs_failing_grade}
                    />
                  </div>
                )}
                {screeningLocked && (
                  <p className="topic-card-intro" style={{ marginTop: '10px' }}>
                    These answers come from your eligibility check at sign-up and can&apos;t be changed here. To correct one, contact the GCTCDO (1st Floor, Admin Building).
                  </p>
                )}
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
                        disabled={screeningLocked && !!savedScreening.transferee}
                      />
                      <TextField
                        label="Total Academic Units Passed"
                        required
                        type="number"
                        value={academicInfo.transfereeUnitsPassed}
                        onChange={(v) => updateAI('transfereeUnitsPassed', v)}
                        placeholder="e.g. 30 (at least 26 required)"
                        disabled={screeningLocked && !!savedScreening.transferee}
                      />
                      <SelectField
                        label="Did you get a failing grade in any semester at your previous school(s)?"
                        required
                        value={academicInfo.transfereeFailingGrade}
                        onChange={(v) => updateAI('transfereeFailingGrade', v)}
                        options={['Yes', 'No']}
                        disabled={screeningLocked && !!savedScreening.transferee}
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
                  <EditableTag />
                </div>
                <div className="form-grid">
                  <SelectField label="First Priority Program" required value={academicInfo.choice1} onChange={(v) => updateAI('choice1', v)} options={PROGRAM_OPTIONS} />
                  <SelectField label="Second Priority Program" required value={academicInfo.choice2} onChange={(v) => updateAI('choice2', v)} options={[...PROGRAM_OPTIONS.filter((p) => p !== academicInfo.choice1), 'None of the above']} />
                </div>
                {needsShsGrade && (
                  <div className="form-grid" style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #D5DDEA' }}>
                    <div>
                      <TextField
                        label="Lowest Senior High grade in your Mathematics and Science subjects"
                        required
                        type="number"
                        value={academicInfo.shsMathScienceLowest}
                        onChange={(v) => updateAI('shsMathScienceLowest', v)}
                        placeholder="e.g. 88"
                      />
                      {shsGradeText && !shsGradeValid && <p className="field-note" style={{ color: '#902020' }}>Type a grade from 60 to 100.</p>}
                    </div>
                    <div>
                      <p className="field-note" style={{ fontSize: '11.5px', lineHeight: 1.55, marginTop: '24px' }}>
                        {bsedChoiceNames.join(' and ')} {bsedChoiceNames.length > 1 ? 'need' : 'needs'} a grade of <b>85 or higher</b> in every
                        Mathematics and Science subject in Senior High School (CCC Scholar Guidelines). Look at your Grade 11 and Grade 12
                        report cards and type the lowest one. The office checks it against your report card.
                      </p>
                      {shsGradeValid && Number(shsGradeText) < 85 && (
                        <p className="field-note" style={{ fontSize: '11.5px', lineHeight: 1.55, color: '#7a4f0c', background: '#FDF3E3', borderRadius: '8px', padding: '9px 11px' }}>
                          A grade below 85 means you can&rsquo;t be accepted in {bsedChoiceNames.join(' or ')}. You can still submit, and your
                          other program choice is still considered.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ---------- Card 3: Educational Background (school table + Tech-Voc + Grades upload) ---------- */}
              <div className="card topic-card">
                <div className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="topic-card-number">3</span> Educational Background
                  </span>{' '}
                  <EditableTag />
                </div>
                <p className="topic-card-intro">
                  Fill in your school details for each level you&rsquo;ve completed. <strong>Primary / Elementary is required for all applicants.</strong> Secondary / Senior High and Tertiary / College are optional (except Honors / Awards Received, which is optional for all levels).
                </p>

                <EduTable edu={academicInfo.edu} onChangeCell={updateEduCell} transferee={academicInfo.applyingAs === 'Transferee'} />

                <div className="form-grid" style={{ marginTop: '15px' }}>
                  <SelectField
                    label="Have you taken a Technical or Vocational Course?"
                    value={academicInfo.techVoc}
                    onChange={(v) => updateAI('techVoc', v)}
                    options={['Yes', 'No']}
                  />
                </div>

                {academicInfo.techVoc === 'Yes' && (
                  <div className="form-grid">
                    <TextField label="Name of School in Technical/Vocational" value={academicInfo.techVocSchool} onChange={(v) => updateAI('techVocSchool', v)} placeholder="e.g. Calamba Technical Vocational School" />
                    <TextField label="Name of Course in Technical/Vocational" value={academicInfo.techVocCourse} onChange={(v) => updateAI('techVocCourse', v)} placeholder="e.g. Computer Systems Servicing NC II" />
                    <TextField full label="Address of School in Technical/Vocational" value={academicInfo.techVocAddress} onChange={(v) => updateAI('techVocAddress', v)} placeholder="e.g. Brgy. Real, Calamba City, Laguna" />
                  </div>
                )}

                <div className="topic-doc-section">
                  <div className="topic-doc-label">
                    Verifying Documents <span className="tdl-count">1 required</span>
                  </div>
                  <InlineUploadRow
                    id="up-form138"
                    docType="form138"
                    files={docsByType.form138 || []}
                    onView={openPreview}
                    progress={uploadProgress.form138}
                    reading={readingTypes.has('form138')}
                    rejectionInside
                    label="Grades (Proof of Grades / Form 138 / Report Card)"
                    sublabel="Latest grading period / semester, certified true copy"
                    required
                    status={form138Status === 'idle' && hasUploaded('form138') ? 'done' : form138Status}
                    onFileSelected={(f) => handleInlineUpload('form138', f, setForm138Status, () => {})}
                  />
                </div>
              </div>

              {(!requiredAcademicInfoComplete || !requiredAcademicUploadsComplete) && applicantName.trim() && !academicSubmittedAt && (
                <p className="text-[11px] text-ccc-muted leading-snug">
                  Applying As, Term Applying In, both Priority Programs, the Primary/Elementary row, and the Grades (Form 138) upload are required (plus GWA, Units Passed, and the failing-grade question if applying as a Transferee). This section saves independently of the others.
                </p>
              )}
              <SectionSubmittedNote at={academicSubmittedAt} locked={profileLocked} />

              <SectionFormActions
                saveState={saveState}
                sectionState={academicSectionState}
                error={sectionErrors.academic}
                disabled={!applicantName.trim()}
                saveDisabled={profileLocked}
                submitDisabled={profileLocked}
                submitLabel={profileLocked ? 'Submitted (Locked)' : 'Submit Section'}
                onSaveDraft={() => saveProgress(2)}
                onSubmit={() => submitSection('academic')}
              />
            </div>
            </FieldsLockedContext.Provider>
          )}

          {/* ══════════ FAMILY & FINANCIAL INFORMATION (built — Parent/
              Guardian table, only-child branch, emergency contact,
              working-student branch, sibling income table, ported from
              Ivy's panel-financial) ══════════ */}
          {activePanel === 'financial' && appLoaded && historyLoaded && screening.stage2Open && (
            <FieldsLockedContext.Provider value={profileLocked}>
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; My Profile (Softcopy)</p>
                <h1>Family &amp; Financial Information</h1>
                <p>Used by the Guidance Office as part of your application. Your financial details do not affect your eligibility.</p>
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
                {/* Oct 15 2026 (client): the sibling list now sits here, right after
                    Number of Siblings (it used to be its own "Family's Annual
                    Income" card further down). */}
                {familyInfo.onlyChild === 'No' && (
                  <>
                    <p className="topic-card-intro" style={{ margin: '12px 0 8px' }}>
                      List each sibling from eldest to youngest. Use the + button to add another sibling.
                    </p>
                    <SiblingIncomeTable
                      siblings={familyInfo.siblings}
                      onChangeCell={updateSiblingCell}
                      onAddColumn={addSiblingColumn}
                      onRemoveColumn={removeSiblingColumn}
                    />
                  </>
                )}
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
                              disabled={profileLocked}
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
                              disabled={profileLocked}
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
                      id="up-employmentcert"
                      docType="employmentcert"
                      files={docsByType.employmentcert || []}
                      onView={openPreview}
                      progress={uploadProgress.employmentcert}
                      reading={readingTypes.has('employmentcert')}
                      rejectionInside
                      label="Proof of Employment"
                      sublabel="Accepted documents include an ID, certificate, or any document provided by your employer"
                      required
                      status={employmentCertStatus === 'idle' && hasUploaded('employmentcert') ? 'done' : employmentCertStatus}
                      onFileSelected={(f) => handleInlineUpload('employmentcert', f, setEmploymentCertStatus, () => {})}
                    />
                  </div>
                )}
                {/* Oct 15 2026 (client): Proof of Income moved here from the old
                    "Family's Annual Income" card. Still optional, now shown to
                    every applicant (not only those with siblings). */}
                <div className="topic-doc-section">
                  <div className="topic-doc-label">Proof of Income <span className="tdl-count">Optional</span></div>
                  <InlineUploadRow
                    id="up-indigency"
                    docType="indigency"
                    files={docsByType.indigency || []}
                    onView={openPreview}
                    progress={uploadProgress.indigency}
                    reading={readingTypes.has('indigency')}
                    rejectionInside
                    label="Proof of Income (Family / Guardian)"
                    sublabel="Certificate of Indigency / Income issued by your Barangay or the City Social Welfare Office"
                    status={indigencyStatus === 'idle' && hasUploaded('indigency') ? 'done' : indigencyStatus}
                    onFileSelected={(f) => handleInlineUpload('indigency', f, setIndigencyStatus, () => {})}
                  />
                </div>
              </div>

              <SectionSubmittedNote at={financialSubmittedAt} locked={profileLocked} />

              <SectionFormActions
                saveState={saveState}
                sectionState={financialSectionState}
                error={sectionErrors.financial}
                disabled={!applicantName.trim()}
                saveDisabled={profileLocked}
                submitDisabled={profileLocked}
                submitLabel={profileLocked ? 'Submitted (Locked)' : 'Submit Section'}
                onSaveDraft={() => saveProgress(5)}
                onSubmit={() => submitSection('financial')}
              />
            </div>
            </FieldsLockedContext.Provider>
          )}

          {/* ══════════ APPEALS & RESCHEDULING (Sept 30 2026: appeals added,
              see app/api/reschedule/route.js) ══════════ */}
          {activePanel === 'appeals' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; Application</p>
                <h1>Appeals &amp; Rescheduling</h1>
                <p>
                  Request to reschedule your exam if you&rsquo;ll be absent, or appeal for a retake or
                  re-application. The Guidance Office reviews every request and will contact you.
                </p>
              </div>

              <div className="card">
                <div className="card-title">Submit a Request</div>
                <div className="form-grid">
                  <SelectField
                    label="Request Type"
                    value={rescheduleType}
                    onChange={setRescheduleType}
                    options={['Reschedule Examination (Absence)', 'Appeal (Retake / Re-application)', 'Other Concern']}
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
                  id="up-supportdoc"
                  docType="supportdoc"
                  files={docsByType.supportdoc || []}
                  onView={openPreview}
                  progress={uploadProgress.supportdoc}
                  reading={readingTypes.has('supportdoc')}
                  label="Supporting Document"
                  required={rescheduleType === 'Reschedule Examination (Absence)'}
                  sublabel={
                    rescheduleType === 'Reschedule Examination (Absence)'
                      ? 'Required for exam rescheduling (e.g. medical certificate or proof of conflict). Upload it before you submit, and it will be attached to this request.'
                      : 'e.g. Medical certificate, affidavit, or proof of conflict. Upload it before you submit, and it will be attached to this request.'
                  }
                  status={supportDocStatus === 'idle' && hasUnattachedSupportDoc ? 'done' : supportDocStatus}
                  onFileSelected={(f) => handleInlineUpload('supportdoc', f, setSupportDocStatus, setSupportDocRejection)}
                />
                {supportDocRejection && <QualityRejectionAlert message={supportDocRejection} />}

                {/* Sept 29: the note used to sit to the LEFT of the button, so
                    the button jumped sideways when it appeared. It's now to
                    the right, so the button never moves. */}
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={submitReschedule}
                    disabled={rescheduleSaveState === 'saving' || !applicantName.trim() || !rescheduleType || !rescheduleDetails.trim()}
                    className="mbtn mbtn-primary"
                  >
                    {rescheduleSaveState === 'saving' ? 'Submitting…' : 'Submit Request'}
                  </button>
                  {rescheduleSaveState === 'saved' && <StatusToast tone="success">&#x2713; Request submitted</StatusToast>}
                  {rescheduleSaveState === 'error' && (
                    <StatusToast tone="error">{rescheduleError || 'Couldn\u2019t submit, please try again.'}</StatusToast>
                  )}
                </div>
              </div>

              {rescheduleHistory.length > 0 && (
                <div className="card">
                  <div className="card-title">Your Past Requests</div>
                  <div className="preq-list">
                    {rescheduleHistory.map((r) => (
                      <PastRequestCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ HEALTH & WELLNESS (built — Medical Status + the
              Medical Examination Results/Certificate upload, ported from
              Ivy's health panel) ══════════ */}
          {activePanel === 'health' && appLoaded && historyLoaded && screening.stage2Open && (
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
                  id="up-medcert"
                  docType="medcert"
                  files={docsByType.medcert || []}
                  onView={openPreview}
                  progress={uploadProgress.medcert}
                  reading={readingTypes.has('medcert')}
                  rejectionInside
                  label="Medical Examination Results / Certificate"
                  sublabel="To be completed only once you have passed the applicant examination"
                  status={medcertStatus === 'idle' && hasUploaded('medcert') ? 'done' : medcertStatus}
                  onFileSelected={(f) => handleInlineUpload('medcert', f, setMedcertStatus, () => {})}
                />
              </div>

              {healthSubmittedAt && (
                <p className="text-[11px] text-ccc-muted leading-snug">
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

          {/* ══════════ ALLOWANCE (Oct 5 2026, Progress Table row 78) ══════════ */}
          {activePanel === 'allowance' && <AllowancePanel />}

          {/* ══════════ DOCUMENTS & STATUS (built — status table is real; the
              upload dropzone below is an interim home for document types
              whose real panel (Academic/Financial/Health/Appeals) isn't
              built yet, so nothing is blocked while those are being built) ══════════ */}
          {activePanel === 'status' && (
            <div>
              <div className="portal-header">
                <p className="portal-eyebrow">Admission &middot; Application</p>
                <h1>Documents &amp; Verification Status</h1>
                <p>Track every document and submit your application when everything is ready.</p>
              </div>

              {/* Oct 6 2026: the final step now sits at the top of this panel,
                  with what's left to do, the Applications Open state, and a
                  confirmation before submitting. */}
              {!submitted && submitBlocked && (
                <div className="submit-closed-note" role="status">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" /></svg>
                  <span>
                    <b>{submitBlocked}</b> You can still finish and submit each section and upload your documents, and
                    everything is saved. Only the final Submit Application is paused for now.
                  </span>
                </div>
              )}
              <FinalSubmitCard
                submitted={submitted}
                submittedAt={submittedAt}
                checks={finalSubmitChecks}
                blocked={!!submitBlocked}
                saving={saveState === 'saving'}
                error={submitError}
                onSubmit={() => {
                  setSubmitError('')
                  setSubmitConfirmOpen(true)
                }}
              />

              {historyLoaded ? (
                <DocumentStatusTable
                  groups={statusTableGroups}
                  docs={statusTableDocs}
                  applicantName={applicantName}
                  onReupload={jumpToUploadFor}
                  uploadPlaces={DOC_UPLOAD_PLACE}
                  rowRules={docRowRules}
                />
              ) : (
                <div className="card">
                  <SkeletonRows rows={5} avatar={false} label="Loading your documents..." />
                </div>
              )}

              {/* Application History & Activity Log — spec has this card
                  right here too, but scripted with fake data; this one is
                  built from real events (see buildActivityLog() above). */}
              <div className="card">
                <div className="card-title">Application History &amp; Activity Log</div>
                {historyLoaded && appLoaded ? (
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
                ) : (
                  <SkeletonText lines={3} label="Loading your activity..." />
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* History drawer — tucked away, opened deliberately */}
      <FilePreviewModal preview={preview} onClose={() => setPreview(null)} />
      {!uploadNotice && pendingAcks.length > 0 && (
        <AckDialog key={pendingAcks[0].id} post={pendingAcks[0]} index={1} total={pendingAcks.length} onConfirm={confirmAck} />
      )}
      {uploadNotice && (
        <UploadNoticeDialog
          notice={uploadNotice}
          autofillNote={uploadNotice.kind === 'upload' ? autofillNotes[uploadNotice.docType] : null}
          onClose={() => setUploadNotice(null)}
        />
      )}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes noticeSpin {
          to { transform: rotate(360deg); }
        }
        .applicant-portal .notice-spinner {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 3px solid currentColor;
          border-right-color: transparent;
          animation: noticeSpin 0.8s linear infinite;
        }
        .applicant-portal .confirm-box .mbtn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
    </main>
  )
}