import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'

// Sept 22 2026: category and read/unread filters added, matching the
// System & Activity panel's Show/Status dropdowns. Still admin-visible
// only (no cookie check was here before either -- this route has never
// been reachable from outside the admin console's own UI, so leaving GET
// open matches the existing posture; PATCH below is gated since it's a
// write).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status') // 'unread' | 'read' | null (= all)

    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50)
    if (category && category !== 'all') query = query.eq('category', category)
    if (status === 'unread') query = query.eq('read', false)
    if (status === 'read') query = query.eq('read', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, entries: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// "Mark all as read" -- a single shared flag across every entry (see the
// migration's comment: this is a small shared console, not a per-admin
// notification system). Gated to signed-in admins, matching everything
// else that writes to this table.
export async function PATCH(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { error } = await supabase.from('audit_log').update({ read: true }).eq('read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
