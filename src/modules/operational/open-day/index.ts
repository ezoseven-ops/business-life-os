/**
 * Open Day / Close Day — Public API
 *
 * Phase B: Query layer + deterministic builder
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
