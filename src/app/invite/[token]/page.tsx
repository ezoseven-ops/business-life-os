import { auth } from '@/lib/auth'
import { getInvitationByToken } from '@/modules/invitations/invitation.service'
import { InviteAcceptClient } from './InviteAcceptClient'
import { redirect } from 'next/navigation'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">😕</div>
          <h1 className="text-xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="text-gray-500 text-sm">This invitation link is invalid or has been revoked.</p>
        </div>
      </div>
    )
  }

  if (invitation.status !== 'PENDING') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">{invitation.status === 'ACCEPTED' ? '✅' : '⏰'}</div>
          <h1 className="text-xl font-bold text-gray-900">
            {invitation.status === 'ACCEPTED' ? 'Already Accepted' : 'Invitation Expired'}
          </h1>
          <p className="text-gray-500 text-sm">
            {invitation.status === 'ACCEPTED'
              ? 'This invitation has already been accepted.'
              : 'This invitation has expired. Please ask for a new one.'}
          </p>
        </div>
      </div>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">⏰</div>
          <h1 className="text-xl font-bold text-gray-900">Invitation Expired</h1>
          <p className="text-gray-500 text-sm">This invitation has expired. Please ask for a new one.</p>
        </div>
      </div>
    )
  }

  const session = await auth()

  // If not logged in, redirect to login with callback
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/invite/${token}`)
  }

  // If already in a workspace, show error
  if (session.user.workspaceId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">🏢</div>
          <h1 className="text-xl font-bold text-gray-900">Already in a Workspace</h1>
          <p className="text-gray-500 text-sm">
            You are already a member of a workspace. Multi-workspace support is coming soon.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <InviteAcceptClient
        token={token}
        workspaceName={invitation.workspace.name}
        invitedByName={invitation.invitedBy.name || 'Someone'}
        role={invitation.role}
      />
    </div>
  )
}
