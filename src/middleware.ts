import { auth } from '@/lib/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const publicPaths = ['/login', '/verify', '/invite', '/api/auth', '/api/health', '/api/webhooks']
  const isPublic = publicPaths.some((path) => pathname.startsWith(path))
  if (isPublic) return
  if (!req.auth) {
    return Response.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
