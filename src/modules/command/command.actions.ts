'use server'

import { safeAction, requireRole } from '@/lib/action-utils'
import { classifyInput, executeCommand, executeMultiStepCommands } from './command.service'
import { commandPayloadSchema, type MultiStepEntry } from './command.types'
import { logActivity } from '@/modules/activity/activity.service'

/**
 * Step 1: Classify raw text/voice input.
 * Returns either { isCommand: true, command: ... } or { isCommand: false }
 * If not a command, the caller falls back to the capture pipeline.
 */
export async function classifyInputAction(formData: { text: string }) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const result = await classifyInput(formData.text, session.workspaceId)
    return result
  })
}

/**
 * Step 2: Execute a confirmed command.
 * ONLY called after user explicitly confirms the command preview.
 * All mutations happen here — never auto-executed.
 */
export async function executeCommandAction(formData: Record<string, unknown>) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const command = commandPayloadSchema.parse(formData)

    const result = await executeCommand(
      command,
      session.workspaceId,
      session.user.id,
    )

    // Log activity for mutations (not navigation)
    if (result.intent !== 'navigate') {
      const entityMap: Record<string, { type: string; id: string }> = {
        create_task: { type: 'TASK', id: 'taskId' in result ? (result as any).taskId : '' },
        assign_task: { type: 'TASK', id: 'taskId' in result ? (result as any).taskId : '' },
        complete_task: { type: 'TASK', id: 'taskId' in result ? (result as any).taskId : '' },
        create_project: { type: 'PROJECT', id: 'projectId' in result ? (result as any).projectId : '' },
        add_member: { type: 'PROJECT', id: 'projectId' in result ? (result as any).projectId : '' },
        create_event: { type: 'EVENT', id: 'eventId' in result ? (result as any).eventId : '' },
        save_note: { type: 'NOTE', id: 'noteId' in result ? (result as any).noteId : '' },
      }

      const entity = entityMap[result.intent]
      if (entity) {
        const action = result.intent === 'complete_task' ? 'STATUS_CHANGED'
          : result.intent === 'assign_task' ? 'ASSIGNED'
          : 'CREATED'

        await logActivity(
          action as any,
          entity.type as any,
          entity.id,
          session.user.id,
          { source: 'voice_command', intent: result.intent },
        )
      }
    }

    return result
  })
}

/**
 * Step 3: Execute multiple confirmed commands sequentially.
 * Stop-on-failure: if one command fails, remaining are skipped.
 * Each successful mutation is logged.
 */
export async function executeMultiStepCommandAction(
  steps: MultiStepEntry[],
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Validate all commands before executing
    const validatedSteps: MultiStepEntry[] = steps.map((step) => ({
      ...step,
      command: commandPayloadSchema.parse(step.command),
    }))

    const results = await executeMultiStepCommands(
      validatedSteps,
      session.workspaceId,
      session.user.id,
    )

    // Log activity for each successful mutation
    for (const step of results) {
      if (step.status !== 'success' || !step.result) continue
      if (step.result.intent === 'navigate') continue

      const entityMap: Record<string, { type: string; id: string }> = {
        create_task: { type: 'TASK', id: 'taskId' in step.result ? (step.result as any).taskId : '' },
        assign_task: { type: 'TASK', id: 'taskId' in step.result ? (step.result as any).taskId : '' },
        complete_task: { type: 'TASK', id: 'taskId' in step.result ? (step.result as any).taskId : '' },
        create_project: { type: 'PROJECT', id: 'projectId' in step.result ? (step.result as any).projectId : '' },
        add_member: { type: 'PROJECT', id: 'projectId' in step.result ? (step.result as any).projectId : '' },
        create_event: { type: 'EVENT', id: 'eventId' in step.result ? (step.result as any).eventId : '' },
        save_note: { type: 'NOTE', id: 'noteId' in step.result ? (step.result as any).noteId : '' },
      }

      const entity = entityMap[step.result.intent]
      if (entity) {
        const action = step.result.intent === 'complete_task' ? 'STATUS_CHANGED'
          : step.result.intent === 'assign_task' ? 'ASSIGNED'
          : 'CREATED'

        await logActivity(
          action as any,
          entity.type as any,
          entity.id,
          session.user.id,
          { source: 'voice_command_multi', intent: step.result.intent },
        )
      }
    }

    return results
  })
}
