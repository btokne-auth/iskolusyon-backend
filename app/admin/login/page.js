'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'
import OtpBoxes from '../../components/OtpBoxes'
// Sept 24 2026 reskin: this page never imported the shared admin theme or
// carried the .admin-portal wrapper class, so it was pure ad hoc Tailwind
// while every other admin page already reads from admin-theme.css. Needed
// both together -- the theme's CSS variables (--navy, --muted, --border,
// etc.) are declared inside the .admin-portal selector itself, so a shared
// class like .efield does nothing without the wrapper class present too.
import '../../admin-theme.css'

// Sept 24 2026: same eye / eye-slash icons as the applicant side (see
// ApplicantAuth.js's EyeIcon/EyeOffIcon, which itself matches app/page.js's
// IconEye/IconEyeOff) -- reused here so the show/hide toggle looks
// identical across the whole app rather than introducing a third variant
// just for this page.
function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.11A10.6 10.6 0 0112 5c6 0 9.5 7 9.5 7a13.6 13.6 0 01-3.13 3.94M6.6 6.6C4.16 8.2 2.5 10.5 2.5 12c0 0 3.5 7 9.5 7 1.13 0 2.19-.19 3.17-.53" />
    </svg>
  )
}

// Sept 24 2026: rebuilt to match Ivy's "REVISED-3" mockup for this screen --
// a full-bleed dark backdrop with a centered card, no public nav or footer
// links (this is its own standalone screen, not embedded in the normal
// site chrome the way the rest of the admin console is). Pau asked
// afterward for a slim branding bar top and bottom, for orientation and
// brand consistency, without pulling in anything applicant-facing -- see
// SiteHeader usage below (logos + college name only, no nav links, no
// Sign Up button) and the one-line copyright footer at the bottom.
// Oct 7 2026 (manuscript Ch. 3, Input Validation): only go back to a page of
// the admin console after signing in. Before this, a link such as
// /admin/login?next=https://fake-site.example would have sent a freshly
// signed-in admin to another website.
function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/admin') || next.startsWith('//')) return '/admin'
  if (next.startsWith('/admin/login') || next.startsWith('/admin/change-password')) return '/admin'
  return next
}

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Oct 7 2026: step 2 of sign-in (emailed code). sentTo is the masked
  // address the code went to; null means we're on the password step.
  const [sentTo, setSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [codeMinutes, setCodeMinutes] = useState(10)
  // Oct 12 2026: same code screen as the applicant sign-in (Ivy's Suggestions
  // Log): 6 boxes, a "Code expires in" timer and a 1-minute wait before
  // "Send a new code" (the server already allows one new code a minute).
  const [expiresAt, setExpiresAt] = useState(null)
  const [resendAt, setResendAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sentTo) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sentTo])
  const startTimers = (secondsLeft) => {
    const t = Date.now()
    setNow(t)
    setExpiresAt(t + secondsLeft * 1000)
    setResendAt(t + 60 * 1000)
  }
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null
  const resendWait = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0

  // Reopen the code step after a refresh, or after setting a first password.
  useEffect(() => {
    fetch('/api/admin-login', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.pending) {
          setSentTo(data.sentTo || 'your email')
          setCodeMinutes(data.minutes || 10)
          const left = typeof data.secondsLeft === 'number' ? data.secondsLeft : (data.minutes || 10) * 60
          setNow(Date.now())
          setExpiresAt(Date.now() + left * 1000)
          setResendAt(null)
          if (searchParams.get('step') === 'code') {
            setNotice('Your new password is saved. We emailed you a sign-in code to finish signing in.')
          }
        }
      })
      .catch(() => {})
  }, [searchParams])

  const goToConsole = () => {
    router.push(safeNext(searchParams.get('next')))
    router.refresh()
  }

  const submitCode = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'That code did not work.')
        if (data.restart) {
          setSentTo(null)
          setCode('')
          setPassword('')
        }
        return
      }
      goToConsole()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not send a new code.')
        if (data.restart) setSentTo(null)
        return
      }
      setCode('')
      startTimers((data.minutes || codeMinutes) * 60)
      setNotice(`A new code was sent to ${data.sentTo}. Only the newest code works.`)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
  }

  const useDifferentAccount = async () => {
    try {
      await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
    } catch {}
    setSentTo(null)
    setCode('')
    setPassword('')
    setError('')
    setNotice('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed.')
        return
      }
      // Sept 29 2026: signed in with a temporary password (invite or reset).
      if (data.mustChangePassword) {
        router.push('/admin/change-password')
        return
      }
      // Oct 7 2026: right password, now the emailed code.
      if (data.requiresCode) {
        setSentTo(data.sentTo || 'your email')
        setCodeMinutes(data.minutes || 10)
        setCode('')
        startTimers((data.minutes || 10) * 60)
        return
      }
      goToConsole()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Oct 3 2026 redesign: same split-card layout as the applicant login
  // (navy pane with the steps on the left, form on the right) so the two
  // sign-in pages look like one system. Same fields and submit flow.
  return (
    <div className="al-card">
      <div className="al-side">
        <span className="al-side-circle" aria-hidden="true" />
        <h1 className="al-side-title">
          Admin
          <br />
          Console
        </h1>
        <p className="al-side-text">
          Sign in to review scholarship applications, record results and manage communications for applicants.
        </p>
        <ol className="al-steps">
          <li className={`al-step ${sentTo ? '' : 'current'}`}>
            <span className="al-step-num">1</span>
            <span className="al-step-text">
              Sign in
              <small>New or reset accounts choose their own password here</small>
            </span>
          </li>
          <li className={`al-step ${sentTo ? 'current' : ''}`}>
            <span className="al-step-num">2</span>
            <span className="al-step-text">
              Enter the emailed code
              <small>A 6-digit code, every sign-in</small>
            </span>
          </li>
        </ol>
        <div className="al-spacer" />
        <Link href="/" className="al-back">
          &larr; Back to homepage
        </Link>
      </div>

      {sentTo ? (
        <form onSubmit={submitCode} className="al-form">
          <div className="al-form-head">
            <h2 className="al-title">Check your email</h2>
            <p className="al-sub">
              We sent a 6-digit sign-in code to <strong>{sentTo}</strong>. It works once and expires in {codeMinutes}{' '}
              minutes.
            </p>
          </div>
          {notice && (
            <div className="al-info" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="al-error" role="alert">
              {error}
            </div>
          )}
          {secondsLeft === 0 && (
            <div className="al-error" role="alert">
              This code has expired. Send a new code below.
            </div>
          )}
          <div className="al-field">
            <span className="al-label">Sign-in code</span>
            <OtpBoxes value={code} onChange={setCode} autoFocus />
            {secondsLeft > 0 && (
              <p className="al-note" style={{ textAlign: 'center', marginTop: 0 }}>
                Code expires in {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
              </p>
            )}
          </div>
          <button type="submit" disabled={loading || code.length !== 6 || secondsLeft === 0} className="al-submit">
            {loading ? 'Checking...' : 'Verify and Open Console'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              onClick={resendCode}
              disabled={resendWait > 0}
              className="al-forgot"
              style={{ background: 'none', border: 0, padding: 0, color: resendWait > 0 ? 'var(--muted, #5a6b85)' : 'var(--ccc-blue)', fontWeight: 700, cursor: resendWait > 0 ? 'default' : 'pointer' }}
            >
              Send a new code
            </button>
            {resendWait > 0 && (
              <p className="al-note" style={{ marginTop: 4 }}>
                You may request another code in {resendWait} second{resendWait === 1 ? '' : 's'}.
              </p>
            )}
            <button type="button" onClick={useDifferentAccount} className="al-forgot" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'block', margin: '8px auto 0' }}>
              Use a different account
            </button>
          </div>
          <p className="al-note">Didn&apos;t get it? Check your Spam folder.</p>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="al-form">
        <div className="al-form-head">
          <h2 className="al-title">Admin Login</h2>
          <p className="al-sub">For authorized CCC personnel. Use your institutional email and password.</p>
        </div>
        <div className="al-info">
          Just invited, or had your password reset? Use the temporary password from your email. You&apos;ll choose
          your own right after. Every sign-in also asks for a code we email you.
        </div>
        {/* Oct 7 2026: shown after the 30-minute inactivity sign-out. */}
        {searchParams.get('expired') === '1' && !error && (
          <div className="al-info" role="status">
            You were signed out after 30 minutes without activity, to keep applicant data safe. Please sign in again.
          </div>
        )}
        {error && (
          <div className="al-error" role="alert">
            {error}
          </div>
        )}
        <div className="al-field">
          <label htmlFor="adminEmail" className="al-label">Institutional email</label>
          <input
            id="adminEmail"
            className="al-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@ccc.edu.ph"
            autoComplete="username"
            required
          />
        </div>
        <div className="al-field">
          <label htmlFor="adminPassword" className="al-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="adminPassword"
              className="al-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              style={{ paddingRight: 46 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="al-eye"
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
        <div className="al-row">
          {/* "Keep me signed in" is still not built, so it stays a disabled
              placeholder exactly as before (Pau has her own plan for it). */}
          <label
            className="al-keep"
            style={{ cursor: 'not-allowed' }}
            title="Not built yet -- every sign-in behaves the same way until the User Account Module lands."
          >
            <input type="checkbox" disabled />
            Keep me signed in
          </label>
          <span className="al-forgot">Forgot your password? Ask a Super Admin.</span>
        </div>
        <button type="submit" disabled={loading} className="al-submit">
          {loading ? 'Checking...' : 'Continue'}
        </button>
        {/* Sign-ins are written to audit_log (app/api/admin-login/route.js). */}
        <p className="al-note">Access is logged. Unauthorized use is prohibited.</p>
      </form>
      )}
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <main className="admin-portal min-h-screen flex flex-col" style={{ background: 'var(--ccc-off)' }}>
      {/* SiteHeader has no public nav links or Sign Up/Log In buttons built
          into it -- it only renders the logo cluster, college name, and an
          optional badge -- so it's already the "slim branding bar" without
          needing a separate trimmed-down component. Logos explicitly set to
          the same 3-logo set (CCC, Admissions, Registrar) the rest of the
          admin console uses, instead of SiteHeader's 2-logo applicant-side
          default, so this page's branding matches its own section. */}
      <SiteHeader
        topbarLabel="Iskolusyon Admin Console"
        portalBadge="Admin Sign-in"
        logos={[
          { src: '/LOGO_CCC.png', alt: 'City College of Calamba Logo' },
          { src: '/LOGO_CCC_Admissions.png', alt: 'CCC Admissions Logo' },
          { src: '/LOGO_CCC_Registrar.png', alt: 'CCC Registrar Logo' },
        ]}
      />

      <div className="flex-1 flex items-center justify-center px-4 py-14">
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </div>

      {/* One-line copyright bar instead of the full public WelcomeFooter --
          that component's "Admission Requirements" / "FAQs" resource links
          are for applicants browsing the public site and don't belong on a
          staff-only login screen. This keeps just the universal part. */}
      <div
        className="text-center py-2.5 text-[10.5px] font-bold uppercase tracking-wide"
        style={{ background: 'var(--ccc-blue)', color: 'rgba(255,255,255,.9)', fontFamily: 'var(--font-montserrat)', letterSpacing: '0.5px' }}
      >
        © 2026 Iskolusyon Scholarship Management System &nbsp;|&nbsp; Developed for the City College of Calamba
      </div>
    </main>
  )
}
