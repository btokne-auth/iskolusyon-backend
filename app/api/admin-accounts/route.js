import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import {
  listAdminAccounts,
  countSuperAdmins,
  deleteAdminAccount,
  inviteAdminAccount,
  resetAdminToTempPassword,
  confirmOwnPassword,
} from '@/app/lib/adminAccounts'
import { sendAdminTempPasswordEmail } from '@/app/lib/adminEmails'

// Admin Accounts panel (Super Admins only).
//
// Sept 29, 2026: invite flow. Following Ivy's admin.html behavior (a
// "re-enter your password" pop-up before Invite and Remove, extended to
// Reset too) and her progress-table comment (Super Admin password first,
// then an emailed invite, then the new admin sets their own password),
// built MCL-style: the system generates a temporary password, emails it,
// and the admin must choose their own on first sign-in. Resend sends from
// the verified iskolusyon.dev domain, so invites reach any inbox.

async function requireSuperAdmin(request) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAdminCookieFull(cookie)
  if (!session) return { response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) }
  if (!session.isSuperAdmin) {
    return { response: NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 }) }
  }
  return { session }
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

// Roster. Never returns password hashes.
export async function GET(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response
    const accounts = await listAdminAccounts()
    return NextResponse.json({ success: true, accounts })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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

    const result = await inviteAdminAccount({
      name: body.name,
      email: body.email,
      isSuperAdmin: !!body.isSuperAdmin,
    })
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    const mail = await sendAdminTempPasswordEmail({
      kind: 'invite',
      name: result.account.name,
      email: result.account.email,
      role: result.account.is_super_admin ? 'super_admin' : 'admin',
      tempPassword: result.tempPassword,
      loginUrl: loginUrlFor(request),
      invitedBy: session.name,
    })

    await logAudit(
      session.name,
      `Invited admin account: ${result.account.name} (${result.account.email})${
        result.account.is_super_admin ? ', Super Admin' : ''
      }${mail.error ? '. Invite email failed to send' : ''}`,
      mail.error ? 'warn' : 'info'
    )

    return NextResponse.json({
      success: true,
      account: result.account,
      emailSent: !mail.error,
      emailError: mail.error || null,
      tempPassword: mail.error ? result.tempPassword : undefined,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Reset { email, confirmPassword }: issues and emails a new temporary
// password; the admin sets their own on next sign-in.
export async function PATCH(request) {
  try {
    const { session, response } = await requireSuperAdmin(request)
    if (!session) return response

    const body = await request.json()
    const email = (body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 })

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
      role: result.account.is_super_admin ? 'super_admin' : 'admin',
      tempPassword: result.tempPassword,
      loginUrl: loginUrlFor(request),
      invitedBy: session.name,
    })

    await logAudit(
      session.name,
      `Reset password for admin account: ${result.account.name} (${result.account.email})${
        mail.error ? '. Reset email failed to send' : ''
      }`,
      'warn'
    )

    return NextResponse.json({
      success: true,
      account: result.account,
      emailSent: !mail.error,
      emailError: mail.error || null,
      tempPassword: mail.error ? result.tempPassword : undefined,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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
      .select('name, email, is_super_admin')
      .eq('email', email)
      .maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!target) return NextResponse.json({ error: 'That admin account no longer exists.' }, { status: 404 })

    if (target.is_super_admin) {
      const superAdminCount = await countSuperAdmins()
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'This is the last Super Admin account. Promote another admin to Super Admin before removing this one.' },
          { status: 400 }
        )
      }
    }

    const deleted = await deleteAdminAccount(email)
    if (!deleted) return NextResponse.json({ error: 'That admin account no longer exists.' }, { status: 404 })

    await logAudit(session.name, `Removed admin account: ${deleted.name} (${deleted.email})`, 'warn')

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
