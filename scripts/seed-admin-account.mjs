// Adds (or updates) one admin account in Supabase's admin_accounts table.
//
// Usage:
//   node scripts/seed-admin-account.mjs "Pauline Estira" pauline@ccc.edu.ph "your-password"
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// .env.local (same as the rest of the app).

import { readFileSync } from 'fs'
import { scryptSync, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value // last occurrence in the file wins
    }
  } catch {
    // .env.local not found — assume env vars are already set some other way
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  loadEnvLocal()

  const [name, email, password] = process.argv.slice(2)
  if (!name || !email || !password) {
    console.error('Usage: node scripts/seed-admin-account.mjs "Full Name" email@ccc.edu.ph "password"')
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const password_hash = hashPassword(password)

  const { error } = await supabase
    .from('admin_accounts')
    .upsert({ email: email.trim().toLowerCase(), name: name.trim(), password_hash }, { onConflict: 'email' })

  if (error) {
    console.error('Failed to save admin account:', error.message)
    process.exit(1)
  }

  console.log(`Saved admin account for ${name} <${email}>.`)
}

main()