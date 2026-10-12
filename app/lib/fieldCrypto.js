// Oct 7 2026: app-level encryption at rest (manuscript Ch. 3, Data
// Transmission and Encryption Testing: "stored sensitive fields are
// encrypted at rest within the centralized database"; Cybersecurity
// Principles: "encryption at rest for sensitive stored fields").
//
// Supabase already encrypts its whole disk (AES-256). This adds a second
// lock on the most private applicant fields: they are scrambled with
// AES-256-GCM by THIS app before they reach Supabase, using a key that only
// lives in Vercel's environment variables (FIELD_ENCRYPTION_KEY). Someone who
// opens the Supabase Table Editor, a database backup or a leaked export sees
// only "enc:v1:..." for these fields. The portal and the admin console still
// show the real values, because the app unlocks them when reading.
//
// GCM also detects tampering: an edited encrypted value fails to unlock
// instead of showing altered data.
//
// Which fields (Pau's choice, Oct 7 2026: financial + contact):
//  - every contact number (applicant, spouse, mother, father, guardian,
//    emergency contact, and each sibling's contact in fam_siblings)
//  - the family's financial details: each parent's / guardian's employment
//    status (the form has no income field; see applicantProfileSchema.js)
//  - Medical Status (health_condition), the most private free-text answer
//  - Oct 12 2026: the special classification answers (LGBTQI+, disability,
//    solo parent, Indigenous Peoples member, homeless/underprivileged)
// Not encrypted on purpose: names, birth details, address, barangay and
// precinct, because the system has to search and compare those (conflict
// detection, duplicate check, CHED Form 3 sorting).
//
// Uses Node's crypto, so only import this from route handlers / server libs.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export const ENCRYPTED_FIELDS = [
  'contact_number',
  'spouse_contact',
  'fam_mother_contact',
  'fam_father_contact',
  'fam_guardian_contact',
  'fam_emergency_contact_number',
  'fam_mother_employment',
  'fam_father_employment',
  'fam_guardian_employment',
  'health_condition',
  // Oct 12 2026: special classifications, which RA 10173 treats as
  // sensitive personal information (manuscript Ch. 1 inputs).
  'lgbtqi_member',
  'disability',
  'solo_parent',
  'indigenous_member',
  'underprivileged',
]
const ENCRYPTED_SET = new Set(ENCRYPTED_FIELDS)
const PREFIX = 'enc:v1:'
let warned = false

function getKey() {
  const raw = (process.env.FIELD_ENCRYPTION_KEY || '').trim()
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  if (!warned) {
    warned = true
    console.error(
      'FIELD_ENCRYPTION_KEY is missing or not 64 hex characters: sensitive fields are being saved WITHOUT app-level encryption.'
    )
  }
  return null
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptText(value) {
  if (typeof value !== 'string' || value === '' || isEncrypted(value)) return value
  const key = getKey()
  if (!key) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`
}

export function decryptText(value) {
  if (!isEncrypted(value)) return value
  const key = getKey()
  if (!key) return ''
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch (err) {
    console.error('A protected field could not be unlocked (wrong key or edited value):', err.message)
    return ''
  }
}

function mapSiblings(list, fn) {
  if (!Array.isArray(list)) return list
  return list.map((s) => (s && typeof s === 'object' && typeof s.contact === 'string' ? { ...s, contact: fn(s.contact) } : s))
}

// Use on any object about to be written to `applications` (insert/update).
export function encryptApplicationFields(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  for (const key of Object.keys(out)) {
    if (ENCRYPTED_SET.has(key)) out[key] = encryptText(out[key])
  }
  if ('fam_siblings' in out) out.fam_siblings = mapSiblings(out.fam_siblings, encryptText)
  return out
}

// Use on any `applications` row read back before using or returning it.
export function decryptApplicationFields(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  for (const key of Object.keys(out)) {
    if (ENCRYPTED_SET.has(key)) out[key] = decryptText(out[key])
  }
  if ('fam_siblings' in out) out.fam_siblings = mapSiblings(out.fam_siblings, decryptText)
  return out
}

export function decryptApplicationRows(rows) {
  return Array.isArray(rows) ? rows.map(decryptApplicationFields) : rows
}
