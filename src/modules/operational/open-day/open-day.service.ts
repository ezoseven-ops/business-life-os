/**
 * Open Day — Orchestration Service
 *
 * Phase C: Single entrypoint that runs the full Open Day pipeline:
 *   1. Load DayRitualConfig (if present)
 *   2. Run query layer (Phase B)
 *   3. Build briefing payload (Phase B)
 *   4. Generate AI summary (Phase C)
 *   5. Persist/update DayRecord (Phase C)
 *
 * Idempotent: re-running for the same (userId, date, OPEN_DAY) updates the existing record.
 *
 * Spec reference: sections 3.1 Steps 1–7, 4.1, 5
 */

import { prisma } from '@/lib/prisma'
import { runOpenDayQueries } from './open-day.queries'
import { buildOpenDayBriefing } from './open-day.builder'
import { generateOpenDaySummary } from './open-day.summary'
import type {
  OpenDayBriefing,
  OpenDayConfig,
  PriorityWeights,
} from './open-day.types'
import { DEFAULT_OPEN_DAY_CONFIG, DEFAULT_PRIORITY_WEIGHTS } from './open-day.types'

// ─── Types ───

export interface OpenDayResult {
  /** The DayRecord id */
  recordId: string
  /** The assembled briefing payload */
  briefing: OpenDayBriefing
  /** AI-generated (or fallback) narrative */
  aiSummary: string
  /** Whether AI was used for the summary */
  isAI: boolean
  /** Whether an existing record was updated (true) or a new one created (false) */
  wasUpdate: boolean
}

// ─── Config Loading ───

/**
 * Load DayRitualConfig for a user and convert to OpenDayConfig.
 * Returns defaults if no config exists.
 */
async function loadOpenDayConfig(userId: string): Promise<{
  config: OpenDayConfig
  language: string
  guidance: string
}> {
  const ritualConfig = await prisma.dayRitualConfig.findUnique({
    where: { userId },
  })

  if (!ritualConfig) {
    return {
      config: DEFAULT_OPEN_DAY_CONFIG,
      language: 'pl',
      guidance: '3-5 sentences, concise, action-oriented',
    }
  }

  // Parse priority weights from JSON, falling back to defaults
  let priorityWeights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
  if (ritualConfig.priorityWeights && typeof ritualConfig.priorityWeights === 'object') {
    const raw = ritualConfig.priorityWeights as Record<string, unknown>
    priorityWeights = {
      urgent: typeof raw.urgent === 'number' ? raw.urgent : DEFAULT_PRIORITY_WEIGHTS.urgent,
      high: typeof raw.high === 'number' ? raw.high : DEFAULT_PRIORITY_WEIGHTS.high,
      medium: typeof raw.medium === 'number' ? raw.medium : DEFAULT_PRIORITY_WEIGHTS.medium,
      low: typeof raw.low === 'number' ? raw.low : DEFAULT_PRIORITY_WEIGHTS.low,
      overdueMultiplier: typeof raw.overdueMultiplier === 'number' ? raw.overdueMultiplier : DEFAULT_PRIORITY_WEIGHTS.overdueMultiplier,
      overdueMax: typeof raw.overdueMax === 'number' ? raw.overdueMax : DEFAULT_PRIORITY_WEIGHTS.overdueMax,
      deadlineClose: typeof raw.deadlineClose === 'number' ? raw.deadlineClose : DEFAULT_PRIORITY_WEIGHTS.deadlineClose,
      deadlineMedium: typeof raw.deadlineMedium === 'number' ? raw.deadlineMedium : DEFAULT_PRIORITY_WEIGHTS.deadlineMedium,
      blockerMultiplier: typeof raw.blockerMultiplier === 'number' ? raw.blockerMultiplier : DEFAULT_PRIORITY_WEIGHTS.blockerMultiplier,
      blockerMax: typeof raw.blockerMax === 'number' ? raw.blockerMax : DEFAULT_PRIORITY_WEIGHTS.blockerMax,
    }
  }

  return {
    config: {
      criticalOverdueDays: ritualConfig.criticalOverdueDays,
      deadlineWarningDays: ritualConfig.deadlineWarningDays,
      stalledProjectDays: ritualConfig.stalledProjectDays,
      followUpStaleDays: ritualConfig.followUpStaleDays,
      priorityWeights,
    },
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
 * Run the complete Open Day pipeline for a user and date.
 *
 * Idempotent: if a DayRecord already exists for (userId, date, OPEN_DAY),
 * it will be updated instead of creating a duplicate.
 */
export async function runOpenDayForUser(
  userId: string,
  date: Date,
): Promise<OpenDayResult> {
  // 1. Load user config
  const { config, language, guidance } = await loadOpenDayConfig(userId)

  // 2. Resolve workspace
  const workspaceId = await resolveWorkspaceId(userId)

  // 3. Run queries (Phase B Step 1)
  const queryResults = await runOpenDayQueries(workspaceId, date)

  // 4. Build briefing (Phase B Steps 2–5)
  const briefing = buildOpenDayBriefing(queryResults, userId, date, config)

  // 5. Generate AI summary (Phase C Step 6)
  const summaryResult = await generateOpenDaySummary(briefing, { language, guidance })

  // 6. Persist to DayRecord (Phase C Step 7) — idempotent upsert
  const dateOnly = toDateOnly(date)

  const record = await prisma.dayRecord.upsert({
    where: {
      userId_date_type: {
        userId,
        date: dateOnly,
        type: 'OPEN_DAY',
      },
    },
    create: {
      userId,
      date: dateOnly,
      type: 'OPEN_DAY',
      data: briefing as unknown as Record<string, unknown>,
      aiSummary: summaryResult.aiNarrative,
    },
    update: {
      data: briefing as unknown as Record<string, unknown>,
      aiSummary: summaryResult.aiNarrative,
    },
  })

  // Detect if this was an update
  // If createdAt is very close to now, it was a create; otherwise update
  const wasUpdate = Math.abs(record.createdAt.getTime() - Date.now()) > 5000

  return {
    recordId: record.id,
    briefing,
    aiSummary: summaryResult.aiNarrative,
    isAI: summaryResult.isAI,
    wasUpdate,
  }
}

// ─── Retrieval Helper ───

/**
 * Fetch the existing Open Day DayRecord for a user and date.
 * Returns null if no Open Day has been run for that date.
 */
export async function getOpenDayRecord(
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
        type: 'OPEN_DAY',
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
