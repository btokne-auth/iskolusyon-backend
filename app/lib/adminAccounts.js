// ---------- Per-admin accounts (replaces the shared passcode) ----------
//
// Still a placeholder ahead of a real User Account Module (no invite-by-
// email, no forgot-password, no session timeout — matches the PR #2
// mockup's *look* of individual sign-in without building the parts that
// need a real backend). Each admin has their own row in Supabase's
// `admin_accounts` table: name, email, password_hash, is_super_admin.
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

// Returns { name, email, isSuperAdmin } on success, or null if the
// email/password don't match a row in admin_accounts.
export async function verifyAdminCredentials(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (!normalizedEmail || !password) return null

  const { data, error } = await supabase
    .from('admin_accounts')
    .select('name, email, password_hash, is_super_admin')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !data) return null
  if (!verifyPassword(password, data.password_hash)) return null

  return { name: data.name, email: data.email, isSuperAdmin: !!data.is_super_admin }
}

// Read-only list for the Admin Accounts panel — never returns password_hash.
export async function listAdminAccounts() {
  const { data, error } = await supabase
    .from('admin_accounts')
    .select('name, email, is_super_admin, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// Sept 22, 2026: delete-only for now (see app/api/admin-accounts/route.js's
// DELETE handler for why invite/create is deliberately not built yet --
// there's no email infrastructure to hang a real invite flow on). Two
// guards live here rather than only in the route so any future caller gets
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
