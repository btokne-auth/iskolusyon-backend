import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'

// Oct 6 2026: a second wake-up call for the OCR worker. Uploads already wake
// the worker once (app/api/upload/route.js). If a document is still being
// read after about 30 seconds, the portal calls this so the worker gets
// another nudge instead of the document waiting until someone restarts it
// (on Oct 6 three uploads sat in "processing" because no wake-up reached
// the worker).
//
// Only a signed-in applicant who actually has a document still being read
// can use it, and each server instance sends at most one wake-up every 20
// seconds, so it can't be used to flood the worker.
// Example of misuse it prevents: a stranger calling this address over and
// over to keep the free worker busy.
const MIN_GAP_MS = 20000
let lastWakeAt = 0

export async function POST(request) {
  const session = await verifyApplicantCookieValue(request.cookies.get(APPLICANT_COOKIE_NAME)?.value)
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: waiting, error } = await supabase
    .from('documents')
    .select('id')
    .eq('applicant_user_id', session.id)
    .eq('review_status', 'processing')
    .limit(1)
  if (error) return NextResponse.json({ error: 'Could not check your documents.' }, { status: 500 })
  if (!waiting || waiting.length === 0) return NextResponse.json({ success: true, woke: false, reason: 'nothing waiting' })

  const now = Date.now()
  if (now - lastWakeAt < MIN_GAP_MS) return NextResponse.json({ success: true, woke: false, reason: 'recently woken' })
  lastWakeAt = now

  const workerUrl = process.env.OCR_WORKER_URL
  const workerSecret = process.env.OCR_WORKER_SECRET
  if (!workerUrl || !workerSecret) {
    console.error('OCR worker not configured (OCR_WORKER_URL / OCR_WORKER_SECRET missing)')
    return NextResponse.json({ success: false, woke: false }, { status: 503 })
  }
  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/wake`, {
      method: 'POST',
      headers: { 'x-ocr-worker-secret': workerSecret },
      // A sleeping free Render instance can take about a minute to start;
      // the request itself is what starts it, so there's no need to wait
      // that long here. The worker reads every waiting document once up.
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) console.error(`OCR worker re-wake returned ${res.status}`)
    return NextResponse.json({ success: true, woke: res.ok })
  } catch (wakeErr) {
    console.error('OCR worker re-wake did not answer in time (it may still be starting):', wakeErr.message)
    return NextResponse.json({ success: true, woke: false, reason: 'starting' })
  }
}
