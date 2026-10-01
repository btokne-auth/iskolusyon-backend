import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminCookieFull } from '@/app/lib/adminAuth'
import { listActiveLocks, claimLock, releaseLock } from '@/app/lib/applicantLocks'

// Oct 1 2026: Locked Applications for Review (see app/lib/applicantLocks.js).
// GET                                -> { locks: [{ application_id, admin_name, mine }] }
// POST { id }                        -> claim or refresh (409 + lockedBy if someone else has it)
// POST { id, action: 'release' }     -> release (also used by sendBeacon when a tab closes)

async function session(request) {
  return verifyAdminCookieFull(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
}

export async function GET(request) {
  try {
    const admin = await session(request)
    if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    const locks = await listActiveLocks()
    return NextResponse.json({
      success: true,
      locks: locks.map((l) => ({
        application_id: l.application_id,
        admin_name: l.admin_name,
        mine: (l.admin_email || '').toLowerCase() === (admin.email || '').toLowerCase(),
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const admin = await session(request)
    if (!admin) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    let body = {}
    try {
      body = JSON.parse(await request.text())
    } catch {
      return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
    }
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Missing applicant.' }, { status: 400 })

    if (body.action === 'release') {
      await releaseLock(id, admin.email)
      return NextResponse.json({ success: true })
    }

    const result = await claimLock(id, admin)
    if (!result.ok) {
      return NextResponse.json(
        { error: `${result.lockedBy} is currently reviewing this applicant. Only one admin can work on an applicant at a time. Please try again once they're finished.`, lockedBy: result.lockedBy },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    // If the locks table is missing, don't block admins from working.
    console.error('Applicant lock failed (allowing):', err.message)
    return NextResponse.json({ success: true, lockUnavailable: true })
  }
}
