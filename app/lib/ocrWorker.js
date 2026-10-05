// Oct 6 2026: wakes the OCR worker (iskolusyon-ocr-worker on Render).
//
// Why two steps: on Render's free plan a sleeping service no longer wakes
// up for a POST request; Render answers 502 and the service keeps sleeping
// (a GET still wakes it). From Oct 3 until Oct 6 every upload's wake-up
// call got that 502, so documents stayed in "processing" until someone
// restarted the worker by hand.
//
// 1. POST /wake (with the shared secret). If the worker is awake, it reads
//    every waiting document right away.
// 2. If that isn't answered with OK, a plain GET to the worker's address.
//    That wakes a sleeping worker, and the worker reads every waiting
//    document as soon as it starts up (its startup sweep), so the secret
//    isn't needed for this step and the GET itself does nothing else.
export async function wakeOcrWorker(context = '') {
  const workerUrl = process.env.OCR_WORKER_URL
  const workerSecret = process.env.OCR_WORKER_SECRET
  if (!workerUrl || !workerSecret) {
    console.error(`OCR worker not configured (OCR_WORKER_URL / OCR_WORKER_SECRET missing) ${context}`)
    return { ok: false, step: 'not configured' }
  }
  const base = workerUrl.replace(/\/+$/, '')

  try {
    const res = await fetch(`${base}/wake`, {
      method: 'POST',
      headers: { 'x-ocr-worker-secret': workerSecret },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) return { ok: true, step: 'wake' }
    console.warn(`OCR worker wake-up returned ${res.status}, waking it with a GET instead ${context}`)
  } catch (err) {
    console.warn(`OCR worker wake-up did not answer (${err.message}), waking it with a GET instead ${context}`)
  }

  try {
    // A sleeping free instance can take up to about a minute to start.
    const res = await fetch(`${base}/`, { method: 'GET', signal: AbortSignal.timeout(40000) })
    // The worker has no page at "/", so a 404 here means it is up and its
    // startup sweep is running. Anything 5xx means it still isn't up.
    if (res.status < 500) return { ok: true, step: 'get' }
    console.error(`OCR worker still not up after a GET (status ${res.status}); documents stay in processing ${context}`)
    return { ok: false, step: 'get', status: res.status }
  } catch (err) {
    console.error(`OCR worker did not answer a GET in time (${err.message}); it may still be starting ${context}`)
    return { ok: false, step: 'get timeout' }
  }
}
