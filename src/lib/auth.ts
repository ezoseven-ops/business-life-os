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

        // Dev convenience: ensure the user has a workspace.
        // Without a workspace, every (app) page returns null.
        if (!user.workspaceId) {
          // Check if user already owns a workspace (ownerId is @unique)
          let workspace = await prisma.workspace.findUnique({
            where: { ownerId: user.id },
          })
          if (!workspace) {
            const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase()
            workspace = await prisma.workspace.create({
              data: {
                name: `${name}'s Workspace`,
                slug: `${slug}-${Date.now()}`,
                ownerId: user.id,
              },
            })
          }
          user = await prisma.user.update({
            where: { id: user.id },
            data: { workspaceId: workspace.id },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
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

      // Self-heal: if workspaceId is missing in the token but was assigned
      // in the DB after initial sign-in, refresh it automatically.
      // This prevents the "shell visible but pages empty" bug when the JWT
      // was created before the user was linked to a workspace.
      //
      // GUARD: Only run in Node.js runtime. Prisma cannot execute in edge
      // runtime (middleware), so we skip the DB lookup there. The self-heal
      // will run on the next server-side page render instead.
      const isEdgeRuntime = typeof (globalThis as Record<string, unknown>).EdgeRuntime === 'string'
      if (token.id && !token.workspaceId && !isEdgeRuntime) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { workspaceId: true, role: true },
          })
          if (dbUser?.workspaceId) {
            token.workspaceId = dbUser.workspaceId
            token.role = dbUser.role
          }
        } catch {
          // Silently skip if Prisma is unavailable (e.g. edge runtime fallthrough)
        }
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
