'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTaskAction } from '@/modules/tasks/task.actions'

interface AddTaskInlineProps {
  projectId: string
  onCancel?: () => void
}

export function AddTaskInline({ projectId, onCancel }: AddTaskInlineProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await createTaskAction({ title: title.trim(), projectId, priority })
      if (result.success) {
        setTitle('')
        setPriority('MEDIUM')
        router.refresh()
      } else {
        setError(result.error || 'Failed to create task')
      }
    } catch {
      setError('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const priorities = [
    { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-500' },
    { value: 'MEDIUM', label: 'Med', color: 'bg-blue-50 text-blue-600' },
    { value: 'HIGH', label: 'High', color: 'bg-orange-50 text-orange-600' },
    { value: 'URGENT', label: '!!!', color: 'bg-red-50 text-red-600' },
  ] as const

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError('') }}
        placeholder="What needs to be done?"
        className="w-full text-sm font-medium bg-transparent outline-none placeholder:text-gray-400"
        autoFocus
        disabled={saving}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {priorities.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              disabled={saving}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                priority === p.value ? p.color + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-gray-50 text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={saving} className="text-xs text-gray-400 font-medium px-3 py-1.5">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="text-xs font-semibold text-white bg-primary px-4 py-1.5 rounded-lg disabled:opacity-40"
          >
            {saving ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}
