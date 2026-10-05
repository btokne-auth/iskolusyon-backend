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

// Oct 5 2026: the roster columns (never password_hash).
const ACCOUNT_COLUMNS =
  'name, email, is_super_admin, role, access_from, access_until, created_at, must_change_password, temp_password_expires_at'

// ---------- Roles (Oct 5 2026) ----------
// 'super_admin' and 'admin' run the console. 'registrar' (Office of the
// Registrar) only posts allowances and sees Dashboard counts. 'lgu' (view
// only) only sees CHED Form 3 reports released to the LGU, and only between
// access_from and access_until (inclusive, Manila dates).
export const ROLE_KEYS = ['admin', 'super_admin', 'registrar', 'lgu']
export const ROLE_LABELS = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  registrar: 'Office of the Registrar',
  lgu: 'LGU (view only)',
}

// is_super_admin stays the source of truth for Super Admins (older code and
// the seed script only set that column).
export function effectiveRole(row) {
  if (!row) return null
  if (row.is_super_admin) return 'super_admin'
  if (row.role === 'registrar' || row.role === 'lgu') return row.role
  return 'admin'
}

// Today's date in Manila as YYYY-MM-DD, the same day boundary the
// Acceptance Start/End dates use.
export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 'active' | 'not_started' | 'ended' for an LGU account; always 'active'
// for every other role.
export function accessState(row) {
  if (effectiveRole(row) !== 'lgu') return 'active'
  const today = manilaToday()
  if (!row.access_from || !row.access_until) return 'ended'
  if (today < String(row.access_from)) return 'not_started'
  if (today > String(row.access_until)) return 'ended'
  return 'active'
}

export function formatAccessDate(ymd) {
  if (!ymd || !DATE_RE.test(String(ymd))) return String(ymd || '')
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// The sign-in refusal shown to an LGU account outside its window, or null.
export function accessRefusal(row) {
  const state = accessState(row)
  if (state === 'not_started') return `Your access starts on ${formatAccessDate(row.access_from)}.`
  if (state === 'ended') return 'Your access has ended. Please contact City College of Calamba.'
  return null
}

export async function getAdminAccount(email) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail) return null
  const { data, error } = await supabase
    .from('admin_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data || null
}
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
    .select('name, email, password_hash, is_super_admin, role, access_from, access_until, must_change_password, temp_password_expires_at')
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
    role: effectiveRole(data),
    accessFrom: data.access_from || null,
    accessUntil: data.access_until || null,
    accessRefusal: accessRefusal(data),
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
    .select(ACCOUNT_COLUMNS)
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
// Oct 5 2026: `role` is one of ROLE_KEYS (`isSuperAdmin` still works for
// older callers). An LGU account needs accessFrom/accessUntil (YYYY-MM-DD).
export function checkAccessDates(accessFrom, accessUntil) {
  if (!DATE_RE.test(String(accessFrom || '')) || !DATE_RE.test(String(accessUntil || ''))) {
    return 'Please set both access dates for the LGU account.'
  }
  if (String(accessUntil) < String(accessFrom)) return 'The access end date must be on or after the start date.'
  return null
}

export async function inviteAdminAccount({ name, email, isSuperAdmin, role, accessFrom, accessUntil }) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const trimmedName = (name || '').trim()
  const finalRole = ROLE_KEYS.includes(role) ? role : isSuperAdmin ? 'super_admin' : 'admin'

  if (!trimmedName) return { error: 'Full name is required.' }
  if (!normalizedEmail) return { error: 'Email is required.' }
  if (finalRole === 'lgu') {
    const dateProblem = checkAccessDates(accessFrom, accessUntil)
    if (dateProblem) return { error: dateProblem }
  }

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
        is_super_admin: finalRole === 'super_admin',
        role: finalRole,
        access_from: finalRole === 'lgu' ? accessFrom : null,
        access_until: finalRole === 'lgu' ? accessUntil : null,
        must_change_password: true,
        temp_password_expires_at: tempExpiryIso(),
      },
    ])
    .select(ACCOUNT_COLUMNS)
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
    .select(ACCOUNT_COLUMNS)
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
    .select('name, email, password_hash, is_super_admin, role, access_from, access_until, must_change_password, temp_password_expires_at')
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

  return {
    account: {
      name: account.name,
      email: account.email,
      isSuperAdmin: !!account.is_super_admin,
      role: effectiveRole(account),
      accessRefusal: accessRefusal(account),
    },
  }
}

// Oct 5 2026: a Super Admin changes an LGU account's access window.
export async function updateLguAccess(email, accessFrom, accessUntil) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const dateProblem = checkAccessDates(accessFrom, accessUntil)
  if (dateProblem) return { error: dateProblem }
  const current = await getAdminAccount(normalizedEmail)
  if (!current) return { error: 'That account no longer exists.' }
  if (effectiveRole(current) !== 'lgu') return { error: 'Only LGU accounts have access dates.' }
  const { data, error } = await supabase
    .from('admin_accounts')
    .update({ access_from: accessFrom, access_until: accessUntil })
    .eq('email', normalizedEmail)
    .select(ACCOUNT_COLUMNS)
    .maybeSingle()
  if (error) return { error: error.message }
  return { account: data }
}

// Oct 5 2026: guards "the only Registrar account can't be removed".
export async function countRole(role) {
  const { count, error } = await supabase
    .from('admin_accounts')
    .select('email', { count: 'exact', head: true })
    .eq('role', role)
    .eq('is_super_admin', false)
  if (error) throw new Error(error.message)
  return count || 0
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
    .select('name, email, is_super_admin, role')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
