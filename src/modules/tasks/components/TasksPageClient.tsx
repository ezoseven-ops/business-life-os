'use client'

import { useState } from 'react'
import { AddTaskInline } from './AddTaskInline'

export function TasksPageClient({
  defaultProjectId,
  showInitially,
}: {
  defaultProjectId?: string
  showInitially?: boolean
}) {
  const [showForm, setShowForm] = useState(showInitially || false)

  if (!defaultProjectId) return null

  return (
    <div>
      {showForm ? (
        <AddTaskInline projectId={defaultProjectId} onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full card flex items-center gap-3 px-4 py-3.5 text-left group hover:border-[var(--color-cc-accent)]/30"
        >
          <div className="w-6 h-6 rounded-full border-2 border-dashed border-white/10 group-hover:border-[var(--color-cc-accent)] flex items-center justify-center">
            <svg className="w-3 h-3 text-[var(--color-cc-text-muted)] group-hover:text-[var(--color-cc-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-sm text-[var(--color-cc-text-muted)] group-hover:text-[var(--color-cc-accent)] font-medium">Add a task...</span>
        </button>
      )}
    </div>
  )
}
