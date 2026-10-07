'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ApplicantAuth from '../components/ApplicantAuth'
import LoadingScreen from '../components/LoadingScreen'

// Sept 23, 2026: split out of what used to be the site root ("/"). The
// public welcome page now lives at "/" (app/page.js) and links here for
// Log In / Apply Now / Sign Up. If someone's already logged in and lands
// here anyway (a stale bookmark, browser back button, etc.), we bounce
// them straight to /portal instead of showing the login form again.
// ?mode=signup lets the welcome page's "Sign Up" button open straight
// into the signup panel instead of the login one.
function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/applicant-session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && data.loggedIn) {
          router.replace('/portal')
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return (
      <LoadingScreen />
    )
  }

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  return (
    <ApplicantAuth
      initialMode={initialMode}
      expired={searchParams.get('expired') === '1'}
      onAuthenticated={() => router.push('/portal')}
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
