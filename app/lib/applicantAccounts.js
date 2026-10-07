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
//  - Login is email + password, followed by a one-time login code (MFA) —
//    matches Ivy's spec (signup.html / index.html both show a "send code,
//    then verify" step). Same Resend-sandbox limitation as everything else
//    OTP-related here: codes only deliver to the developer's own inbox
//    until the .dev domain is claimed, not arbitrary applicant addresses,
//    but that's fine for dev/testing with Pau's own inbox as a stand-in.
//    (Login-time MFA was originally deferred earlier the same day pending
//    her bringing it back up — she has, see "Login-time MFA / OTP" below.)
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
import { safeErrorText, logServerError } from '@/app/lib/safeError'
import { encryptApplicationFields, decryptApplicationFields } from '@/app/lib/fieldCrypto'

const resend = new Resend(process.env.RESEND_API_KEY)

// Sept 23, 2026: iskolusyon.dev is now verified on Resend, so this no
// longer has to be the onboarding@resend.dev sandbox address (which could
// only ever deliver to the developer's own inbox). Configurable via env
// so a future domain change doesn't need another code patch.
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Iskolusyon <noreply@iskolusyon.dev>'
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

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

// A real (if simple) email format check — catches things like
// "name@" or "name@domain" with no TLD, which the old `.includes('@')`
// check let straight through (flagged when testing Forgot Password,
// Sept 19: "xavierestira@" was accepted and a reset code got sent for it).
function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
  if (!normalizedEmail || !isValidEmailFormat(normalizedEmail)) {
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

  if (findError) return { error: safeErrorText(findError, 'applicantAccounts') }

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
    if (updateError) return { error: safeErrorText(updateError, 'applicantAccounts') }
    return { accountId: existing.id }
  }

  const { data, error } = await supabase
    .from('applicant_accounts')
    .insert([{ email: normalizedEmail, password_hash: passwordHash }])
    .select('id')
    .single()

  if (error) return { error: safeErrorText(error, 'applicantAccounts') }
  return { accountId: data.id }
}

// Steps 2/3 of signup — stages Program Application + Personal Information
// so it's ready to copy into a real `applications` row once verified.
export async function saveSignupProgress(accountId, { academicInfo, personalInfo }) {
  const updates = {}
  if (academicInfo !== undefined) updates.pending_academic_info = academicInfo
  if (personalInfo !== undefined) updates.pending_personal_info = personalInfo
  if (Object.keys(updates).length === 0) return { success: true }

  // Oct 7 2026: only an account still in signup can be changed this way.
  const { error } = await supabase
    .from('applicant_accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('email_verified', false)
  if (error) return { error: safeErrorText(error, 'applicantAccounts') }
  return { success: true }
}

// Generates a 6-digit code, stores its hash + expiry, and emails it.
// Fire-and-report — an email failure is surfaced to the caller (unlike the
// submission-confirmation email elsewhere, verification is on the critical
// path so the applicant needs to know if it didn't send).
//
// Oct 7 2026 security fix (found while testing Ch. 3 Authentication): the
// code used to go to whatever email the browser sent, so someone could
// start a signup with another person's address, ask for the code to be sent
// to their OWN inbox, and end up with a "verified" account under an email
// they don't own. The code now always goes to the email saved on the
// account at step 1, and only for an account that isn't verified yet. The
// second argument is ignored and kept only so older callers don't break.
export async function sendVerificationCode(accountId, _ignoredEmail) { // eslint-disable-line no-unused-vars
  const { data: pendingAccount, error: pendingError } = await supabase
    .from('applicant_accounts')
    .select('id, email, email_verified')
    .eq('id', accountId)
    .maybeSingle()
  if (pendingError) return { error: safeErrorText(pendingError, 'applicantAccounts') }
  if (!pendingAccount) return { error: 'Account not found. Please start signup again.' }
  if (pendingAccount.email_verified) return { error: 'This account is already verified. Please log in.' }
  const email = pendingAccount.email

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('applicant_accounts')
    .update({ otp_hash: hashOtp(code), otp_expires_at: expiresAt, otp_attempts: 0 })
    .eq('id', accountId)

  if (dbError) return { error: safeErrorText(dbError, 'applicantAccounts') }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your Iskolusyon verification code',
      html: `
        <p>Hi,</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    const ref = logServerError(err, 'applicantAccounts email')
    return {
      error: 'Could not send the verification email right now. Please try again in a moment. (Ref: ' + ref + ')',
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

  if (findError) return { error: safeErrorText(findError, 'applicantAccounts') }
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

  if (activateError) return { error: safeErrorText(activateError, 'applicantAccounts') }

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
        .update(encryptApplicationFields(columns))
        .eq('id', existingApp.id)
        .select()
        .single()
      if (!error) application = data
    } else {
      const { data, error } = await supabase
        .from('applications')
        .insert([encryptApplicationFields({ applicant_name: displayName, current_step: 1, status: 'draft', ...columns })])
        .select()
        .single()
      if (!error) application = data
    }
  }
  application = decryptApplicationFields(application)

  return { account: { ...account, email_verified: true }, application, displayName }
}

// ---------- Password Reset and Recovery System ----------
// Listed under the User Account Module in the progress table: Forgot
// Password button, Account Lookup via Email Address, Forgot Password Reset
// Code Input Boxes, Forgot Password Code Countdown Timer, Password
// Visibility Toggle for New Password, Password Confirmation Validation,
// Password Reset Success pop-up/screen. The last three are already covered
// by shared UI (TextField's built-in visibility toggle, confirm-password
// matching, and ApplicantAuth's Alert component) — this file handles the
// first four: looking the account up, generating/emailing/checking the
// reset code, and applying the new password.
//
// Reuses the exact same otp_hash/otp_expires_at/otp_attempts columns as
// signup verification. Safe to share because an account is only ever in
// one state at a time: unverified accounts (mid-signup) can't reach this
// flow (rejected below), and once verified, signup's own verify step
// refuses to run again — so the two flows never race for the same row.

// Step 1 — looks the account up by email and, if found and verified,
// sends a reset code. Deliberately returns { success: true } even when no
// account matches (or the account exists but was never verified), rather
// than revealing which emails are registered — standard practice for a
// "forgot password" lookup, and consistent with not leaking account
// existence. The one case worth a distinct message is an unverified
// account, since "check your email" would be actively misleading there.
export async function requestPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !isValidEmailFormat(normalizedEmail)) {
    return { error: 'Please enter a valid email address.' }
  }

  const { data: account, error: findError } = await supabase
    .from('applicant_accounts')
    .select('id, email, email_verified')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (findError) return { error: safeErrorText(findError, 'applicantAccounts') }

  if (!account) {
    // No account — still report success so this endpoint can't be used to
    // enumerate registered emails.
    return { success: true }
  }
  if (!account.email_verified) {
    return { error: 'This account never finished email verification. Please sign up again instead of resetting a password.' }
  }

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('applicant_accounts')
    .update({ otp_hash: hashOtp(code), otp_expires_at: expiresAt, otp_attempts: 0 })
    .eq('id', account.id)

  if (dbError) return { error: safeErrorText(dbError, 'applicantAccounts') }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: account.email,
      subject: 'Reset your Iskolusyon password',
      html: `
        <p>Hi,</p>
        <p>We received a request to reset your Iskolusyon password. Your reset code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    const ref = logServerError(err, 'applicantAccounts email')
    return {
      error: 'Could not send the reset email right now. Please try again in a moment. (Ref: ' + ref + ')',
    }
  }

  return { success: true }
}

// Step 2 — checks the reset code and, if valid, sets the new password.
// Same expiry/attempt-limit checks as signup verification.
export async function resetPasswordWithCode(email, code, newPassword) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return { error: 'Missing email.' }
  if (!validatePasswordStrength(newPassword)) {
    return {
      error:
        'Password must be at least 8 characters and include a number, an uppercase letter, a lowercase letter, and a special character.',
    }
  }

  const { data: account, error: findError } = await supabase
    .from('applicant_accounts')
    .select('id, otp_hash, otp_expires_at, otp_attempts')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (findError) return { error: safeErrorText(findError, 'applicantAccounts') }
  if (!account) return { error: 'Could not find that account. Please request a new reset code.' }
  if (!account.otp_hash || !account.otp_expires_at) {
    return { error: 'No reset code was sent yet. Request one first.' }
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
      .eq('id', account.id)
    return { error: 'Incorrect code. Please try again.' }
  }

  const { error: updateError } = await supabase
    .from('applicant_accounts')
    .update({
      password_hash: hashPassword(newPassword),
      otp_hash: null,
      otp_expires_at: null,
      otp_attempts: 0,
    })
    .eq('id', account.id)

  if (updateError) return { error: safeErrorText(updateError, 'applicantAccounts') }
  return { success: true }
}

// ---------- Login-time MFA / OTP ----------
// Deferred at signup time (Sept 19) pending Pau bringing it back up — she
// has now (same day). Reuses the exact same otp_hash/otp_expires_at/
// otp_attempts columns and generateOtp()/hashOtp() helpers as signup
// verification and password reset, same reasoning as those: an account
// moves through one OTP-gated step at a time, so sharing the columns is
// safe in the common case. One real edge case worth knowing: if someone
// requests a password-reset code and then, in another tab, logs in with
// their still-known old password before finishing the reset, the login
// code overwrites the reset code (and vice versa) — the earlier code just
// stops working and has to be re-requested. Not a security hole, just a
// UX rough edge; not handled specially here.
//
// Flow: /api/applicant-login now has two actions instead of one —
// no action ('credentials': email+password) sends the OTP on success but
// does NOT set the session cookie yet, and 'verify' (accountId+code) checks
// the code and only then sets the cookie. See the two-stage LoginPanel in
// ApplicantAuth.js.

// Step 1 — after credentials check succeeds, generate + email a fresh
// login code. Does not touch the session cookie.
export async function sendLoginCode(accountId, email) {
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('applicant_accounts')
    .update({ otp_hash: hashOtp(code), otp_expires_at: expiresAt, otp_attempts: 0 })
    .eq('id', accountId)

  if (dbError) return { error: safeErrorText(dbError, 'applicantAccounts') }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your Iskolusyon login code',
      html: `
        <p>Hi,</p>
        <p>Someone (hopefully you) is logging in to your Iskolusyon account. Your login code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
        <p>This code expires in ${OTP_TTL_MINUTES} minutes. If this wasn't you, your password may be compromised, so reset it as soon as possible.</p>
        <p>City College of Calamba, Iskolusyon Scholarship System</p>
      `,
    })
  } catch (err) {
    const ref = logServerError(err, 'applicantAccounts email')
    return {
      error: 'Could not send the login code right now. Please try again in a moment. (Ref: ' + ref + ')',
    }
  }

  return { success: true }
}

// Step 2 — checks the login code. Same expiry/attempt-limit rules as the
// other two OTP flows. Does not touch the password; the caller (the route)
// looks up the account fresh and builds the session cookie on success.
export async function verifyLoginCode(accountId, code) {
  const { data: account, error: findError } = await supabase
    .from('applicant_accounts')
    .select('id, email, otp_hash, otp_expires_at, otp_attempts')
    .eq('id', accountId)
    .maybeSingle()

  if (findError) return { error: safeErrorText(findError, 'applicantAccounts') }
  if (!account) return { error: 'Account not found. Please log in again.' }
  if (!account.otp_hash || !account.otp_expires_at) {
    return { error: 'No login code was sent yet. Please log in again.' }
  }
  if (new Date(account.otp_expires_at).getTime() < Date.now()) {
    return { error: 'This code has expired. Request a new one.' }
  }
  if (account.otp_attempts >= OTP_MAX_ATTEMPTS) {
    return { error: 'Too many incorrect attempts. Please log in again to request a new code.' }
  }

  if (hashOtp(String(code || '').trim()) !== account.otp_hash) {
    await supabase
      .from('applicant_accounts')
      .update({ otp_attempts: account.otp_attempts + 1 })
      .eq('id', accountId)
    return { error: 'Incorrect code. Please try again.' }
  }

  const { error: clearError } = await supabase
    .from('applicant_accounts')
    .update({ otp_hash: null, otp_expires_at: null, otp_attempts: 0 })
    .eq('id', accountId)

  if (clearError) return { error: safeErrorText(clearError, 'applicantAccounts') }
  return { success: true, account }
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
