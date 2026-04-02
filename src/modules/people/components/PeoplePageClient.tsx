'use client'

import { useState } from 'react'
import { AddPersonInline } from './AddPersonInline'

export function PeoplePageClient({
  showInitially,
}: {
  showInitially?: boolean
}) {
  const [showForm, setShowForm] = useState(showInitially || false)

  return (
    <div>
      {showForm ? (
        <AddPersonInline onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full card flex items-center gap-3 px-4 py-3.5 text-left group hover:border-primary/30"
        >
          <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 group-hover:border-primary flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-400 group-hover:text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="text-sm text-gray-400 group-hover:text-primary font-medium">Add a person...</span>
        </button>
      )}
    </div>
  )
}
