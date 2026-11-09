import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { requireConsoleRole } from '@/app/lib/adminRoles'
import {
  listAdminAccounts,
  countSuperAdmins,
  deleteAdminAccount,
  inviteAdminAccount,
  resetAdminToTempPassword,
  confirmOwnPassword,
  effectiveRole,
  accessState,
  updateLguAccess,
  countRole,
  formatAccessDate,
  ROLE_KEYS,
  ROLE_LABELS,
} from '@/app/lib/adminAccounts'
import { sendAdminTempPasswordEmail } from '@/app/lib/adminEmails'
import { serverError } from '@/app/lib/safeError'

// Admin Accounts panel (Super Admins only).
//
// Sept 29, 2026: invite flow. Following Ivy's admin.html behavior (a
// "re-enter your password" pop-up before Invite and Remove, extended to
// Reset too) and her progress-table comment (Super Admin password first,
// then an emailed invite, then the new admin sets their own password),
// built MCL-style: the system generates a temporary password, emails it,
// and the admin must choose their own on first sign-in. Resend sends from
// the verified iskolusyon.dev domain, so invites reach any inbox.

// Nov 2026 (panel revisions S8): managing accounts is the System Admin's job.
async function requireSuperAdmin(request) {
  return requireConsoleRole(request, ['super_admin'])
}

// The Super Admin's own password, re-entered in the confirm pop-up.
// A wrong password is logged, same as a failed sign-in.
async function requireOwnPassword(session, confirmPassword, actionLabel) {
  const ok = await confirmOwnPassword(session.email, confirmPassword || '')
  if (ok) return null
  try {
    await supabase.from('audit_log').insert([
      {
        actor: session.name,
        action: `Incorrect password when confirming: ${actionLabel}`,
        kind: 'warn',
        category: 'Admin Accounts',
      },
    ])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
  return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 403 })
}

async function logAudit(actor, action, kind) {
  try {
    await supabase.from('audit_log').insert([{ actor, action, kind, category: 'Admin Accounts' }])
  } catch (auditErr) {
    console.error('Audit log insert failed (non-blocking):', auditErr)
  }
}

function loginUrlFor(request) {
  return `${new URL(request.url).origin}/admin/login`
}

// Oct 5 2026: each account also carries role_key (super_admin, admin,
// registrar, lgu) and access_state (active, not_started, ended; only LGU
// accounts can be anything but active).
function withRole(row) {
  return row ? { ...row, role_key: effectiveRole(row), access_state: accessState(row) } : row
}

function roleLabelWithArticle(role) {
  if (role === 'admin') return 'a Guidance Staff account'
  if (role === 'guidance_head') return 'the Guidance Head'
  if (role === 'lgu') return 'an LGU (view only) account'
  if (role === 'registrar') return 'the Office of the Registrar'
  return 'a System Admin'
}

// Roster. Never returns password hashes.
export async function GET(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response
    const accounts = (await listAdminAccounts()).map(withRole)
    return NextResponse.json({ success: true, accounts })
  } catch (err) {
    return serverError(err, 'api/admin-accounts')
  }
}

// Invite { name, email, isSuperAdmin, confirmPassword }.
// If the email can't be sent, the account still exists and the temporary
// password is returned once so the Super Admin can pass it on directly.
export async function POST(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response

    const body = await request.json()
    const denied = await requireOwnPassword(session, body.confirmPassword, 'invite admin')
    if (denied) return denied

    // Oct 5 2026: `role` (admin, super_admin, registrar, lgu); older
    // clients still send isSuperAdmin.
    // Oct 15 2026: 'lgu' is no longer offered; an unknown role is refused
    // (not quietly turned into an Admin).
    if (body.role && !ROLE_KEYS.includes(body.role)) {
      return NextResponse.json({ error: 'That account type is not available.' }, { status: 400 })
    }
    const role = ROLE_KEYS.includes(body.role) ? body.role : body.isSuperAdmin ? 'super_admin' : 'admin'
    const result = await inviteAdminAccount({
      name: body.name,
      email: body.email,
      role,
      accessFrom: body.accessFrom,
      accessUntil: body.accessUntil,
    })
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    const accountRole = effectiveRole(result.account)
    const mail = await sendAdminTempPasswordEmail({
      kind: 'invite',
      name: result.account.name,
      email: result.account.email,
      role: accountRole,
      accessFrom: result.account.access_from,
      accessUntil: result.account.access_until,
      tempPassword: result.tempPassword,
      loginUrl: loginUrlFor(request),
      invitedBy: session.name,
    })

    const accessNote =
      accountRole === 'lgu'
        ? `, access ${formatAccessDate(result.account.access_from)} to ${formatAccessDate(result.account.access_until)}`
        : ''
    await logAudit(
      session.name,
      `Invited ${ROLE_LABELS[accountRole]} account: ${result.account.name} (${result.account.email})${accessNote}${
        mail.error ? '. Invite email failed to send' : ''
      }`,
      mail.error ? 'warn' : 'info'
    )

    return NextResponse.json({
      success: true,
      account: withRole(result.account),
      emailSent: !mail.error,
      emailError: mail.error || null,
      tempPassword: mail.error ? result.tempPassword : undefined,
    })
  } catch (err) {
    return serverError(err, 'api/admin-accounts')
  }
}

// Reset { email, confirmPassword }: issues and emails a new temporary
// password; the admin sets their own on next sign-in.
// Oct 5 2026: { action: 'dates', email, accessFrom, accessUntil,
// confirmPassword } changes an LGU account's access dates instead.
export async function PATCH(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response

    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 })

    if (body.action === 'dates') {
      const deniedDates = await requireOwnPassword(session, body.confirmPassword, 'change LGU access dates')
      if (deniedDates) return deniedDates
      const updated = await updateLguAccess(email, body.accessFrom, body.accessUntil)
      if (updated.error) return NextResponse.json({ error: updated.error }, { status: 400 })
      await logAudit(
        session.name,
        `Changed access dates for LGU account: ${updated.account.name} (${updated.account.email}) to ${formatAccessDate(
          updated.account.access_from
        )} through ${formatAccessDate(updated.account.access_until)}`,
        'info'
      )
      return NextResponse.json({ success: true, account: withRole(updated.account) })
    }

    const denied = await requireOwnPassword(session, body.confirmPassword, 'reset admin password')
    if (denied) return denied

    if (email === session.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You can't reset your own password here while signed in as it." },
        { status: 400 }
      )
    }

    const result = await resetAdminToTempPassword(email)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    const mail = await sendAdminTempPasswordEmail({
      kind: 'reset',
      name: result.account.name,
      email: result.account.email,
      role: effectiveRole(result.account),
      tempPassword: result.tempPassword,
      loginUrl: loginUrlFor(request),
      invitedBy: session.name,
    })

    await logAudit(
      session.name,
      `Reset password for ${ROLE_LABELS[effectiveRole(result.account)]} account: ${result.account.name} (${result.account.email})${
        mail.error ? '. Reset email failed to send' : ''
      }`,
      'warn'
    )

    return NextResponse.json({
      success: true,
      account: withRole(result.account),
      emailSent: !mail.error,
      emailError: mail.error || null,
      tempPassword: mail.error ? result.tempPassword : undefined,
    })
  } catch (err) {
    return serverError(err, 'api/admin-accounts')
  }
}

// Remove { email, confirmPassword } (JSON body). Guards: not your own
// signed-in account, and never the last Super Admin.
export async function DELETE(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response

    const body = await request.json().catch(() => ({}))
    const email = (body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 })

    const denied = await requireOwnPassword(session, body.confirmPassword, 'remove admin')
    if (denied) return denied

    if (email === session.email.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot remove your own account while signed in as it.' }, { status: 400 })
    }

    const { data: target, error: lookupError } = await supabase
      .from('admin_accounts')
      .select('name, email, is_super_admin, role')
      .eq('email', email)
      .maybeSingle()
    if (lookupError) return serverError(lookupError, 'api/admin-accounts')
    if (!target) return NextResponse.json({ error: 'That admin account no longer exists.' }, { status: 404 })

    if (target.is_super_admin) {
      const superAdminCount = await countSuperAdmins()
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'This is the last System Admin account. Invite another System Admin before removing this one.' },
          { status: 400 }
        )
      }
    }

    // Nov 2026: keep at least one Guidance Head, or nobody could open/close
    // applications or release results.
    if (effectiveRole(target) === 'guidance_head') {
      const headCount = await countRole('guidance_head')
      if (headCount <= 1) {
        return NextResponse.json(
          { error: 'This is the only Guidance Head account. Invite another Guidance Head before removing this one.' },
          { status: 400 }
        )
      }
    }

    // Oct 5 2026: keep at least one Office of the Registrar account (Ivy's
    // mockup: the Registrar account can't be deleted).
    if (effectiveRole(target) === 'registrar') {
      const registrarCount = await countRole('registrar')
      if (registrarCount <= 1) {
        return NextResponse.json(
          { error: 'This is the only Office of the Registrar account. Invite another Registrar account before removing this one.' },
          { status: 400 }
        )
      }
    }

    const deleted = await deleteAdminAccount(email)
    if (!deleted) return NextResponse.json({ error: 'That admin account no longer exists.' }, { status: 404 })

    await logAudit(session.name, `Removed ${ROLE_LABELS[effectiveRole(deleted)]} account: ${deleted.name} (${deleted.email})`, 'warn')

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/admin-accounts')
  }
}
