'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  addProjectMemberAction,
  removeProjectMemberAction,
  updateProjectMemberRoleAction,
  getAvailableMembersAction,
} from '@/modules/projects/project-member.actions'
import { ErrorBanner, SuccessBanner } from '@/components/ErrorStates'

type ProjectMember = {
  id: string
  role: string
  userId: string
  user: {
    id: string
    name: string | null
    avatarUrl: string | null
    linkedPerson?: { id: string } | null
  }
}

type AvailableUser = {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: string
}

const ROLES = [
  { value: 'LEAD', label: 'Lead', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  { value: 'CONTRIBUTOR', label: 'Contributor', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'VIEWER', label: 'Viewer', color: '#6b6b85', bg: 'rgba(255,255,255,0.06)' },
] as const

function getRoleMeta(role: string) {
  return ROLES.find((r) => r.value === role) ?? ROLES[1]
}

export function ProjectMemberManager({
  projectId,
  members: initialMembers,
  canEdit,
}: {
  projectId: string
  members: ProjectMember[]
  canEdit: boolean
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('CONTRIBUTOR')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)

  useEffect(() => {
    if (showAddForm) {
      loadAvailableUsers()
    }
  }, [showAddForm])

  async function loadAvailableUsers() {
    setLoadingUsers(true)
    const result = await getAvailableMembersAction(projectId)
    if (result.success) {
      setAvailableUsers(result.data)
      if (result.data.length > 0) {
        setSelectedUserId(result.data[0].id)
      }
    } else {
      setError(result.error)
    }
    setLoadingUsers(false)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await addProjectMemberAction(projectId, selectedUserId, selectedRole)

    if (result.success) {
      const user = availableUsers.find((u) => u.id === selectedUserId)
      setSuccess(`${user?.name || 'Member'} added to project`)
      setShowAddForm(false)
      setSelectedUserId('')
      setSelectedRole('CONTRIBUTOR')
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  async function handleRemove(userId: string, userName: string | null) {
    setError(null)
    setSuccess(null)
    const result = await removeProjectMemberAction(projectId, userId)
    if (result.success) {
      setSuccess(`${userName || 'Member'} removed from project`)
    } else {
      setError(result.error)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setError(null)
    setEditingRole(null)
    const result = await updateProjectMemberRoleAction(projectId, userId, newRole)
    if (!result.success) {
      setError(result.error)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2 px-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: '#6b6b85' }}
        >
          Team ({initialMembers.length})
        </span>
        {canEdit && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setError(null)
              setSuccess(null)
            }}
            className="ml-auto text-[11px] font-semibold"
            style={{ color: '#7c6ef6' }}
          >
            {showAddForm ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      <ErrorBanner message={error ?? ''} onDismiss={() => setError(null)} />
      <SuccessBanner message={success ?? ''} onDismiss={() => setSuccess(null)} />

      {/* Add member form */}
      {showAddForm && canEdit && (
        <div
          className="mb-3 p-3.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {loadingUsers ? (
            <p className="text-xs text-center py-3" style={{ color: '#6b6b85' }}>
              Loading workspace members...
            </p>
          ) : availableUsers.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: '#6b6b85' }}>
              All workspace members are already in this project
            </p>
          ) : (
            <form onSubmit={handleAddMember} className="space-y-3">
              {/* User select */}
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block"
                  style={{ color: '#6b6b85' }}
                >
                  Member
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f0f0f5',
                    outline: 'none',
                  }}
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id} style={{ backgroundColor: '#1a1a2e', color: '#f0f0f5' }}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role select */}
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block"
                  style={{ color: '#6b6b85' }}
                >
                  Role
                </label>
                <div className="flex gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSelectedRole(r.value)}
                      className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                      style={
                        selectedRole === r.value
                          ? {
                              backgroundColor: r.bg,
                              color: r.color,
                              border: `1px solid ${r.color}30`,
                            }
                          : {
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              color: '#6b6b85',
                              border: '1px solid rgba(255,255,255,0.06)',
                            }
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedUserId}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#7c6ef6' }}
              >
                {loading ? 'Adding...' : 'Add to Project'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Members list */}
      {initialMembers.length === 0 ? (
        <div
          className="text-center py-6 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: '#6b6b85' }}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
          </div>
          <p className="text-[13px] font-medium" style={{ color: '#6b6b85' }}>
            No team members yet
          </p>
          {canEdit && (
            <p className="text-[11px] mt-1" style={{ color: '#6b6b85' }}>
              Click &quot;+ Add&quot; to assign workspace members
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {initialMembers.map((m) => {
            const roleMeta = getRoleMeta(m.role)
            const personId = m.user?.linkedPerson?.id
            const isEditingThis = editingRole === m.userId

            return (
              <div
                key={m.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(124,110,246,0.12)' }}
                >
                  <span className="text-[12px] font-bold" style={{ color: '#7c6ef6' }}>
                    {(m.user?.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Name + link */}
                <div className="flex-1 min-w-0">
                  {personId ? (
                    <Link
                      href={`/people/${personId}`}
                      className="text-[13px] font-medium truncate block hover:underline"
                      style={{ color: '#f0f0f5' }}
                    >
                      {m.user?.name ?? 'Unknown'}
                    </Link>
                  ) : (
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: '#f0f0f5' }}
                    >
                      {m.user?.name ?? 'Unknown'}
                    </p>
                  )}
                </div>

                {/* Role badge / role editor */}
                {isEditingThis && canEdit ? (
                  <div className="flex gap-1">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => handleRoleChange(m.userId, r.value)}
                        className="text-[9px] font-bold uppercase px-2 py-1 rounded-full transition-all"
                        style={
                          m.role === r.value
                            ? {
                                backgroundColor: r.bg,
                                color: r.color,
                                border: `1px solid ${r.color}40`,
                              }
                            : {
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                color: '#6b6b85',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setEditingRole(null)}
                      className="text-[9px] px-1.5"
                      style={{ color: '#6b6b85' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => canEdit && setEditingRole(m.userId)}
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ backgroundColor: roleMeta.bg, color: roleMeta.color }}
                      disabled={!canEdit}
                      title={canEdit ? 'Click to change role' : undefined}
                    >
                      {roleMeta.label}
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleRemove(m.userId, m.user?.name)}
                        className="text-[10px] opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: '#ff5a5a' }}
                        title="Remove from project"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
