'use client'

import { useEffect, useState } from 'react'

// Oct 12 2026: today's date and time in Manila for the blue top bar, like
// ccc.edu.ph's own top bar (Ivy's Suggestions Log). Renders nothing until
// it mounts, so the server and browser never disagree about the time.
function manilaLabel(d) {
  const date = d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
  return `${date} · ${time}`
}

export default function ManilaClock({ className }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => setLabel(manilaLabel(new Date()))
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  )
}
