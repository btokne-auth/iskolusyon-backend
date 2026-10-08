// Oct 8 2026: one password rule for everyone (applicants and admins), used
// by the server checks and by the live strength meter under the password
// fields. Plain JavaScript with no server imports, so the browser can use
// it too.
//
// The rule is the one applicants already had: at least 8 characters, with
// a number, an uppercase letter, a lowercase letter and a special
// character. Before today admins only needed 8 characters.

export const MIN_PASSWORD_LENGTH = 8
export const STRONG_PASSWORD_LENGTH = 12

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include a number, an uppercase letter, a lowercase letter, and a special character.'

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= MIN_PASSWORD_LENGTH },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number (0–9)', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'A special character (like ! @ # ?)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

export function passwordChecks(password) {
  const pw = typeof password === 'string' ? password : ''
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(pw) }))
}

export function isStrongPassword(password) {
  if (typeof password !== 'string') return false
  return PASSWORD_RULES.every((rule) => rule.test(password))
}

// How the meter rates a password, from 0 (nothing typed) to 4:
// 1 Weak   = meets 2 rules or fewer
// 2 Fair   = meets 3 or 4 rules (still can't be saved)
// 3 Good   = meets every rule (can be saved)
// 4 Strong = meets every rule and is 12 characters or longer
export function passwordStrength(password) {
  const pw = typeof password === 'string' ? password : ''
  if (!pw) return { score: 0, label: '' }
  const met = PASSWORD_RULES.filter((rule) => rule.test(pw)).length
  if (met === PASSWORD_RULES.length) {
    return pw.length >= STRONG_PASSWORD_LENGTH ? { score: 4, label: 'Strong' } : { score: 3, label: 'Good' }
  }
  return met >= 3 ? { score: 2, label: 'Fair' } : { score: 1, label: 'Weak' }
}
