// Oct 7 2026: one-time step after turning on app-level field encryption
// (app/lib/fieldCrypto.js). New saves are encrypted automatically; this
// encrypts the values that were saved BEFORE, so nothing sensitive stays
// readable in the Supabase Table Editor.
//
// Run from the project folder, with FIELD_ENCRYPTION_KEY already in
// .env.local (the SAME key as in Vercel):
//   node --env-file=.env.local scripts/encrypt-existing-fields.mjs
// Add --dry-run to only count what would change.
// Safe to run more than once: values that are already encrypted are skipped.

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'

const FIELDS = [
  'contact_number', 'spouse_contact', 'fam_mother_contact', 'fam_father_contact', 'fam_guardian_contact',
  'fam_emergency_contact_number', 'fam_mother_employment', 'fam_father_employment', 'fam_guardian_employment',
  'health_condition',
]
const PREFIX = 'enc:v1:'
const dryRun = process.argv.includes('--dry-run')

const keyHex = (process.env.FIELD_ENCRYPTION_KEY || '').trim()
if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
  console.error('FIELD_ENCRYPTION_KEY in .env.local must be 64 hex characters. Nothing was changed.')
  process.exit(1)
}
const key = Buffer.from(keyHex, 'hex')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function enc(value) {
  if (typeof value !== 'string' || value === '' || value.startsWith(PREFIX)) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`
}

const { data: rows, error } = await supabase.from('applications').select(['id', ...FIELDS, 'fam_siblings'].join(', '))
if (error) {
  console.error('Could not read applications:', error.message)
  process.exit(1)
}

let changedRows = 0
let changedValues = 0
for (const row of rows) {
  const patch = {}
  for (const f of FIELDS) {
    const next = enc(row[f])
    if (next !== row[f]) {
      patch[f] = next
      changedValues++
    }
  }
  if (Array.isArray(row.fam_siblings) && row.fam_siblings.some((s) => s && typeof s.contact === 'string' && s.contact && !s.contact.startsWith(PREFIX))) {
    patch.fam_siblings = row.fam_siblings.map((s) => (s && typeof s.contact === 'string' ? { ...s, contact: enc(s.contact) } : s))
    changedValues++
  }
  if (Object.keys(patch).length === 0) continue
  changedRows++
  if (!dryRun) {
    const { error: upErr } = await supabase.from('applications').update(patch).eq('id', row.id)
    if (upErr) {
      console.error(`Row ${row.id} failed:`, upErr.message)
      process.exit(1)
    }
  }
}
console.log(`${dryRun ? '[dry run] would encrypt' : 'Encrypted'} ${changedValues} values in ${changedRows} of ${rows.length} applications.`)
