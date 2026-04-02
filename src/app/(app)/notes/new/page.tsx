'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { createNoteAction } from '@/modules/notes/note.actions'

export default function QuickCapturePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (saving) return
    if (!content.trim() && !title.trim()) return
    setError('')
    setSaving(true)
    try {
      const result = await createNoteAction({
        title: title || undefined,
        content,
        type: 'QUICK',
      })
      if (result.success) {
        router.push('/notes')
        router.refresh()
      } else {
        setError(result.error || 'Failed to save note')
      }
    } catch {
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <Header
        title="Quick Note"
        backHref="/"
        action={
          <button
            onClick={handleSave}
            disabled={saving || (!content.trim() && !title.trim())}
            className="text-sm font-semibold text-primary disabled:text-gray-300"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="px-5 py-5 max-w-lg mx-auto space-y-2">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError('') }}
          className="w-full text-xl font-bold bg-transparent outline-none placeholder:text-gray-300"
          autoFocus
          disabled={saving}
        />
        <textarea
          placeholder="Start writing..."
          value={content}
          onChange={(e) => { setContent(e.target.value); setError('') }}
          rows={16}
          className="w-full text-base leading-relaxed bg-transparent outline-none resize-none placeholder:text-gray-300"
          disabled={saving}
        />
        {error && (
          <p className="text-sm text-red-500 text-center pt-2">{error}</p>
        )}
      </div>
    </div>
  )
}
