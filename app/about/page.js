'use client'
import { useState } from 'react'
import SiteHeader from '../components/SiteHeader'

// ---------- Guest Module: About Us + FAQ ----------
// No login, no fetch, no dependency on any other module — safe to build
// and ship on its own. Matches the approved CCC brand theme (same
// SiteHeader, same ccc-* color tokens used on the applicant/admin pages).
//
// ⚠️ PLACEHOLDER CONTENT: everything in PROGRAMS, CONTACT_INFO, and FAQS
// below is a starting draft, not verified CCC information. Swap in the
// real program names, office details, and FAQ answers before this goes
// in front of an actual applicant or your panel.

const PROGRAMS = [
  {
    name: 'Academic Excellence Scholarship',
    blurb: 'For applicants who meet the grade-threshold requirement set by the City College of Calamba.',
  },
  {
    name: 'Financial Assistance Grant',
    blurb: 'For applicants demonstrating financial need, based on submitted proof of income.',
  },
  {
    name: 'Special Demographics Scholarship',
    blurb: 'For applicants under a specific legal or demographic classification recognized by the LGU.',
  },
]

const CONTACT_INFO = {
  office: 'CCC Admissions & Scholarship Office',
  address: 'City College of Calamba, Real St., Calamba City, Laguna',
  phone: '(049) 000-0000',
  email: 'scholarship@ccc.edu.ph',
  hours: 'Monday–Friday, 8:00 AM – 5:00 PM',
}

const FAQS = [
  {
    q: 'How do I apply for a scholarship?',
    a: 'Fill out the application form on the applicant page, then upload each required document. Every document is scanned automatically and given a status of Verified or Needs Review.',
  },
  {
    q: 'What documents do I need to submit?',
    a: 'Birth Certificate or PSA copy, Voter\u2019s ID, Form 138 / report card, Certificate of Enrollment, Good Moral Character, proof of income, and any supporting documents for your specific classification. The exact list depends on the program you\u2019re applying to.',
  },
  {
    q: 'How do I check my application status?',
    a: 'Type your name in the applicant form and click "View my document status" to see a live checklist of every document you\u2019ve submitted, and whether each one is Verified, Needs Review, or Not Uploaded yet.',
  },
  {
    q: 'What happens if a document is flagged "Needs Review"?',
    a: 'It means text detection wasn\u2019t fully confident reading your file \u2014 usually from a blurry photo, glare, or an angled shot. Your document is still saved, but you can re-upload a clearer copy any time to avoid delays.',
  },
  {
    q: 'Who do I contact if I have a problem?',
    a: 'Reach the CCC Admissions & Scholarship Office using the contact details above during office hours.',
  },
]

function IconChevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-ccc-border rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
          {q}
        </span>
        <IconChevron open={open} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-ccc-text leading-relaxed border-t border-ccc-border pt-3">
          {a}
        </div>
      )}
    </div>
  )
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-ccc-off">
      <SiteHeader topbarLabel="Iskolusyon Applicant Portal" portalBadge="About & FAQ" />

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 space-y-12">
        {/* About Us */}
        <section className="space-y-3">
          <h1 className="text-2xl font-extrabold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            About the CCC Scholarship Program
          </h1>
          <p className="text-sm text-ccc-text leading-relaxed">
            The City College of Calamba Scholarship Program supports qualified residents of Calamba
            City in pursuing higher education by verifying eligibility and matching applicants to the
            scholarship or financial-assistance program that fits their situation. Iskolusyon is the
            web platform built to make that process transparent, faster, and easier to track for
            applicants and administrators alike.
          </p>
        </section>

        {/* Programs Offered Directory */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Programs Offered
          </h2>
          <div className="grid gap-3">
            {PROGRAMS.map((p) => (
              <div key={p.name} className="rounded-xl border border-ccc-border bg-white p-4">
                <p className="text-sm font-semibold text-ccc-navy">{p.name}</p>
                <p className="text-xs text-ccc-muted mt-1 leading-relaxed">{p.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact & Office Info */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Contact & Office Information
          </h2>
          <div className="rounded-xl border border-ccc-border bg-white p-5 space-y-2 text-sm text-ccc-text">
            <p><span className="font-semibold text-ccc-navy">{CONTACT_INFO.office}</span></p>
            <p>{CONTACT_INFO.address}</p>
            <p>{CONTACT_INFO.phone} &middot; {CONTACT_INFO.email}</p>
            <p className="text-ccc-muted">{CONTACT_INFO.hours}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ccc-navy" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-2.5">
            {FAQS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}