import { auth, signOut } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getWorkspace } from '@/modules/workspace/workspace.service'
import { getEnabledIntegrations } from '@/modules/integrations/integration.service'
import { getWorkspaceMembers, getWorkspaceInvitations } from '@/modules/invitations/invitation.service'
import { TeamManagement } from './TeamManagement'
import { GoogleCalendarSettings } from './GoogleCalendarSettings'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const isOwner = session.user.role === 'OWNER'
  const params = await searchParams

  // Check Google Calendar connection status from DB (no API call needed)
  const oauthConfigured = !!(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET)
  const googleCalendarIntegration = await prisma.integration.findFirst({
    where: {
      workspaceId: session.user.workspaceId,
      type: 'GOOGLE_CALENDAR',
      enabled: true,
    },
    select: { id: true, config: true },
  })
  const gcalConnected = !!(googleCalendarIntegration?.config as Record<string, any> | null)?.accessToken

  // Parse callback query params
  let callbackMessage: { type: 'success' | 'error'; text: string } | null = null
  if (params.calendar_connected === 'true') {
    callbackMessage = { type: 'success', text: 'Google Calendar connected successfully' }
  } else if (params.calendar_error) {
    const err = Array.isArray(params.calendar_error) ? params.calendar_error[0] : params.calendar_error
    callbackMessage = { type: 'error', text: `Connection failed: ${err}` }
  }

  const [workspace, integrations, members, invitations] = await Promise.all([
    getWorkspace(session.user.workspaceId),
    getEnabledIntegrations(session.user.workspaceId),
    isOwner ? getWorkspaceMembers(session.user.workspaceId) : Promise.resolve([]),
    isOwner ? getWorkspaceInvitations(session.user.workspaceId) : Promise.resolve([]),
  ])

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Settings" backHref="/" />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6 pb-24">
        {/* Profile */}
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-cc-text-muted)' }}>Profile</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--color-cc-accent)' }}>
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--color-cc-text)' }}>{session.user.name || 'No name'}</p>
              <p className="text-sm" style={{ color: '#a0a0b8' }}>{session.user.email}</p>
            </div>
          </div>
        </section>

        {/* Workspace */}
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-cc-text-muted)' }}>Workspace</h3>
          <div>
            <p className="font-medium" style={{ color: 'var(--color-cc-text)' }}>{workspace?.name}</p>
            <p className="text-sm" style={{ color: '#a0a0b8' }}>{workspace?._count.members} member(s)</p>
          </div>
        </section>

        {isOwner && (
          <TeamManagement
            members={members}
            invitations={invitations}
            currentUserId={session.user.id}
          />
        )}

        <GoogleCalendarSettings
          initialConnected={gcalConnected}
          isOwner={isOwner}
          oauthConfigured={oauthConfigured}
          callbackMessage={callbackMessage}
        />

        {/* Integrations */}
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-cc-text-muted)' }}>Integrations</h3>
          <div className="space-y-2">
            {['TELEGRAM', 'WHATSAPP'].map((type) => {
              const connected = integrations.some((i) => i.type === type)
              return (
                <div key={type} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-cc-text)' }}>{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                    backgroundColor: connected ? 'var(--color-cc-success-muted)' : 'var(--color-cc-surface)',
                    color: connected ? 'var(--color-cc-success)' : 'var(--color-cc-text-muted)'
                  }}>
                    {connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Sign out */}
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="w-full py-3 text-center font-medium rounded-xl"
            style={{ color: 'var(--color-cc-fire)', background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
