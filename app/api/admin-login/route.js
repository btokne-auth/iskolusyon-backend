import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, createAdminCookieValue } from '@/app/lib/adminAuth'
import { verifyAdminCredentials } from '@/app/lib/adminAccounts'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter your email and password.' }, { status: 400 })
    }

    const account = await verifyAdminCredentials(email, password)
    if (!account) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
    }

    const { value, maxAge } = await createAdminCookieValue(account.name, account.isSuperAdmin)

    const res = NextResponse.json({ success: true, name: account.name, isSuperAdmin: account.isSuperAdmin })
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
