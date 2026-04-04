'use server'

import { safeAction, requireRole } from '@/lib/action-utils'
import { captureInputSchema, captureConfirmSchema } from './capture.types'
import { parseCapture, executeCapture } from './capture.service'
import { logActivity } from '@/modules/activity/activity.service'

/**
 * Step 1: User submits raw text → AI classifies and returns structured draft.
 * Only OWNER and TEAM can capture (CLIENT cannot create tasks/projects).
 */
export async function parseCaptureAction(formData: { text: string }) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = captureInputSchema.parse(formData)

    const draft = await parseCapture(validated.text, session.workspaceId)
    return draft
  })
}

/**
 * Step 2: User confirms the draft → system executes based on classification.
 *
 * Execution per type:
 *   project     → create project + tasks, log activity
 *   task_bundle → add tasks to existing project, log activity
 *   follow_up   → create single task, log activity
 *   decision    → persist as Note (structured JSON)
 *   session     → persist as Note (structured JSON)
 *   note        → persist as Note (human-readable text)
 *   message     → persist as Note (structured message draft)
 */
export async function executeCaptureAction(formData: Record<string, unknown>) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = captureConfirmSchema.parse(formData)

    const result = await executeCapture(
      validated,
      session.workspaceId,
      session.user.id,
    )

    // Log activity for types that write to the DB
    switch (result.classification) {
      case 'project':
        await logActivity(
          'CREATED',
          'PROJECT',
          result.projectId,
          session.user.id,
          { source: 'capture', type: 'project', taskCount: result.taskIds.length },
        )
        break

      case 'task_bundle':
        await logActivity(
          'CREATED',
          'TASK',
          result.taskIds[0] ?? result.projectId,
          session.user.id,
          { source: 'capture', type: 'task_bundle', taskCount: result.taskIds.length, projectId: result.projectId },
        )
        break

      case 'follow_up':
        await logActivity(
          'CREATED',
          'TASK',
          result.taskId,
          session.user.id,
          { source: 'capture', type: 'follow_up', projectId: result.projectId },
        )
        break

      case 'decision':
        await logActivity(
          'CREATED',
          'NOTE',
          result.noteId,
          session.user.id,
          { source: 'capture', type: 'decision', projectId: result.projectId },
        )
        break

      case 'session':
        await logActivity(
          'CREATED',
          'NOTE',
          result.noteId,
          session.user.id,
          { source: 'capture', type: 'session', projectId: result.projectId },
        )
        break

      case 'note':
        await logActivity(
          'CREATED',
          'NOTE',
          result.noteId,
          session.user.id,
          { source: 'capture', type: 'note', projectId: result.projectId },
        )
        break

      case 'message':
        await logActivity(
          'CREATED',
          'NOTE',
          result.noteId,
          session.user.id,
          { source: 'capture', type: 'message', projectId: result.projectId },
        )
        break
    }

    return result
  })
}
