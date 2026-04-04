'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTaskAction } from '@/modules/tasks/task.actions'
import { InlineError } from '@/components/ErrorStates'
import { addCommentAction } from '@/modules/comments/comment.actions'
import { formatRelativeTime } from '@/lib/utils'

interface TaskData {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  assigneeId: string | null
  projectId: string
  projectName: string
  assigneeName: string | null
  creatorName: string
  createdAt: string
  sourceMessageId: string | null
  sourcePersonName: string | null
  sourcePersonId: string | null
  comments: { id: string; content: string; authorName: string; createdAt: string }[]
}

interface Props {
  task: TaskData
  users: { id: string; name: string }[]
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

export function TaskDetailClient({ task, users }: Props) {
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

  const currentStatus = statusOptions.find(s => s.value === task.status)
  const currentPriority = priorityOptions.find(p => p.value === task.priority)

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="card p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">{task.title}</h2>
        {task.description && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <span>{task.projectName}</span>
          <span>&middot;</span>
          <span>by {task.creatorName}</span>
          <span>&middot;</span>
          <span>{formatRelativeTime(task.createdAt)}</span>
        </div>
      </div>

      {/* Source message (if created from conversation) */}
      {task.sourceMessageId && (
        <div className="card p-4 border-l-4 border-l-blue-400">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Created from conversation</span>
          </div>
          {task.sourcePersonName && task.sourcePersonId && (
            <a href={`/inbox/${task.sourcePersonId}`} className="text-sm text-primary font-medium hover:underline">
              View thread with {task.sourcePersonName}
            </a>
          )}
        </div>
      )}

      <InlineError message={error} />

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
                  ? s.color + ' ring-2 ring-offset-1 ring-gray-300'
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
                  ? p.color + ' ring-2 ring-offset-1 ring-gray-300'
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
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Assignee</label>
        <select
          value={task.assigneeId || ''}
          onChange={(e) => updateField('assigneeId', e.target.value || null)}
          disabled={saving}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-gray-200 focus:border-primary"
        >
          <option value="">Unassigned</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Due Date */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Due Date</label>
        <input
          type="date"
          value={task.dueDate ? task.dueDate.split('T')[0] : ''}
          onChange={(e) => updateField('dueDate', e.target.value || null)}
          disabled={saving}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-gray-200 focus:border-primary"
        />
      </div>

      {/* Comments */}
      <div className="card p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">
          Comments ({task.comments.length})
        </label>

        {task.comments.length > 0 && (
          <div className="space-y-3 mb-4">
            {task.comments.map(c => (
              <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">{c.authorName}</span>
                  <span className="text-[10px] text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none resize-none border border-gray-200 focus:border-primary"
            disabled={commentSaving}
          />
          <button
            onClick={handleAddComment}
            disabled={!commentText.trim() || commentSaving}
            className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
