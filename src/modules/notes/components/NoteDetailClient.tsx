'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateNoteAction, deleteNoteAction } from '@/modules/notes/note.actions'
import { InlineError } from '@/components/ErrorStates'
import { formatRelativeTime } from '@/lib/utils'

interface NoteDetailClientProps {
  note: {
    id: string
    title: string | null
    content: string
    type: string
    updatedAt: Date
    author: { id: string; name: string | null } | null
    project: { id: string; name: string } | null
  }
}

const typeConfig: Record<string, { label: string; bg: string; color: string }> = {
  QUICK: { label: 'Quick', bg: 'bg-amber-50', color: 'text-amber-600' },
  MEETING: { label: 'Meeting', bg: 'bg-purple-50', color: 'text-purple-600' },
  VOICE: { label: 'Voice', bg: 'bg-red-50', color: 'text-red-600' },
}

export function NoteDetailClient({ note }: NoteDetailClientProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  const cfg = typeConfig[note.type] || typeConfig.QUICK

  async function handleSave() {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      const result = await updateNoteAction(note.id, {
        title: title.trim() || undefined,
        content,
      })
      if (result.success) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to save')
      }
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      const result = await deleteNoteAction(note.id)
      if (result.success) {
        router.push('/notes')
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete')
        setDeleting(false)
      }
    } catch {
      setError('Failed to delete')
      setDeleting(false)
    }
  }

  function handleCancel() {
    setTitle(note.title || '')
    setContent(note.content)
    setError('')
    setConfirmingDelete(false)
    setEditing(false)
  }

  return (
    <div className="px-5 py-5 max-w-lg mx-auto pb-24">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-gray-400">{formatRelativeTime(note.updatedAt)}</span>
        {note.project && (
          <>
            <span className="text-xs text-gray-300">&middot;</span>
            <span className="text-xs text-gray-400">{note.project.name}</span>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            placeholder="Title"
            className="w-full text-xl font-bold bg-transparent outline-none placeholder:text-gray-300"
            autoFocus
            disabled={saving}
          />
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setError('') }}
            placeholder="Start writing..."
            rows={16}
            className="w-full text-base leading-relaxed bg-transparent outline-none resize-none placeholder:text-gray-300"
            disabled={saving}
          />
          <InlineError message={error} />
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-xs font-medium text-red-500 px-3 py-1.5"
            >
              {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-xs font-medium text-gray-400 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-semibold text-white bg-primary px-4 py-1.5 rounded-lg disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {note.title || 'Untitled'}
          </h2>
          {note.content ? (
            <p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">
              {note.content}
            </p>
          ) : (
            <p className="text-base text-gray-400 italic">No content</p>
          )}

          <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-500 px-3 py-1.5"
            >
              {deleting ? 'Deleting...' : confirmingDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-primary px-3 py-1.5"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
