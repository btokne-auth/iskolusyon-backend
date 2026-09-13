'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteHeader from '../../components/SiteHeader'

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [passcode, setPasscode] = useState('')
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
        body: JSON.stringify({ passcode, name }),
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
      <div className="rounded-2xl border border-ccc-border bg-white shadow-sm p-6">
        <h1
          className="text-lg font-extrabold text-ccc-navy mb-1"
          style={{ fontFamily: 'var(--font-montserrat)' }}
        >
          Admin sign-in
        </h1>
        <p className="text-xs text-ccc-muted mb-5">
          Shared team passcode. Enter your name too, so the activity log
          knows who did what — this isn&apos;t a real account system yet,
          just a placeholder until the User Account Module is ready.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-ccc-muted block mb-1">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jhudiel"
              autoComplete="name"
              className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-ccc-muted block mb-1">
              Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Shared team passcode"
              autoComplete="current-password"
              className="w-full rounded-lg border border-ccc-border bg-white px-3 py-2.5 text-sm text-ccc-text focus:outline-none focus:ring-2 focus:ring-ccc-blue/40"
              required
            />
          </div>

          {error && <p className="text-xs text-ccc-red">{error}</p>}

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
    <main className="min-h-screen bg-ccc-off text-ccc-text">
      <SiteHeader topbarLabel="Iskolusyon Admin Console" portalBadge="Admin Sign-in" />
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </main>
  )
}