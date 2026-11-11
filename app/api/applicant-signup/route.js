import { NextResponse } from 'next/server'
import {
  startSignup,
  saveSignupProgress,
  sendVerificationCode,
  verifySignupCode,
} from '@/app/lib/applicantAccounts'
import { serverError } from '@/app/lib/safeError'
import { supabase } from '@/app/supabaseClient'
import { MINUTE, getClientIp, limitRequest } from '@/app/lib/rateLimit'
import { logApplicantActivity, applicantLabel } from '@/app/lib/activityLog'
import { validatePersonalInfo, errorSummary } from '@/app/lib/fieldValidation'
import { claimPassedCheck, getCheckStatus, isValidTokenShape } from '@/app/lib/signupResidencyCheck'
import { signupScreening, SCREENING_ANSWER_KEYS } from '@/app/lib/screening'

function screeningAnswers(source) {
  const s = source && typeof source === 'object' ? source : {}
  return Object.fromEntries(SCREENING_ANSWER_KEYS.map((k) => [k, s[k] ?? '']))
}

// One endpoint, four actions — mirrors the action-in-body pattern already
// used by /api/application (save vs submit) rather than spawning four
// near-identical route files for a single 4-step wizard.
//
// action: 'start'      { email, password }                    -> { accountId }
//         'save'       { accountId, academicInfo, personalInfo } -> { success }
//         'send-code'  { accountId, email }                    -> { success } (also used to resend)
//         'verify'     { accountId, code }                     -> { success, name } + sets session cookie
export async function POST(request) {
  try {
    const body = await request.json()
    const action = body.action

    if (action === 'start') {
      // Oct 7 2026: at most 10 new sign-ups per network address per hour
      // (a campus can share one address, so not lower).
      const limited = await limitRequest(`signup-start:ip:${getClientIp(request)}`, 10, 60 * MINUTE,
        'Too many sign-ups from this network. Please try again later.')
      if (limited) return limited
      // Nov 2026 (panel revisions S3/S4): no account without a passed
      // residency check (a Voter's ID or Certification read as a COMELEC
      // record with a Calamba address). Checked here on the server too.
      const token = String(body.residencyToken || '')
      const check = isValidTokenShape(token) ? await getCheckStatus(token) : { status: 'none' }
      if (check.status !== 'passed') {
        return NextResponse.json({ error: 'Please complete the residency check (Voter\'s ID) first.', residency: true }, { status: 400 })
      }
      // Nov 2026 (panel revisions S3/S4/S2): the academic screening too,
      // before any account exists (app/lib/screening.js).
      const answers = screeningAnswers(body.screening)
      const screen = signupScreening(answers)
      if (!screen.complete) {
        return NextResponse.json({ error: screen.invalid || 'Please answer the academic standing questions first.', screening: true }, { status: 400 })
      }
      if (!screen.passed) {
        return NextResponse.json({ error: screen.reasons.join(' '), screening: true, reasons: screen.reasons }, { status: 400 })
      }
      // The report card (Form 138) read at sign-up: a report card with no
      // grade below 75. Not asked of Old Curriculum / ALS completers.
      const needsCard = answers.applyingAs !== 'Old Curriculum and ALS Completer'
      const gradeToken = String(body.gradeToken || '')
      if (needsCard) {
        const card = isValidTokenShape(gradeToken) ? await getCheckStatus(gradeToken) : { status: 'none' }
        if (card.status !== 'passed') {
          return NextResponse.json({ error: 'Please upload your report card (Form 138) and wait for it to be checked.', grades: true }, { status: 400 })
        }
      }
      const result = await startSignup(body.email, body.password)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      const accountEmail = String(body.email || '').trim().toLowerCase()
      const claimed = await claimPassedCheck(token, { accountId: result.accountId, email: accountEmail })
      if (claimed.error) return NextResponse.json({ error: claimed.error, residency: true }, { status: 400 })
      if (needsCard) {
        const claimedCard = await claimPassedCheck(gradeToken, { accountId: result.accountId, email: accountEmail })
        if (claimedCard.error) return NextResponse.json({ error: claimedCard.error, grades: true }, { status: 400 })
      }
      // The screening answers are kept with the sign-up and can't be changed
      // later in sign-up (see 'save') or in the portal.
      await saveSignupProgress(result.accountId, { academicInfo: answers })
      return NextResponse.json({ success: true, accountId: result.accountId })
    }

    if (action === 'save') {
      if (!body.accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
      // Oct 21 2026: the same rules as the form, checked here too so they
      // can't be skipped (birthdate not today or later, an 11-digit 09
      // mobile number, a Calamba barangay and an address in Calamba).
      if (body.personalInfo && typeof body.personalInfo === 'object') {
        const problems = validatePersonalInfo(body.personalInfo, { signup: true })
        if (problems.length) {
          const fieldErrors = Object.fromEntries(problems.map((p) => [p.field, p.message]))
          return NextResponse.json({ error: errorSummary(problems), fieldErrors }, { status: 400 })
        }
      }
      // Nov 2026: the screening answers given before the account was made
      // always win over anything sent later.
      let academicInfo = body.academicInfo
      if (academicInfo && typeof academicInfo === 'object') {
        const { data: pending } = await supabase
          .from('applicant_accounts')
          .select('pending_academic_info')
          .eq('id', body.accountId)
          .maybeSingle()
        academicInfo = { ...academicInfo, ...screeningAnswers(pending?.pending_academic_info) }
      }
      const result = await saveSignupProgress(body.accountId, {
        academicInfo,
        personalInfo: body.personalInfo,
      })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === 'send-code') {
      if (!body.accountId) {
        return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
      }
      // Oct 7 2026: one code per minute per account, and 20 per network
      // address per hour, so nobody can flood an inbox. The code always goes
      // to the email saved at step 1 (see sendVerificationCode).
      const limitedAccount = await limitRequest(`signup-code:account:${body.accountId}`, 1, MINUTE)
      if (limitedAccount) return limitedAccount
      const limitedIp = await limitRequest(`signup-code:ip:${getClientIp(request)}`, 20, 60 * MINUTE)
      if (limitedIp) return limitedIp
      const result = await sendVerificationCode(body.accountId)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 502 })
      return NextResponse.json({ success: true })
    }

    if (action === 'verify') {
      if (!body.accountId || !body.code) {
        return NextResponse.json({ error: 'Missing accountId or code' }, { status: 400 })
      }
      const result = await verifySignupCode(body.accountId, body.code)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
      await logApplicantActivity(applicantLabel(result.displayName, result.account.email), 'New applicant account created (email verified)')
      // Nov 2026: the Voter's ID checked before the account existed gets the
      // applicant's name now that it is known.
      try {
        await supabase.from('documents').update({ applicant_name: result.displayName })
          .eq('applicant_user_id', result.account.id).is('applicant_name', null)
      } catch (nameErr) {
        console.error('Could not name the sign-up Voter\'s ID (non-blocking):', nameErr)
      }

      // Nov 2026 (panel revision S4): no session here any more. The new
      // applicant signs in once with email, password and a login code (the
      // same two-step sign-in as every later visit), which confirms a real
      // person who knows the password and owns the inbox.
      return NextResponse.json({ success: true, name: result.displayName, email: result.account.email })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return serverError(err, 'api/applicant-signup')
  }
}
