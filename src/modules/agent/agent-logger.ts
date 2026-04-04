import { createLogger } from '@/lib/logger'
import type { AgentLogEntry } from './agent.types'

// ─────────────────────────────────────────────
// Agent Structured Logger
//
// Every agent decision is recorded as a structured
// log entry. In development, logs go to stdout.
// In production, logs are JSON for structured ingestion.
//
// This is separate from the general logger to support:
// - Session-scoped log retrieval
// - Decision audit trails
// - Performance measurement (duration per phase)
// - Future: persistent log storage (DB/S3)
// ─────────────────────────────────────────────

const log = createLogger('Agent')

/** In-memory log buffer per session (capped at 100 entries) */
const sessionLogs = new Map<string, AgentLogEntry[]>()

const MAX_LOG_ENTRIES = 100

/**
 * Record a structured agent log entry.
 * Logs to both the general logger and the in-memory session buffer.
 */
export function agentLog(
  sessionId: string,
  phase: AgentLogEntry['phase'],
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry: AgentLogEntry = {
    sessionId,
    timestamp: Date.now(),
    phase,
    message,
    data,
  }

  // Write to general logger
  switch (phase) {
    case 'error':
      log.error(`[${phase}] ${message}`, { sessionId, ...data })
      break
    default:
      log.info(`[${phase}] ${message}`, { sessionId, ...data })
      break
  }

  // Buffer in memory for session retrieval
  let buffer = sessionLogs.get(sessionId)
  if (!buffer) {
    buffer = []
    sessionLogs.set(sessionId, buffer)
  }
  buffer.push(entry)

  // Cap buffer size
  if (buffer.length > MAX_LOG_ENTRIES) {
    sessionLogs.set(sessionId, buffer.slice(-MAX_LOG_ENTRIES))
  }
}

/**
 * Retrieve logs for a specific session.
 * Optionally filter by phase.
 */
export function getSessionLogs(
  sessionId: string,
  phase?: AgentLogEntry['phase'],
): AgentLogEntry[] {
  const buffer = sessionLogs.get(sessionId) ?? []
  if (phase) {
    return buffer.filter((e) => e.phase === phase)
  }
  return buffer
}

/**
 * Clear logs for a session (called on session expiry).
 */
export function clearSessionLogs(sessionId: string): void {
  sessionLogs.delete(sessionId)
}

/**
 * Convenience: log the start and end of a phase, returning duration.
 */
export function createPhaseTimer(
  sessionId: string,
  phase: AgentLogEntry['phase'],
  message: string,
): { end: (data?: Record<string, unknown>) => number } {
  const start = Date.now()
  agentLog(sessionId, phase, `${message} — started`)

  return {
    end(data?: Record<string, unknown>) {
      const duration = Date.now() - start
      agentLog(sessionId, phase, `${message} — completed (${duration}ms)`, {
        ...data,
        durationMs: duration,
      })
      return duration
    },
  }
}
