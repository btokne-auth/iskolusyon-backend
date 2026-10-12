// Oct 12 2026 (manuscript Ch. 1: audit logs "tracking all actions taken
// within the system"): applicant-side events go to the same Activity Log
// as admin actions, under the "Applicants" category. Before this, only
// admin actions were logged.
//
// Logged: account created, sign-ins, failed sign-ins and lockouts, wrong
// sign-in codes, password resets, section and final submissions, and
// appeal/reschedule requests. Never logged: passwords, codes, or any
// answer from the application itself.
//
// Best effort: a failed log write never blocks what the applicant did.
// `kind` is 'done' or 'warn' here (audit_log.kind allows done/warn/info
// after the Oct 12 migration).

import { supabase } from '@/app/supabaseClient'

function clean(text, max = 160) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

export async function logApplicantActivity(who, action, kind = 'done') {
  try {
    const actor = clean(who, 120) || 'Applicant'
    const { error } = await supabase.from('audit_log').insert([
      { actor, action: clean(action, 300), kind: kind === 'warn' ? 'warn' : 'done', category: 'Applicants' },
    ])
    if (error) console.error('Applicant activity log failed (non-blocking):', error.message)
  } catch (err) {
    console.error('Applicant activity log failed (non-blocking):', err?.message)
  }
}

// "Juan Dela Cruz (juan@email.com)", or just the email when there's no
// name yet.
export function applicantLabel(name, email) {
  const n = clean(name, 80)
  const e = clean(email, 120).toLowerCase()
  if (n && e) return `${n} (${e})`
  return n || e || 'Applicant'
}
