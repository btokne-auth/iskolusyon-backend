import { NextResponse } from 'next/server'
import { APPLICANT_COOKIE_NAME } from '@/app/lib/applicantAuth'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(APPLICANT_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
