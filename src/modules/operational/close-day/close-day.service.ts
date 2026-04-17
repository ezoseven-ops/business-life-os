/**
 * Close Day — Orchestration Service
 *
 * Phase C: Single entrypoint that runs the full Close Day pipeline:
 *   1. Resolve workspace
 *   2. Load DayRitualConfig (if present)
 *   3. Run query layer (Phase A)
 *   4. Build briefing payload (Phase B)
 *   5. Generate AI summary (Phase C)
 *   6. Persist/update DayRecord (Phase C)
 *
 * Idempotent: re-running for the same (userId, date, CLOSE_DAY) updates the existing record.
 *
 * Spec reference: sections 3.2 Steps 1–8, 4.2, 5
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { runCloseDayQueries } from '../open-day/open-day.queries'
import { buildCloseDayBriefing } from './close-day.builder'
import { generateCloseDaySummary } from './close-day.summary'
import type { CloseDayBriefing } from '../open-day/open-day.types'

// ─── Types ───

export interface CloseDayResult {
  /** The DayRecord id */
  recordId: string
  /** The assembled briefing payload */
  briefing: CloseDayBriefing
  /** AI-generated (or fallback) narrative */
  aiSummary: string
  /** Whether AI was used for the summary */
  isAI: boolean
  /** Whether an existing record was updated (true) or a new one created (false) */
  wasUpdate: boolean
}

// ─── Config Loading ───

/**
 * Load DayRitualConfig for a user — extracts only what Close Day needs.
 * Returns defaults if no config exists.
 */
async function loadCloseDayConfig(userId: string): Promise<{
  language: string
  guidance: string
}> {
  const ritualConfig = await prisma.dayRitualConfig.findUnique({
    where: { userId },
    select: {
      aiLanguage: true,
      aiSummaryGuidance: true,
    },
  })

  if (!ritualConfig) {
    return {
      language: 'pl',
      guidance: '3-5 sentences, concise, debrief tone',
    }
  }

  return {
    language: ritualConfig.aiLanguage,
    guidance: ritualConfig.aiSummaryGuidance,
  }
}

// ─── Resolve Workspace ───

async function resolveWorkspaceId(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { workspaceId: true },
  })

  if (!user.workspaceId) {
    throw new Error(`User ${userId} has no workspace assigned`)
  }

  return user.workspaceId
}

// ─── Date Normalization ───

/**
 * Normalize a Date to a Prisma @db.Date value (midnight UTC).
 * DayRecord.date uses @db.Date which strips time.
 */
function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

// ─── Main Entrypoint ───

/**
 * Run the complete Close Day pipeline for a user and date.
 *
 * Idempotent: if a DayRecord already exists for (userId, date, CLOSE_DAY),
 * it will be updated instead of creating a duplicate.
 */
export async function runCloseDayForUser(
  userId: string,
  date: Date,
): Promise<CloseDayResult> {
  // 1. Load user config
  const { language, guidance } = await loadCloseDayConfig(userId)

  // 2. Resolve workspace
  const workspaceId = await resolveWorkspaceId(userId)

  // 3. Run queries (Phase A)
  const queryResults = await runCloseDayQueries(workspaceId, date)

  // 4. Build briefing (Phase B)
  const briefing = buildCloseDayBriefing({
    results: queryResults,
    userId,
    date,
  })

  // 5. Generate AI summary (Phase C)
  const summaryResult = await generateCloseDaySummary(briefing, { language, guidance })

  // Attach AI narrative to the briefing before persistence
  const briefingWithSummary: CloseDayBriefing = {
    ...briefing,
    summary: {
      ...briefing.summary,
      aiNarrative: summaryResult.aiNarrative,
    },
  }

  // 6. Persist to DayRecord — idempotent upsert
  const dateOnly = toDateOnly(date)

  const record = await prisma.dayRecord.upsert({
    where: {
      userId_date_type: {
        userId,
        date: dateOnly,
        type: 'CLOSE_DAY',
      },
    },
    create: {
      userId,
      date: dateOnly,
      type: 'CLOSE_DAY',
      data: briefingWithSummary as unknown as Prisma.InputJsonValue,
      aiSummary: summaryResult.aiNarrative,
    },
    update: {
      data: briefingWithSummary as unknown as Prisma.InputJsonValue,
      aiSummary: summaryResult.aiNarrative,
    },
  })

  // Detect if this was an update
  const wasUpdate = Math.abs(record.createdAt.getTime() - Date.now()) > 5000

  return {
    recordId: record.id,
    briefing: briefingWithSummary,
    aiSummary: summaryResult.aiNarrative,
    isAI: summaryResult.isAI,
    wasUpdate,
  }
}

// ─── Retrieval Helper ───

/**
 * Fetch the existing Close Day DayRecord for a user and date.
 * Returns null if no Close Day has been run for that date.
 */
export async function getCloseDayRecord(
  userId: string,
  date: Date,
): Promise<{
  id: string
  date: Date
  data: unknown
  aiSummary: string
  createdAt: Date
} | null> {
  const dateOnly = toDateOnly(date)

  return prisma.dayRecord.findUnique({
    where: {
      userId_date_type: {
        userId,
        date: dateOnly,
        type: 'CLOSE_DAY',
      },
    },
    select: {
      id: true,
      date: true,
      data: true,
      aiSummary: true,
      createdAt: true,
    },
  })
}
