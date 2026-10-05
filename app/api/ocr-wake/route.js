import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'
import { wakeOcrWorker } from '@/app/lib/ocrWorker'

// Waking a sleeping worker can take up to about a minute.
export const maxDuration = 60

// Oct 6 2026: a second wake-up call for the OCR worker. Uploads already wake
// the worker once (app/api/upload/route.js). If a document is still being
// read after about 30 seconds, the portal calls this so the worker gets
// another nudge instead of the document waiting until someone restarts it.
//
// Only a signed-in applicant who actually has a document still being read
// can use it, and each server instance sends at most one wake-up every 20
// seconds, so it can't be used to flood the worker.
// Example of misuse it prevents: a stranger calling this address over and
// over to keep the free worker busy.
const MIN_GAP_MS = 20000
let lastWakeAt = 0

export async function POST(request) {
  try {
    const session = await verifyApplicantCookieValue(request.cookies.get(APPLICANT_COOKIE_NAME)?.value)
    if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

    const { data: waiting, error } = await supabase
      .from('documents')
      .select('id')
      .eq('applicant_user_id', session.id)
      .eq('review_status', 'processing')
      .limit(1)
    if (error) {
      console.error('ocr-wake: could not check documents:', error.message)
      return NextResponse.json({ error: 'Could not check your documents.' }, { status: 500 })
    }
    if (!waiting || waiting.length === 0) return NextResponse.json({ success: true, woke: false, reason: 'nothing waiting' })

    const now = Date.now()
    if (now - lastWakeAt < MIN_GAP_MS) return NextResponse.json({ success: true, woke: false, reason: 'recently woken' })
    lastWakeAt = now

    const result = await wakeOcrWorker('(re-wake from the portal)')
    return NextResponse.json({ success: true, woke: result.ok, step: result.step })
  } catch (err) {
    console.error('ocr-wake failed:', err)
    return NextResponse.json({ error: 'Could not wake the reading service.' }, { status: 500 })
  }
}
