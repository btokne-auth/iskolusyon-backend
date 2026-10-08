'use client'
import { passwordChecks, passwordStrength, STRONG_PASSWORD_LENGTH } from '../lib/passwordRules'

// Oct 8 2026: live password strength meter. A 4-part bar with a label
// (Weak / Fair / Good / Strong) and a checklist of the password rule, where
// each line turns green once it's met. Shown under the password field on
// applicant sign-up, applicant password reset and the admin "Set Your
// Password" page. Inline styles so it looks the same in both themes.

const LEVELS = {
  1: { color: '#C62828', text: '#B71C1C' },
  2: { color: '#E0A100', text: '#8A6300' },
  3: { color: '#2E7D32', text: '#1B5E20' },
  4: { color: '#1B5E20', text: '#1B5E20' },
}

function Tick({ met }) {
  return met ? (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="8" fill="#2E7D32" />
      <path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="7" fill="none" stroke="#A3ADBD" strokeWidth="1.6" />
    </svg>
  )
}

export default function PasswordStrength({ password, style }) {
  const { score, label } = passwordStrength(password)
  const checks = passwordChecks(password)
  const level = LEVELS[score]

  return (
    <div style={{ margin: '-4px 0 12px', textAlign: 'left', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          role="meter"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={score}
          aria-valuetext={label || 'Nothing typed yet'}
          style={{ display: 'flex', gap: 4, flex: 1 }}
        >
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: score >= n ? level.color : '#E3E7EE',
                transition: 'background-color .2s ease',
              }}
            />
          ))}
        </div>
        <span
          aria-live="polite"
          style={{ minWidth: 46, fontSize: 11, fontWeight: 700, textAlign: 'right', color: level ? level.text : '#8A93A3' }}
        >
          {label}
        </span>
      </div>

      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 3 }}>
        {checks.map((c) => (
          <li
            key={c.id}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c.met ? '#1B5E20' : '#5F6B7D' }}
          >
            <Tick met={c.met} />
            <span>{c.label}</span>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {c.met ? ' (done)' : ' (not yet)'}
            </span>
          </li>
        ))}
      </ul>

      {score === 3 && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#5F6B7D' }}>
          Good enough to save. Use {STRONG_PASSWORD_LENGTH} or more characters to make it Strong.
        </p>
      )}
    </div>
  )
}
