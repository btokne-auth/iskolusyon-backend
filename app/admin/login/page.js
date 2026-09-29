'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteHeader from '../../components/SiteHeader'
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
function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      const next = searchParams.get('next') || '/admin'
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
      {/* Lock icon circle from the mockup -- an emoji instead of an SVG since
          no icon set is wired into this project; it's a decorative badge,
          not a functional element, so it doesn't need to be pixel-exact. */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(224, 123, 57, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          fontSize: 26,
        }}
      >
        🔒
      </div>

      <h1
        className="text-xl font-extrabold text-ccc-navy mb-2"
        style={{ fontFamily: 'var(--font-montserrat)' }}
      >
        Admin Console Access
      </h1>
      {/* Sept 24 2026: opening sentence matches Ivy's mockup copy word for
          word ("This console is restricted..."); the rest is still ours --
          it names what's genuinely still missing (self-signup, session
          timeout) and points a locked-out admin at the real fix (Super
          Admin reset), neither of which the mockup's shorter copy covers. */}
      {/* Sept 29 2026: copy updated for the invite flow (and no em dash). */}
      <p className="text-xs text-ccc-muted mb-6">
        This console is restricted to authorized CCC personnel. Sign in with
        your institutional email and password. If you were just invited, use
        the temporary password from your email; you&apos;ll choose your own
        right after. Forgot your password? Ask a Super Admin to reset it.
      </p>

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="efield">
          <label>Institutional Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@ccc.edu.ph"
            autoComplete="username"
            required
          />
        </div>
        <div className="efield">
          <label>Password</label>
          {/* Sept 24 2026: show/hide toggle -- no matching CSS class for this
              in admin-theme.css, so the input is wrapped in a relative
              container and the toggle is hand-styled to sit inside it. */}
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              style={{ paddingRight: 36 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ccc-muted hover:text-ccc-text"
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Sept 24 2026, updated same day: dropped "Forgot Password?" --
            Super Admin password reset shipped, so it's no longer a dead
            end, just not self-service (see the copy above). Keeping it
            here as a disabled link would have implied a self-serve flow
            that isn't coming. "Keep me signed in" is still a genuine gap
            (remember-me isn't built), so it stays as a disabled
            placeholder. */}
        <div className="mb-4">
          <label
            className="flex items-center gap-1.5 text-[11px] text-ccc-muted"
            style={{ cursor: 'not-allowed' }}
            title="Not built yet -- every sign-in behaves the same way until the User Account Module lands."
          >
            <input type="checkbox" disabled />
            Keep me signed in
          </label>
        </div>

        {error && <p className="text-xs text-ccc-red mb-3">{error}</p>}

        {/* Sept 24 2026: matches the uppercase/tracking-wide/bold treatment
            every other primary button in the admin console already uses
            (e.g. Add Admin Account's submit button) -- this one had drifted
            to plain sentence-case semibold, which was the actual
            inconsistency worth fixing, more than the color itself (kept
            navy, not Ivy's mockup blue, so it still matches every other
            button here). The disabled/loading state now greys out the way
            Ivy's mockup's idle-button state does, instead of just dimming
            the navy via opacity. */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ccc-navy text-white text-sm font-bold uppercase tracking-wide py-2.5 disabled:!bg-[#D5D9DF] disabled:!text-[#8A9199] disabled:cursor-not-allowed"
        >
          {loading ? 'Unlocking...' : 'Unlock Console'}
        </button>

        {/* Sept 24 2026: restored now that sign-ins are actually written to
            audit_log (see app/api/admin-login/route.js) -- this line was
            deliberately left out of the earlier rebuild because it wasn't
            true yet. */}
        <p className="text-center text-[10.5px] text-ccc-muted mt-4">
          Access is logged. Unauthorized use is prohibited.
        </p>
      </form>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <main className="admin-portal min-h-screen flex flex-col" style={{ background: 'var(--ccc-navy)' }}>
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

      <div className="flex-1 flex items-center justify-center px-4 py-12">
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
