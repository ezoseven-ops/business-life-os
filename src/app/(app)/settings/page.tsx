import { auth, signOut } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getWorkspace } from '@/modules/workspace/workspace.service'
import { getEnabledIntegrations } from '@/modules/integrations/integration.service'
import { getWorkspaceMembers, getWorkspaceInvitations } from '@/modules/invitations/invitation.service'
import { TeamManagement } from './TeamManagement'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const isOwner = session.user.role === 'OWNER'

  const [workspace, integrations, members, invitations] = await Promise.all([
    getWorkspace(session.user.workspaceId),
    getEnabledIntegrations(session.user.workspaceId),
    isOwner ? getWorkspaceMembers(session.user.workspaceId) : Promise.resolve([]),
    isOwner ? getWorkspaceInvitations(session.user.workspaceId) : Promise.resolve([]),
  ])

  return (
    <div>
      <Header title="Settings" backHref="/" />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6">
        {/* Profile */}
        <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Profile</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {session.user.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium">{session.user.name || 'No name'}</p>
              <p className="text-sm text-text-secondary">{session.user.email}</p>
            </div>
          </div>
        </section>

        {/* Workspace */}
        <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Workspace</h3>
          <div>
            <p className="font-medium">{workspace?.name}</p>
            <p className="text-sm text-text-secondary">{workspace?._count.members} member(s)</p>
          </div>
        </section>

        {/* Team Management (Owner only) */}
        {isOwner && (
          <TeamManagement
            members={members}
            invitations={invitations}
            currentUserId={session.user.id}
          />
        )}

        {/* Integrations */}
        <section className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Integrations</h3>
          <div className="space-y-2">
            {['TELEGRAM', 'WHATSAPP'].map((type) => {
              const connected = integrations.some((i) => i.type === type)
              return (
                <div key={type} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
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
            className="w-full py-3 text-center text-danger font-medium bg-surface rounded-xl border border-border"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
