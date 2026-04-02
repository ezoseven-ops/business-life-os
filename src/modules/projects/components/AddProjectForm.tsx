'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectAction } from '@/modules/projects/project.actions'

export function AddProjectForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setError('')
    setSaving(true)
    try {
      const result = await createProjectAction({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      if (result.success) {
        router.refresh()
        onCancel()
      } else {
        setError(result.error || 'Failed to create project')
      }
    } catch {
      setError('Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        placeholder="Project name"
        className="w-full text-sm font-semibold bg-transparent outline-none placeholder:text-gray-400"
        autoFocus
        disabled={saving}
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description (optional)"
        className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
        disabled={saving}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="text-xs text-gray-400 font-medium px-3 py-1.5">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="text-xs font-semibold text-white bg-primary px-4 py-1.5 rounded-lg disabled:opacity-40"
        >
          {saving ? '...' : 'Create'}
        </button>
      </div>
    </form>
  )
}
