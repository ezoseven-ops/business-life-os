import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/sentry'
import {
  getSession,
  recordAction,
  addUnresolved,
  clearUnresolved,
  setCurrentProject,
  setCurrentEntity,
  buildSnapshot,
  extractEntitiesFromCommandResult,
  extractEntitiesFromCaptureResult,
} from './agent-context'
import { routeAgentInput } from './agent-router'
import { agentLog, createPhaseTimer } from './agent-logger'
import type {
  AgentSession,
  AgentAction,
  AgentResponse,
  AgentRoutingResult,
  FocusEntity,
} from './agent.types'
import type { CommandPayload, CommandResult, MultiStepEntry } from '@/modules/command/command.types'
import type { CaptureResult } from '@/modules/capture/capture.types'

// ─────────────────────────────────────────────
// Agent Service — The Orchestrator
//
// Single entry point for all agent interactions.
// Now async throughout (BLOCK 1: DB-backed sessions).
// ─────────────────────────────────────────────

const log = createLogger('AgentService')

/**
 * Process user input through the agent intelligence layer.
 * Returns routing result + session snapshot for the UI.
 * Does NOT execute anything — classifies and validates only.
 */
export async function processInput(
  text: string,
  workspaceId: string,
  userId: string,
): Promise<AgentResponse> {
  const { session, wasExpired } = await getSession(workspaceId, userId)
  const timer = createPhaseTimer(session.sessionId, 'input', 'Processing input')

  agentLog(session.sessionId, 'input', 'Received input', {
    text: text.substring(0, 200),
    wasExpired,
    currentProject: session.currentProject?.name ?? null,
    currentEntity: session.currentEntity?.name ?? null,
  })

  try {
    // Route through AI
    const routeTimer = createPhaseTimer(session.sessionId, 'route', 'AI routing')
    const routing = await routeAgentInput(text, session, workspaceId)
    routeTimer.end({ inputType: routing.inputType, confidence: routing.confidence })

    // Pre-execution validation
    const validated = validateRouting(routing, session)

    // Handle question — record as conversational
    if (validated.inputType === 'question' && validated.answer) {
      await recordConversationalAction(session, text, validated.answer)
    }

    // Handle clarification response — clear unresolved
    if (validated.inputType === 'clarification_response') {
      await clearUnresolved(session, 'ambiguous_reference')
    }

    const awaitingInput = !!validated.clarificationNeeded
      || validated.inputType === 'question'
      || validated.confidence < 0.6

    const response: AgentResponse = {
      routing: validated,
      sessionSnapshot: buildSnapshot(session, wasExpired),
      awaitingInput,
    }

    timer.end({ inputType: validated.inputType })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    agentLog(session.sessionId, 'error', 'Processing failed', { error: message })
    log.error('Agent processing failed', { error: message, sessionId: session.sessionId })
    captureError(error, { module: 'agent', action: 'processInput', userId, workspaceId })

    return {
      routing: {
        inputType: 'question',
        interpretation: 'Something went wrong processing your input. Please try again.',
        confidence: 0,
        answer: 'I encountered an error. Could you try rephrasing?',
      },
      sessionSnapshot: buildSnapshot(session, wasExpired),
      awaitingInput: true,
    }
  }
}

/**
 * Record a completed command execution into the session.
 */
export async function recordCommandExecution(
  workspaceId: string,
  userId: string,
  command: CommandPayload,
  result: CommandResult,
  interpretation: string,
): Promise<void> {
  const { session } = await getSession(workspaceId, userId)
  const entities = extractEntitiesFromCommandResult(result, command)

  const action: AgentAction = {
    type: 'command',
    intent: command.intent,
    interpretation,
    result,
    entities,
    timestamp: Date.now(),
  }

  await recordAction(session, action)

  agentLog(session.sessionId, 'execute', 'Command recorded', {
    intent: command.intent,
    entityCount: entities.length,
    entities: entities.map((e) => `${e.type}:${e.name}`),
  })

  await checkForUnresolved(session, command, entities)
}

/**
 * Record a completed multi-step execution.
 */
export async function recordMultiStepExecution(
  workspaceId: string,
  userId: string,
  steps: MultiStepEntry[],
  interpretation: string,
): Promise<void> {
  const { session } = await getSession(workspaceId, userId)

  const allEntities: FocusEntity[] = []
  for (const step of steps) {
    if (step.status === 'success' && step.result) {
      const entities = extractEntitiesFromCommandResult(step.result, step.command)
      allEntities.push(...entities)
    }
  }

  const action: AgentAction = {
    type: 'multi_step',
    intent: steps.map((s) => s.command.intent).join('+'),
    interpretation,
    result: steps,
    entities: allEntities,
    timestamp: Date.now(),
  }

  await recordAction(session, action)
}

/**
 * Record a completed capture execution.
 */
export async function recordCaptureExecution(
  workspaceId: string,
  userId: string,
  result: CaptureResult,
  interpretation: string,
): Promise<void> {
  const { session } = await getSession(workspaceId, userId)
  const entities = extractEntitiesFromCaptureResult(result)

  const action: AgentAction = {
    type: 'capture',
    intent: result.classification,
    interpretation,
    result,
    entities,
    timestamp: Date.now(),
  }

  await recordAction(session, action)
}

/**
 * Set project context.
 */
export async function setProjectContext(
  workspaceId: string,
  userId: string,
  project: { id: string; name: string } | null,
): Promise<void> {
  const { session } = await getSession(workspaceId, userId)
  await setCurrentProject(session, project)
}

/**
 * Set entity focus.
 */
export async function setEntityContext(
  workspaceId: string,
  userId: string,
  entity: FocusEntity | null,
): Promise<void> {
  const { session } = await getSession(workspaceId, userId)
  await setCurrentEntity(session, entity)
}

/**
 * Get current session snapshot for the client.
 */
export async function getSessionSnapshot(
  workspaceId: string,
  userId: string,
) {
  const { session, wasExpired } = await getSession(workspaceId, userId)
  return buildSnapshot(session, wasExpired)
}

// ─── Internal helpers ───

function validateRouting(
  routing: AgentRoutingResult,
  session: AgentSession,
): AgentRoutingResult {
  // Follow-up without history → downgrade
  if (routing.inputType === 'follow_up' && session.actionHistory.length === 0) {
    log.warn('Follow-up without action history, downgrading', {
      sessionId: session.sessionId,
    })
    if (routing.command) {
      return { ...routing, inputType: 'command' }
    }
    return {
      ...routing,
      inputType: 'question',
      clarificationNeeded: {
        question: routing.interpretation || 'I don\'t have context for that reference. What are you referring to?',
        options: [],
      },
    }
  }

  // Clarification response without unresolved → treat as command
  if (routing.inputType === 'clarification_response' && session.unresolvedItems.length === 0) {
    if (routing.command) {
      return { ...routing, inputType: 'command' }
    }
  }

  // Correction without history
  if (routing.inputType === 'correction' && session.actionHistory.length === 0) {
    return {
      ...routing,
      inputType: 'question',
      answer: 'There\'s nothing to correct — no recent actions in this session.',
      clarificationNeeded: undefined,
    }
  }

  return routing
}

async function recordConversationalAction(
  session: AgentSession,
  input: string,
  _answer: string,
): Promise<void> {
  const action: AgentAction = {
    type: 'conversational',
    intent: 'question',
    interpretation: input.substring(0, 200),
    result: null,
    entities: [],
    timestamp: Date.now(),
  }
  await recordAction(session, action)
}

async function checkForUnresolved(
  session: AgentSession,
  command: CommandPayload,
  entities: FocusEntity[],
): Promise<void> {
  if (command.intent === 'create_task') {
    const cmd = command as Extract<CommandPayload, { intent: 'create_task' }>
    if (!cmd.dueDate) {
      await addUnresolved(session, {
        type: 'missing_deadline',
        description: `Task "${cmd.title}" has no deadline`,
        relatedEntityId: entities.find((e) => e.type === 'task')?.id,
        timestamp: Date.now(),
      })
    }
    if (!cmd.assigneeName && !cmd.assigneeId) {
      await addUnresolved(session, {
        type: 'no_assignee',
        description: `Task "${cmd.title}" has no assignee`,
        relatedEntityId: entities.find((e) => e.type === 'task')?.id,
        timestamp: Date.now(),
      })
    }
  }
}
