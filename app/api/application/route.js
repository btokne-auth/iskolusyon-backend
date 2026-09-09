import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'

// GET /api/application?name=Juan+Dela+Cruz
// Looks up an existing draft/submitted application row for this applicant,
// matched the same way documents are matched elsewhere in the app —
// case-insensitive, trimmed name (no accounts module yet to key off of).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = (searchParams.get('name') || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .ilike('applicant_name', name)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, application: data || null })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/application
// body: { applicantName, applicantEmail, step, action }
// action: 'save'   -> creates/updates a 'draft' row at the given step
//         'submit' -> flips the row to 'submitted' with a timestamp
//
// Auto-save and the manual "Save progress" button both call this with
// action: 'save' — the only difference is whether the applicant clicked
// a button or just moved to the next step.
export async function POST(request) {
  try {
    const body = await request.json()
    const applicantName = (body.applicantName || '').trim()
    const applicantEmail = (body.applicantEmail || '').trim()
    const step = Number(body.step) || 1
    const action = body.action === 'submit' ? 'submit' : 'save'

    if (!applicantName) {
      return NextResponse.json({ error: 'Missing applicant name' }, { status: 400 })
    }

    // Find any existing row for this applicant first (draft or submitted).
    const { data: existing, error: findError } = await supabase
      .from('applications')
      .select('*')
      .ilike('applicant_name', applicantName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    const now = new Date().toISOString()

    if (existing) {
      const updates = {
        applicant_email: applicantEmail || existing.applicant_email,
        current_step: step,
        updated_at: now,
      }
      if (action === 'submit') {
        updates.status = 'submitted'
        updates.submitted_at = now
      }

      const { data, error } = await supabase
        .from('applications')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, application: data })
    }

    // No existing row — create one.
    const insertPayload = {
      applicant_name: applicantName,
      applicant_email: applicantEmail || null,
      current_step: step,
      status: action === 'submit' ? 'submitted' : 'draft',
      submitted_at: action === 'submit' ? now : null,
    }

    const { data, error } = await supabase
      .from('applications')
      .insert([insertPayload])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, application: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}