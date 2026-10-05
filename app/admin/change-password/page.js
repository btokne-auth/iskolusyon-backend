'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteHeader from '../../components/SiteHeader'
import { Skeleton } from '../../components/Skeleton'
import '../../admin-theme.css'

// Sept 29 2026: first sign-in on a temporary password (new invite or a
// Super Admin reset). Same standalone layout as /admin/login. Behavior
// follows Ivy's admin.html "Set Your Password" view (new password +
// confirm, at least 8 characters, then continue), reached here after
// signing in with the emailed temporary password instead of via a link.

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

function PasswordInput({ value, onChange, show, onToggle, placeholder, autoComplete }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={8}
        required
        style={{ paddingRight: 36 }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ccc-muted hover:text-ccc-text"
        tabIndex={-1}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function ChangePasswordForm() {
  const router = useRouter()
  const [name, setName] = useState(null) // null = checking
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin-change-password')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.success) {
          router.replace('/admin/login')
          return
        }
        setName(data.name || '')
      })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don\u2019t match.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      })
      const data = await res.json()
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not save your password.')
        return
      }
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (name === null) {
    return (
      <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="sk-sr">Loading...</span>
        <Skeleton dark width="55%" height={16} />
        <Skeleton dark width="85%" height={11} />
        <Skeleton dark width="100%" height={42} radius={8} />
        <Skeleton dark width="100%" height={42} radius={8} />
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(0, 60, 208, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          fontSize: 26,
        }}
      >
        🔑
      </div>
      <h1 className="text-xl font-extrabold text-ccc-navy mb-2" style={{ fontFamily: 'var(--font-montserrat)' }}>
        Set Your Password
      </h1>
      <p className="text-xs text-ccc-muted mb-6">
        {name ? `Welcome, ${name}. ` : ''}You signed in with a temporary password. Choose your own password to
        continue to the Admin Console.
      </p>

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="efield">
          <label>New Password</label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="efield">
          <label>Confirm Password</label>
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            placeholder="Type it again"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-xs text-ccc-red mb-3">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-ccc-navy text-white text-sm font-bold uppercase tracking-wide py-2.5 disabled:!bg-[#D5D9DF] disabled:!text-[#8A9199] disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  )
}

export default function AdminChangePasswordPage() {
  return (
    <main className="admin-portal min-h-screen flex flex-col" style={{ background: 'var(--ccc-navy)' }}>
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
        <ChangePasswordForm />
      </div>
      <div
        className="text-center py-2.5 text-[10.5px] font-bold uppercase tracking-wide"
        style={{ background: 'var(--ccc-blue)', color: 'rgba(255,255,255,.9)', fontFamily: 'var(--font-montserrat)', letterSpacing: '0.5px' }}
      >
        © 2026 Iskolusyon Scholarship Management System &nbsp;|&nbsp; Developed for the City College of Calamba
      </div>
    </main>
  )
}
