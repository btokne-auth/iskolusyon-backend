import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { listAdminAccounts, countSuperAdmins, deleteAdminAccount, createAdminAccount } from '@/app/lib/adminAccounts'

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

// Sept 24 2026: real create, replacing scripts/seed-admin-account.mjs for
// day-to-day use (see adminAccounts.js's createAdminAccount for why this is
// deliberately create-only, not an upsert). Still no invite-by-email --
// Resend is sandbox-restricted to the developer's own inbox on the free
// tier -- so the Super Admin sets the new account's password directly, same
// as the terminal script always did, just from the panel instead of a
// terminal. Role model stays the real two-value one (Admin / Super Admin).
export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: 'Super Admin access required.' }, { status: 403 })
    }

    const body = await request.json()
    const result = await createAdminAccount({
      name: body.name,
      email: body.email,
      password: body.password,
      isSuperAdmin: !!body.isSuperAdmin,
    })
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    try {
      await supabase.from('audit_log').insert([
        {
          actor: session.name,
          action: `Added admin account — ${result.account.name} (${result.account.email})${
            result.account.is_super_admin ? ' — Super Admin' : ''
          }`,
          kind: 'info',
          category: 'Admin Accounts',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, account: result.account })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Sept 22, 2026, updated Sept 24, 2026 once POST (above) shipped: Ivy's
// mockup's "Invite Admin Account" form still isn't built as a real
// email invite -- Resend is sandbox-restricted to the developer's own
// inbox on the free tier -- so account creation is Super-Admin-sets-the-
// password-directly instead (see POST above and adminAccounts.js's
// createAdminAccount). The role model stays the real two-value one
// (Admin / Super Admin) -- there's no third "Office of the Registrar"
// role in the schema, that account in Ivy's mockup is just a regular
// Admin row under a different name.
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
          category: 'Admin Accounts',
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
