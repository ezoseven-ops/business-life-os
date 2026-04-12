/**
 * Open Day / Close Day — Public API
 *
 * Phase B: Query layer + deterministic builder
 * Phase C: AI summary generation + DayRecord persistence
 */

// Types
export type {
  TaskSnapshot,
  ProjectSnapshot,
  EventSnapshot,
  MessageSnapshot,
  NoteSnapshot,
  PersonSnapshot,
  CriticalItem,
  CriticalItemType,
  ProjectDayContext,
  OpenDayBriefing,
  OpenDayQueryResults,
  OpenDayConfig,
  PriorityWeights,
} from './open-day.types'

export {
  DEFAULT_OPEN_DAY_CONFIG,
  DEFAULT_PRIORITY_WEIGHTS,
} from './open-day.types'

// Queries
export { runOpenDayQueries } from './open-day.queries'

// Builder
export { buildOpenDayBriefing } from './open-day.builder'

// Summary
export { generateOpenDaySummary } from './open-day.summary'
export type { SummaryResult } from './open-day.summary'

// Service (Phase C orchestration)
export { runOpenDayForUser, getOpenDayRecord } from './open-day.service'
export type { OpenDayResult } from './open-day.service'
