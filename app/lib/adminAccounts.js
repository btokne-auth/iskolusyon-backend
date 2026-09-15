// ---------- Per-admin accounts (replaces the shared passcode) ----------
//
// Still a placeholder ahead of a real User Account Module (no roles, no
// invite-by-email, no forgot-password, no session timeout — matches the
// PR #2 mockup's *look* of individual sign-in without building the parts
// that need a real backend). Each admin has their own row in Supabase's
// `admin_accounts` table: name, email, password_hash.
//
// Passwords are hashed with Node's built-in `crypto.scrypt` (no new
// dependency needed) as "<saltHex>:<hashHex>". This file uses Node's
// `crypto` module, so it must only be imported from normal Node runtime
// code (API routes), never from middleware.js (Edge runtime).

import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { supabase } from '@/app/supabaseClient'

const KEY_LENGTH = 64

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false
  const [salt, hash] = storedHash.split(':')
  const hashBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH)
  if (hashBuffer.length !== candidateBuffer.length) return false
  return timingSafeEqual(hashBuffer, candidateBuffer)
}

// Returns { name, email } on success, or null if the email/password don't
// match a row in admin_accounts.
export async function verifyAdminCredentials(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail || !password) return null

  const { data, error } = await supabase
    .from('admin_accounts')
    .select('name, email, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !data) return null
  if (!verifyPassword(password, data.password_hash)) return null

  return { name: data.name, email: data.email }
}