import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths
  const publicPaths = ['/login', '/verify', '/invite', '/api/auth', '/api/health', '/api/webhooks']
  const isPublic = publicPaths.some((path) => pathname.startsWith(path))

  if (isPublic) {
    return NextResponse.next()
  }

  // Check JWT token
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
