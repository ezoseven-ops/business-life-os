import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import { CLOSURE_SYSTEM_PROMPT } from './prompts/closure.prompt'
import type { FocusTask } from './focus.engine'
import type { Signal } from './signal.engine'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ClosureBrief = {
  completedToday: number
  blockedCount: number
  closureSummary: string
  slipped: string
  tomorrowPrep: string
  isAI: boolean
}

type CompletedTask = {
  title: string
  projectName: string
}

// ─────────────────────────────────────────────
// Cache (same pattern as daily brief)
// ─────────────────────────────────────────────

type CacheEntry = {
  brief: ClosureBrief
  expiresAt: number
}

const closureCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export async function getClosureBrief(
  workspaceId: string,
  userId: string,
  focusTasks: FocusTask[],
  signals: Signal[],
): Promise<ClosureBrief> {
  // Check cache
  const cacheKey = `${workspaceId}:${userId}`
  const cached = closureCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.brief
  }

  // Query: tasks completed today by this user
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const completedTasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: 'DONE',
      updatedAt: { gte: startOfDay },
      OR: [
        { assigneeId: userId },
        { creatorId: userId },
      ],
    },
    select: {
      title: true,
      project: { select: { name: true } },
    },
    take: 20,
  })

  const completedToday: CompletedTask[] = completedTasks.map((t) => ({
    title: t.title,
    projectName: t.project.name,
  }))

  // Blocked tasks
  const blockedTasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: 'WAITING',
    },
    select: {
      title: true,
      project: { select: { name: true } },
    },
    take: 10,
  })

  const criticals = signals.filter((s) => s.category === 'CRITICAL')

  // Try AI
  try {
    const aiBrief = await generateClosureAI(
      completedToday,
      blockedTasks.map((t) => ({ title: t.title, projectName: t.project.name })),
      criticals.map((s) => ({ title: s.title, description: s.description, projectName: s.projectName })),
      focusTasks.map((t) => ({ title: t.title, projectName: t.projectName })),
    )

    const brief: ClosureBrief = {
      completedToday: completedToday.length,
      blockedCount: blockedTasks.length,
      ...aiBrief,
      isAI: true,
    }

    closureCache.set(cacheKey, { brief, expiresAt: Date.now() + CACHE_TTL_MS })
    return brief
  } catch (error) {
    console.error('[Closure] AI failed, using fallback:', error)
    return buildFallbackClosure(completedToday, blockedTasks.length, focusTasks)
  }
}

// ─────────────────────────────────────────────
// AI generation
// ─────────────────────────────────────────────

async function generateClosureAI(
  completedToday: CompletedTask[],
  blockedTasks: { title: string; projectName: string }[],
  deteriorated: { title: string; description: string; projectName: string }[],
  tomorrowFocus: { title: string; projectName: string }[],
): Promise<{ closureSummary: string; slipped: string; tomorrowPrep: string }> {
  const payload = { completedToday, stillBlocked: blockedTasks, deteriorated, tomorrowFocus }

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: CLOSURE_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    max_tokens: 250,
  })

  const content = result.choices[0]?.message?.content
  if (!content) throw new Error('Empty AI response for closure')

  const parsed = JSON.parse(content) as {
    closureSummary: string
    slipped: string
    tomorrowPrep: string
  }

  if (!parsed.closureSummary || !parsed.slipped || !parsed.tomorrowPrep) {
    throw new Error('Incomplete closure response')
  }

  return parsed
}

// ─────────────────────────────────────────────
// Fallback
// ─────────────────────────────────────────────

function buildFallbackClosure(
  completedToday: CompletedTask[],
  blockedCount: number,
  focusTasks: FocusTask[],
): ClosureBrief {
  const closureSummary = completedToday.length > 0
    ? `You completed ${completedToday.length} task${completedToday.length > 1 ? 's' : ''} today, including "${completedToday[0].title}".`
    : 'No tasks were completed today.'

  const slipped = blockedCount > 0
    ? `${blockedCount} task${blockedCount > 1 ? 's remain' : ' remains'} blocked and waiting for action.`
    : 'Nothing slipped today — all active work is progressing.'

  const tomorrowPrep = focusTasks.length > 0
    ? `Tomorrow, start with "${focusTasks[0].title}" in ${focusTasks[0].projectName}.`
    : 'No high-priority tasks queued for tomorrow yet.'

  return {
    completedToday: completedToday.length,
    blockedCount,
    closureSummary,
    slipped,
    tomorrowPrep,
    isAI: false,
  }
}
