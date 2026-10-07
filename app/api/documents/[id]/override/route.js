import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { ADMIN_COOKIE_NAME, verifyAdminCookieValue } from '@/app/lib/adminAuth'
import { serverError } from '@/app/lib/safeError'

// Manual "Super Admin" override on a single document's review status.
// Scoped ONLY to this project's own document/verification records (the
// `documents` table) — it does NOT touch qualification or scholarship-
// matching data, which belongs to the Scholarship Matching module.
//
// Still gated behind the shared admin cookie from app/lib/adminAuth.js —
// see that file for why this is a placeholder, not real per-user
// permissions. Whoever is signed in with the shared passcode can override
// any document; there's no per-role restriction yet.
const VALID_ACTIONS = {
  verify: { needs_review: false, review_status: 'verified', label: 'manually marked Verified', kind: 'done' },
  flag: { needs_review: true, review_status: 'flagged', label: 'manually flagged for review', kind: 'warn' },
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params

    const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    const adminName = await verifyAdminCookieValue(cookie)
    if (!adminName) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const { action, note } = await request.json()
    const change = VALID_ACTIONS[action]
    if (!change) {
      return NextResponse.json({ error: 'Unknown override action.' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('documents')
      .select('applicant_name, document_type')
      .eq('file_path', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        needs_review: change.needs_review,
        review_status: change.review_status,
      })
      .eq('file_path', id)

    if (updateError) {
      return serverError(updateError, 'api/documents/[id]/override')
    }

    // Best-effort audit trail — same non-blocking pattern as
    // app/api/upload/route.js. Uses the existing 'done' / 'warn' kinds so
    // it renders correctly on the existing Global Audit Logs page without
    // needing any changes there.
    try {
      await supabase.from('audit_log').insert([
        {
          actor: adminName,
          action: `Document ${change.label}: ${existing.applicant_name || 'Unknown applicant'} \u00b7 ${existing.document_type || 'document'}${note ? ` (note: ${note})` : ''}`,
          kind: change.kind,
          category: 'Documents',
        },
      ])
    } catch (auditErr) {
      console.error('Audit log insert failed (non-blocking):', auditErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'api/documents/[id]/override')
  }
}