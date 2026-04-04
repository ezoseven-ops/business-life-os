'use server'

import { safeAction, requireRole } from '@/lib/action-utils'
import { checkAiRateLimit } from '@/lib/rate-limit'
import {
  processInput,
  recordCommandExecution,
  recordMultiStepExecution,
  recordCaptureExecution,
  setProjectContext,
  setEntityContext,
  getSessionSnapshot,
} from './agent.service'
import { commandPayloadSchema } from '@/modules/command/command.types'
import { executeCommand, executeMultiStepCommands } from '@/modules/command/command.service'
import { parseCapture, executeCapture } from '@/modules/capture/capture.service'
import { logActivity } from '@/modules/activity/activity.service'
import type { CommandResult, MultiStepEntry } from '@/modules/command/command.types'
import type { FocusEntity } from './agent.types'

// ─────────────────────────────────────────────
// Agent Server Actions
//
// These are the public-facing server actions that
// the UI calls. They combine the agent intelligence
// layer with the existing command/capture execution.
//
// Key difference from command.actions.ts:
// - Input goes through AgentRouter (context-aware)
// - Execution results are recorded back into the session
// - Session context persists across interactions
// ─────────────────────────────────────────────

/**
 * Process input through the agent intelligence layer.
 * Returns routing result + session snapshot.
 * Does NOT execute — waits for user confirmation.
 */
export async function agentProcessInputAction(formData: { text: string }) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Rate limit: 10/min, 50/hr per user
    const rateCheck = checkAiRateLimit(session.user.id)
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.`)
    }
    return processInput(formData.text, session.workspaceId, session.user.id)
  })
}

/**
 * Execute a confirmed command AND record it in the agent session.
 * This replaces executeCommandAction when in agent mode.
 */
export async function agentExecuteCommandAction(
  formData: Record<string, unknown>,
  interpretation: string,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const command = commandPayloadSchema.parse(formData)

    // Execute the command
    const result = await executeCommand(
      command,
      session.workspaceId,
      session.user.id,
    )

    // Record in agent session for context continuity
    recordCommandExecution(
      session.workspaceId,
      session.user.id,
      command,
      result,
      interpretation,
    )

    // Log activity (same as standard command)
    if (result.intent !== 'navigate') {
      logCommandActivity(result, session.user.id)
    }

    return result
  })
}

/**
 * Execute confirmed multi-step commands AND record in agent session.
 */
export async function agentExecuteMultiStepAction(
  steps: MultiStepEntry[],
  interpretation: string,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Validate all commands
    const validatedSteps: MultiStepEntry[] = steps.map((step) => ({
      ...step,
      command: commandPayloadSchema.parse(step.command),
    }))

    // Execute
    const results = await executeMultiStepCommands(
      validatedSteps,
      session.workspaceId,
      session.user.id,
    )

    // Record in agent session
    recordMultiStepExecution(
      session.workspaceId,
      session.user.id,
      results,
      interpretation,
    )

    // Log activity for each successful step
    for (const step of results) {
      if (step.status === 'success' && step.result && step.result.intent !== 'navigate') {
        logCommandActivity(step.result, session.user.id)
      }
    }

    return results
  })
}

/**
 * Execute the agent's capture routing.
 * When the agent classifies input as 'capture', this:
 * 1. Passes text through the capture pipeline
 * 2. Records the result in the agent session
 */
export async function agentParseCaptureAction(formData: { text: string }) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const draft = await parseCapture(formData.text, session.workspaceId)
    return draft
  })
}

/**
 * Execute a confirmed capture AND record in agent session.
 */
export async function agentExecuteCaptureAction(
  formData: Record<string, unknown>,
  interpretation: string,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Execute capture
    const result = await executeCapture(
      formData as any,
      session.workspaceId,
      session.user.id,
    )

    // Record in agent session
    recordCaptureExecution(
      session.workspaceId,
      session.user.id,
      result,
      interpretation,
    )

    return result
  })
}

/**
 * Update the agent's project context.
 * Called when user navigates to a project page.
 */
export async function agentSetProjectContextAction(
  project: { id: string; name: string } | null,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    setProjectContext(session.workspaceId, session.user.id, project)
    return { updated: true }
  })
}

/**
 * Update the agent's entity focus.
 * Called when user views a specific task, person, etc.
 */
export async function agentSetEntityContextAction(
  entity: FocusEntity | null,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    setEntityContext(session.workspaceId, session.user.id, entity)
    return { updated: true }
  })
}

/**
 * Get current agent session snapshot.
 * Used by the UI to display agent state.
 */
export async function agentGetSnapshotAction() {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    return getSessionSnapshot(session.workspaceId, session.user.id)
  })
}

// ─── Helpers ───

function logCommandActivity(result: CommandResult, userId: string): void {
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
  if (!entity) return

  const action = result.intent === 'complete_task' ? 'STATUS_CHANGED'
    : result.intent === 'assign_task' ? 'ASSIGNED'
    : 'CREATED'

  // Fire and forget — don't block on logging
  logActivity(
    action as any,
    entity.type as any,
    entity.id,
    userId,
    { source: 'agent_mode', intent: result.intent },
  ).catch(() => {
    // Swallow — activity logging should never block execution
  })
}
