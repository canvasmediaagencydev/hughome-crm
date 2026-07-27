import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// User-facing pages that require a valid session. Unauthenticated visitors are
// redirected to '/' (the LIFF login page). API routes guard themselves.
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/rewards', '/profile', '/call', '/facebook']

const SESSION_COOKIE = 'hh_session'

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const secret = process.env.SESSION_SECRET
  if (!secret) return false // fail closed
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  if (!isProtected) return NextResponse.next()

  if (await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
