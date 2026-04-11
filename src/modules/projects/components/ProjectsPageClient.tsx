'use client'

import { useState } from 'react'
import { AddProjectForm } from './AddProjectForm'

export function ProjectsPageClient() {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      {showForm && (
        <div className="mb-4">
          <AddProjectForm onCancel={() => setShowForm(false)} />
        </div>
      )}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full card card-hover flex items-center gap-3 px-4 py-3.5 text-left group hover:border-[var(--color-cc-accent)]/30"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-cc-accent)]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--color-cc-text-muted)] group-hover:text-[var(--color-cc-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-sm text-[var(--color-cc-text-muted)] group-hover:text-[var(--color-cc-accent)] font-medium">New project...</span>
        </button>
      )}
    </>
  )
}
