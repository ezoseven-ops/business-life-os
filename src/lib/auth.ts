import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'
import type { Provider } from '@auth/core/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const providers: Provider[] = []

// Google OAuth — only register if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  )
}

if (process.env.NODE_ENV === 'development') {
  providers.push(
    Credentials({
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim()
        const name = String(credentials?.name || 'Dev User').trim()

        if (!email) return null

        let user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              role: 'OWNER',
            },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    })
  )
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  providers,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.workspaceId = (user as { workspaceId?: string | null }).workspaceId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string; role?: string; workspaceId?: string | null }).id = token.id as string
        ;(session.user as { id?: string; role?: string; workspaceId?: string | null }).role = token.role as string
        ;(session.user as { id?: string; role?: string; workspaceId?: string | null }).workspaceId =
          (token.workspaceId as string | null) ?? null
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
