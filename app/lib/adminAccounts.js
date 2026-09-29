// ---------- Per-admin accounts (replaces the shared passcode) ----------
//
// Each admin has their own row in Supabase's `admin_accounts` table: name,
// email, password_hash, is_super_admin, plus (Sept 29, 2026)
// must_change_password and temp_password_expires_at for the invite flow.
//
// Invite flow (Sept 29, 2026, MCL-style, agreed with Pau; Ivy's progress-
// table comment allowed either this or a setup link): a Super Admin
// re-enters their own password, then invites a new admin by name, email
// and role. The system generates a temporary password, emails it, and
// the new admin must choose their own password on first sign-in. A
// temporary password stops working after 7 days. A Super Admin "reset"
// works the same way (new temporary password, emailed).
//
// `is_super_admin` was added Sept 18, 2026 alongside the admin portal
// rebuild, to back admin.html's Super-Admin-only nav items (Admin
// Accounts, System & Activity). See docs/migrations/
// 2026-09-18-admin-roles-and-announcements.sql — defaults to TRUE so any
// account seeded before this change keeps full access.
//
// Passwords are hashed with Node's built-in `crypto.scrypt` (no new
// dependency needed) as "<saltHex>:<hashHex>". This file uses Node's
// `crypto` module, so it must only be imported from normal Node runtime
// code (API routes), never from middleware.js (Edge runtime).

import { scryptSync, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { supabase } from '@/app/supabaseClient'

const KEY_LENGTH = 64
export const TEMP_PASSWORD_DAYS = 7
export const MIN_PASSWORD_LENGTH = 8

// 12 characters from an alphabet without look-alikes (no 0/O, 1/l/I), so
// it can be read off an email or a screen and typed without mistakes.
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export function generateTempPassword() {
  let out = ''
  for (let i = 0; i < 12; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]
  return out
}

function tempExpiryIso() {
  return new Date(Date.now() + TEMP_PASSWORD_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

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

// Returns { name, email, isSuperAdmin, mustChangePassword, tempExpired } on
// success, or null if the email/password don't match a row in
// admin_accounts. Callers decide what a temporary/expired password means
// (the login route sends the admin to set a new password; the Super Admin
// re-confirm check only needs the password to match).
export async function verifyAdminCredentials(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail || !password) return null

  const { data, error } = await supabase
    .from('admin_accounts')
    .select('name, email, password_hash, is_super_admin, must_change_password, temp_password_expires_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !data) return null
  if (!verifyPassword(password, data.password_hash)) return null

  const mustChangePassword = !!data.must_change_password
  const tempExpired =
    mustChangePassword &&
    !!data.temp_password_expires_at &&
    new Date(data.temp_password_expires_at).getTime() < Date.now()

  return {
    name: data.name,
    email: data.email,
    isSuperAdmin: !!data.is_super_admin,
    mustChangePassword,
    tempExpired,
  }
}

// Used for the "re-enter your password" check before a Super Admin
// invites, resets or removes an admin.
export async function confirmOwnPassword(email, password) {
  const account = await verifyAdminCredentials(email, password)
  return !!account && !account.mustChangePassword
}

// Read-only list for the Admin Accounts panel — never returns password_hash.
export async function listAdminAccounts() {
  const { data, error } = await supabase
    .from('admin_accounts')
    .select('name, email, is_super_admin, created_at, must_change_password, temp_password_expires_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// Sept 24 2026: replaced scripts/seed-admin-account.mjs for day-to-day use
// (the script still works as a break-glass fallback). Create-only, not an
// upsert: a pre-existing email is rejected rather than silently
// overwriting that person's real password.
//
// Sept 29 2026: now an invite. The system generates the temporary
// password (the Super Admin never types one), and the account must set
// its own password on first sign-in. Returns the plain temporary password
// once so the route can email it; it is never stored in plain text.
export async function inviteAdminAccount({ name, email, isSuperAdmin }) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const trimmedName = (name || '').trim()

  if (!trimmedName) return { error: 'Full name is required.' }
  if (!normalizedEmail) return { error: 'Email is required.' }

  const { data: existing, error: lookupError } = await supabase
    .from('admin_accounts')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (lookupError) return { error: lookupError.message }
  if (existing) return { error: 'An admin account with that email already exists.' }

  const tempPassword = generateTempPassword()
  const { data, error } = await supabase
    .from('admin_accounts')
    .insert([
      {
        name: trimmedName,
        email: normalizedEmail,
        password_hash: hashPassword(tempPassword),
        is_super_admin: !!isSuperAdmin,
        must_change_password: true,
        temp_password_expires_at: tempExpiryIso(),
      },
    ])
    .select('name, email, is_super_admin, created_at, must_change_password, temp_password_expires_at')
    .single()

  if (error) return { error: error.message }
  return { account: data, tempPassword }
}

// Sept 24 2026, reworked Sept 29 2026: a Super Admin "reset" now issues a
// fresh temporary password (emailed), and the admin sets their own on
// next sign-in, same as a new invite.
export async function resetAdminToTempPassword(email) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail) return { error: 'Missing email.' }

  const tempPassword = generateTempPassword()
  const { data, error } = await supabase
    .from('admin_accounts')
    .update({
      password_hash: hashPassword(tempPassword),
      must_change_password: true,
      temp_password_expires_at: tempExpiryIso(),
    })
    .eq('email', normalizedEmail)
    .select('name, email, is_super_admin, created_at, must_change_password, temp_password_expires_at')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'That admin account no longer exists.' }
  return { account: data, tempPassword }
}

// First sign-in after an invite or reset: the admin replaces their
// temporary password with their own. Only allowed while the account is
// still flagged must_change_password and the temporary password hasn't
// expired.
export async function setOwnPasswordFromTemp(email, newPassword) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail) return { error: 'Missing email.' }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }

  const { data: account, error: lookupError } = await supabase
    .from('admin_accounts')
    .select('name, email, password_hash, is_super_admin, must_change_password, temp_password_expires_at')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (lookupError) return { error: lookupError.message }
  if (!account) return { error: 'That admin account no longer exists.' }
  if (!account.must_change_password) return { error: 'This account already has its own password. Please sign in.' }
  if (account.temp_password_expires_at && new Date(account.temp_password_expires_at).getTime() < Date.now()) {
    return { error: 'Your temporary password has expired. Ask a Super Admin to send you a new one.' }
  }
  if (verifyPassword(newPassword, account.password_hash)) {
    return { error: 'Please choose a password different from your temporary one.' }
  }

  const { error } = await supabase
    .from('admin_accounts')
    .update({ password_hash: hashPassword(newPassword), must_change_password: false, temp_password_expires_at: null })
    .eq('email', normalizedEmail)
  if (error) return { error: error.message }

  return { account: { name: account.name, email: account.email, isSuperAdmin: !!account.is_super_admin } }
}

// Sept 22, 2026: removal. Two guards live here rather than only in the route so any future caller gets
// them too: never let the roster go to zero Super Admins (the console
// would have no way back in), and the route layers a "not deleting your
// own signed-in account" check on top using the cookie's email.
export async function countSuperAdmins() {
  const { count, error } = await supabase
    .from('admin_accounts')
    .select('email', { count: 'exact', head: true })
    .eq('is_super_admin', true)

  if (error) throw new Error(error.message)
  return count || 0
}

export async function deleteAdminAccount(email) {
  const { data, error } = await supabase
    .from('admin_accounts')
    .delete()
    .eq('email', email)
    .select('name, email, is_super_admin')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
