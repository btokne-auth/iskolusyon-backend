'use client'

import { useRef } from 'react'

// 6-digit OTP entry — matches index.html/signup.html's .otp-box UI exactly:
// one box per digit, auto-advance on entry, backspace steps back into the
// previous box when the current one is already empty, and pasting a full
// code distributes it across all six boxes. Shared by every OTP step
// (login MFA, signup verification, forgot-password reset) and, since
// Oct 12 2026, the admin console's sign-in code step.
export default function OtpBoxes({ value, onChange, error, autoFocus }) {
  const length = 6
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  function setDigitAt(i, char) {
    const chars = value.padEnd(length, ' ').split('')
    chars[i] = char
    onChange(chars.join('').replace(/\s/g, '').slice(0, length))
  }

  function handleInput(i, e) {
    const v = e.target.value.replace(/\D/g, '')
    const char = v ? v[v.length - 1] : ''
    setDigitAt(i, char)
    if (char && i < length - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="mb-3">
      <div className="flex gap-2 justify-center my-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={d}
            onChange={(e) => handleInput(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${i + 1}`}
            className={`w-11 h-[54px] text-center text-lg font-extrabold rounded-lg border-2 outline-none focus:border-ccc-blue focus:ring-2 focus:ring-ccc-blue/20 text-ccc-navy ${
              error ? 'border-red-500' : 'border-ccc-border'
            }`}
            style={{ fontFamily: 'var(--font-montserrat)' }}
          />
        ))}
      </div>
      {error && <div className="text-[11px] text-red-600 text-center mb-2">{error}</div>}
    </div>
  )
}
