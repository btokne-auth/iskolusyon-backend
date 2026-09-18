import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'

// Backs the admin portal's Communications panel. Real and persisted (not a
// mockup shell) — any signed-in admin can post, any signed-in admin can
// read. There's no applicant-facing "read" side wired up yet: the
// applicant portal's Messages panel still shows an honest empty state
// (see PortalSidebar.js / page.js on the applicant-portal-rebuild branch)
// until that gets connected to this table.

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, announcements: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const session = await verifyAdminCookieFull(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { title, body, category } = await request.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and message body are required.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert([{ author: session.name, title: title.trim(), body: body.trim(), category: category || null }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await supabase.from('audit_log').insert([
        { actor: session.name, action: `Posted announcement — "${title.trim()}"`, kind: 'done' },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true, announcement: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
