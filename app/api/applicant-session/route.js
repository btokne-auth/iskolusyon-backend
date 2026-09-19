import { NextResponse } from 'next/server'
import { APPLICANT_COOKIE_NAME, verifyApplicantCookieValue } from '@/app/lib/applicantAuth'

export async function GET(request) {
  const cookie = request.cookies.get(APPLICANT_COOKIE_NAME)?.value
  const session = await verifyApplicantCookieValue(cookie)

  if (!session) {
    return NextResponse.json({ loggedIn: false }, { status: 401 })
  }
  return NextResponse.json({ loggedIn: true, id: session.id, email: session.email, name: session.name })
}
