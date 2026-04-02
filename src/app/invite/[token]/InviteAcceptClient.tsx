'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitationAction } from '@/modules/invitations/invitation.actions'
import type { UserRole } from '@prisma/client'

export function InviteAcceptClient({
  token,
  workspaceName,
  invitedByName,
  role,
}: {
  token: string
  workspaceName: string
  invitedByName: string
  role: UserRole
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleLabel = role === 'CLIENT' ? 'Client' : role === 'TEAM' ? 'Team Member' : 'Owner'

  async function handleAccept() {
    setLoading(true)
    setError(null)
    const result = await acceptInvitationAction(token)
    if (result.success) {
      // Redirect based on role
      if (result.data.role === 'CLIENT') {
        router.push('/portal')
      } else {
        router.push('/')
      }
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 max-w-sm w-full space-y-5">
      <div className="text-center space-y-2">
        <div className="text-4xl">🤝</div>
        <h1 className="text-xl font-bold text-gray-900">You're Invited!</h1>
        <p className="text-gray-500 text-sm">
          <span className="font-medium text-gray-700">{invitedByName}</span> has invited you to join
        </p>
        <p className="text-lg font-semibold text-primary">{workspaceName}</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 text-center">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your Role</span>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">{roleLabel}</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 text-center">
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Joining...' : 'Accept & Join Workspace'}
      </button>
    </div>
  )
}
