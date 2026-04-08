'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTaskAction } from '@/modules/tasks/task.actions'
import { InlineError } from '@/components/ErrorStates'
import { addCommentAction } from '@/modules/comments/comment.actions'
import { formatRelativeTime } from '@/lib/utils'

interface ProjectPerson {
  id: string
  name: string
  email: string | null
  company: string | null
}

interface Props {
  task: any
  workspaceUsers: { id: string; name: string }[]
  projectPersons: ProjectPerson[]
  currentUserId: string
}

const statusOptions = [
  { value: 'TODO', label: 'To Do', color: 'bg-gray-100 text-gray-600' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50 text-blue-600' },
  { value: 'WAITING', label: 'Waiting', color: 'bg-amber-50 text-amber-600' },
  { value: 'DONE', label: 'Done', color: 'bg-green-50 text-green-600' },
]

const priorityOptions = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-50 text-blue-600' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-50 text-orange-600' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-50 text-red-600' },
]

export function TaskDetailClient({ task, workspaceUsers, projectPersons, currentUserId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  async function updateField(field: string, value: string | null) {
    setSaving(true)
    setError('')
    try {
      const result = await updateTaskAction(task.id, { [field]: value })
      if (!result.success) setError(result.error || 'Failed to update')
      else router.refresh()
    } catch {
      setError('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssigneeChange(compositeValue: string) {
    setSaving(true)
    setError('')
    try {
      let result
      if (!compositeValue) {
        result = await updateTaskAction(task.id, { assigneeId: null, assigneePersonId: null })
      } else if (compositeValue.startsWith('user:')) {
        const userId = compositeValue.replace('user:', '')
        result = await updateTaskAction(task.id, { assigneeId: userId })
      } else if (compositeValue.startsWith('person:')) {
        const personId = compositeValue.replace('person:', '')
        result = await updateTaskAction(task.id, { assigneePersonId: personId })
      }
      if (result && !result.success) setError(result.error || 'Failed to update assignee')
      else router.refresh()
    } catch {
      setError('Failed to update assignee')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddComment() {
    if (!commentText.trim() || commentSaving) return
    setCommentSaving(true)
    try {
      const result = await addCommentAction({
        content: commentText.trim(),
        taskId: task.id,
      })
      if (result.success) {
        setCommentText('')
        router.refresh()
      }
    } catch {
      setError('Failed to add comment')
    } finally {
      setCommentSaving(false)
    }
  }

  // Compute composite assignee value
  function getAssigneeValue(): string {
    if (task.assigneeId) return 'user:' + task.assigneeId
    if (task.assigneePersonId) return 'person:' + task.assigneePersonId
    return ''
  }

  // Get assignee display info
  const isPersonAssignee = !!(task.assigneePersonId && task.assigneePerson)
  const isUserAssignee = !!(task.assigneeId && task.assignee)
  const assigneeName = isUserAssignee
    ? task.assignee.name
    : isPersonAssignee
      ? task.assigneePerson.name
      : null
  const assigneeDetail = isPersonAssignee
    ? [task.assigneePerson.email, task.assigneePerson.company].filter(Boolean).join(' · ')
    : null

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="card p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{task.title}</h2>
        {task.description && (
          <p className="text-sm text-gray-500">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <span>Created by {task.creator?.name || 'Unknown'}</span>
          <span>&middot;</span>
          <span>{formatRelativeTime(task.createdAt)}</span>
          {saving && <span className="ml-auto text-blue-500">Saving...</span>}
        </div>
      </div>

      {/* Source message (if created from conversation) */}
      {task.sourceMessageId && (
        <div className="card p-4 border-l-4 border-l-blue-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-600">Created from conversation</span>
          </div>
          {task.sourcePersonName && (
            <p className="text-xs text-gray-500">
              From conversation with <span className="font-medium text-gray-700">{task.sourcePersonName}</span>
            </p>
          )}
        </div>
      )}

      {error && <InlineError message={error} />}

      {/* Status */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Status</label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(s => (
            <button
              key={s.value}
              onClick={() => updateField('status', s.value)}
              disabled={saving}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                task.status === s.value
                  ? s.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Priority</label>
        <div className="flex flex-wrap gap-2">
          {priorityOptions.map(p => (
            <button
              key={p.value}
              onClick={() => updateField('priority', p.value)}
              disabled={saving}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                task.priority === p.value
                  ? p.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">
          Assignee
          {isPersonAssignee && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
              External
            </span>
          )}
        </label>
        <select
          value={getAssigneeValue()}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          disabled={saving}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">Unassigned</option>
          {workspaceUsers.length > 0 && (
            <optgroup label="Team Members">
              {workspaceUsers.map(u => (
                <option key={'user:' + u.id} value={'user:' + u.id}>{u.name}</option>
              ))}
            </optgroup>
          )}
          {projectPersons.length > 0 && (
            <optgroup label="Project People (External)">
              {projectPersons.map(p => (
                <option key={'person:' + p.id} value={'person:' + p.id}>
                  {p.name}{p.company ? ` (${p.company})` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {isPersonAssignee && assigneeDetail && (
          <p className="text-xs text-gray-400 mt-1">{assigneeDetail}</p>
        )}
      </div>

      {/* Due Date */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Due Date</label>
        <input
          type="date"
          value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
          onChange={(e) => updateField('dueDate', e.target.value || null)}
          disabled={saving}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
        />
      </div>

      {/* Scheduled Date (Calendar Readiness) */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">
          Scheduled Date <span className="normal-case font-normal">(do on)</span>
        </label>
        <input
          type="date"
          value={task.scheduledDate ? new Date(task.scheduledDate).toISOString().split('T')[0] : ''}
          onChange={(e) => updateField('scheduledDate', e.target.value || null)}
          disabled={saving}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
        />
        <p className="text-xs text-gray-400 mt-1">When you plan to work on this task (for calendar sync)</p>
      </div>

      {/* Comments */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">
          Comments ({task.comments?.length || 0})
        </label>
        {task.comments?.length > 0 && (
          <div className="space-y-3 mb-4">
            {task.comments.map((c: any) => (
              <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">{c.author?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600">{c.content}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none"
          />
          <button
            onClick={handleAddComment}
            disabled={commentSaving || !commentText.trim()}
            className="self-end bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {commentSaving ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
