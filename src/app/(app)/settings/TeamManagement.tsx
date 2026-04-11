'use client'

import { useState } from 'react'
import { inviteUserAction, revokeInvitationAction, removeMemberAction, updateMemberRoleAction } from '@/modules/invitations/invitation.actions'
import { ErrorBanner, SuccessBanner } from '@/components/ErrorStates'
import type { UserRole } from '@prisma/client'

type Member = {
  id: string
  name: string | null
  email: string
  role: UserRole
  avatarUrl: string | null
}

type Invitation = {
  id: string
  email: string
  role: UserRole
  status: string
  invitedBy: { name: string | null }
}

export function TeamManagement({
  members,
  invitations,
  currentUserId,
}: {
  members: Member[]
  invitations: Invitation[]
  currentUserId: string
}) {
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'TEAM' | 'CLIENT'>('TEAM')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await inviteUserAction({
      email: inviteEmail,
      role: inviteRole,
    })

    if (result.success) {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteForm(false)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleRevoke(id: string) {
    await revokeInvitationAction(id)
  }

  async function handleRemove(userId: string) {
    const result = await removeMemberAction(userId)
    if (!result.success) setError(result.error)
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    const result = await updateMemberRoleAction(userId, role)
    if (!result.success) setError(result.error)
  }

  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING')

  return (
    <section className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Team</h3>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="text-xs font-semibold text-[var(--color-cc-accent)]"
        >
          {showInviteForm ? 'Cancel' : '+ Invite'}
        </button>
      </div>

      <ErrorBanner message={error ?? ''} onDismiss={() => setError(null)} />
      <SuccessBanner message={success ?? ''} onDismiss={() => setSuccess(null)} />

      {/* Invite form */}
      {showInviteForm && (
        <form onSubmit={handleInvite} className="space-y-3 bg-[var(--color-cc-surface-subtle)] rounded-xl p-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-cc-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-cc-accent)]/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteRole('TEAM')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                inviteRole === 'TEAM'
                  ? 'border-[var(--color-cc-accent)] bg-[var(--color-cc-accent)]/5 text-[var(--color-cc-accent)]'
                  : 'border-[var(--color-cc-border)] text-[var(--color-cc-text-muted)]'
              }`}
            >
              Team Member
            </button>
            <button
              type="button"
              onClick={() => setInviteRole('CLIENT')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                inviteRole === 'CLIENT'
                  ? 'border-[var(--color-cc-accent)] bg-[var(--color-cc-accent)]/5 text-[var(--color-cc-accent)]'
                  : 'border-[var(--color-cc-border)] text-[var(--color-cc-text-muted)]'
              }`}
            >
              Client
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--color-cc-accent)] text-[var(--color-cc-bg)] rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </button>
        </form>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--color-cc-accent)]/10 flex items-center justify-center">
                <span className="text-xs font-bold text-[var(--color-cc-accent)]">
                  {member.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{member.name || 'Unnamed'}</p>
                <p className="text-[11px] text-[var(--color-cc-text-muted)]">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                member.role === 'OWNER'
                  ? 'bg-purple-100 text-purple-700'
                  : member.role === 'CLIENT'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-[var(--color-cc-surface)] text-[var(--color-cc-text-secondary)]'
              }`}>
                {member.role === 'TEAM' ? 'Team' : member.role.toLowerCase()}
              </span>
              {member.id !== currentUserId && member.role !== 'OWNER' && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div className="pt-2 border-t border-[var(--color-cc-border)]">
          <p className="text-[10px] font-semibold text-[var(--color-cc-text-muted)] uppercase tracking-wide mb-2">Pending Invitations</p>
          {pendingInvitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm text-[var(--color-cc-text-secondary)]">{inv.email}</p>
                <p className="text-[10px] text-[var(--color-cc-text-muted)]">
                  {inv.role === 'TEAM' ? 'Team' : 'Client'} &middot; by {inv.invitedBy.name || 'Unknown'}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(inv.id)}
                className="text-[10px] text-red-400 hover:text-red-600"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
