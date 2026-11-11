'use client'
import { useState, useEffect, useRef } from 'react'
import '../welcome-theme.css'
import WelcomeNavbar from './WelcomeNavbar'
import WelcomeFooter from './WelcomeFooter'
import OtpBoxes from './OtpBoxes'
import PasswordStrength from './PasswordStrength'
import { isStrongPassword } from '../lib/passwordRules'
import { signupScreening } from '../lib/screening'
import { CALAMBA_BARANGAYS, formatMobileInput, latestBirthdate, earliestBirthdate, MIN_APPLICANT_AGE, MAX_APPLICANT_AGE, validatePersonalInfo, withCalambaCity } from '../lib/fieldValidation'

// Mirrors isValidEmailFormat() in applicantAccounts.js — a real format
// check, not just "contains an @". Catches "name@" / "name@domain" with no
// TLD, which the old .includes('@') check across Login/Signup/Forgot
// Password let straight through (flagged testing Forgot Password, Sept 19:
// "xavierestira@" was accepted and a reset code got sent for it).
function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Sept 19 2026: matches the same fix applied to app/page.js's own Contact
// Number fields — this file has its own local TextField/state, so the
// sanitizer is duplicated here rather than shared, same as
// isValidEmailFormat() above already is. Strips anything that isn't a
// digit or space (plus a single leading "+" for a +63 country code) as
// the applicant types, instead of accepting letters into a phone number.
function sanitizePhoneInput(value) {
  // Sept 19 2026, second pass — matches the same fix in app/page.js: auto-
  // group the digits into "0917 123 4567" shape (this app's placeholder
  // format everywhere) instead of leaving spacing up to however the
  // applicant happens to type, which usually means no spaces at all once
  // the field is filtering every keystroke.
  // Oct 21 2026: always a PH mobile number starting with 09 (+63 is
  // converted), see formatMobileInput in app/lib/fieldValidation.js.
  return formatMobileInput(value)
}

// Real applicant Login + Signup — the User Account Module, formally Ivy's
// scope, built here since her side hasn't moved. Signup is a 4-step wizard
// matching her approved signup.html spec (Account Setup -> Program
// Application -> Personal Information -> Review & Verify), collecting into
// the exact same camelCase shapes app/page.js already posts to
// /api/application, so what's typed here becomes the applicant's first
// real Personal Information / Educational Background save — no retyping.
//
// Scope decided Sept 19, 2026: login is email+password only (no per-login
// OTP — deferred until the .dev domain unlocks Resend for real applicant
// inboxes). Signup still requires a one-time email code before the account
// activates, matching her spec.

// Matches "Password Visibility Toggle" — listed under both Secure Login
// (MFA) and Forgot Password in the progress table's User Account Module
// scope. Simple eye / eye-slash icons, same stroke style as the icons
// already used elsewhere in the app (app/page.js's IconEye/IconEyeOff).
function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.11A10.6 10.6 0 0112 5c6 0 9.5 7 9.5 7a13.6 13.6 0 01-3.13 3.94M6.6 6.6C4.16 8.2 2.5 10.5 2.5 12c0 0 3.5 7 9.5 7 1.13 0 2.19-.19 3.17-.53" />
    </svg>
  )
}

function TextField({ label, value, onChange, type = 'text', placeholder, required, error, autoComplete, max, min }) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (visible ? 'text' : 'password') : type

  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold text-ccc-navy uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          max={max}
          min={min}
          className={`w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-ccc-blue/20 focus:border-ccc-blue ${
            isPassword ? 'pr-9' : ''
          } ${error ? 'border-red-500' : 'border-ccc-border'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ccc-muted hover:text-ccc-text"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
    </div>
  )
}

// Nov 2026 (panel revisions S3/S4/S2): academic standing, asked right after
// the residency check and before any account exists. Rules in
// app/lib/screening.js (First Year: no grade below 75, client interview;
// Transferee: Appendix J; Old Curriculum / ALS: checked by staff later).
function AcademicScreeningBox({ answers, set, result, needsCard, error, onRefused }) {
  const a = answers
  return (
    <div className="rounded-md border border-ccc-border bg-ccc-off px-4 py-4 mt-3 mb-3">
      <div className="text-sm font-bold text-ccc-navy mb-1">Academic standing</div>
      <p className="text-[12px] text-ccc-muted leading-relaxed mb-3">
        A few questions from the CCC Scholar Guidelines. Answer honestly: your grades are checked in the next step and again
        by the Guidance Office, and false information disqualifies your application.
      </p>
      <SelectField label="Applying as" value={a.applyingAs} onChange={set.applyingAs} options={['First Year', 'Transferee', 'Old Curriculum and ALS Completer']} />
      {a.applyingAs === 'First Year' && (
        <SelectField label="Do you have any grade below 75 in your latest Senior High report card (Form 138)?" value={a.shsFailingGrade} onChange={set.shsFailingGrade} options={['No', 'Yes']} />
      )}
      {a.applyingAs === 'Transferee' && (
        <>
          <TextField label="General Weighted Average (GWA) at your previous school" value={a.transfereeGwa} onChange={(v) => { if (/^\d?(\.\d{0,2})?$/.test(v)) set.transfereeGwa(v) }} placeholder="e.g. 1.75 (1.00 to 5.00; 2.25 or better required)" />
          <TextField label="Total academic units passed" value={a.transfereeUnitsPassed} onChange={(v) => { if (/^\d{0,3}$/.test(v)) set.transfereeUnitsPassed(v) }} placeholder="e.g. 30 (at least 26 required)" />
          <SelectField label="Did you get a failing grade in any semester at your previous school(s)?" value={a.transfereeFailingGrade} onChange={set.transfereeFailingGrade} options={['No', 'Yes']} />
        </>
      )}
      {a.applyingAs === 'Old Curriculum and ALS Completer' && (
        <p className="text-[12px] text-ccc-muted leading-relaxed">The Guidance Office checks your proof of grades after you sign up.</p>
      )}
      {a.applyingAs === 'Transferee' && (
        <p className="text-[12px] text-ccc-muted leading-relaxed">
          After you sign up, upload your transcript of records or certificate of grades in the portal. The Guidance Office
          confirms it before you can take the exam.
        </p>
      )}
      {result.invalid && <div className="text-[11px] text-red-600 mt-1">{result.invalid}</div>}
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
      {result.complete && result.passed && (
        <div className="text-[13px] text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2 mt-2">
          {needsCard ? (
            <><span className="font-bold">Answers accepted.</span> Next, upload your report card so it can be checked.</>
          ) : (
            <><span className="font-bold">Eligibility check passed.</span> You can now create your account.</>
          )}
        </div>
      )}
      {result.complete && !result.passed && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
          <span className="font-bold">Based on these answers, you are not eligible:</span>
          <ul className="list-disc pl-5 mt-1">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <span className="block mt-1">If an answer is wrong, change it above. Otherwise, confirm your answers.</span>
        </div>
      )}
      {result.complete && !result.passed && (
        <button
          type="button"
          onClick={() => onRefused(result.reasons)}
          className="w-full mt-2 py-2.5 rounded-md border border-red-300 bg-white text-red-700 font-bold text-sm uppercase tracking-wide hover:bg-red-50"
        >
          Confirm my answers
        </button>
      )}
    </div>
  )
}

// Nov 2026 (panel revisions S2): the report card read at sign-up. It must
// read as a report card and show no grade below 75; staff still confirm it
// later, and the original card is checked at enrollment.
function GradeCheckBox({ state, message, failCount, error, onFile, onRetryPoll }) {
  const busy = state === 'uploading' || state === 'processing'
  const what = 'report card'
  return (
    <div className="rounded-md border border-ccc-border bg-ccc-off px-4 py-4 mb-3">
      <div className="text-sm font-bold text-ccc-navy mb-1">Report card check</div>
      <p className="text-[12px] text-ccc-muted leading-relaxed mb-3">
        Upload a clear photo or scan of your latest Grade 11 or 12 report card (Form 138). It is read to confirm your
        answers before your account is created.
      </p>
      {state !== 'passed' && (
        <label className={`block w-full text-center py-2.5 rounded-md border border-dashed border-ccc-blue text-ccc-blue font-bold text-sm ${busy ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-white'}`}>
          {state === 'uploading' ? 'Uploading…' : state === 'processing' ? `Reading your ${what}…` : state === 'failed' ? 'Upload a different file' : `Upload ${what}`}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
      {state === 'processing' && <p className="text-[12px] text-ccc-muted mt-2">This usually takes under a minute.</p>}
      {state === 'slow' && (
        <div className="text-[13px] text-ccc-navy mt-2">
          Still reading. <button type="button" className="text-ccc-blue font-bold underline" onClick={onRetryPoll}>Check again</button>
        </div>
      )}
      {state === 'passed' && (
        <div className="text-[13px] text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          <span className="font-bold">Report card checked.</span> No grade below 75 was found. You can now create your account.
          The Guidance Office still confirms it later.
        </div>
      )}
      {state === 'failed' && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
          <span className="font-bold">Not confirmed:</span> {message} This file was not kept.
        </div>
      )}
      {state === 'failed' && failCount >= 2 && (
        <div className="text-[13px] text-ccc-navy bg-white border border-ccc-border rounded-md px-3 py-2 mt-2">
          <span className="font-bold">Still not passing?</span> Bring your {what} to the GCTCDO, 1st Floor, Admin
          Building, City College of Calamba, and the Guidance Office will check it for you.
        </div>
      )}
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required, error, placeholder = 'Select…' }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold text-ccc-navy uppercase tracking-wide mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-ccc-blue/20 focus:border-ccc-blue bg-white ${
          error ? 'border-red-500' : 'border-ccc-border'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
    </div>
  )
}

// The barangay list moved to app/lib/fieldValidation.js (Oct 21 2026) so
// the server checks sign-up against the same list.

const SUFFIX_OPTIONS = ['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

// The 6-digit OTP boxes moved to ./OtpBoxes.js (Oct 12 2026) so the admin
// sign-in code step can use the same boxes.

// Resend-code cooldown — spec runs this independently of the 10-minute code
// expiry: the code itself stays valid the full 10 minutes, but "Resend
// code" only unlocks after 60 seconds so the applicant isn't stuck waiting
// the whole time if the email is slow. Returns [secondsLeft, restart()].
function useResendCooldown(active) {
  const COOLDOWN_SECONDS = 60
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS)

  useEffect(() => {
    if (!active || secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [active, secondsLeft])

  return [secondsLeft, () => setSecondsLeft(COOLDOWN_SECONDS)]
}

const PROGRAMS = [
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

const SIDE_STEPS = {
  signup: ['Account Setup', 'Program Application', 'Personal Information', 'Review & Verify'],
  login: ['Sign In', 'Verify Code (MFA)'],
  forgot: ['Find Account', 'Verify Code', 'New Password'],
}

// mode: 'login' | 'signup' | 'forgot'. step is the 1-based current step
// within that mode's own list above — each mode tracks its stage
// independently (e.g. login's stage 'otp' maps to step 2 here).
// Sept 23, 2026: brought in line with index.html/signup.html's own
// .auth-side panel — 160deg navy-to-blue gradient (was 135deg), 320px wide
// (was 300px), and the "← Back to homepage" link at the bottom that this
// panel was missing entirely (the mockup's modal has "← Close" here since
// it's a popup; a dedicated /login page has nothing to close, so this
// points back to "/" instead, matching signup.html's own wording exactly).
function AuthSide({ mode, step }) {
  const steps = SIDE_STEPS[mode]
  return (
    <div
      className="hidden md:flex flex-col text-white p-[2.5rem_2.1rem] w-[320px] shrink-0 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, var(--ccc-navy) 0%, var(--ccc-blue) 100%)' }}
    >
      <div className="absolute -right-[60px] -bottom-[60px] w-[200px] h-[200px] rounded-full bg-white/5 pointer-events-none" />
      <h1 className="text-[1.3rem] font-extrabold mb-2.5 leading-snug relative z-10" style={{ fontFamily: 'var(--font-montserrat)' }}>
        {mode === 'login' ? 'Welcome back, Scholar.' : mode === 'forgot' ? 'Forgot your password?' : 'Start your scholarship journey.'}
      </h1>
      <p className="text-[.8rem] text-white/70 mb-8 leading-relaxed relative z-10">
        {mode === 'login'
          ? 'Sign in to continue your scholarship application, check your status, and manage your submitted documents.'
          : mode === 'forgot'
          ? 'No worries, we’ll help you find your account and get back in.'
          : 'Create your account to apply, track, and manage your City College of Calamba scholarship application.'}
      </p>
      {(mode === 'signup' || mode === 'login' || mode === 'forgot') && step > 0 && (
        <div className="flex flex-col relative z-10">
          {steps.map((label, i) => {
            const num = i + 1
            const isDone = num < step
            const isCurrent = num === step
            const isLast = i === steps.length - 1
            return (
              <div key={label} className={`flex gap-3 relative ${isLast ? 'pb-0' : 'pb-[22px]'}`}>
                {!isLast && (
                  <span className="absolute left-[13px] top-[30px] bottom-0 w-[2px] bg-white/15" aria-hidden="true" />
                )}
                <div
                  className={`w-[27px] h-[27px] rounded-full flex items-center justify-center text-[.72rem] font-extrabold shrink-0 relative z-10 ${
                    isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-white text-ccc-blue shadow-[0_0_0_4px_rgba(255,255,255,.22)]' : 'bg-white/15 text-white/70'
                  }`}
                  style={{ fontFamily: 'var(--font-montserrat)' }}
                >
                  {isDone ? '✓' : num}
                </div>
                <span className={`text-[.78rem] pt-[5px] font-semibold ${isCurrent || isDone ? 'text-white' : 'text-white/55'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-auto pt-7 relative z-10">
        <a href="/" className="inline-flex items-center gap-1.5 text-[.75rem] text-white/75 font-semibold hover:text-white no-underline">
          ← Back to homepage
        </a>
      </div>
    </div>
  )
}

function Alert({ tone = 'info', children }) {
  const styles = {
    info: 'bg-[#E8F0FA] text-[#0D2F6E] border-[#B5D0F0]',
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return <div className={`text-[13px] rounded-md border px-3 py-2 mb-4 ${styles[tone]}`}>{children}</div>
}

export default function ApplicantAuth({ onAuthenticated, initialMode = 'login', expired = false }) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'signup' | 'forgot'
  // Nov 2026 (panel revision S4): after sign-up the applicant signs in once
  // with email, password and a login code, instead of being signed in
  // straight after the email code.
  const [createdEmail, setCreatedEmail] = useState('')

  // Sept 23, 2026: was just a bare SiteHeader + centered card on a plain
  // ccc-off background. Pau asked for /login and signup to carry the same
  // "top part and lower part" (navbar + footer) design as the new homepage,
  // matching signup.html's full-page chrome instead of looking like a
  // standalone modal with nothing around it. WelcomeNavbar/WelcomeFooter are
  // the exact same components app/page.js uses; links on this page fall
  // back to plain "/#id" hrefs (no scroll-spy/section state here) since
  // this isn't the page those sections actually live on.
  return (
    <div className="welcome-page min-h-screen flex flex-col" style={{ background: 'var(--ccc-off)' }}>
      <WelcomeNavbar />
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        {/* max-w-[960px] + rounded-[14px] + this shadow match the mockup's
            own .auth-shell exactly (Sept 23, 2026 design-parity pass). */}
        <div className="w-full max-w-[960px] bg-white rounded-[14px] shadow-[0_12px_48px_rgba(13,47,110,.22)] overflow-hidden flex max-h-[92vh] my-8">
          {mode === 'login' && (
            <LoginPanel
              expired={expired}
              createdEmail={createdEmail}
              onSwitch={() => setMode('signup')}
              onForgot={() => setMode('forgot')}
              onAuthenticated={onAuthenticated}
            />
          )}
          {mode === 'signup' && (
            <SignupPanel
              onSwitch={() => setMode('login')}
              onCreated={(createdAs) => {
                setCreatedEmail(createdAs)
                setMode('login')
              }}
            />
          )}
          {mode === 'forgot' && <ForgotPasswordPanel onSwitch={() => setMode('login')} />}
        </div>
      </div>
      <WelcomeFooter />
    </div>
  )
}

const LOGIN_OTP_TTL_SECONDS = 10 * 60

function LoginPanel({ expired, createdEmail, onSwitch, onForgot, onAuthenticated }) {
  // stage: 'credentials' -> 'otp' — login-time MFA, added Sept 19. The
  // credentials step no longer sets the session cookie itself; it sends a
  // login code and hands off to the OTP step, same shape as
  // ForgotPasswordPanel's lookup -> reset staging below.
  const [stage, setStage] = useState('credentials')
  const [email, setEmail] = useState(createdEmail || '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [accountId, setAccountId] = useState(null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(LOGIN_OTP_TTL_SECONDS)
  const [resendCooldown, restartResendCooldown] = useResendCooldown(stage === 'otp')

  useEffect(() => {
    if (stage !== 'otp' || secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [stage, secondsLeft])

  async function submitCredentials(e) {
    e.preventDefault()
    setError('')

    // Inline field-level validation (matches the red field-err style used
    // in the signup steps below) instead of relying on the browser's
    // default "Please fill out this field" tooltip, which looked
    // inconsistent with the rest of the auth UI.
    const nextFieldErrors = {}
    if (!email.trim()) nextFieldErrors.email = 'Please enter your email address.'
    else if (!isValidEmailFormat(email)) nextFieldErrors.email = 'Please enter a valid email address.'
    if (!password) nextFieldErrors.password = 'Please enter your password.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/applicant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed.')
        return
      }
      setAccountId(data.accountId)
      setSecondsLeft(LOGIN_OTP_TTL_SECONDS)
      restartResendCooldown()
      setStage('otp')
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Re-runs the credentials check, which re-sends a fresh code as a side
  // effect — same "resend by re-requesting" pattern ForgotPasswordPanel
  // uses below, rather than a separate resend endpoint.
  async function resendCode() {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not resend the code.')
        return
      }
      setAccountId(data.accountId)
      setSecondsLeft(LOGIN_OTP_TTL_SECONDS)
      restartResendCooldown()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) {
      setFieldErrors({ code: 'Please enter the login code.' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', accountId, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFieldErrors({ code: data.error || 'Could not verify that code.' })
        return
      }
      onAuthenticated({ id: accountId, email: data.email, name: data.name })
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function backToCredentials() {
    setStage('credentials')
    setCode('')
    setAccountId(null)
    setError('')
    setFieldErrors({})
  }

  return (
    <>
      <AuthSide mode="login" step={stage === 'otp' ? 2 : 1} />
      <div className="flex-1 p-8">
        {stage === 'credentials' && (
          <>
            <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
              Applicant Login
            </h2>
            <p className="text-sm text-ccc-muted mb-3">Enter your credentials to access your account.</p>
            {/* Oct 7 2026: shown after the 60-minute inactivity sign-out. */}
            {createdEmail && !error && (
              <Alert tone="success">Your account was created. Please sign in with your email and password to continue your application.</Alert>
            )}
            {expired && !error && (
              <Alert tone="info">You were signed out after 60 minutes without activity, to keep your account safe. Your saved sections are still there. Please sign in again.</Alert>
            )}
            <Alert tone="info">Enter your registered email and password. A 6-digit verification code will be sent to your email.</Alert>
            {error && <Alert tone="error">{error}</Alert>}
            <form onSubmit={submitCredentials} noValidate>
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => { setEmail(v); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })) }}
                placeholder="e.g. yourname@email.com"
                autoComplete="email"
                error={fieldErrors.email}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(v) => { setPassword(v); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })) }}
                placeholder="Your password"
                autoComplete="current-password"
                error={fieldErrors.password}
              />
              <div className="text-right -mt-1 mb-3">
                <button type="button" onClick={onForgot} className="text-[12px] text-ccc-blue font-semibold hover:underline">
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60"
              >
                {loading ? 'Logging in…' : 'Log In'}
              </button>
            </form>
            <p className="text-center text-[13px] text-ccc-muted mt-4">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={onSwitch} className="text-ccc-blue font-bold hover:underline">
                Sign up here
              </button>
            </p>
          </>
        )}

        {stage === 'otp' && (
          <>
            <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
              Verify It&apos;s You
            </h2>
            <p className="text-sm text-ccc-muted mb-5">
              We sent a 6-digit login code to {email}. Enter it below to finish logging in.
            </p>
            {secondsLeft > 0 ? (
              <Alert tone="success">Check your inbox (and spam folder) for the code.</Alert>
            ) : (
              <Alert tone="error">This code has expired. Click &quot;Resend code&quot; below to get a new one.</Alert>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <form onSubmit={submitCode} noValidate>
              <OtpBoxes
                value={code}
                onChange={(v) => { setCode(v); if (fieldErrors.code) setFieldErrors((f) => ({ ...f, code: undefined })) }}
                error={fieldErrors.code}
                autoFocus
              />
              {secondsLeft > 0 && (
                <p className="text-[12px] text-ccc-muted text-center -mt-1 mb-3">
                  Code expires in {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || secondsLeft <= 0}
                className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify & Log In'}
              </button>
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading || resendCooldown > 0}
                  className="text-[13px] text-ccc-blue font-bold hover:underline disabled:opacity-50 disabled:no-underline disabled:text-ccc-muted"
                >
                  Resend code
                </button>
                {resendCooldown > 0 && (
                  <p className="text-[11px] text-ccc-muted mt-1">
                    You may request another code in {resendCooldown >= 60 ? Math.ceil(resendCooldown / 60) + ' minute' + (Math.ceil(resendCooldown / 60) !== 1 ? 's' : '') : resendCooldown + ' second' + (resendCooldown !== 1 ? 's' : '')}.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={backToCredentials}
                disabled={loading}
                className="w-full mt-1 text-[12px] text-ccc-muted hover:underline disabled:opacity-50"
              >
                Use a different account
              </button>
            </form>
          </>
        )}
      </div>
    </>
  )
}

// Same rule as the server (app/lib/passwordRules.js), checked here too so
// the applicant sees it inline instead of only after a round trip.
function passwordStrengthError(password) {
  if (!password) return 'Please enter a password.'
  if (!isStrongPassword(password)) {
    return 'Must be at least 8 characters and include a number, an uppercase letter, a lowercase letter, and a special character.'
  }
  return null
}

// Nov 2026 (panel revisions S3/S4): the residency check box on sign-up
// step 1. The applicant uploads a Voter's ID or Voter's Certification; the
// system reads it and only lets them continue if it is a COMELEC record
// with a Calamba City address.
// Nov 2026 (panel revisions S2): OCR can misread a real Voter's ID (an old
// card, a weak camera). After two tries that were not confirmed, the page
// points to the GCTCDO office, so a genuine Calamba resident always has a
// way in, without keeping their file online.
const OFFICE_FALLBACK_AFTER = 2

function ResidencyCheckBox({ voterOwner, setVoterOwner, checkState, checkMessage, error, onFile, onRetryPoll, failCount = 0 }) {
  const busy = checkState === 'uploading' || checkState === 'processing'
  return (
    <div className="rounded-md border border-ccc-border bg-ccc-off px-4 py-4 mb-3">
      <div className="text-sm font-bold text-ccc-navy mb-1">Residency check</div>
      <p className="text-[12px] text-ccc-muted leading-relaxed mb-3">
        Upload a clear photo or scan of a Voter&apos;s ID or Voter&apos;s Certification (COMELEC) showing a Calamba City address.
        If you are not a registered voter yet, use your parent&apos;s or guardian&apos;s.
      </p>
      <SelectField
        label="Whose Voter's ID is it?"
        value={voterOwner}
        onChange={setVoterOwner}
        options={['Mine', "My parent's or guardian's"]}
      />
      {voterOwner && checkState !== 'passed' && (
        <label className={`block w-full text-center py-2.5 rounded-md border border-dashed border-ccc-blue text-ccc-blue font-bold text-sm ${busy ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-white'}`}>
          {busy ? 'Checking…' : checkState === 'failed' ? 'Upload a different file' : "Upload Voter's ID (JPG, PNG or PDF)"}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onFile(file)
            }}
          />
        </label>
      )}
      {busy && (
        <p className="text-[12px] text-ccc-muted mt-2" role="status" aria-live="polite">
          Reading your document. This usually takes about 20 seconds, and up to a minute and a half if the reader was idle.
        </p>
      )}
      {checkState === 'slow' && (
        <p className="text-[12px] text-ccc-gold mt-2">
          This is taking longer than usual.{' '}
          <button type="button" onClick={onRetryPoll} className="font-bold underline">Check again</button>
        </p>
      )}
      {checkState === 'passed' && (
        <div className="text-[13px] text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2 mt-1">
          <span className="font-bold">Calamba City voter record confirmed.</span> It is saved as the Voter&apos;s ID of your application.
          You can now create your account.
        </div>
      )}
      {checkState === 'failed' && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">
          <span className="font-bold">Not confirmed:</span> {checkMessage}
          <div className="text-[12px] mt-1">
            This file was not kept. If it was the wrong file or a blurry photo, upload the correct one. Only residents of Calamba City can apply.
          </div>
        </div>
      )}
      {checkState === 'failed' && failCount >= OFFICE_FALLBACK_AFTER && (
        <div className="text-[13px] text-ccc-navy bg-white border border-ccc-border rounded-md px-3 py-2 mt-2">
          <span className="font-bold">Still not passing?</span> If you really live in Calamba City, the system may just be
          having trouble reading your document. Bring your Voter&apos;s ID or Voter&apos;s Certification to the{' '}
          <span className="font-bold">GCTCDO, 1st Floor, Admin Building, City College of Calamba</span>, and the Guidance
          Office will check it for you.
        </div>
      )}
      {error && <div className="text-[11px] text-red-600 mt-2">{error}</div>}
    </div>
  )
}

function SignupPanel({ onSwitch, onCreated }) {
  // Step 0 = Data Privacy Consent screen. Described in index.html's own
  // "How to Apply" guide text ("A Data Privacy Consent screen will appear.
  // Read it carefully and click I Agree to proceed.") but never actually
  // built into signup.html's markup — written fresh here in the same
  // visual style. Deliberately outside the "Step X of 4" counter and the
  // side stepper (matches how the guide describes it as happening before
  // Account Setup, not as one of the 4 numbered steps).
  const [step, setStep] = useState(0)
  const [consentChecked, setConsentChecked] = useState(false)
  const [accountId, setAccountId] = useState(null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  function clearFieldError(field, setter) {
    return (v) => {
      setter(v)
      if (fieldErrors[field]) setFieldErrors((f) => ({ ...f, [field]: undefined }))
    }
  }

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  // Oct 21 2026: asked first, so someone outside Calamba stops before
  // giving any personal details (CCC Scholar Guidelines: Calamba residents).
  const [calambaResident, setCalambaResident] = useState('')
  const [residencyCertified, setResidencyCertified] = useState(false)
  // Nov 2026 (panel revisions S3/S4): the Voter's ID is checked here, before
  // any account exists (app/api/signup-residency-check). checkState:
  // idle | uploading | processing | passed | failed | slow
  const [voterOwner, setVoterOwner] = useState('')
  const [residencyToken, setResidencyToken] = useState('')
  const [checkState, setCheckState] = useState('idle')
  const [checkMessage, setCheckMessage] = useState('')
  const [failCount, setFailCount] = useState(0)
  const [voterPrecinct, setVoterPrecinct] = useState('')
  const pollRef = useRef(null)

  // Step 2 — Program Application (matches academicInfo shape from app/page.js)
  const [applyingAs, setApplyingAs] = useState('')
  const [termApplying, setTermApplying] = useState('')
  const [choice1, setChoice1] = useState('')
  const [choice2, setChoice2] = useState('')
  // Nov 2026 (panel revisions S3/S4/S2): the academic screening at step 1,
  // next to the residency check, before any account exists.
  const [shsFailingGrade, setShsFailingGrade] = useState('')
  const [transfereeGwa, setTransfereeGwa] = useState('')
  const [transfereeUnitsPassed, setTransfereeUnitsPassed] = useState('')
  const [transfereeFailingGrade, setTransfereeFailingGrade] = useState('')
  const [academicFailed, setAcademicFailed] = useState(null) // reasons, once refused
  // The report card (Form 138) read at sign-up (Lock 1 of the grade rule).
  const [gradeToken, setGradeToken] = useState('')
  const [gradeState, setGradeState] = useState('idle') // idle | uploading | processing | passed | failed | slow
  const [gradeMessage, setGradeMessage] = useState('')
  const [gradeFailCount, setGradeFailCount] = useState(0)
  const gradePollRef = useRef(null)
  const screeningAnswers = { applyingAs, shsFailingGrade, transfereeGwa, transfereeUnitsPassed, transfereeFailingGrade }
  const academic = signupScreening(screeningAnswers)
  // Only First Year uploads the report card at sign-up (Form 138 is on CCC's
  // First Year list); others upload proof of grades in the portal.
  const needsCard = applyingAs === 'First Year'
  // Changing "Applying as" after the grades were checked means checking
  // again (a transcript and a report card are read differently).
  function changeApplyingAs(v) {
    if (v !== applyingAs) {
      clearTimeout(gradePollRef.current)
      setGradeState('idle')
      setGradeMessage('')
      setGradeFailCount(0)
    }
    setApplyingAs(v)
  }
  const readyForAccount = checkState === 'passed' && !academicFailed && academic.passed && (!needsCard || gradeState === 'passed')

  async function refuseSignup(reasons, reason) {
    setAcademicFailed(reasons)
    try {
      await fetch('/api/signup-residency-check', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: residencyToken, gradeToken, screening: screeningAnswers, reason }),
      })
    } catch {
      // Unfinished checks expire on their own within a day.
    }
  }

  function pollGrade(token, startedAt) {
    clearTimeout(gradePollRef.current)
    gradePollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/signup-residency-check?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (res.ok && data.status === 'passed') {
          setGradeState('passed')
          setGradeMessage('')
          return
        }
        if (res.ok && data.status === 'failed') {
          if (data.kind === 'failing_grade') {
            refuseSignup([data.reason || 'Your grades do not meet the CCC Scholar Guidelines.'], 'failing_grade')
            return
          }
          setGradeFailCount((n) => n + 1)
          setGradeState('failed')
          setGradeMessage(data.reason || 'This file could not be read as a report card.')
          return
        }
      } catch {
        // keep trying below
      }
      if (Date.now() - startedAt > 150000) {
        setGradeState('slow')
        return
      }
      pollGrade(token, startedAt)
    }, 4000)
  }

  async function uploadReportCard(file) {
    if (!file) return
    setFieldErrors((f) => ({ ...f, grades: undefined }))
    setGradeState('uploading')
    setGradeMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'form138')
      if (gradeToken) form.append('token', gradeToken)
      const res = await fetch('/api/signup-residency-check', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 422) setGradeFailCount((n) => n + 1)
        setGradeState('failed')
        setGradeMessage(data.message || data.error || 'The file could not be uploaded.')
        return
      }
      setGradeToken(data.token)
      setGradeState('processing')
      pollGrade(data.token, Date.now())
    } catch {
      setGradeState('failed')
      setGradeMessage('Could not reach the server. Check your connection and try again.')
    }
  }

  // Step 3 — Personal Information (subset matching personalInfo shape)
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [sex, setSex] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [civilStatus, setCivilStatus] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [address, setAddress] = useState('')
  const [barangay, setBarangay] = useState('')
  const [residencyYears, setResidencyYears] = useState('')
  const [residencyInfoOpen, setResidencyInfoOpen] = useState(false)

  // Step 4 — the two required certification checkboxes, matching
  // signup.html's s-terms / s-privacy checkboxes on the review screen.
  const [termsCertified, setTermsCertified] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  // Step 4 — "Verification Code Countdown Timer" + the code itself matching
  // the OTP's real server-side lifetime (OTP_TTL_MINUTES = 10 in
  // applicantAccounts.js, kept in sync here so the countdown doesn't claim
  // the code is still valid after the server has actually expired it).
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const OTP_TTL_SECONDS = 10 * 60
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS)
  const [resendCooldown, restartResendCooldown] = useResendCooldown(codeSent)

  useEffect(() => {
    if (!codeSent || secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [codeSent, secondsLeft])

  useEffect(() => () => clearTimeout(pollRef.current), [])

  function applyPrefill(prefill) {
    if (!prefill) return
    if (prefill.street) setAddress((v) => v || prefill.street)
    if (prefill.barangay) setBarangay((v) => v || prefill.barangay)
    if (prefill.voterPrecinct) setVoterPrecinct(prefill.voterPrecinct)
  }

  function pollCheck(token, startedAt) {
    clearTimeout(pollRef.current)
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/signup-residency-check?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (res.ok && data.status === 'passed') {
          setCheckState('passed')
          setCheckMessage('')
          applyPrefill(data.prefill)
          return
        }
        if (res.ok && data.status === 'failed') {
          setFailCount((n) => n + 1)
          setCheckState('failed')
          setCheckMessage(data.reason || 'This document could not be confirmed as a Calamba City voter record.')
          return
        }
      } catch {
        // keep trying below
      }
      if (Date.now() - startedAt > 150000) {
        setCheckState('slow')
        return
      }
      pollCheck(token, startedAt)
    }, 4000)
  }

  async function uploadVoterId(file) {
    if (!file) return
    setFieldErrors((f) => ({ ...f, voterId: undefined }))
    setCheckState('uploading')
    setCheckMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (residencyToken) form.append('token', residencyToken)
      const res = await fetch('/api/signup-residency-check', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 422) setFailCount((n) => n + 1)
        setCheckState('failed')
        setCheckMessage(data.message || data.error || 'The file could not be uploaded.')
        return
      }
      setResidencyToken(data.token)
      setCheckState('processing')
      pollCheck(data.token, Date.now())
    } catch {
      setCheckState('failed')
      setCheckMessage('Could not reach the server. Check your connection and try again.')
    }
  }

  async function handleStep1(e) {
    e.preventDefault()
    setError('')

    const nextFieldErrors = {}
    if (!calambaResident) nextFieldErrors.calambaResident = 'Please answer this question.'
    else if (calambaResident !== 'Yes') return // the "not eligible" panel is showing instead of the form
    else if (!residencyCertified) nextFieldErrors.residencyCertified = 'Please confirm that you live in Calamba City.'
    else if (checkState !== 'passed') nextFieldErrors.voterId = "Please upload a Voter's ID or Voter's Certification and wait for it to be confirmed."
    else if (!academic.complete) nextFieldErrors.screening = academic.invalid || 'Please answer the academic standing questions.'
    else if (!academic.passed) return // the "not eligible" panel is showing instead
    else if (needsCard && gradeState !== 'passed') nextFieldErrors.grades = 'Please upload your report card (Form 138) and wait for it to be checked.'
    if (!email.trim()) nextFieldErrors.email = 'Please enter your email address.'
    else if (!isValidEmailFormat(email)) nextFieldErrors.email = 'Please enter a valid email address.'
    const passwordError = passwordStrengthError(password)
    if (passwordError) nextFieldErrors.password = passwordError
    if (!password2) nextFieldErrors.password2 = 'Please confirm your password.'
    else if (password && password2 && password !== password2) nextFieldErrors.password2 = 'Passwords do not match.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/applicant-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', email, password, residencyToken, gradeToken, screening: screeningAnswers }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Server-only checks (email already registered, or a password rule
        // that somehow slipped past the client check above) land as a
        // field-specific error too, not a generic top banner — keeps this
        // consistent with steps 2/3's per-field errors instead of being a
        // one-off exception.
        const message = data.error || 'Could not start signup.'
        if (data.residency) {
          setCheckState('idle')
          setFieldErrors({ voterId: message })
          return
        }
        if (data.screening) {
          setFieldErrors({ screening: message })
          return
        }
        if (data.grades) {
          setGradeState('idle')
          setFieldErrors({ grades: message })
          return
        }
        setFieldErrors({ [/password/i.test(message) ? 'password' : 'email']: message })
        return
      }
      setAccountId(data.accountId)
      setFieldErrors({})
      setStep(2)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function saveProgressAndAdvance(nextStep, extra) {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', accountId, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
          setFieldErrors(data.fieldErrors)
          return
        }
        setError(data.error || 'Could not save your progress.')
        return
      }
      setFieldErrors({})
      setStep(nextStep)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleStep2(e) {
    e.preventDefault()
    const nextFieldErrors = {}
    if (!termApplying) nextFieldErrors.termApplying = 'Please select the term you are applying in.'
    if (!choice1) nextFieldErrors.choice1 = 'Please select your first choice program.'
    if (!choice2) nextFieldErrors.choice2 = 'Please select your second choice program.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    saveProgressAndAdvance(3, {
      academicInfo: { ...screeningAnswers, termApplying, choice1, choice2 },
    })
  }

  function handleStep3(e) {
    e.preventDefault()
    const nextFieldErrors = {}
    if (!lastName.trim()) nextFieldErrors.lastName = 'Please enter your last name.'
    if (!firstName.trim()) nextFieldErrors.firstName = 'Please enter your first name.'
    if (!sex) nextFieldErrors.sex = 'Please select your sex at birth.'
    if (!dateOfBirth) nextFieldErrors.dateOfBirth = 'Please enter your date of birth.'
    if (!civilStatus) nextFieldErrors.civilStatus = 'Please select your civil status.'
    if (!contactNumber.trim()) nextFieldErrors.contactNumber = 'Please enter your contact number.'
    if (!address.trim()) nextFieldErrors.address = 'Please enter your present home address.'
    if (!barangay) nextFieldErrors.barangay = 'Please enter your barangay of residence.'
    if (!String(residencyYears).trim()) nextFieldErrors.residencyYears = 'Please enter your years of residency.'
    // Oct 21 2026: format rules (app/lib/fieldValidation.js), the same ones
    // the server checks. A blank field keeps its "Please enter..." message.
    for (const problem of validatePersonalInfo(
      { firstName, middleName, lastName, dateOfBirth, contactNumber, address, barangay, residencyYears },
      { signup: true }
    )) {
      if (!nextFieldErrors[problem.field]) nextFieldErrors[problem.field] = problem.message
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    saveProgressAndAdvance(4, {
      personalInfo: {
        firstName, middleName, lastName, suffix, sex, dateOfBirth, civilStatus,
        contactNumber, address, barangay, residencyYears, voterPrecinct,
      },
    })
  }

  async function sendCode() {
    if (codeSent && resendCooldown > 0) return
    setError('')
    const nextFieldErrors = {}
    if (!termsCertified) nextFieldErrors.terms = 'You must certify your information to continue.'
    if (!privacyAgreed) nextFieldErrors.privacy = 'You must agree to the Privacy Statement terms to continue.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setLoading(true)
    try {
      // Re-save personalInfo with the two certification checkboxes folded
      // in — 'save' replaces pending_personal_info wholesale, so this has
      // to carry every step-3 field again, not just the new booleans, or
      // it would blow away what handleStep3 already staged.
      const saveRes = await fetch('/api/applicant-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          accountId,
          personalInfo: {
            firstName, middleName, lastName, suffix, sex, dateOfBirth, civilStatus,
            contactNumber, address, barangay, residencyYears, voterPrecinct, termsCertified, privacyAgreed,
          },
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) {
        setError(saveData.error || 'Could not save your certification.')
        return
      }

      const res = await fetch('/api/applicant-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-code', accountId, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not send the verification code.')
        return
      }
      setCodeSent(true)
      setSecondsLeft(OTP_TTL_SECONDS) // (re)start the countdown — covers both the first send and every "Resend code" click
      restartResendCooldown()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) {
      setFieldErrors({ code: 'Please enter the verification code.' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', accountId, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Verification failed.')
        return
      }
      onCreated(data.email || email)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthSide mode="signup" step={step} />
      <div className="flex-1 p-8 max-h-[85vh] overflow-y-auto">
        {step > 0 && (
          <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-1">Step {step} of 4</div>
        )}
        <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
          {step === 0 ? 'Data Privacy Consent' : 'Create Your Applicant Account'}
        </h2>
        {error && <Alert tone="error">{error}</Alert>}

        {step === 0 && (
          <div>
            <p className="text-sm text-ccc-muted mb-4">
              Before creating your account, please read and agree to how City College of Calamba collects and uses your information.
            </p>
            <div className="rounded-lg border border-ccc-border bg-ccc-off p-4 mb-4 text-[13px] text-ccc-text leading-relaxed max-h-56 overflow-y-auto space-y-2">
              <p>
                In line with the Data Privacy Act of 2012 (RA 10173), City College of Calamba collects the personal, academic,
                financial, and health information you submit through this portal solely to process your scholarship application,
                including verifying your identity, evaluating your eligibility, and communicating updates about your application status.
              </p>
              <p>
                Your data is stored securely and is accessible only to authorized CCC scholarship administrators. It will not be
                shared with third parties except where required by law or LGU compliance reporting. You may request to review or
                correct your submitted information by contacting the CCC Scholarship Office.
              </p>
              <p>
                By checking the box below and continuing, you consent to this collection and processing of your data for the
                purpose of your scholarship application.
              </p>
            </div>
            <label className="flex items-start gap-2.5 text-[13px] text-ccc-text mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-ccc-blue shrink-0"
              />
              <span>I have read and agree to the collection and processing of my personal data as described above.</span>
            </label>
            {/* Disabled-until-checked instead of clickable-then-error — matches the
                "Continue button gated on required fields" pattern used elsewhere in
                the app (e.g. the Step 1 Personal Information cards), and reads
                cleaner than restating "I Agree" on the button itself when the
                checkbox label already says it. */}
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!consentChecked}
              className="w-full mt-3 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ccc-blue"
            >
              Continue →
            </button>
            {!consentChecked && (
              <p className="text-center text-[11px] text-ccc-muted mt-2">Check the box above to continue.</p>
            )}
            <p className="text-center text-[13px] text-ccc-muted mt-4">
              Already have an account?{' '}
              <button type="button" onClick={onSwitch} className="text-ccc-blue font-bold hover:underline">Log in here</button>
            </p>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStep1} noValidate>
            <Alert tone="info">
              Iskolusyon is for <strong>residents of Calamba City</strong> only. Before creating an account, we check your residency
              using a Voter&apos;s ID or Voter&apos;s Certification (yours, or a parent&apos;s or guardian&apos;s).
            </Alert>
            <SelectField
              label="Are you a resident of Calamba City?"
              value={calambaResident}
              onChange={(v) => {
                // Changing the answer always clears the certification, so
                // going No -> Yes means ticking it again on purpose.
                setResidencyCertified(false)
                clearFieldError('calambaResident', setCalambaResident)(v)
              }}
              options={['Yes', 'No']}
              error={fieldErrors.calambaResident}
            />
            {/* Oct 21 2026 (panel): answering "No" ends sign-up here. No
                account, email or address is asked for, so a non-resident is
                not walked through a form only to be told to type "Calamba". */}
            {calambaResident === 'No' ? (
              <div className="rounded-md border border-ccc-border bg-ccc-off px-4 py-4 mt-1">
                <div className="text-sm font-bold text-ccc-navy mb-1">You can&apos;t apply for this scholarship</div>
                <p className="text-[13px] text-ccc-text leading-relaxed mb-2">
                  Iskolusyon scholarships are only for residents of Calamba City, as stated in the CCC Scholar Guidelines.
                  Applicants must prove residency with a Voter&apos;s ID or Voter&apos;s Certification showing a Calamba City address
                  (their own, or a parent&apos;s or guardian&apos;s).
                </p>
                <p className="text-[13px] text-ccc-muted leading-relaxed mb-3">
                  If you live in Calamba City and picked &ldquo;No&rdquo; by mistake, change your answer above.
                </p>
                <a href="/" className="inline-block w-full text-center py-2.5 rounded-md border border-ccc-border bg-white text-ccc-navy font-bold text-sm uppercase tracking-wide hover:bg-ccc-off no-underline">
                  ← Back to homepage
                </a>
              </div>
            ) : (
              <>
                {calambaResident === 'Yes' && (
                  <div className="mb-3">
                    <label className="flex items-start gap-2.5 text-[13px] text-ccc-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={residencyCertified}
                        onChange={(e) => { setResidencyCertified(e.target.checked); if (fieldErrors.residencyCertified) setFieldErrors((f) => ({ ...f, residencyCertified: undefined })) }}
                        className="mt-0.5 w-4 h-4 accent-ccc-blue shrink-0"
                      />
                      <span>
                        I certify that I currently live in Calamba City, and I will submit a Voter&apos;s ID or Voter&apos;s Certification
                        (mine or my parent&apos;s/guardian&apos;s) showing a Calamba City address. I understand that false information will
                        disqualify my application.
                      </span>
                    </label>
                    {fieldErrors.residencyCertified && <div className="text-[11px] text-red-600 mt-1">{fieldErrors.residencyCertified}</div>}
                  </div>
                )}
                {calambaResident === 'Yes' && residencyCertified && (
                  <ResidencyCheckBox
                    voterOwner={voterOwner}
                    setVoterOwner={setVoterOwner}
                    checkState={checkState}
                    checkMessage={checkMessage}
                    failCount={failCount}
                    error={fieldErrors.voterId}
                    onFile={uploadVoterId}
                    onRetryPoll={() => {
                      setCheckState('processing')
                      pollCheck(residencyToken, Date.now())
                    }}
                  />
                )}
                {checkState === 'passed' && !academicFailed && (
                  <AcademicScreeningBox
                    answers={screeningAnswers}
                    set={{ applyingAs: changeApplyingAs, shsFailingGrade: setShsFailingGrade, transfereeGwa: setTransfereeGwa, transfereeUnitsPassed: setTransfereeUnitsPassed, transfereeFailingGrade: setTransfereeFailingGrade }}
                    result={academic}
                    needsCard={needsCard}
                    error={fieldErrors.screening}
                    onRefused={(reasons) => refuseSignup(reasons, 'answers')}
                  />
                )}
                {checkState === 'passed' && !academicFailed && academic.passed && needsCard && (
                  <GradeCheckBox
                    state={gradeState}
                    message={gradeMessage}
                    failCount={gradeFailCount}
                    error={fieldErrors.grades}
                    onFile={uploadReportCard}
                    onRetryPoll={() => {
                      setGradeState('processing')
                      pollGrade(gradeToken, Date.now())
                    }}
                  />
                )}
                {academicFailed && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4 mt-1">
                    <div className="text-sm font-bold text-red-800 mb-1">You can&apos;t apply for this scholarship</div>
                    <ul className="text-[13px] text-red-800 leading-relaxed mb-2 list-disc pl-5">
                      {academicFailed.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                    <p className="text-[13px] text-ccc-text leading-relaxed mb-3">
                      No account was created and your uploaded documents were not kept. If you think this is a mistake, visit the GCTCDO,
                      1st Floor, Admin Building, City College of Calamba.
                    </p>
                    <button type="button" onClick={() => { window.location.href = '/' }} className="inline-block w-full text-center py-2.5 rounded-md border border-ccc-border bg-white text-ccc-navy font-bold text-sm uppercase tracking-wide hover:bg-ccc-off">
                      ← Back to homepage
                    </button>
                  </div>
                )}
                {readyForAccount && (
                <>
                <Alert tone="info">A verification code will be sent to this email before your account is finalized.</Alert>
                <TextField label="Email Address" type="email" value={email} onChange={clearFieldError('email', setEmail)} autoComplete="email" placeholder="e.g. yourname@email.com" error={fieldErrors.email} />
                <TextField label="Password" type="password" value={password} onChange={clearFieldError('password', setPassword)} autoComplete="new-password" placeholder="Create a password" error={fieldErrors.password} />
                <PasswordStrength password={password} />
                <TextField label="Confirm Password" type="password" value={password2} onChange={clearFieldError('password2', setPassword2)} autoComplete="new-password" placeholder="Re-enter your password" error={fieldErrors.password2} />
                <button type="submit" disabled={loading} className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
                  {loading ? 'Please wait…' : 'Continue →'}
                </button>
                </>
                )}
              </>
            )}
            <p className="text-center text-[13px] text-ccc-muted mt-4">
              Already have an account?{' '}
              <button type="button" onClick={onSwitch} className="text-ccc-blue font-bold hover:underline">Log in here</button>
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} noValidate>
            <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-2">Program Application</div>
            <div className="mb-3 text-[13px] text-ccc-text">
              <span className="block text-[11px] font-bold text-ccc-navy uppercase tracking-wide mb-1">Applying as</span>
              {applyingAs} <span className="text-ccc-muted">(from the eligibility check)</span>
            </div>
            <SelectField label="Term Applying In" value={termApplying} onChange={clearFieldError('termApplying', setTermApplying)} options={['Term 1', 'Term 2']} error={fieldErrors.termApplying} />
            <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-2 mt-4">Preferred Program</div>
            <SelectField label="First Choice" value={choice1} onChange={clearFieldError('choice1', setChoice1)} options={PROGRAMS} error={fieldErrors.choice1} />
            <SelectField label="Second Choice" value={choice2} onChange={clearFieldError('choice2', setChoice2)} options={[...PROGRAMS, 'None of the above']} error={fieldErrors.choice2} />
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-md border border-ccc-border text-ccc-muted font-bold text-sm uppercase tracking-wide hover:bg-ccc-off">← Back</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleStep3} noValidate>
            <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-2">Personal & Identity Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <TextField label="Last Name" value={lastName} onChange={clearFieldError('lastName', setLastName)} placeholder="e.g. Dela Cruz" error={fieldErrors.lastName} />
              <TextField label="First Name" value={firstName} onChange={clearFieldError('firstName', setFirstName)} placeholder="e.g. Juan" error={fieldErrors.firstName} />
              <TextField label="Middle Name (if any)" value={middleName} onChange={setMiddleName} placeholder="e.g. Santos" />
              <SelectField label="Suffix (if any)" value={suffix} onChange={setSuffix} options={SUFFIX_OPTIONS} placeholder="None" />
              <SelectField label="Sex at birth" value={sex} onChange={clearFieldError('sex', setSex)} options={['Male', 'Female']} error={fieldErrors.sex} />
              <TextField label="Date of Birth" type="date" max={latestBirthdate(MIN_APPLICANT_AGE)} min={earliestBirthdate(MAX_APPLICANT_AGE)} value={dateOfBirth} onChange={clearFieldError('dateOfBirth', setDateOfBirth)} error={fieldErrors.dateOfBirth} />
              <SelectField label="Civil Status" value={civilStatus} onChange={clearFieldError('civilStatus', setCivilStatus)} options={['Single', 'Married', 'Widowed', 'Legally Separated']} error={fieldErrors.civilStatus} />
              <TextField label="Contact Number" type="tel" value={contactNumber} onChange={(v) => clearFieldError('contactNumber', setContactNumber)(sanitizePhoneInput(v))} placeholder="09XX XXX XXXX" error={fieldErrors.contactNumber} />
            </div>
            {/* Oct 21 2026 (panel): the city is fixed, not typed. The
                applicant types only the house number and street; the barangay
                comes from the dropdown, and the full address is shown below
                exactly as it will be saved. */}
            <div className="text-[11px] text-ccc-navy bg-[#E8F0FA] border border-[#B5D0F0] rounded-md px-3 py-2 mb-2">
              <span className="font-bold">Calamba City residents only.</span> The city is already set to Calamba City, Laguna.
            </div>
            <TextField label="House No. and Street / Subdivision" value={address} onChange={clearFieldError('address', setAddress)} placeholder="e.g. 123 Rizal St., Villa Remedios Subd." error={fieldErrors.address} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <SelectField label="Barangay of Residence" value={barangay} onChange={clearFieldError('barangay', setBarangay)} options={CALAMBA_BARANGAYS} error={fieldErrors.barangay} />
              <div className="mb-3">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-ccc-navy uppercase tracking-wide mb-1">
                  Years of Residency in Calamba
                  <span
                    className="relative inline-flex"
                    onMouseEnter={() => setResidencyInfoOpen(true)}
                    onMouseLeave={() => setResidencyInfoOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => setResidencyInfoOpen((v) => !v)}
                      aria-label="Residency proof reminder"
                      className="w-4 h-4 rounded-full bg-ccc-blue/10 text-ccc-blue text-[10px] font-bold flex items-center justify-center normal-case"
                    >
                      i
                    </button>
                    {/* Oct 7 2026: opens to the LEFT of the "i" (right-0) so it
                        isn't cut off at the card's right edge. */}
                    {residencyInfoOpen && (
                      <div className="absolute right-0 top-5 z-20 w-60 max-w-[calc(100vw-3rem)] rounded-md border border-ccc-border bg-white shadow-lg p-2.5 text-[11px] font-normal normal-case text-ccc-text leading-snug">
                        The number of years of residency provided must be supported by a valid proof of residency for the applicant to qualify for a CCC scholarship.
                      </div>
                    )}
                  </span>
                </label>
                {/* Sept 19 2026 fix: this is a raw <input>, not the local
                    TextField component — TextField's own onChange already
                    unwraps the DOM event to a plain string before calling
                    what clearFieldError() returns, but here the event was
                    being passed straight through, so every keystroke set
                    residencyYears to the SyntheticEvent object itself
                    instead of its value. That's also why the console was
                    full of "[object Object] cannot be parsed" warnings —
                    a number input can't render an object as its value, so
                    typing looked like it did nothing at all. */}
                <input
                  type="number"
                  min="0"
                  value={residencyYears}
                  onChange={(e) => clearFieldError('residencyYears', setResidencyYears)(e.target.value)}
                  placeholder="e.g. 12"
                  className={`w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-ccc-blue/20 focus:border-ccc-blue bg-white ${
                    fieldErrors.residencyYears ? 'border-red-500' : 'border-ccc-border'
                  }`}
                />
                {fieldErrors.residencyYears && <div className="text-[11px] text-red-600 mt-1">{fieldErrors.residencyYears}</div>}
              </div>
            </div>
            <div className="text-[12px] text-ccc-text bg-ccc-off border border-ccc-border rounded-md px-3 py-2 mb-3">
              <span className="text-[10px] font-bold text-ccc-muted uppercase tracking-wide block mb-0.5">Your address will be saved as</span>
              {address.trim() ? withCalambaCity(address, barangay) : <span className="text-ccc-muted">House no. and street, Brgy. ___, Calamba City</span>}
            </div>
            <p className="text-[11px] text-ccc-muted mb-3">
              You&apos;ll be able to fill in the rest of your profile (Educational Background details, Family &amp; Financial Information, Health &amp; Wellness, and document uploads) after your account is verified.
            </p>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-md border border-ccc-border text-ccc-muted font-bold text-sm uppercase tracking-wide hover:bg-ccc-off">← Back</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div>
            <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-2">Review &amp; Verify</div>
            <div className="rounded-lg border border-ccc-border p-4 mb-4 text-sm space-y-1">
              <div><span className="text-ccc-muted">Email:</span> <span className="font-semibold">{email}</span></div>
              <div><span className="text-ccc-muted">Name:</span> <span className="font-semibold">{firstName} {middleName} {lastName}</span></div>
              <div><span className="text-ccc-muted">Program:</span> <span className="font-semibold">{choice1}</span></div>
            </div>

            {!codeSent ? (
              <>
                <label className="flex items-start gap-2.5 text-[13px] text-ccc-text mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsCertified}
                    onChange={(e) => { setTermsCertified(e.target.checked); if (fieldErrors.terms) setFieldErrors((f) => ({ ...f, terms: undefined })) }}
                    className="mt-0.5 w-4 h-4 accent-ccc-blue shrink-0"
                  />
                  <span>I certify that the information provided is true and correct, and I consent to its use for scholarship eligibility matching and verification purposes.</span>
                </label>
                {fieldErrors.terms && <div className="text-[11px] text-red-600 mb-2">{fieldErrors.terms}</div>}

                <label className="flex items-start gap-2.5 text-[13px] text-ccc-text mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAgreed}
                    onChange={(e) => { setPrivacyAgreed(e.target.checked); if (fieldErrors.privacy) setFieldErrors((f) => ({ ...f, privacy: undefined })) }}
                    className="mt-0.5 w-4 h-4 accent-ccc-blue shrink-0"
                  />
                  <span>
                    I have read and agree to the{' '}
                    <a
                      href="https://ccc.edu.ph/public/upload/files/CCC-Privacy-Statement-June-2026.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ccc-blue font-semibold hover:underline"
                    >
                      Privacy Statement
                    </a>{' '}
                    terms governing the collection and use of my personal data.
                  </span>
                </label>
                {fieldErrors.privacy && <div className="text-[11px] text-red-600 mb-3">{fieldErrors.privacy}</div>}

                <Alert tone="info">
                  Click below to receive a one-time verification code at your email. Your account is created once the code is confirmed.
                </Alert>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={loading}
                  className="w-full py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send Verification Code'}
                </button>
              </>
            ) : (
              <form onSubmit={verify} noValidate>
                {secondsLeft > 0 ? (
                  <Alert tone="success">Code sent. Check your email (and spam folder) for a 6-digit code.</Alert>
                ) : (
                  <Alert tone="error">This code has expired. Click &quot;Resend code&quot; below to get a new one.</Alert>
                )}
                <OtpBoxes value={code} onChange={clearFieldError('code', setCode)} error={fieldErrors.code} autoFocus />
                {secondsLeft > 0 && (
                  <p className="text-[12px] text-ccc-muted text-center -mt-1 mb-3">
                    Code expires in {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                  </p>
                )}
                <button type="submit" disabled={loading || secondsLeft <= 0} className="w-full py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
                  {loading ? 'Verifying…' : 'Verify & Create Account'}
                </button>
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={loading || resendCooldown > 0}
                    className="text-[13px] text-ccc-blue font-bold hover:underline disabled:opacity-50 disabled:no-underline disabled:text-ccc-muted"
                  >
                    Resend code
                  </button>
                  {resendCooldown > 0 && (
                    <p className="text-[11px] text-ccc-muted mt-1">
                      You may request another code in {resendCooldown >= 60 ? Math.ceil(resendCooldown / 60) + ' minute' + (Math.ceil(resendCooldown / 60) !== 1 ? 's' : '') : resendCooldown + ' second' + (resendCooldown !== 1 ? 's' : '')}.
                    </p>
                  )}
                </div>
              </form>
            )}
            <button type="button" onClick={() => setStep(3)} className="w-full mt-3 py-2 text-[13px] text-ccc-muted font-semibold hover:text-ccc-text">← Back</button>
          </div>
        )}
      </div>
    </>
  )
}

// Forgot Password — the remaining listed sub-feature under the User Account
// Module's Forgot Password scope: Account Lookup via Email, Reset Code
// Input + Countdown Timer, Password Confirmation Validation, and a Reset
// Success screen. Password Visibility Toggle comes free from TextField.
// Mirrors requestPasswordReset()/resetPasswordWithCode() in
// applicantAccounts.js, including the same 10-minute OTP lifetime used by
// signup verification.
const RESET_OTP_TTL_SECONDS = 10 * 60

function ForgotPasswordPanel({ onSwitch }) {
  // stage: 'lookup' -> 'reset' -> 'done'
  const [stage, setStage] = useState('lookup')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RESET_OTP_TTL_SECONDS)
  const [resendCooldown, restartResendCooldown] = useResendCooldown(stage === 'reset')

  function clearFieldError(field, setter) {
    return (v) => {
      setter(v)
      if (fieldErrors[field]) setFieldErrors((f) => ({ ...f, [field]: undefined }))
    }
  }

  useEffect(() => {
    if (stage !== 'reset' || secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [stage, secondsLeft])

  async function requestCode(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setFieldErrors({ email: 'Please enter your email address.' })
      return
    }
    if (!isValidEmailFormat(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      })
      const data = await res.json()
      if (!res.ok) {
        // The only case this surfaces an error for is the "never verified"
        // account case — a real, honest message (see requestPasswordReset).
        // Every other case (including "no such account") returns success
        // to avoid revealing which emails are registered.
        setFieldErrors({ email: data.error || 'Could not send the reset code.' })
        return
      }
      setSecondsLeft(RESET_OTP_TTL_SECONDS)
      restartResendCooldown()
      setStage('reset')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/applicant-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not resend the code.')
        return
      }
      setSecondsLeft(RESET_OTP_TTL_SECONDS)
      restartResendCooldown()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitReset(e) {
    e.preventDefault()
    setError('')

    const nextFieldErrors = {}
    if (!code.trim()) nextFieldErrors.code = 'Please enter the reset code.'
    const passwordError = passwordStrengthError(newPassword)
    if (passwordError) nextFieldErrors.newPassword = passwordError
    if (!newPassword2) nextFieldErrors.newPassword2 = 'Please confirm your new password.'
    else if (newPassword && newPassword2 && newPassword !== newPassword2) {
      nextFieldErrors.newPassword2 = 'Passwords do not match.'
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/applicant-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email, code, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFieldErrors({ code: data.error || 'Could not reset your password.' })
        return
      }
      setStage('done')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // step tracker: lookup->1 (Find Account), reset->2 (Verify Code — the
  // spec splits "Verify Code" and "New Password" into two separate screens;
  // this app's single 'reset' screen covers both at once, so it's shown as
  // step 2 while filling it in), done->4 (past the end of the 3-step list,
  // so every step renders as complete).
  const authSideStep = stage === 'lookup' ? 1 : stage === 'reset' ? 2 : 4

  return (
    <>
      <AuthSide mode="forgot" step={authSideStep} />
      <div className="flex-1 p-8">
      <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
        Reset Your Password
      </h2>

      {stage === 'lookup' && (
        <>
          <p className="text-sm text-ccc-muted mb-5">
            Enter the email address on your account and we&apos;ll send you a code to reset your password.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <form onSubmit={requestCode} noValidate>
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={clearFieldError('email', setEmail)}
              placeholder="e.g. yourname@email.com"
              autoComplete="email"
              error={fieldErrors.email}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
          </form>
        </>
      )}

      {stage === 'reset' && (
        <>
          {secondsLeft > 0 ? (
            <Alert tone="success">If that email is registered, a 6-digit code was sent to it. Check your inbox (and spam folder).</Alert>
          ) : (
            <Alert tone="error">This code has expired. Click &quot;Resend code&quot; below to get a new one.</Alert>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <form onSubmit={submitReset} noValidate>
            <OtpBoxes value={code} onChange={clearFieldError('code', setCode)} error={fieldErrors.code} autoFocus />
            {secondsLeft > 0 && (
              <p className="text-[12px] text-ccc-muted text-center -mt-1 mb-3">
                Code expires in {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
              </p>
            )}
            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={clearFieldError('newPassword', setNewPassword)}
              autoComplete="new-password"
              placeholder="Create a new password"
              error={fieldErrors.newPassword}
            />
            <PasswordStrength password={newPassword} />
            <TextField
              label="Confirm New Password"
              type="password"
              value={newPassword2}
              onChange={clearFieldError('newPassword2', setNewPassword2)}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              error={fieldErrors.newPassword2}
            />
            <button
              type="submit"
              disabled={loading || secondsLeft <= 0}
              className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60"
            >
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={resendCode}
                disabled={loading || resendCooldown > 0}
                className="text-[13px] text-ccc-blue font-bold hover:underline disabled:opacity-50 disabled:no-underline disabled:text-ccc-muted"
              >
                Resend code
              </button>
              {resendCooldown > 0 && (
                <p className="text-[11px] text-ccc-muted mt-1">
                  You may request another code in {resendCooldown >= 60 ? Math.ceil(resendCooldown / 60) + ' minute' + (Math.ceil(resendCooldown / 60) !== 1 ? 's' : '') : resendCooldown + ' second' + (resendCooldown !== 1 ? 's' : '')}.
                </p>
              )}
            </div>
          </form>
        </>
      )}

      {stage === 'done' && (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-extrabold mx-auto mb-4">
            ✓
          </div>
          <h3 className="text-base font-extrabold text-ccc-navy mb-1">Password Reset Successful</h3>
          <p className="text-sm text-ccc-muted mb-5">
            Your password has been updated. You can now log in with your new password.
          </p>
          <button
            type="button"
            onClick={onSwitch}
            className="w-full py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8]"
          >
            Back to Log In
          </button>
        </div>
      )}

      {stage !== 'done' && (
        <p className="text-center text-[13px] text-ccc-muted mt-4">
          Remembered your password?{' '}
          <button type="button" onClick={onSwitch} className="text-ccc-blue font-bold hover:underline">
            Log in here
          </button>
        </p>
      )}
      </div>
    </>
  )
}
