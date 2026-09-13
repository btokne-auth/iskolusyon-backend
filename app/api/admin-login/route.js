import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, createAdminCookieValue } from '@/app/lib/adminAuth'

export async function POST(request) {
  try {
    const { passcode, name } = await request.json()

    const expectedCode = process.env.ADMIN_ACCESS_CODE
    if (!expectedCode) {
      return NextResponse.json(
        { error: 'Admin access code is not configured on the server (ADMIN_ACCESS_CODE missing from .env.local).' },
        { status: 500 }
      )
    }

    if (!passcode || passcode !== expectedCode) {
      return NextResponse.json({ error: 'Incorrect passcode.' }, { status: 401 })
    }

    const trimmedName = (name || '').trim()
    if (!trimmedName) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
    }
    if (trimmedName.length > 40) {
      return NextResponse.json({ error: 'Name is too long.' }, { status: 400 })
    }

    const { value, maxAge } = await createAdminCookieValue(trimmedName)

    const res = NextResponse.json({ success: true, name: trimmedName })
    res.cookies.set(ADMIN_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}