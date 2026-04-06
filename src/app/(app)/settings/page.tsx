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

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {/* Profile */}
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#6b6b85' }}>Profile</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(124,110,246,0.12)' }}>
              <span className="text-lg font-bold" style={{ color: '#7c6ef6' }}>
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium" style={{ color: '#f0f0f5' }}>{session.user.name || 'No name'}</p>
              <p className="text-sm" style={{ color: '#a0a0b8' }}>{session.user.email}</p>
            </div>
          </div>
        </section>

        {/* Workspace */}
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#6b6b85' }}>Workspace</h3>
          <div>
            <p className="font-medium" style={{ color: '#f0f0f5' }}>{workspace?.name}</p>
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
        <section className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#6b6b85' }}>Integrations</h3>
          <div className="space-y-2">
            {['TELEGRAM', 'WHATSAPP'].map((type) => {
              const connected = integrations.some((i) => i.type === type)
              return (
                <div key={type} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium" style={{ color: '#f0f0f5' }}>{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                    backgroundColor: connected ? 'rgba(45,216,130,0.12)' : 'rgba(255,255,255,0.05)',
                    color: connected ? '#2dd882' : '#6b6b85'
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
            style={{ color: '#ff5a5a', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
