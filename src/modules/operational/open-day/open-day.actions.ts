'use server'

/**
 * Open Day — Server Actions (Phase D)
 *
 * Minimal app-facing entrypoints for executing and retrieving Open Day records.
 * Reuses the existing Phase C service pipeline. No duplicate orchestration.
 */

import { safeAction, requireRole } from '@/lib/action-utils'
import { runOpenDayForUser, getOpenDayRecord } from './open-day.service'

/**
 * Execute Open Day for the authenticated user on a given date.
 *
 * - Auth: OWNER or TEAM only (operational ritual, not for clients)
 * - Idempotent: re-running for same date updates the existing record
 * - Delegates entirely to Phase C `runOpenDayForUser`
 */
export async function executeOpenDayAction(dateStr?: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const date = dateStr ? new Date(dateStr) : new Date()

    // Validate date string if provided
    if (dateStr && isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.')
    }

    const result = await runOpenDayForUser(session.user.id, date)

    return {
      recordId: result.recordId,
      aiSummary: result.aiSummary,
      isAI: result.isAI,
      wasUpdate: result.wasUpdate,
      summary: result.briefing.summary,
      criticalItemCount: result.briefing.criticalItems.length,
      projectCount: result.briefing.todayByProject.length,
      date: result.briefing.metadata.date,
      dayOfWeek: result.briefing.metadata.dayOfWeek,
    }
  })
}

/**
 * Retrieve an existing Open Day record for the authenticated user and date.
 *
 * - Auth: OWNER or TEAM only
 * - Returns null (wrapped in success) if no record exists for that date
 */
export async function getOpenDayAction(dateStr?: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const date = dateStr ? new Date(dateStr) : new Date()

    if (dateStr && isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.')
    }

    return getOpenDayRecord(session.user.id, date)
  })
}
