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
    <div className="w-full max-w-sm mx-auto px-4 pt-16">
      {/* Sept 24 2026: swapped the hand-rolled box for .card (same white
          surface, border, radius and shadow every other admin panel uses)
          and the two fields onto .efield (the label+input pattern already
          used in Application Cycle Settings) instead of one-off Tailwind
          per input. Heading kept as plain Tailwind -- .card-title is sized
          for a section label inside a card, not a page heading, so it
          would read too small here. */}
      <div className="card">
        <h1
          className="text-lg font-extrabold text-ccc-navy mb-1"
          style={{ fontFamily: 'var(--font-montserrat)' }}
        >
          Admin sign-in
        </h1>
        <p className="text-xs text-ccc-muted mb-5">
          Sign in with your own admin account. This still isn&apos;t backed
          by a real account system yet — no self-signup, password reset, or
          session timeout — just individual credentials in place of the old
          shared passcode, until the User Account Module is ready.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="efield">
            <label>Email</label>
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

          {error && <p className="text-xs text-ccc-red mb-3">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ccc-navy text-white text-sm font-semibold py-2.5 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <main className="admin-portal min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader topbarLabel="Iskolusyon Admin Console" portalBadge="Admin Sign-in" />
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </main>
  )
}