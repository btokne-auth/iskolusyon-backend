'use client'
import { useEffect, useState } from 'react'
import SiteHeader from './components/SiteHeader'

// ---------- Public guest welcome page ----------
// Sept 23, 2026: this is the site's real "front door" — the equivalent of
// Ivy's iskolusyon_front-end mockup's index.html. Before this existed, "/"
// went straight to what is now app/portal/page.js (the logged-in applicant
// dashboard), so a guest with no account had nowhere to land and no way to
// learn what Iskolusyon even is before signing up.
//
// This page is written fresh against this app's own design system
// (Tailwind + the ccc-* tokens in globals.css + the shared SiteHeader) —
// none of Ivy's markup, CSS or client-side script was copied, only the real
// CCC informational content (FAQ answers, program lists, office contact
// info, etc.), per the standing rule that mockups are a content/behavior
// reference only.
//
// Per Pau's explicit call: Log In and Sign Up are NOT a modal on this page.
// Both routes to a dedicated /login screen (?mode=signup deep-links into
// the signup panel there) — simpler and more reliable than porting the
// mockup's popup-modal login.

function IconChevron({ open, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}
function IconMail(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  )
}
function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
    </svg>
  )
}
function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.6 7-12a7 7 0 10-14 0c0 5.4 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
function IconFacebook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.23 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22C18.34 21.23 22 17.08 22 12.06z" />
    </svg>
  )
}

// ---- How to Apply: 6 steps, content ported verbatim from Ivy's mockup ----
const HOW_TO_APPLY_STEPS = [
  {
    title: 'Create Account / Log In',
    desc: 'Sign up for a new applicant account, or log in if you already have one.',
    guide: (
      <>
        <p className="font-bold text-ccc-navy mb-2">For New Users</p>
        <ol className="list-decimal list-inside space-y-1.5 mb-4">
          <li>Click the <strong>Sign Up</strong> button.</li>
          <li>Read and agree to the Data Privacy Consent.</li>
          <li>Fill out the registration form with your basic information.</li>
          <li>Provide a valid email address and create a password.</li>
          <li>Click <strong>Send Verification Code</strong> — a code will be sent to your email.</li>
          <li>Enter the code to <strong>Verify &amp; Create Account</strong>.</li>
        </ol>
        <p className="font-bold text-ccc-navy mb-2">For Existing Users</p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>Click the <strong>Log In</strong> button.</li>
          <li>Enter your registered email address and password.</li>
          <li>Click <strong>Send Verification Code</strong>.</li>
          <li>Enter the code to <strong>Verify &amp; Log In</strong>.</li>
        </ol>
        <p className="text-xs text-ccc-muted mt-4 bg-ccc-off border border-ccc-border rounded-lg p-3">
          Didn&apos;t get a code? Check your email&apos;s spam or junk folder before requesting a new one.
        </p>
      </>
    ),
  },
  {
    title: 'Fill Out Your Profile',
    desc: 'Complete your personal, family, and educational information.',
    guide: (
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Log in to your applicant account.</li>
        <li>Go to your <strong>Profile</strong> section.</li>
        <li>Fill out your personal information (name, address, contact details).</li>
        <li>Fill out your family background information.</li>
        <li>Fill out your educational background.</li>
        <li>Save your changes before moving on.</li>
      </ol>
    ),
  },
  {
    title: 'Upload Required Documents',
    desc: 'Submit clear, complete copies of all required admission documents.',
    guide: (
      <>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>Go to the <strong>Documents</strong> section of your profile.</li>
          <li>Check the list of documents required for your applicant type (First Year, Transferee, etc.)</li>
          <li>Prepare clear, readable scans or photos of each document.</li>
          <li>Upload each document to its matching field.</li>
          <li>Double-check that every required document has been uploaded.</li>
          <li>Wait for your documents to be reviewed.</li>
        </ol>
        <p className="text-xs text-ccc-muted mt-4 bg-ccc-off border border-ccc-border rounded-lg p-3">
          Accepted formats: PDF, JPG, and PNG (max 5MB per file).
        </p>
      </>
    ),
  },
  {
    title: 'Check Your Qualification',
    desc: 'See whether your submitted requirements were approved.',
    guide: (
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Log in to your applicant account.</li>
        <li>Go to your <strong>Application Status</strong>.</li>
        <li>Check your qualification result.</li>
        <li>Your status will show as <strong>Qualified</strong>, <strong>Conditionally Qualified</strong>, or <strong>Not Qualified</strong>.</li>
        <li>If conditionally qualified, review which requirement still needs to be completed or corrected.</li>
      </ol>
    ),
  },
  {
    title: 'Take the Qualifying Exam',
    desc: 'Attend your assigned exam schedule and bring your exam permit.',
    guide: (
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Wait for your exam schedule and permit to be issued through your account.</li>
        <li>Download or take note of your exam permit and schedule.</li>
        <li>Arrive at the testing venue on your assigned date and time.</li>
        <li>Present your exam permit and a valid ID.</li>
        <li>Take the qualifying exam.</li>
      </ol>
    ),
  },
  {
    title: 'Track Your Application Result',
    desc: 'Monitor your final scholarship status through your account.',
    guide: (
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Log in to your applicant account.</li>
        <li>Go to your <strong>Application Status</strong>.</li>
        <li>Check your current stage in the process.</li>
        <li>Your result will show as <strong>Under Review</strong>, <strong>For Interview</strong>, <strong>Scholarship Granted</strong>, or <strong>Not Selected</strong>.</li>
        <li>Watch for further instructions if you are called for an interview or granted the scholarship.</li>
      </ol>
    ),
  },
]

// ---- Before You Apply: programs offered, verbatim from Ivy's mockup ----
const PROGRAM_DEPARTMENTS = [
  {
    name: 'Department of Business and Accounting',
    programs: ['BS Accounting Information System', 'BS Accountancy'],
  },
  {
    name: 'Department of Teacher Education',
    programs: [
      'Bachelor of Early Childhood Education',
      'BSEd - Filipino',
      'BSEd - English',
      'Bachelor of Elementary Education',
      'BSEd - Social Studies',
      'BSEd - Science',
      'BSEd - Mathematics',
    ],
  },
  {
    name: 'Department of Computing and Informatics',
    programs: ['BS Computer Science', 'BS Information Technology'],
  },
  {
    name: 'Department of Arts and Sciences',
    programs: ['BS Psychology'],
  },
]

const FAQ_DATA = [
  {
    category: 'Admissions',
    subcategories: [
      {
        name: 'Application Process & Requirements',
        items: [
          {
            q: 'Where can I find the admission guidelines?',
            a: 'Admission guidelines, including requirements and qualifications, are available on the Before You Apply section of this website.',
          },
          {
            q: 'How do I start my application?',
            a: 'Create an applicant account, fill out your profile, and upload your required documents through the Iskolusyon portal.',
          },
          {
            q: 'Am I eligible to apply?',
            a: 'You must be a resident of Calamba City and a registered voter of Calamba (or the parent/guardian of the applicant must be, if the applicant is not yet a registered voter) to be eligible.',
          },
          {
            q: 'Are there minimum grade requirements?',
            a: 'There is no strict minimum grade requirement, but applicants must not have any failing grades and must pass the qualifying entrance exam.',
          },
          {
            q: 'What happens if I submit incomplete requirements?',
            a: 'Incomplete requirements may delay or disqualify your application. Make sure all required documents are uploaded before the deadline.',
          },
          {
            q: 'What happens if I submit fake or falsified documents?',
            a: 'Submitting fake or falsified documents will result in immediate disqualification and may lead to further administrative or legal action.',
          },
        ],
      },
      {
        name: 'Examination Details',
        items: [
          {
            q: 'How do I get my exam permit?',
            a: 'Exam permits are issued onsite. A photo will be taken for identity verification purposes on the day of the exam.',
          },
          {
            q: 'How is my exam schedule assigned?',
            a: 'Applicants are grouped into batches of 100 based on the order their applications were submitted.',
          },
          {
            q: 'What happens if I miss my exam schedule?',
            a: 'Missing your exam schedule generally forfeits your slot, unless you have a valid reason and request a reschedule through your account.',
          },
        ],
      },
      {
        name: 'Results & Next Steps',
        items: [
          {
            q: 'How will I know the exam results?',
            a: 'Results are announced through the Iskolusyon website — check your application status regularly.',
          },
          {
            q: 'What happens after I pass?',
            a: 'Passing applicants will be recommended for a medical examination and official enrollment.',
          },
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
          {
            q: 'Do I need to submit original documents or are photocopies okay?',
            a: "Currently enrolled senior high school students may submit photocopies during the admission phase. Applicants who have already graduated or stopped studying must present original documents. All applicants will need to present their original documents once they pass the exam and proceed to enrollment.",
          },
        ],
      },
    ],
  },
]

const CONTACT_OFFICES = [
  {
    name: "GCTCDO (Guidance, Counseling, Testing, and Career Dev't Office)",
    hours: 'Monday to Thursday and Saturday (7:00 AM to 5:00 PM)',
    address: 'GCTCDO, 1st Floor, Admin Building, City College of Calamba',
    email: 'gctcdo@ccc.edu.ph',
    fb: 'https://facebook.com/CCCGTCDC',
  },
  {
    name: 'Office of the College Registrar',
    hours: 'Monday to Thursday (7:00 AM to 6:00 PM)',
    address: 'Office of the College Registrar, 1st Floor, JMC Building, City College of Calamba',
    email: 'verify@ccc.edu.ph / registrar@ccc.edu.ph',
    fb: 'https://facebook.com/profile.php?id=61551390461332',
  },
]

function AccordionItem({ title, open, onToggle, children }) {
  return (
    <div className="border border-ccc-border rounded-xl bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-extrabold text-ccc-navy text-sm md:text-base" style={{ fontFamily: 'var(--font-montserrat)' }}>
          {title}
        </span>
        <IconChevron open={open} className="w-5 h-5 text-ccc-blue shrink-0" />
      </button>
      {open && <div className="px-5 pb-5 text-sm text-ccc-text leading-relaxed">{children}</div>}
    </div>
  )
}

export default function WelcomePage() {
  const [announcements, setAnnouncements] = useState([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)
  const [openStep, setOpenStep] = useState(null)
  const [openSection, setOpenSection] = useState('programs')
  const [reqTab, setReqTab] = useState('first-years')
  const [faqQuery, setFaqQuery] = useState('')
  const [openFaqId, setOpenFaqId] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        // Public page — only ever show real public announcements, never the
        // targeted `type: 'message'` rows that share this same table/endpoint.
        const rows = Array.isArray(data) ? data : data.announcements || []
        setAnnouncements(rows.filter((row) => row.type === 'announcement'))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAnnouncementsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const normalizedQuery = faqQuery.trim().toLowerCase()
  const filteredFaq = FAQ_DATA.map((cat) => ({
    ...cat,
    subcategories: cat.subcategories
      .map((sub) => ({
        ...sub,
        items: sub.items.filter(
          (item) =>
            !normalizedQuery ||
            item.q.toLowerCase().includes(normalizedQuery) ||
            item.a.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((sub) => sub.items.length > 0),
  })).filter((cat) => cat.subcategories.length > 0)

  return (
    <main className="min-h-screen bg-ccc-off">
      <SiteHeader
        topbarLabel="City College of Calamba — Iskolusyon Scholarship Portal"
        topbarLink={{ href: 'https://ccc.edu.ph', label: 'www.ccc.edu.ph' }}
        subtitle="Scholarship Portal"
        logos={[
          { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
          { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
          { src: '/LOGO_CCC_Registrar.png', alt: 'CCC Registrar Logo' },
        ]}
        rightSlot={
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="px-4 py-2 rounded-md text-ccc-blue border border-ccc-blue font-bold text-xs uppercase tracking-wide hover:bg-blue-50"
            >
              Log In
            </a>
            <a
              href="/login?mode=signup"
              className="px-4 py-2 rounded-md bg-ccc-blue text-white font-bold text-xs uppercase tracking-wide hover:bg-[#002fa8]"
            >
              Sign Up
            </a>
          </div>
        }
      />

      {/* ---------- Hero ---------- */}
      <section className="bg-gradient-to-br from-ccc-navy to-ccc-blue text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <h1
            className="text-3xl md:text-5xl font-extrabold mb-4"
            style={{ fontFamily: 'var(--font-montserrat)' }}
          >
            Scholarship Portal
          </h1>
          <p className="text-sm md:text-base text-white/85 max-w-2xl mx-auto mb-8 leading-relaxed">
            Your all-in-one platform providing comprehensive application procedures, guidelines, and
            real-time notifications for aspiring City College of Calamba scholars.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="/login?mode=signup"
              className="px-6 py-3 rounded-md bg-ccc-gold text-ccc-navy font-extrabold text-sm uppercase tracking-wide hover:brightness-105"
            >
              Apply Now
            </a>
            <a
              href="#how-to-apply"
              className="px-6 py-3 rounded-md border-2 border-white text-white font-extrabold text-sm uppercase tracking-wide hover:bg-white/10"
            >
              How to Apply
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Announcements ---------- */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-ccc-navy mb-5" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Announcements
        </h2>
        {announcementsLoading ? (
          <p className="text-sm text-ccc-muted">Loading…</p>
        ) : announcements.length === 0 ? (
          <div className="bg-white border border-ccc-border rounded-xl px-6 py-10 text-center">
            <p className="font-bold text-ccc-navy mb-1.5">No announcements yet</p>
            <p className="text-sm text-ccc-muted max-w-md mx-auto">
              Official announcements such as qualifications, steps, and exam schedules will appear here
              once they are posted.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {announcements.map((item) => (
              <div key={item.id} className="bg-white border border-ccc-border rounded-xl p-4">
                <p className="font-bold text-ccc-navy text-sm mb-1">{item.title}</p>
                <p className="text-sm text-ccc-text leading-relaxed">{item.body || item.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- How to Apply ---------- */}
      <section id="how-to-apply" className="bg-white border-y border-ccc-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-14">
          <h2 className="text-xl md:text-2xl font-extrabold text-ccc-navy mb-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
            How to Apply
          </h2>
          <p className="text-sm text-ccc-muted mb-7">
            Follow these steps to complete your scholarship application — click any step to see the
            detailed guide.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {HOW_TO_APPLY_STEPS.map((step, i) => (
              <button
                key={step.title}
                onClick={() => setOpenStep(i)}
                className="text-left bg-ccc-off border border-ccc-border rounded-xl p-4 hover:border-ccc-blue transition-colors"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="w-7 h-7 rounded-full bg-ccc-blue text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-extrabold text-ccc-navy text-sm" style={{ fontFamily: 'var(--font-montserrat)' }}>
                    {step.title}
                  </span>
                </div>
                <p className="text-xs text-ccc-muted pl-10">{step.desc}</p>
              </button>
            ))}
          </div>

          {openStep !== null && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setOpenStep(null)}
            >
              <div
                className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-ccc-navy text-lg" style={{ fontFamily: 'var(--font-montserrat)' }}>
                    {openStep + 1}. {HOW_TO_APPLY_STEPS[openStep].title}
                  </h3>
                </div>
                <div className="text-sm text-ccc-text">{HOW_TO_APPLY_STEPS[openStep].guide}</div>
                <button
                  onClick={() => setOpenStep(null)}
                  className="mt-6 w-full px-4 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Before You Apply ---------- */}
      <section id="before-you-apply" className="max-w-5xl mx-auto px-4 md:px-8 py-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-ccc-navy mb-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Before You Apply
        </h2>
        <p className="text-sm text-ccc-muted mb-7">
          Review the programs offered, applicant qualifications, and admission requirements before you
          start your application.
        </p>

        <div className="space-y-3">
          <AccordionItem
            title="01 · Programs Offered"
            open={openSection === 'programs'}
            onToggle={() => setOpenSection(openSection === 'programs' ? null : 'programs')}
          >
            <p className="mb-4 text-ccc-muted">Open for Academic Year 2027-2028.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {PROGRAM_DEPARTMENTS.map((dept) => (
                <div key={dept.name}>
                  <p className="font-bold text-ccc-navy mb-1.5">{dept.name}</p>
                  <ul className="list-disc list-inside space-y-1 text-ccc-text">
                    {dept.programs.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem
            title="02 · Applicant Qualifications"
            open={openSection === 'qualifications'}
            onToggle={() => setOpenSection(openSection === 'qualifications' ? null : 'qualifications')}
          >
            <div className="space-y-3">
              <p>
                Applicants shall not be discriminated against on the basis of age, sex, nationality,
                religion, or political affiliation, subject to the regulations of the Academic Personnel
                Council.
              </p>
              <p>
                Applicants must be a resident of Calamba City and a graduate or transferee, in good
                standing, of a school recognized by DepEd or CHED.
              </p>
              <p>
                Applicants must be a registered voter of Calamba City. If the applicant is not yet a
                registered voter, their Voter&apos;s ID or COMELEC Certificate of Registration — or that of
                their parent/guardian — may be submitted instead.
              </p>
            </div>
          </AccordionItem>

          <AccordionItem
            title="03 · Admission Requirements"
            open={openSection === 'requirements'}
            onToggle={() => setOpenSection(openSection === 'requirements' ? null : 'requirements')}
          >
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { id: 'first-years', label: 'First Years' },
                { id: 'transferees', label: 'Transferees' },
                { id: 'old-curriculum', label: 'Old Curriculum & ALS' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setReqTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    reqTab === tab.id
                      ? 'bg-ccc-blue text-white border-ccc-blue'
                      : 'bg-white text-ccc-muted border-ccc-border'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {reqTab === 'first-years' && (
              <ul className="list-disc list-inside space-y-1.5">
                <li>Photocopy of Grade 11/12 report card (Form 138)</li>
                <li>Photocopy of PSA/NSO or Local Civil Registrar Birth Certificate</li>
                <li>Photocopy of Voter&apos;s ID of the applicant, or of a parent/guardian</li>
                <li>3 pcs 2x2 ID photo, white background</li>
              </ul>
            )}
            {reqTab === 'transferees' && (
              <>
                <ul className="list-disc list-inside space-y-1.5 mb-4">
                  <li>Photocopy of PSA/NSO or Local Civil Registrar Birth Certificate</li>
                  <li>Photocopy of Voter&apos;s ID of the applicant, or of a parent/guardian</li>
                  <li>3 pcs 2x2 ID photo, white background</li>
                </ul>
                <p className="font-bold text-ccc-navy mb-2">Qualification criteria for transferees:</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Must have no failing grade in any semester.</li>
                  <li>Must have passed at least 28 academic units with a General Weighted Average (GWA) of 2.25 or better.</li>
                  <li>Must be able to complete at least 50% of the remaining units of the program at City College of Calamba.</li>
                  <li>The Program Director has case-by-case discretion over applicants with a grade of 5.0, a dropped subject, or an INC (incomplete) grade.</li>
                </ol>
              </>
            )}
            {reqTab === 'old-curriculum' && (
              <p>
                Applicants who graduated under the pre-2017 curriculum (before K-12) must submit Form
                137/138 as proof of their academic background. Applicants who completed the Alternative
                Learning System (ALS) must undergo the senior high school curriculum before they may be
                considered for admission.
              </p>
            )}
          </AccordionItem>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="bg-white border-y border-ccc-border">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-14">
          <h2 className="text-xl md:text-2xl font-extrabold text-ccc-navy mb-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-ccc-muted mb-5">
            Search or browse answers to common questions about admissions and the registrar.
          </p>
          <input
            type="text"
            value={faqQuery}
            onChange={(e) => setFaqQuery(e.target.value)}
            placeholder="Search FAQs…"
            className="w-full max-w-md mb-8 px-4 py-2.5 rounded-md border border-ccc-border text-sm focus:outline-none focus:ring-2 focus:ring-ccc-blue/30"
          />

          {filteredFaq.length === 0 ? (
            <p className="text-sm text-ccc-muted">No matching questions found.</p>
          ) : (
            <div className="space-y-8">
              {filteredFaq.map((cat) => (
                <div key={cat.category}>
                  <h3
                    className="text-base font-extrabold text-ccc-blue uppercase tracking-wide mb-4"
                    style={{ fontFamily: 'var(--font-montserrat)' }}
                  >
                    {cat.category}
                  </h3>
                  <div className="space-y-6">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.name}>
                        <p className="font-bold text-ccc-navy text-sm mb-2">{sub.name}</p>
                        <div className="space-y-2">
                          {sub.items.map((item) => {
                            const id = cat.category + sub.name + item.q
                            const open = openFaqId === id
                            return (
                              <div key={id} className="border border-ccc-border rounded-lg overflow-hidden">
                                <button
                                  onClick={() => setOpenFaqId(open ? null : id)}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-ccc-off"
                                >
                                  <span className="text-sm font-semibold text-ccc-text">{item.q}</span>
                                  <IconChevron open={open} className="w-4 h-4 text-ccc-blue shrink-0" />
                                </button>
                                {open && (
                                  <div className="px-4 py-3 text-sm text-ccc-muted leading-relaxed">{item.a}</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Contact Our Offices ---------- */}
      <section id="contact" className="max-w-5xl mx-auto px-4 md:px-8 py-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-ccc-navy mb-1.5" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Contact Our Offices
        </h2>
        <p className="text-sm text-ccc-muted mb-7">
          For further assistance, contact us via the available helplines below for scholarship-related
          concerns.
        </p>
        <div className="grid gap-4 md:grid-cols-2 mb-10">
          {CONTACT_OFFICES.map((office) => (
            <div key={office.name} className="bg-white border border-ccc-border rounded-xl p-5">
              <p className="font-extrabold text-ccc-navy text-sm mb-3" style={{ fontFamily: 'var(--font-montserrat)' }}>
                {office.name}
              </p>
              <div className="space-y-2 text-sm text-ccc-text">
                <p className="flex items-start gap-2">
                  <IconClock className="w-4 h-4 text-ccc-muted mt-0.5 shrink-0" />
                  {office.hours}
                </p>
                <p className="flex items-start gap-2">
                  <IconPin className="w-4 h-4 text-ccc-muted mt-0.5 shrink-0" />
                  {office.address}
                </p>
                <p className="flex items-start gap-2">
                  <IconMail className="w-4 h-4 text-ccc-muted mt-0.5 shrink-0" />
                  {office.email}
                </p>
                <a
                  href={office.fb}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-ccc-blue font-semibold hover:underline"
                >
                  <IconFacebook className="w-4 h-4 shrink-0" />
                  Facebook Page
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl overflow-hidden border border-ccc-border relative">
          <iframe
            title="City College of Calamba location"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d965.0069!2d121.1675199!3d14.2120907!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd622b2e539df1%3A0x9102ac773e8a0b99!2sCity%20College%20of%20Calamba!5e0!3m2!1sen!2sph!4v1717000000000!5m2!1sen!2sph"
            width="100%"
            height="320"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute bottom-0 left-0 bg-ccc-navy/90 text-white text-xs font-semibold px-3 py-2">
            City College of Calamba — Brgy. Real, Calamba City, Laguna 4027
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-ccc-navy text-white">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 grid gap-10 md:grid-cols-3">
          <div>
            <img src="/LOGO_CCC-WHITE-ONLY.png" alt="City College of Calamba" className="h-12 w-auto mb-4" />
            <p className="text-xs font-extrabold uppercase tracking-wide text-white/70 mb-2">
              Connect Directly with CCC
            </p>
            <div className="text-sm text-white/85 space-y-1.5">
              <p>(049) 559 8900</p>
              <p>(02) 8 539 5170</p>
              <a href="https://ccc.edu.ph" target="_blank" rel="noreferrer" className="block hover:underline">
                www.ccc.edu.ph
              </a>
              <a href="mailto:info@ccc.edu.ph" className="block hover:underline">
                info@ccc.edu.ph
              </a>
              <a
                href="https://facebook.com/citycollegeofcalamba"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:underline"
              >
                <IconFacebook className="w-4 h-4" />
                Facebook
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-white/70 mb-3">Resources</p>
            <div className="text-sm text-white/85 space-y-1.5">
              <a href="#before-you-apply" className="block hover:underline">
                Admission Requirements
              </a>
              <a href="#faq" className="block hover:underline">
                FAQs
              </a>
              <a
                href="https://ccc.edu.ph/public/upload/files/CCC-Privacy-Statement-June-2026.pdf"
                target="_blank"
                rel="noreferrer"
                className="block hover:underline"
              >
                Privacy Statement
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-white/70 mb-3">Get Started</p>
            <div className="flex flex-col gap-2 items-start">
              <a
                href="/login?mode=signup"
                className="px-4 py-2 rounded-md bg-ccc-gold text-ccc-navy font-extrabold text-xs uppercase tracking-wide"
              >
                Apply Now
              </a>
              <a href="/login" className="text-sm text-white/85 hover:underline">
                Already have an account? Log in
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
          © 2026 Iskolusyon Scholarship Management System | Developed for the City College of Calamba
        </div>
      </footer>
    </main>
  )
}
