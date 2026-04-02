'use client'

import { useState } from 'react'
import { addCommentAction } from '@/modules/comments/comment.actions'

export function ClientTaskDetailClient({ taskId }: { taskId: string }) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return

    setLoading(true)
    await addCommentAction({ content: comment.trim(), taskId })
    setComment('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment..."
        className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
      />
      <button
        type="submit"
        disabled={loading || !comment.trim()}
        className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {loading ? '...' : 'Send'}
      </button>
    </form>
  )
}
