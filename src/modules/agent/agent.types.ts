// ─────────────────────────────────────────────
// Agent Layer Types
//
// The agent is a persistent, context-aware AI operator.
// It maintains session state across interactions,
// resolves references ("this", "that", "him"),
// and decides HOW to process each input based on
// what it knows about the current operational context.
//
// This is NOT chat. This is the intelligence layer
// that operates the system FOR the founder.
// ─────────────────────────────────────────────

import type { CommandPayload, CommandResult, MultiStepEntry } from '@/modules/command/command.types'
import type { CaptureDraft, CaptureResult } from '@/modules/capture/capture.types'

// ─────────────────────────────────────────────
// Agent Session — in-memory operational context
// ─────────────────────────────────────────────

/** Entity type currently in focus */
export type FocusEntityType = 'project' | 'task' | 'person' | 'event' | 'note' | null

/** A reference to the entity the agent is currently working with */
export interface FocusEntity {
  type: FocusEntityType
  id: string
  name: string
}

/** A completed action the agent remembers */
export interface AgentAction {
  type: 'command' | 'capture' | 'multi_step' | 'conversational'
  intent: string
  interpretation: string
  result: CommandResult | CaptureResult | MultiStepEntry[] | null
  entities: FocusEntity[]   // entities created/modified by this action
  timestamp: number
}

/** Unresolved item the agent noticed but didn't act on */
export interface UnresolvedItem {
  type: 'missing_deadline' | 'no_assignee' | 'ambiguous_reference' | 'missing_project'
  description: string
  relatedEntityId?: string
  timestamp: number
}

/** Full agent session — everything the agent knows right now */
export interface AgentSession {
  /** Session identity */
  sessionId: string
  workspaceId: string
  userId: string

  /** Current focus: what project/entity the user is working in */
  currentProject: { id: string; name: string } | null
  currentEntity: FocusEntity | null

  /** Recent action history (last 10, newest first) */
  actionHistory: AgentAction[]

  /** Items the agent noticed but couldn't resolve */
  unresolvedItems: UnresolvedItem[]

  /** When this session was last active */
  lastActiveAt: number
  createdAt: number
}

// ─────────────────────────────────────────────
// Agent Router — input classification
// ─────────────────────────────────────────────

/**
 * How the agent classifies input, considering context.
 *
 * Goes beyond simple command/capture:
 * - 'command': execute a mutation
 * - 'multi_step': multiple mutations
 * - 'capture': structure new information
 * - 'follow_up': modifies/references the last action ("change that", "add deadline")
 * - 'clarification_response': answers the agent's question ("the first one", "Tomek K.")
 * - 'question': user asking the agent something ("how many tasks in project X?")
 * - 'correction': user wants to undo/change last action ("no, assign to someone else")
 */
export type AgentInputType =
  | 'command'
  | 'multi_step'
  | 'capture'
  | 'follow_up'
  | 'clarification_response'
  | 'question'
  | 'correction'

/** The agent's routing decision */
export interface AgentRoutingResult {
  inputType: AgentInputType
  interpretation: string
  confidence: number         // 0-1, how sure the agent is

  /** For commands: the parsed payload */
  command?: CommandPayload
  commands?: CommandPayload[]

  /** For follow-ups: what the agent thinks the user wants to change */
  followUpAction?: {
    targetAction: AgentAction   // what we're modifying
    modification: string        // natural language: "change assignee to X"
    resolvedCommand?: CommandPayload  // the resolved command if possible
  }

  /** For questions: the agent's answer (no mutation needed) */
  answer?: string

  /** For clarification: what the agent needs to know */
  clarificationNeeded?: {
    question: string
    options: string[]
  }

  /** For captures: falls through to existing capture pipeline */
  captureText?: string

  /** Proactive suggestions after the action */
  suggestions?: AgentSuggestion[]
}

/** A proactive suggestion the agent offers */
export interface AgentSuggestion {
  type: 'missing_deadline' | 'suggest_assignee' | 'follow_up_needed' | 'related_task'
  message: string
  actionHint?: CommandPayload   // pre-built command the user can confirm
}

// ─────────────────────────────────────────────
// Agent Response — what the UI renders
// ─────────────────────────────────────────────

export interface AgentResponse {
  /** The routing decision */
  routing: AgentRoutingResult

  /** Updated session (client receives this to stay in sync) */
  sessionSnapshot: AgentSessionSnapshot

  /** Whether the agent is waiting for user input */
  awaitingInput: boolean
}

/** Minimal session state sent to the client */
export interface AgentSessionSnapshot {
  sessionId: string
  currentProject: { id: string; name: string } | null
  currentEntityType: FocusEntityType
  currentEntityName: string | null
  lastActionInterpretation: string | null
  actionCount: number
  hasUnresolved: boolean
  /** BLOCK 5: true when the previous session expired and a fresh one was created */
  sessionExpired: boolean
}

// ─────────────────────────────────────────────
// Agent Log Entry — every decision is recorded
// ─────────────────────────────────────────────

export interface AgentLogEntry {
  sessionId: string
  timestamp: number
  phase: 'input' | 'route' | 'resolve' | 'execute' | 'suggest' | 'error'
  message: string
  data?: Record<string, unknown>
}
