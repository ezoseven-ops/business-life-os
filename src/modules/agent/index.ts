// ─────────────────────────────────────────────
// Agent Module — Public API
// ─────────────────────────────────────────────

// Types
export type {
  AgentSession,
  AgentAction,
  AgentResponse,
  AgentRoutingResult,
  AgentSessionSnapshot,
  AgentSuggestion,
  AgentLogEntry,
  FocusEntity,
  FocusEntityType,
  UnresolvedItem,
  AgentInputType,
} from './agent.types'

// Service (server-side orchestrator)
export {
  processInput,
  recordCommandExecution,
  recordMultiStepExecution,
  recordCaptureExecution,
  setProjectContext,
  setEntityContext,
  getSessionSnapshot,
} from './agent.service'

// Context manager
export {
  getSession,
  recordAction,
  resolveReference,
  buildContextSummary,
  buildSnapshot,
  cleanupExpiredSessions,
} from './agent-context'

// Logger
export {
  agentLog,
  getSessionLogs,
  clearSessionLogs,
  createPhaseTimer,
} from './agent-logger'
