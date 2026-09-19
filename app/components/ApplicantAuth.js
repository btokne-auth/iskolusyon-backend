'use client'
import { useState } from 'react'
import SiteHeader from './SiteHeader'

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

function TextField({ label, value, onChange, type = 'text', placeholder, required, error, autoComplete }) {
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

function SelectField({ label, value, onChange, options, required, error }) {
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
        <option value="">Select…</option>
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

const SIDE_STEPS = ['Account Setup', 'Program Application', 'Personal Information', 'Review & Verify']

function AuthSide({ mode, step }) {
  return (
    <div className="hidden md:flex flex-col bg-gradient-to-br from-ccc-navy to-ccc-blue text-white p-8 w-[300px] shrink-0">
      <h1 className="text-xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-montserrat)' }}>
        {mode === 'login' ? 'Welcome back.' : 'Start your scholarship journey.'}
      </h1>
      <p className="text-sm text-white/70 mb-8 leading-relaxed">
        {mode === 'login'
          ? 'Log in to track and manage your City College of Calamba scholarship application.'
          : 'Create your account to apply, track, and manage your City College of Calamba scholarship application.'}
      </p>
      {mode === 'signup' && (
        <div className="flex flex-col gap-5">
          {SIDE_STEPS.map((label, i) => {
            const num = i + 1
            const isDone = num < step
            const isCurrent = num === step
            return (
              <div key={label} className="flex gap-3 items-start">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-white text-ccc-blue' : 'bg-white/15 text-white/70'
                  }`}
                >
                  {isDone ? '✓' : num}
                </div>
                <span className={`text-sm pt-1 font-semibold ${isCurrent || isDone ? 'text-white' : 'text-white/55'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
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

export default function ApplicantAuth({ onAuthenticated }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'

  return (
    <div className="min-h-screen bg-ccc-off flex flex-col">
      <SiteHeader topbarLabel="(049) 559-8900 to 8907 / (02) 8-539-5170 to 5171" />
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-[900px] bg-white rounded-2xl shadow-xl overflow-hidden flex">
          {mode === 'login' ? (
            <LoginPanel onSwitch={() => setMode('signup')} onAuthenticated={onAuthenticated} />
          ) : (
            <SignupPanel onSwitch={() => setMode('login')} onAuthenticated={onAuthenticated} />
          )}
        </div>
      </div>
    </div>
  )
}

function LoginPanel({ onSwitch, onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')

    // Inline field-level validation (matches the red field-err style used
    // in the signup steps below) instead of relying on the browser's
    // default "Please fill out this field" tooltip, which looked
    // inconsistent with the rest of the auth UI.
    const nextFieldErrors = {}
    if (!email.trim()) nextFieldErrors.email = 'Please enter your email address.'
    else if (!email.includes('@')) nextFieldErrors.email = 'Please enter a valid email address.'
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
      onAuthenticated({ id: data.id, email: data.email, name: data.name })
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AuthSide mode="login" step={0} />
      <div className="flex-1 p-8">
        <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Log In to Your Account
        </h2>
        <p className="text-sm text-ccc-muted mb-5">Access your scholarship application dashboard.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <form onSubmit={submit} noValidate>
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
      </div>
    </>
  )
}

// Mirrors validatePasswordStrength() in app/lib/applicantAccounts.js — same
// rule shown in the field-note under the Password field, checked here too
// so the applicant sees it inline instead of only after a round trip.
function passwordStrengthError(password) {
  if (!password) return 'Please enter a password.'
  if (password.length < 8 || !/[0-9]/.test(password) || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Must be at least 8 characters and include a number, an uppercase letter, a lowercase letter, and a special character.'
  }
  return null
}

function SignupPanel({ onSwitch, onAuthenticated }) {
  const [step, setStep] = useState(1)
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

  // Step 2 — Program Application (matches academicInfo shape from app/page.js)
  const [applyingAs, setApplyingAs] = useState('')
  const [termApplying, setTermApplying] = useState('')
  const [choice1, setChoice1] = useState('')
  const [choice2, setChoice2] = useState('')

  // Step 3 — Personal Information (subset matching personalInfo shape)
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [civilStatus, setCivilStatus] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [address, setAddress] = useState('')

  // Step 4
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  async function handleStep1(e) {
    e.preventDefault()
    setError('')

    const nextFieldErrors = {}
    if (!email.trim()) nextFieldErrors.email = 'Please enter your email address.'
    else if (!email.includes('@')) nextFieldErrors.email = 'Please enter a valid email address.'
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
        body: JSON.stringify({ action: 'start', email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Server-only checks (email already registered, or a password rule
        // that somehow slipped past the client check above) land as a
        // field-specific error too, not a generic top banner — keeps this
        // consistent with steps 2/3's per-field errors instead of being a
        // one-off exception.
        const message = data.error || 'Could not start signup.'
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
    if (!applyingAs) nextFieldErrors.applyingAs = 'Please select how you are applying.'
    if (!termApplying) nextFieldErrors.termApplying = 'Please select the term you are applying in.'
    if (!choice1) nextFieldErrors.choice1 = 'Please select your first choice program.'
    if (!choice2) nextFieldErrors.choice2 = 'Please select your second choice program.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    saveProgressAndAdvance(3, {
      academicInfo: { applyingAs, termApplying, choice1, choice2 },
    })
  }

  function handleStep3(e) {
    e.preventDefault()
    const nextFieldErrors = {}
    if (!lastName.trim()) nextFieldErrors.lastName = 'Please enter your last name.'
    if (!firstName.trim()) nextFieldErrors.firstName = 'Please enter your first name.'
    if (!sex) nextFieldErrors.sex = 'Please select your sex.'
    if (!dateOfBirth) nextFieldErrors.dateOfBirth = 'Please enter your date of birth.'
    if (!civilStatus) nextFieldErrors.civilStatus = 'Please select your civil status.'
    if (!contactNumber.trim()) nextFieldErrors.contactNumber = 'Please enter your contact number.'
    if (!address.trim()) nextFieldErrors.address = 'Please enter your present home address.'
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    saveProgressAndAdvance(4, {
      personalInfo: { firstName, middleName, lastName, sex, dateOfBirth, civilStatus, contactNumber, address },
    })
  }

  async function sendCode() {
    setError('')
    setLoading(true)
    try {
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
      onAuthenticated({ id: accountId, email, name: data.name })
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
        <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-1">Step {step} of 4</div>
        <h2 className="text-lg font-extrabold text-ccc-navy mb-1" style={{ fontFamily: 'var(--font-montserrat)' }}>
          Create Your Applicant Account
        </h2>
        {error && <Alert tone="error">{error}</Alert>}

        {step === 1 && (
          <form onSubmit={handleStep1} noValidate>
            <Alert tone="info">A verification code will be sent to this email before your account is finalized.</Alert>
            <TextField label="Email Address" type="email" value={email} onChange={clearFieldError('email', setEmail)} autoComplete="email" placeholder="e.g. yourname@email.com" error={fieldErrors.email} />
            <TextField label="Password" type="password" value={password} onChange={clearFieldError('password', setPassword)} autoComplete="new-password" placeholder="Create a password" error={fieldErrors.password} />
            <div className="text-[11px] text-ccc-muted -mt-2 mb-3">
              Minimum 8 characters, with at least 1 number, 1 uppercase & 1 lowercase letter, and 1 special character.
            </div>
            <TextField label="Confirm Password" type="password" value={password2} onChange={clearFieldError('password2', setPassword2)} autoComplete="new-password" placeholder="Re-enter your password" error={fieldErrors.password2} />
            <button type="submit" disabled={loading} className="w-full mt-2 py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
              {loading ? 'Please wait…' : 'Continue →'}
            </button>
            <p className="text-center text-[13px] text-ccc-muted mt-4">
              Already have an account?{' '}
              <button type="button" onClick={onSwitch} className="text-ccc-blue font-bold hover:underline">Log in here</button>
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} noValidate>
            <div className="text-[11px] font-bold text-ccc-gold uppercase tracking-wide mb-2">Program Application</div>
            <SelectField label="Applying as" value={applyingAs} onChange={clearFieldError('applyingAs', setApplyingAs)} options={['First Year', 'Transferee', 'Old Curriculum and ALS Completer']} error={fieldErrors.applyingAs} />
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
              <SelectField label="Sex" value={sex} onChange={clearFieldError('sex', setSex)} options={['Male', 'Female']} error={fieldErrors.sex} />
              <TextField label="Date of Birth" type="date" value={dateOfBirth} onChange={clearFieldError('dateOfBirth', setDateOfBirth)} error={fieldErrors.dateOfBirth} />
              <SelectField label="Civil Status" value={civilStatus} onChange={clearFieldError('civilStatus', setCivilStatus)} options={['Single', 'Married', 'Widowed', 'Legally Separated']} error={fieldErrors.civilStatus} />
              <TextField label="Contact Number" value={contactNumber} onChange={clearFieldError('contactNumber', setContactNumber)} placeholder="e.g. 09XX XXX XXXX" error={fieldErrors.contactNumber} />
            </div>
            <TextField label="Present Home Address" value={address} onChange={clearFieldError('address', setAddress)} placeholder="e.g. 123 Rizal St., Brgy. Real, Calamba City" error={fieldErrors.address} />
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
                <Alert tone="success">Code sent. Check your email (and spam folder) for a 6-digit code.</Alert>
                <TextField label="Verification Code" value={code} onChange={clearFieldError('code', setCode)} placeholder="123456" error={fieldErrors.code} />
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-md bg-ccc-blue text-white font-bold text-sm uppercase tracking-wide hover:bg-[#002fa8] disabled:opacity-60">
                  {loading ? 'Verifying…' : 'Verify & Create Account'}
                </button>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={loading}
                  className="w-full mt-2 text-[13px] text-ccc-blue font-bold hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </form>
            )}
            <button type="button" onClick={() => setStep(3)} className="w-full mt-3 py-2 text-[13px] text-ccc-muted font-semibold hover:text-ccc-text">← Back</button>
          </div>
        )}
      </div>
    </>
  )
}
