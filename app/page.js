'use client'
import { useEffect, useRef, useState } from 'react'
import './welcome-theme.css'

// ---------- Public guest welcome page ----------
// Sept 23, 2026: this is the site's real "front door" — the equivalent of
// Ivy's iskolusyon_front-end mockup's index.html. Before this existed, "/"
// went straight to what is now app/portal/page.js (the logged-in applicant
// dashboard), so a guest with no account had nowhere to land.
//
// Rebuilt Sept 23 (v2) to closely match the mockup's own visual design —
// colors, spacing, layout, component behavior — per Pau's explicit request
// that this page "heavily rel[y] on the structure and design from
// index.html." Written fresh as React/JSX + welcome-theme.css (not copied
// HTML/CSS files) but deliberately mirrors the mockup pixel-for-pixel where
// it reasonably can, since it's the team's own approved design either way.
//
// Log In / Sign Up are NOT a modal here (the mockup pops a login modal) —
// per Pau's explicit call, both route to the dedicated /login screen
// instead (?mode=signup deep-links into the signup panel there).

function IconArrow(props) {
  return (
    <svg className="w-[1em] h-[1em] inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function IconChevronLeft(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 12H6M11 6l-6 6 6 6" />
    </svg>
  )
}
function IconChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function IconInfo(props) {
  return (
    <svg className="w-[1em] h-[1em] inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <rect x="11" y="10" width="2" height="7" rx="1" fill="currentColor" stroke="none" />
      <rect x="11" y="6.3" width="2" height="2.1" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconTriangle(props) {
  return (
    <svg className="w-[1em] h-[1em] inline-block" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 8l6 7H6z" />
    </svg>
  )
}
function IconArrowUp(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}
function IconCaretDown(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 16 6 9h12z" />
    </svg>
  )
}
function IconPhone(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}
function IconGlobe(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function IconMail(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}
function IconFacebook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

const NAV_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'how-to-apply', label: 'How to Apply' },
  { id: 'before-you-apply', label: 'Before You Apply' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

// ---- How to Apply: 6 steps, content ported from the mockup's own guides ----
const STEPS = [
  {
    title: 'Create Account',
    desc: 'Sign up with your email and verify your identity',
    guideTitle: 'Create Account / Login',
    guide: (
      <>
        <div className="w-guide-branch">
          <span className="w-guide-branch-label">For New Users, create an account</span>
          <ul className="w-guide-steps">
            <li><span className="w-gs-num">1</span><span>Click the <strong>Sign Up</strong> button on the navigation bar or homepage.</span></li>
            <li><span className="w-gs-num">2</span><span>A <strong>Data Privacy Consent</strong> screen will appear. Read it carefully and click <strong>I Agree</strong> to proceed.</span></li>
            <li><span className="w-gs-num">3</span><span>Fill in the registration form with your <strong>personal information</strong> (full name, date of birth, address, contact number, etc.). Ensure all details are accurate and correct — these will be used for your scholarship application.</span></li>
            <li><span className="w-gs-num">4</span><span>Enter your <strong>email address</strong> and create a secure <strong>password</strong>.</span></li>
            <li><span className="w-gs-num">5</span><span>Click <strong>Send Verification Code</strong>. A one-time code will be sent to your registered email address.</span></li>
            <li><span className="w-gs-num">6</span><span>Enter the verification code in the provided field and click <strong>Verify &amp; Create Account</strong>. Your account will be created upon successful verification.</span></li>
          </ul>
        </div>
        <hr className="w-guide-divider" />
        <div className="w-guide-branch">
          <span className="w-guide-branch-label alt">For Existing Users, log in</span>
          <ul className="w-guide-steps">
            <li><span className="w-gs-num green">1</span><span>Click the <strong>Log In</strong> button on the navigation bar.</span></li>
            <li><span className="w-gs-num green">2</span><span>Enter your registered <strong>email address</strong> and <strong>password</strong>.</span></li>
            <li><span className="w-gs-num green">3</span><span>Click <strong>Send Verification Code</strong>. A one-time code will be sent to your email for security.</span></li>
            <li><span className="w-gs-num green">4</span><span>Enter the code and click <strong>Verify &amp; Log In</strong> to access your account dashboard.</span></li>
          </ul>
        </div>
        <p className="w-guide-note"><IconInfo /> Make sure to use a valid and accessible email address. Check your spam/junk folder if you don&apos;t receive the code within a few minutes.</p>
      </>
    ),
  },
  {
    title: 'Fill Profile',
    desc: 'Enter your personal, academic, and financial information',
    guideTitle: 'Fill Out Your Profile',
    guide: (
      <>
        <ul className="w-guide-steps">
          <li><span className="w-gs-num">1</span><span>After logging in, go to your <strong>Dashboard</strong> and click <strong>Complete My Profile</strong>.</span></li>
          <li><span className="w-gs-num">2</span><span>Fill in your <strong>Personal Information</strong> (full name, date of birth, gender, civil status, and residential address).</span></li>
          <li><span className="w-gs-num">3</span><span>Enter your <strong>Academic Information</strong> (current or last school attended, grade level, and GWA/GPA).</span></li>
          <li><span className="w-gs-num">4</span><span>Provide your <strong>Family &amp; Financial Background</strong> (parent/guardian details, household income, and number of siblings).</span></li>
          <li><span className="w-gs-num">5</span><span>Review all entries for accuracy (incorrect information may delay or affect the processing of your application).</span></li>
          <li><span className="w-gs-num">6</span><span>Click <strong>Save Profile</strong> to store your information.</span></li>
        </ul>
        <p className="w-guide-note"><IconInfo /> You can update your profile before submitting your application. Once submitted, changes may require revalidation.</p>
      </>
    ),
  },
  {
    title: 'Upload Docs',
    desc: 'Submit required documents securely through the portal',
    guideTitle: 'Upload Required Documents',
    guide: (
      <>
        <ul className="w-guide-steps">
          <li><span className="w-gs-num">1</span><span>From your Dashboard, click <strong>Upload Documents</strong>.</span></li>
          <li><span className="w-gs-num">2</span><span>Prepare the required documents based on your applicant type (Freshman, Transferee, etc.). Refer to the Admission Requirements section below for the full list.</span></li>
          <li><span className="w-gs-num">3</span><span>Scan or take clear photos of each document. Accepted formats are <strong>PDF, JPG, and PNG</strong> (max 5MB per file).</span></li>
          <li><span className="w-gs-num">4</span><span>Upload each document in the correct labeled slot (e.g., Report Card, Birth Certificate, Voter&apos;s ID).</span></li>
          <li><span className="w-gs-num">5</span><span>Once all documents are uploaded, click <strong>Submit Documents</strong>.</span></li>
          <li><span className="w-gs-num">6</span><span>You will receive a confirmation notification that your documents are under review.</span></li>
        </ul>
        <p className="w-guide-note"><IconInfo /> Ensure all documents are clear, complete, and unedited. Blurry or incomplete submissions will be flagged for resubmission.</p>
      </>
    ),
  },
  {
    title: 'Check Qualification',
    desc: 'View your scholarship qualification based on submitted documents',
    guideTitle: 'Check Your Qualification',
    guide: (
      <>
        <ul className="w-guide-steps">
          <li><span className="w-gs-num">1</span><span>After document verification is complete, you will receive a <strong>qualification status notification</strong> via email and in your portal dashboard.</span></li>
          <li><span className="w-gs-num">2</span><span>Log in to your account and go to <strong>My Application &gt; Qualification Status</strong>.</span></li>
          <li><span className="w-gs-num">3</span><span>Your qualification result will be displayed — either <strong>Qualified</strong>, <strong>Conditionally Qualified</strong>, or <strong>Not Qualified</strong>.</span></li>
          <li><span className="w-gs-num">4</span><span>If conditionally qualified, follow the instructions to submit any missing or corrected documents.</span></li>
          <li><span className="w-gs-num">5</span><span>If qualified, you will be scheduled for the scholarship qualifying exam. Proceed to Step 5.</span></li>
        </ul>
        <p className="w-guide-note"><IconInfo /> Qualification is based on submitted documents and eligibility criteria. Contact the GCTCDO office if you have questions about your status.</p>
      </>
    ),
  },
  {
    title: 'Take Exam',
    desc: 'Complete the scholarship qualifying exam on schedule',
    guideTitle: 'Take the Qualifying Exam',
    guide: (
      <>
        <ul className="w-guide-steps">
          <li><span className="w-gs-num">1</span><span>Once qualified, you will receive an <strong>exam schedule notification</strong> via email and in your portal dashboard.</span></li>
          <li><span className="w-gs-num">2</span><span>Log in on the scheduled exam date and go to <strong>My Application &gt; Qualifying Exam</strong>.</span></li>
          <li><span className="w-gs-num">3</span><span>Read the exam instructions carefully before starting.</span></li>
          <li><span className="w-gs-num">4</span><span>Complete the exam within the allotted time. Do not close the browser tab during the exam.</span></li>
          <li><span className="w-gs-num">5</span><span>Submit your answers by clicking <strong>Submit Exam</strong> when done. A confirmation screen will appear.</span></li>
        </ul>
        <p className="w-guide-note"><IconInfo /> Make sure you have a stable internet connection before starting the exam. Missed exam schedules must be rebooked through the GCTCDO office.</p>
      </>
    ),
  },
  {
    title: 'Track Result',
    desc: 'Get real-time updates on your application status',
    guideTitle: 'Track Your Application Result',
    guide: (
      <>
        <ul className="w-guide-steps">
          <li><span className="w-gs-num">1</span><span>After the exam, your results will be processed by the GCTCDO office.</span></li>
          <li><span className="w-gs-num">2</span><span>Log in to your account and go to <strong>My Application &gt; Application Status</strong> to check for updates.</span></li>
          <li><span className="w-gs-num">3</span><span>You will also receive real-time <strong>email and portal notifications</strong> as your application progresses.</span></li>
          <li><span className="w-gs-num">4</span><span>Status updates include: <em>Under Review</em>, <em>For Interview</em>, <em>Scholarship Granted</em>, or <em>Not Selected</em>.</span></li>
          <li><span className="w-gs-num">5</span><span>If granted a scholarship, follow the onboarding instructions sent to your email to complete enrollment.</span></li>
        </ul>
        <p className="w-guide-note"><IconInfo /> Processing times may vary. For urgent concerns, contact the GCTCDO office directly via email or Facebook Messenger.</p>
      </>
    ),
  },
]

const PROGRAM_DEPARTMENTS = [
  { name: 'Department of Business and Accounting', programs: ['Bachelor of Science in Accounting Information System', 'Bachelor of Science in Accountancy'] },
  {
    name: 'Department of Teacher Education',
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
  { name: 'Department of Computing and Informatics', programs: ['Bachelor of Science in Computer Science', 'Bachelor of Science in Information Technology'] },
  { name: 'Department of Arts and Sciences', programs: ['Bachelor of Science in Psychology'] },
]

const FAQ_DATA = [
  {
    category: 'Admissions',
    subcategories: [
      {
        name: 'Application Process & Requirements',
        items: [
          { q: 'Where can I find admission guidelines and schedules?', a: 'All official announcements such as qualifications, steps, and exam schedules are posted directly on this website. CCC-granted scholars shall receive specified announcements such as allowances.' },
          { q: 'How do I start my application?', a: 'Applicants must fill out a step-by-step process from this website after account creation and upload scanned copies of their initial documents.' },
          { q: 'Who is eligible to apply?', a: "Applicants must be bonafide residents of Calamba and must have a voter's registration." },
          { q: 'Are there specific grade requirements?', a: 'There is no minimum grade requirement, but applicants must strictly have no failing grades on their academic record and must pass the entrance exam.' },
          { q: 'What happens if my submitted requirements are incomplete?', a: 'You will only receive an official application number once your documents are identified as complete and valid.' },
          { q: 'What is the penalty for using fake documents?', a: 'Submitting fake IDs or falsified documents is strictly prohibited and actively monitored by the admissions office.' },
        ],
      },
      {
        name: 'Examination Details',
        items: [
          { q: 'How do I get my exam permit?', a: 'The exam permit is issued onsite as verification that all requirements have been submitted. A photograph of the applicant will be taken onsite to verify identity.' },
          { q: 'How are application and exam schedules assigned?', a: 'Schedules are by batch; the first 100 submissions are assigned to the first batch, and subsequent applicants are scheduled for different days.' },
          { q: 'What if I miss my exam schedule?', a: 'Failing to attend your scheduled entrance examination will result in the forfeiture of your application. If you have a valid personal reason for missing it, rescheduling can be requested via your account in this website.' },
        ],
      },
      {
        name: 'Results & Next Steps',
        items: [
          { q: 'How are entrance exam results announced?', a: 'Examination results are announced via this website for applicants to review.' },
          { q: 'What happens after passing the exam?', a: 'Passers are identified as scholars and will be issued a recommendation to proceed with their medical exam and official enrollment.' },
        ],
      },
    ],
  },
  {
    category: 'Registrars',
    subcategories: [
      {
        name: 'Document Submission',
        items: [
          { q: 'Do I submit original documents or photocopies?', a: 'If you are a currently enrolled Senior High School student, you only need to submit photocopies during the admission phase. If you have already graduated or stopped studying, you must present original copies to avoid discrepancies. Original copies will be required for all applicants once they pass the exam and proceed to official enrollment.' },
        ],
      },
    ],
  },
]

const CONTACT_OFFICES = [
  {
    name: "Guidance, Counseling, Testing, and Career Dev't Office (GCTCDO)",
    hours: 'Monday to Thursday and Saturday (7:00 AM to 5:00 PM)',
    address: 'GCTCDO, 1st Floor, Admin Building, City College of Calamba',
    email: <a href="mailto:gctcdo@ccc.edu.ph">gctcdo@ccc.edu.ph</a>,
    fb: <a href="https://www.facebook.com/CCCGTCDC" target="_blank" rel="noopener noreferrer">CCC GCTCDC Official Facebook Page</a>,
  },
  {
    name: 'Office of the College Registrar',
    hours: 'Monday to Thursday (7:00 AM to 6:00 PM)',
    address: 'Office of the College Registrar, 1st Floor, JMC Building, City College of Calamba',
    email: (
      <>
        <a href="mailto:verify@ccc.edu.ph">verify@ccc.edu.ph</a> (for student verification)
        <br />
        <a href="mailto:registrar@ccc.edu.ph">registrar@ccc.edu.ph</a> (main email)
      </>
    ),
    fb: <a href="https://www.facebook.com/profile.php?id=61551390461332" target="_blank" rel="noopener noreferrer">Office of the College Registrar Official Facebook Page</a>,
  },
]

const REQ_TABS = [
  {
    label: 'First Years',
    title: 'First Years',
    body: (
      <>
        <p className="w-qual-head">Requirements:</p>
        <ul>
          <li>One (1) Photocopy of latest Grade 11 or 12 (1st or 2nd semester) Report Card/Form, if available</li>
          <li>One (1) Photocopy of PSA/NSO/Local Birth Certificate</li>
          <li>One (1) Photocopy of Applicant/Parents&apos;/Guardian&apos;s Voter&apos;s Identification or Certification</li>
          <li>One (1) 3 pcs. 2x2 Picture (white background)</li>
        </ul>
      </>
    ),
  },
  {
    label: 'Transferees',
    title: 'Transferees',
    body: (
      <>
        <p className="w-qual-head">Requirements:</p>
        <ul>
          <li>One (1) Photocopy of PSA/NSO/Local Birth Certificate</li>
          <li>One (1) Photocopy of Applicant/Parents&apos;/Guardian&apos;s Voter&apos;s Identification or Certification</li>
          <li>One (1) 3 pcs. 2x2 Picture (white background)</li>
        </ul>
        <p className="w-qual-head" style={{ marginTop: '1rem' }}>The City College will accept transferees provided they have passed the following qualifications:</p>
        <ol>
          <li>The applicant does not have a failing grade in any semester from their previous school/s.</li>
          <li>The applicants have passed at least 28 academic units with a general weighted average of 2.25 or better for all collegiate academic units they have taken.</li>
          <li>The applicant will have to complete not less than 50% of the remaining units in his/her program at the college.</li>
          <li>The Program Director has the prerogative regarding the admission of transferees with exceptional cases, i.e., the same will be dealt with on a case-to-case basis, grades of 5.0, dropped, and INC.</li>
        </ol>
      </>
    ),
  },
  {
    label: 'Old Curriculum & ALS',
    title: 'Old Curriculum and ALS Completer',
    body: (
      <p>
        In cases, the prospective student graduated High School on/or before 2017, where K-12 has not been implemented yet, additional requirements need to be satisfied. Specifically, Forms 137 (for evaluation copy) or 138 depending on the availability will be required for submission. For ALS completers, they will be required to undergo the senior high school curriculum.
      </p>
    ),
  },
]

export default function WelcomePage() {
  const [announcements, setAnnouncements] = useState([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [openStep, setOpenStep] = useState(null)
  const [openBya, setOpenBya] = useState({ 0: true })
  const [reqTab, setReqTab] = useState(0)
  const [faqQuery, setFaqQuery] = useState('')
  const [openFaqId, setOpenFaqId] = useState(null)
  const [showToTop, setShowToTop] = useState(false)
  const [activeNav, setActiveNav] = useState('hero')
  const guideRef = useRef(null)
  const autoTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows = Array.isArray(data) ? data : data.announcements || []
        setAnnouncements(rows.filter((row) => row.type === 'announcement'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const slides =
    announcements.length > 0
      ? announcements
      : [{ id: 'empty', title: 'No announcements yet', body: 'Official announcements such as qualifications, steps, and exam schedules will appear here once they are posted.' }]

  useEffect(() => {
    if (slides.length <= 1) return undefined
    clearInterval(autoTimerRef.current)
    autoTimerRef.current = setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length)
    }, 5000)
    return () => clearInterval(autoTimerRef.current)
  }, [slides.length])

  useEffect(() => {
    if (slideIndex >= slides.length) setSlideIndex(0)
  }, [slides.length, slideIndex])

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = NAV_LINKS.map((n) => document.getElementById(n.id)).filter(Boolean)
    const onScroll = () => {
      let cur = 'hero'
      sections.forEach((s) => {
        if (window.scrollY >= s.offsetTop - 90) cur = s.id
      })
      setActiveNav(cur)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function moveSlide(dir) {
    setSlideIndex((i) => (i + dir + slides.length) % slides.length)
    clearInterval(autoTimerRef.current)
    autoTimerRef.current = setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), 5000)
  }

  function toggleStep(i) {
    setOpenStep((cur) => {
      const next = cur === i ? null : i
      if (next !== null) {
        setTimeout(() => guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
      }
      return next
    })
  }

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openBeforeYouApplySection(idx) {
    scrollToId('before-you-apply')
    setOpenBya({ [idx]: true })
  }

  const normalizedQuery = faqQuery.trim().toLowerCase()
  const filteredFaq = FAQ_DATA.map((cat) => ({
    ...cat,
    subcategories: cat.subcategories
      .map((sub) => ({
        ...sub,
        items: sub.items.filter(
          (item) => !normalizedQuery || item.q.toLowerCase().includes(normalizedQuery) || item.a.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((sub) => sub.items.length > 0),
  })).filter((cat) => cat.subcategories.length > 0)

  return (
    <main className="welcome-page">
      {/* ── TOPBAR ── */}
      <div className="w-topbar">
        <div className="inner">
          <span>(049) 559-8900 to 8907 / (02) 8-539-5170 to 5171</span>
          <a href="https://www.ccc.edu.ph" target="_blank" rel="noopener noreferrer">www.ccc.edu.ph</a>
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <nav className="w-navbar">
        <div className="w-nav-inner">
          <a href="#hero" onClick={(e) => { e.preventDefault(); scrollToId('hero') }} className="w-brand">
            <div className="w-brand-logos">
              <img src="/LOGO_CCC.png" alt="City College of Calamba Logo" />
              <img src="/LOGO_CCC_Admissions.png" alt="CCC Admissions Logo" />
              <img src="/LOGO_CCC_Registrar.png" alt="CCC Registrar Logo" />
            </div>
            <div className="w-brand-text">
              <span className="main">City College of Calamba</span>
              <span className="sub">Scholarship Portal</span>
            </div>
          </a>
          <nav className="w-nav-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                onClick={(e) => {
                  e.preventDefault()
                  if (link.id === 'before-you-apply') openBeforeYouApplySection(0)
                  else scrollToId(link.id)
                }}
                className={activeNav === link.id ? 'active' : ''}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="w-nav-actions">
            <a href="/login" className="w-btn-login">Log In</a>
            <a href="/login?mode=signup" className="w-btn-signup">Sign Up</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="w-hero" id="hero">
        <div className="w-hero-content">
          <h1>Scholarship Portal</h1>
          <p>Your all-in-one platform providing comprehensive application procedures, guidelines, and real-time notifications for aspiring City College of Calamba scholars.</p>
          <div className="w-hero-btns">
            <a href="/login?mode=signup" className="w-btn-white">Apply Now</a>
            <a href="#how-to-apply" onClick={(e) => { e.preventDefault(); scrollToId('how-to-apply') }} className="w-btn-outline-w">How to Apply</a>
          </div>
        </div>
      </section>

      <hr className="w-gold-rule" />

      {/* ── ANNOUNCEMENTS ── */}
      <div className="w-announce-wrap" id="announcement">
        <div className="w-section-heading">Announcements</div>
        <div className="w-carousel-outer">
          <div className="w-carousel-track-wrap">
            <div style={{ display: 'flex', transition: 'transform .45s cubic-bezier(.4,0,.2,1)', transform: `translateX(-${slideIndex * 100}%)` }}>
              {slides.map((s) => (
                <div key={s.id} style={{ minWidth: '100%' }}>
                  <div className="w-carousel-text-slide">
                    <h3>{s.title}</h3>
                    <p>{s.body || s.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {slides.length > 1 && (
            <>
              <button className="w-carousel-btn w-carousel-prev" onClick={() => moveSlide(-1)} aria-label="Previous slide">
                <IconChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <button className="w-carousel-btn w-carousel-next" onClick={() => moveSlide(1)} aria-label="Next slide">
                <IconChevronRight className="w-[18px] h-[18px]" />
              </button>
            </>
          )}
          <div className="w-carousel-counter">{slides.length ? `${slideIndex + 1} / ${slides.length}` : '0 / 0'}</div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '2px solid #e0e3ea', margin: 0 }} />

      {/* ── HOW TO APPLY ── */}
      <section className="w-how-section" id="how-to-apply">
        <div className="w-how-inner">
          <div className="w-how-title">How to Apply</div>
          <div className="w-how-sub">
            Follow these steps to complete your scholarship application &nbsp;&mdash;&nbsp;{' '}
            <span style={{ color: 'var(--w-blue)', fontWeight: 600 }}>click any step</span> to see the detailed guide
          </div>
          <div className="w-steps-map">
            {STEPS.map((step, i) => (
              <span key={step.title} style={{ display: 'contents' }}>
                <div className={`w-step-item${openStep === i ? ' active' : ''}`} onClick={() => toggleStep(i)}>
                  <div className="w-step-circle">{i + 1}</div>
                  <div className="w-step-title">{step.title}</div>
                  <div className="w-step-desc">{step.desc}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-step-arrow">
                    <IconArrow className="w-[22px] h-[22px]" />
                  </div>
                )}
              </span>
            ))}
          </div>

          {openStep !== null && (
            <div className="w-steps-dropdown-wrap" ref={guideRef}>
              <div className="w-step-guide">
                <div className="w-step-guide-header">
                  <div className="w-guide-num">{openStep + 1}</div>
                  <div className="w-guide-title">{STEPS[openStep].guideTitle}</div>
                </div>
                <div className="w-step-guide-body">
                  {STEPS[openStep].guide}
                  <button className="w-guide-close-btn" onClick={() => setOpenStep(null)}>
                    <IconTriangle style={{ transform: 'rotate(180deg)' }} /> Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <hr className="w-gold-rule" />

      {/* ── BEFORE YOU APPLY ── */}
      <div className="w-content-wrap">
        <section className="w-bya-section" id="before-you-apply">
          <div className="w-bya-heading">Before You Apply</div>
          <div className="w-bya-sub">Everything you need to check before starting your application &nbsp;&mdash;&nbsp; click each section to expand</div>

          <div className="w-bya-accordion">
            {/* 01 Programs Offered */}
            <div className={`w-bya-l1${openBya[0] ? ' open' : ''}`}>
              <button className="w-bya-l1-header" onClick={() => setOpenBya((s) => ({ ...s, 0: !s[0] }))}>
                <span className="w-bya-l1-title"><span className="w-bya-l1-num">01</span>Programs Offered</span>
                <span className="w-bya-l1-arrow"><IconCaretDown className="w-4 h-4" /></span>
              </button>
              {openBya[0] && (
                <div className="w-bya-l1-body">
                  <p className="w-bya-intro">Open for Academic Year 2027-2028.</p>
                  <div className="w-programs-grid">
                    {PROGRAM_DEPARTMENTS.map((dept) => (
                      <div key={dept.name}>
                        <p className="w-programs-dept">{dept.name}</p>
                        <ul className="w-programs-list">
                          {dept.programs.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 02 Applicant Qualifications */}
            <div className={`w-bya-l1${openBya[1] ? ' open' : ''}`}>
              <button className="w-bya-l1-header" onClick={() => setOpenBya((s) => ({ ...s, 1: !s[1] }))}>
                <span className="w-bya-l1-title"><span className="w-bya-l1-num">02</span>Applicant Qualifications</span>
                <span className="w-bya-l1-arrow"><IconCaretDown className="w-4 h-4" /></span>
              </button>
              {openBya[1] && (
                <div className="w-bya-l1-body">
                  <p className="qual">
                    No student shall be denied admission to this College by reason of age, sex, nationality, religious belief, or political affiliation. However, all students seeking admission must be subject to the regulations for admission prescribed by the City College of Calamba&ndash;Academic Personnel Council.
                  </p>
                  <p className="qual">
                    Academically qualified and deserving applicants must be a resident of the City of Calamba and have graduated from any public or private schools recognized by the Department of Education (DepEd) or are transferees from a tertiary institution recognized by Commission on Higher Education (CHED) with good academic and moral standing.
                  </p>
                  <p className="qual" style={{ marginBottom: 0 }}>
                    Residents of the City of Calamba and have a Voter&apos;s ID or COMELEC Voter&apos;s Certificate. For non-registered voters, a parent or guardian&apos;s voter ID will do.
                  </p>
                </div>
              )}
            </div>

            {/* 03 Admission Requirements */}
            <div className={`w-bya-l1${openBya[2] ? ' open' : ''}`}>
              <button className="w-bya-l1-header" onClick={() => setOpenBya((s) => ({ ...s, 2: !s[2] }))}>
                <span className="w-bya-l1-title"><span className="w-bya-l1-num">03</span>Admission Requirements</span>
                <span className="w-bya-l1-arrow"><IconCaretDown className="w-4 h-4" /></span>
              </button>
              {openBya[2] && (
                <div className="w-bya-l1-body">
                  <p className="w-bya-intro">All qualified applicants must submit the following documents to the City College of Calamba for admission evaluation. The following requirements must be submitted to the CCC by the applicants:</p>
                  <div className="w-req-tabs-wrap">
                    <div className="w-req-tabs">
                      {REQ_TABS.map((tab, i) => (
                        <button key={tab.label} className={`w-req-tab${reqTab === i ? ' active' : ''}`} onClick={() => setReqTab(i)}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="w-req-panel-wrap">
                      <p className="w-req-panel-title">{REQ_TABS[reqTab].title}</p>
                      <div className="w-req-panel">{REQ_TABS[reqTab].body}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <hr className="w-gold-rule" />

      {/* ── FAQ ── */}
      <section className="w-faq-section" id="faq">
        <div className="w-faq-inner">
          <div className="w-faq-title">Frequently Asked Questions</div>
          <div className="w-faq-sub">Search or browse answers to common questions about admissions and the registrar.</div>
          <div className="w-faq-search-wrap">
            <input type="text" value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} placeholder="Search frequently asked questions..." />
          </div>
          <div className="w-faq-list-scroll">
            {filteredFaq.length === 0 ? (
              <p className="w-faq-empty-msg">No matching questions found.</p>
            ) : (
              filteredFaq.map((cat) => (
                <div key={cat.category}>
                  <div className="w-faq-category">{cat.category}</div>
                  {cat.subcategories.map((sub) => (
                    <div key={sub.name}>
                      <div className="w-faq-subcategory">{sub.name}</div>
                      {sub.items.map((item) => {
                        const id = cat.category + sub.name + item.q
                        const open = openFaqId === id
                        return (
                          <div key={id} className={`w-faq-item${open ? ' open' : ''}`}>
                            <button className="w-faq-item-header" onClick={() => setOpenFaqId(open ? null : id)}>
                              <span>{item.q}</span>
                              <span className="w-faq-item-toggle">+</span>
                            </button>
                            {open && (
                              <div className="w-faq-item-body">
                                <p>{item.a}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <hr className="w-gold-rule" />

      {/* ── CONTACT OUR OFFICES ── */}
      <section className="w-contact-section" id="contact">
        <div className="w-contact-inner">
          <div className="w-contact-title">Contact Our Offices</div>
          <div className="w-contact-sub">For further assistance, contact us via the available helplines below for scholarship-related concerns.</div>
          <table className="w-contact-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Office Hours</th>
                <th>Location</th>
                <th>Email Address</th>
                <th>Facebook Page</th>
              </tr>
            </thead>
            <tbody>
              {CONTACT_OFFICES.map((office) => (
                <tr key={office.name}>
                  <td>{office.name}</td>
                  <td>{office.hours}</td>
                  <td>{office.address}</td>
                  <td>{office.email}</td>
                  <td>{office.fb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── LOCATION MAP ── */}
      <section style={{ width: '100%', lineHeight: 0, position: 'relative', display: 'block' }}>
        <iframe
          title="City College of Calamba — Calamba City, Laguna"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d965.0069!2d121.1675199!3d14.2120907!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd622b2e539df1%3A0x9102ac773e8a0b99!2sCity%20College%20of%20Calamba!5e0!3m2!1sen!2sph!4v1717000000000!5m2!1sen!2sph"
          width="100%"
          height="480"
          style={{ border: 0, display: 'block', width: '100%' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div
          style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.93)', borderRadius: 6, padding: '8px 18px',
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 12px rgba(0,0,0,.18)',
            pointerEvents: 'none', whiteSpace: 'nowrap', lineHeight: 1.4,
          }}
        >
          <IconPin style={{ width: 16, height: 16, color: 'var(--ccc-blue)' }} />
          <span style={{ fontFamily: 'var(--font-montserrat)', fontSize: '.75rem', fontWeight: 700, color: 'var(--ccc-navy)', letterSpacing: '.4px' }}>
            City College of Calamba &nbsp;&mdash;&nbsp; Brgy. Real, Calamba City, Laguna 4027
          </span>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-footer">
        <div className="w-footer-inner">
          <div className="w-footer-main">
            <div className="w-footer-logo-col">
              <img src="/LOGO_CCC-WHITE-ONLY.png" alt="City College of Calamba White Logo" />
              <img src="/LOGO_CCC-WHITE_GUIDANCE.png" alt="CCC Guidance White Logo" />
              <img src="/LOGO_CCC-WHITE_REGISTRAR.png" alt="CCC Registrar White Logo" />
            </div>
            <div className="w-footer-content-col">
              <div className="w-footer-content-row">
                <div>
                  <h4>Connect Directly with CCC</h4>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '.8rem', color: 'rgba(255,255,255,.5)' }}>
                    <IconPhone style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} /> (049) 559 8900
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '.8rem', color: 'rgba(255,255,255,.5)' }}>
                    <IconPhone style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} /> (02) 8 539 5170
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <IconGlobe style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} />
                    <a href="https://www.ccc.edu.ph" target="_blank" rel="noopener noreferrer">www.ccc.edu.ph</a>
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <IconMail style={{ width: 15, height: 15, color: 'var(--ccc-gold)', flexShrink: 0 }} />
                    <a href="mailto:info@ccc.edu.ph">info@ccc.edu.ph</a>
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <a
                      href="https://www.facebook.com/citycollegeofcalamba"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="CCC Facebook Page"
                      style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, marginBottom: 0 }}
                    >
                      <IconFacebook style={{ width: 17, height: 17 }} />
                    </a>
                  </div>
                </div>
                <div>
                  <h4>Resources</h4>
                  <a onClick={() => openBeforeYouApplySection(2)} style={{ cursor: 'pointer' }}>Admission Requirements</a>
                  <a onClick={() => scrollToId('faq')} style={{ cursor: 'pointer' }}>FAQs</a>
                  <a href="https://ccc.edu.ph/public/upload/files/CCC-Privacy-Statement-June-2026.pdf" target="_blank" rel="noopener noreferrer">Privacy Statement</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <div className="w-footer-bar">&copy; 2026 Iskolusyon Scholarship Management System &nbsp;|&nbsp; Developed for the City College of Calamba</div>

      <button className={`w-to-top${showToTop ? ' show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">
        <IconArrowUp style={{ width: 16, height: 16 }} />
      </button>
    </main>
  )
}
