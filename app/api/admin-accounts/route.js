import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { listAdminAccounts, countSuperAdmins, deleteAdminAccount } from '@/app/lib/adminAccounts'

// Matches admin.html's "Admin Accounts" panel roster. Gated to Super
// Admins only, same as the nav item itself.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })
    }

    const accounts = await listAdminAccounts()
    return NextResponse.json({ success: true, accounts })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Sept 22, 2026: delete only. Ivy's mockup also shows an "Invite Admin
// Account" form (name/email/role), deliberately left out here -- a real
// invite needs an actual email-delivery path (Resend is still sandbox-
// restricted to the developer's own inbox, per the earlier conversation
// this session), and there's no forgot-password flow yet to back a manual
// account handoff either. New accounts are still seeded via
// scripts/seed-admin-account.mjs until that infrastructure exists. The
// role model stays the real two-value one (Admin / Super Admin) -- there's
// no third "Office of the Registrar" role in the schema, that account in
// Ivy's mockup is just a regular Admin row under a different name.
export async function DELETE(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const email = (searchParams.get('email') || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Missing email.' }, { status: 400 })

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

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Removed admin account — ${deleted.name} (${deleted.email})`,
          kind: 'warn',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
