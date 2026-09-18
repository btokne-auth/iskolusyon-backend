'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The Global Audit Logs page has moved into the admin shell as the
// "System & Activity" panel (see app/admin/page.js, SystemActivityPanel).
// This route now just redirects there instead of duplicating the page, so
// any existing bookmark or link to /admin/activity still lands somewhere
// useful instead of a stale duplicate UI.
export default function AdminActivityRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin?panel=system')
  }, [router])
  return null
}
