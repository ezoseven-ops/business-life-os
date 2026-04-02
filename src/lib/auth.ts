import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'

const providers = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
  }),
]

// Dev-only: allow login with just an email (no password, no verification)
if (process.env.NODE_ENV === 'development') {
  providers.push(
    Credentials({
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        if (!email) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, workspaceId: true },
        })
        if (dbUser) {
          session.user.role = dbUser.role
          session.user.workspaceId = dbUser.workspaceId
        }
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) {
        // Check if there's a pending invitation for this email.
        // Wrapped in try-catch: if Invitation table doesn't exist yet
        // (migration not run), fall through to default workspace creation.
        try {
          const pendingInvitation = await prisma.invitation.findFirst({
            where: { email: user.email, status: 'PENDING' },
          })

          if (pendingInvitation) {
            // User was invited — do NOT create a workspace.
            // The invitation will be accepted via /invite/[token] page,
            // which handles workspace assignment and role setup.
            return
          }
        } catch (err) {
          // Invitation table doesn't exist yet — safe to ignore
          console.warn('[auth] Invitation table not available, skipping invitation check:', (err as Error).message)
        }

        // No invitation (or table doesn't exist) — create a new workspace (existing behavior)
        const slug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
        const workspace = await prisma.workspace.create({
          data: {
            name: `${user.name || 'My'}'s Workspace`,
            slug: `${slug}-${Date.now().toString(36)}`,
            ownerId: user.id,
          },
        })
        await prisma.user.update({
          where: { id: user.id },
          data: { workspaceId: workspace.id, role: 'OWNER' },
        })
      }
    },
  },
})
