'use server'

/**
 * Close Day — Server Actions (Phase D)
 *
 * Minimal app-facing entrypoints for executing and retrieving Close Day records.
 * Reuses the Phase C service pipeline. No duplicate orchestration.
 */

import { safeAction, requireRole } from '@/lib/action-utils'
import { runCloseDayForUser, getCloseDayRecord } from './close-day.service'

/**
 * Execute Close Day for the authenticated user on a given date.
 *
 * - Auth: OWNER or TEAM only (operational ritual, not for clients)
 * - Idempotent: re-running for same date updates the existing record
 * - Delegates entirely to Phase C `runCloseDayForUser`
 */
export async function executeCloseDayAction(dateStr?: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const date = dateStr ? new Date(dateStr) : new Date()

    // Validate date string if provided
    if (dateStr && isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.')
    }

    const result = await runCloseDayForUser(session.user.id, date)

    return {
      recordId: result.recordId,
      aiSummary: result.aiSummary,
      isAI: result.isAI,
      wasUpdate: result.wasUpdate,
      summary: result.briefing.summary,
      deliveredCount: result.briefing.delivered.count,
      notDeliveredCount: result.briefing.notDelivered.count,
      carryOverCount: result.briefing.carryOver.count,
      escalationCount: result.briefing.escalations.count,
      riskCount: result.briefing.risks.count,
      date: result.briefing.metadata.date,
      dayOfWeek: result.briefing.metadata.dayOfWeek,
    }
  })
}

/**
 * Retrieve an existing Close Day record for the authenticated user and date.
 *
 * - Auth: OWNER or TEAM only
 * - Returns null (wrapped in success) if no record exists for that date
 */
export async function getCloseDayAction(dateStr?: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const date = dateStr ? new Date(dateStr) : new Date()

    if (dateStr && isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.')
    }

    return getCloseDayRecord(session.user.id, date)
  })
}
