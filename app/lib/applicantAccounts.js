// ---------- Real applicant accounts (User Account Module) ----------
//
// Was formally Ivy's scope per the "MOST UPDATED MEMBER ROLES AND
// RESPONSIBILITIES" doc; building it now since she isn't. Password hashing
// reuses the exact scrypt helpers already proven out for admin_accounts —
// no new crypto approach introduced. Uses Node's `crypto` module, so (like
// adminAccounts.js) this must only be imported from normal Node route
// handlers, never from middleware.js.
//
// Deliberate scope for this build (decided Sept 19, 2026):
//  - Login is email + password only. No per-login OTP yet — that's Ivy's
//    spec (signup.html / index.html both show a "send code, then verify"
//    step) but Resend's free tier only delivers to the developer's own
//    inbox until the .dev domain is claimed, so a real OTP-every-login
//    flow can't be tested against real applicant emails today. Deferred,
//    not forgotten.
//  - Signup DOES require a one-time email-verification code before the
//    account activates, matching her spec ("account will be created upon
//    successful verification") — same Resend-sandbox limitation applies,
//    but it's a one-time cost per signup rather than every login, and it's
//    fully testable end-to-end using the developer's own email as a stand-in
//    applicant right now.

import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'crypto'
import { Resend } from 'resend'
import { supabase } from '@/app/supabaseClient'
import { personalInfoToColumns, academicInfoToColumns } from './applicationColumns'

const resend = new Resend(process.env.RESEND_API_KEY)
const KEY_LENGTH = 64
const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5

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

function hashOtp(code) {
  return createHash('sha256').update(code).digest('hex')
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

// Basic server-side mirror of the password rule shown in signup.html's
// field-note ("min 8 chars, 1 number, 1 uppercase, 1 lowercase, 1 special").
export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) return false
  if (!/[0-9]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  return true
}

// Step 1 of signup — creates (or re-uses, if the previous attempt never
// finished verifying) an unverified account row. Returns { accountId } or
// { error }.
export async function startSignup(email, password) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!validatePasswordStrength(password)) {
    return {
      error:
        'Password must be at least 8 characters and include a number, an uppercase letter, a lowercase letter, and a special character.',
    }
  }

  const { data: existing, error: findError } = await supabase
    .from('applicant_accounts')
    .select('id, email_verified')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (findError) return { error: findError.message }

  if (existing && existing.email_verified) {
    return { error: 'An account with this email already exists. Try logging in instead.' }
  }

  const passwordHash = hashPassword(password)

  if (existing) {
    // Unverified leftover from an abandoned signup attempt — reuse the row,
    // reset its password to whatever they just typed (they own the email
    // until it's verified, so this is safe).
    const { error: updateError } = await supabase
      .from('applicant_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', existing.id)
    if (updateError) return { error: updateError.message }
    return { accountId: existing.id }
  }

  const { data, error } = await supabase
    .from('applicant_accounts')
    .insert([{ email: normalizedEmail, password_hash: passwordHash }])
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { accountId: data.id }
}

// Steps 2/3 of signup — stages Program Application + Personal Information
// so it's ready to copy into a real `applications` row once verified.
export async function saveSignupProgress(accountId, { academicInfo, personalInfo }) {
  const updates = {}
  if (academicInfo !== undefined) updates.pending_academic_info = academicInfo
  if (personalInfo !== undefined) updates.pending_personal_info = personalInfo
  if (Object.keys(updates).length === 0) return { success: true }

  const { error } = await supabase.from('applicant_accounts').update(updates).eq('id', accountId)
  if (error) return { error: error.message }
  return { success: true }
}

// Generates a 6-digit code, stores its hash + expiry, and emails it.
// Fire-and-report — an email failure is surfaced to the caller (unlike the
// submission-confirmation email elsewhere, verification is on the critical
// path so the applicant needs to know if it didn't send).
export async function sendVerificationCode(accountId, email) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('applicant_accounts')
    .update({ otp_hash: hashOtp(code), otp_expires_at: expiresAt, otp_attempts: 0 })
    .eq('id', accountId)

  if (dbError) return { error: dbError.message }

  try {
    await resend.emails.send({
      from: 'Iskolusyon <onboarding@resend.dev>',
      to: email,
      subject: 'Your Iskolusyon verification code',
      html: `
        <p>Hi,</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        <p>— City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    return {
      error:
        'Could not send the verification email right now (' +
        err.message +
        '). Note: while this project is on Resend\'s free tier, verification emails only deliver to the developer\'s own registered inbox — not arbitrary applicant addresses.',
    }
  }

  return { success: true }
}

// Step 4 — checks the code, marks the account verified, and copies the
// staged Program Application / Personal Information into a real
// `applications` row (status 'draft'), linked via applicant_user_id.
// Returns { account, application } on success, { error, applicationExists }
// on failure (applicationExists lets the caller send a friendlier message
// if this email already has a submitted application under a matching name).
export async function verifySignupCode(accountId, code) {
  const { data: account, error: findError } = await supabase
    .from('applicant_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle()

  if (findError) return { error: findError.message }
  if (!account) return { error: 'Account not found. Please start signup again.' }
  if (account.email_verified) return { error: 'This account is already verified. Please log in.' }
  if (!account.otp_hash || !account.otp_expires_at) {
    return { error: 'No verification code was sent yet. Request a new code first.' }
  }
  if (new Date(account.otp_expires_at).getTime() < Date.now()) {
    return { error: 'This code has expired. Request a new one.' }
  }
  if (account.otp_attempts >= OTP_MAX_ATTEMPTS) {
    return { error: 'Too many incorrect attempts. Request a new code.' }
  }

  if (hashOtp(String(code || '').trim()) !== account.otp_hash) {
    await supabase
      .from('applicant_accounts')
      .update({ otp_attempts: account.otp_attempts + 1 })
      .eq('id', accountId)
    return { error: 'Incorrect code. Please try again.' }
  }

  const now = new Date().toISOString()
  const { error: activateError } = await supabase
    .from('applicant_accounts')
    .update({
      email_verified: true,
      verified_at: now,
      otp_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
    })
    .eq('id', accountId)

  if (activateError) return { error: activateError.message }

  // Build the applicant display name from staged Personal Information, if
  // they filled it in during step 3.
  const pi = account.pending_personal_info || {}
  const ai = account.pending_academic_info || {}
  const displayName = [pi.firstName, pi.lastName].filter(Boolean).join(' ').trim()

  // Create the real `applications` row now, pre-filled with whatever they
  // entered during signup, so they land in the portal without re-typing
  // Program Application / Personal Information. Matches by name the same
  // way the rest of the app does (no existing row should match a brand new
  // account, but if one somehow does — e.g. they'd started a draft under
  // the same name before accounts existed — we update it rather than
  // create a duplicate, and attach applicant_user_id either way).
  let application = null
  if (displayName) {
    const now = new Date().toISOString()
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .ilike('applicant_name', displayName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const columns = {
      applicant_email: account.email,
      applicant_user_id: accountId,
      updated_at: now,
      ...personalInfoToColumns(pi),
      ...academicInfoToColumns(ai),
    }

    if (existingApp) {
      const { data, error } = await supabase
        .from('applications')
        .update(columns)
        .eq('id', existingApp.id)
        .select()
        .single()
      if (!error) application = data
    } else {
      const { data, error } = await supabase
        .from('applications')
        .insert([{ applicant_name: displayName, current_step: 1, status: 'draft', ...columns }])
        .select()
        .single()
      if (!error) application = data
    }
  }

  return { account: { ...account, email_verified: true }, application, displayName }
}

export async function verifyApplicantCredentials(email, password) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password) return null

  const { data, error } = await supabase
    .from('applicant_accounts')
    .select('id, email, password_hash, email_verified')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !data) return null
  if (!data.email_verified) return { unverified: true }
  if (!verifyPassword(password, data.password_hash)) return null

  return { id: data.id, email: data.email }
}
