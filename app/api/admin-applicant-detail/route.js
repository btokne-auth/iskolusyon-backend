import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'

// Full per-applicant profile read, for the Dashboard applicant modal's
// General Information grid + tabbed "Submitted Documents & Profile Data"
// panel (Sept 22 2026 — following up on the click-to-open-modal work).
//
// admin-eligibility's GET stays a lean column list because it's fetched for
// EVERY row on every Dashboard load (List of All Applications). This is the
// opposite: one full row (select('*') — an internal admin-only read, not
// exposed to applicants), fetched lazily only once an admin actually opens
// an applicant's modal. Keeps the list-view fetch cheap and this one
// complete, rather than bloating every row of the list with ~70 columns
// nobody's looking at yet.
export async function GET(request) {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
    }

    const { data, error } = await supabase.from('applications').select('*').eq('id', id).maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, application: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
