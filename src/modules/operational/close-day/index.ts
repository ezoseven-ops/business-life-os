/**
 * Close Day — Public API
 *
 * Phase A: Types + query layer
 * Phase B: Deterministic builder
 * Phase C: AI summary + service orchestration + DayRecord persistence
 */

// Types (re-exported from shared types for convenience)
export type {
  CloseDayBriefing,
  CloseDayQueryResults,
} from '../open-day/open-day.types'

// Queries (re-exported from shared queries for convenience)
export { runCloseDayQueries, queryTasksFailedToday } from '../open-day/open-day.queries'

// Builder
export { buildCloseDayBriefing } from './close-day.builder'

// Summary
export { generateCloseDaySummary } from './close-day.summary'

// Service (Phase C orchestration)
export { runCloseDayForUser, getCloseDayRecord } from './close-day.service'
export type { CloseDayResult } from './close-day.service'

// Server Actions (Phase D entrypoints)
export { executeCloseDayAction, getCloseDayAction } from './close-day.actions'
