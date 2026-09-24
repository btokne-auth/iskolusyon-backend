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
      {/* Sept 24 2026: kept the app's own accurate copy instead of the
          mockup's shorter text -- this still names what isn't built yet
          (self-signup, password reset, session timeout), which matters
          because Forgot Password / Keep me signed in below are disabled
          for exactly that reason. Swapping to the mockup's copy would have
          dropped that disclosure. */}
      <p className="text-xs text-ccc-muted mb-6">
        Sign in with your own admin account. This still isn&apos;t backed
        by a real account system yet — no self-signup, password reset, or
        session timeout — just individual credentials in place of the old
        shared passcode, until the User Account Module is ready.
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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />
        </div>

        {/* Sept 24 2026: both from the mockup, both disabled -- neither
            remember-me nor password reset exists yet (see the copy above),
            so these are placeholders for when the User Account Module
            lands rather than live controls. */}
        <div className="flex items-center justify-between mb-4">
          <label
            className="flex items-center gap-1.5 text-[11px] text-ccc-muted"
            style={{ cursor: 'not-allowed' }}
            title="Not built yet -- every sign-in behaves the same way until the User Account Module lands."
          >
            <input type="checkbox" disabled />
            Keep me signed in
          </label>
          <span
            className="text-[11px] font-semibold text-ccc-muted"
            style={{ cursor: 'not-allowed' }}
            title="Password reset isn't built yet -- contact whoever seeded your account."
          >
            Forgot Password?
          </span>
        </div>

        {error && <p className="text-xs text-ccc-red mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ccc-navy text-white text-sm font-semibold py-2.5 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Unlock Console'}
        </button>
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
