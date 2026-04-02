'use client'

import { useState } from 'react'
import { quickStatusAction } from '@/modules/tasks/task.actions'

export function TaskCheckbox({ taskId, status }: { taskId: string; status: string }) {
  const [isDone, setIsDone] = useState(status === 'DONE')
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    const prev = isDone
    const newStatus: 'TODO' | 'DONE' = prev ? 'TODO' : 'DONE'
    setIsDone(!prev)
    try {
      const result = await quickStatusAction(taskId, newStatus)
      if (!result.success) {
        setIsDone(prev)
      }
    } catch {
      setIsDone(prev)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
        isDone
          ? 'bg-green-500 border-green-500'
          : 'border-gray-300 hover:border-primary active:scale-90'
      } ${loading ? 'opacity-50' : ''}`}
    >
      {isDone && (
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}
