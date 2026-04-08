'use client'

import { TaskCheckbox } from './TaskCheckbox'

/**
 * Wrapper that prevents link navigation when clicking the checkbox.
 * Needed because the parent is a Server Component (page.tsx) which
 * cannot use onClick handlers directly (React 19 restriction).
 */
export function TaskCheckboxWrapper({ taskId, status }: { taskId: string; status: string }) {
  return (
    <div className="flex-shrink-0" onClick={(e) => e.preventDefault()}>
      <TaskCheckbox taskId={taskId} status={status} />
    </div>
  )
}
