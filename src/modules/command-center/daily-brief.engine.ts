import { openai } from '@/lib/openai'
import { DAILY_BRIEF_SYSTEM_PROMPT } from './prompts/daily-brief.prompt'
import type { FocusTask } from './focus.engine'
import type { Signal } from './signal.engine'
import type { ProjectOverview } from './project-overview.query'
import { rhythmGreeting, type RhythmPhase } from './rhythm.engine'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DailyBrief = {
  greeting: string
  whatMatters: string
  biggestRisk: string
  beingIgnored: string
  stats: {
    totalSignals: number
    criticalCount: number
    riskCount: number
    wasteCount: number
  }
  isAI: boolean // true = real AI response, false = fallback
}

// ─────────────────────────────────────────────
// In-memory cache — avoids calling AI on every page load
// Key: workspaceId, TTL: 30 minutes
// ─────────────────────────────────────────────

type CacheEntry = {
  brief: DailyBrief
  dataHash: string
  expiresAt: number
}

const briefCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function computeDataHash(
  focusTasks: FocusTask[],
  signals: Signal[],
  projects: ProjectOverview[],
): string {
  // Lightweight fingerprint — changes when data meaningfully changes
  const parts = [
    focusTasks.map((t) => `${t.id}:${t.status}:${t.score}`).join(','),
    signals.map((s) => `${s.id}:${s.severity}`).join(','),
    projects.map((p) => `${p.id}:${p.taskCounts.done}:${p.taskCounts.overdue}`).join(','),
  ]
  return parts.join('|')
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

export async function getDailyBrief(
  userName: string,
  focusTasks: FocusTask[],
  signals: Signal[],
  projects: ProjectOverview[],
  workspaceId: string,
  rhythmPhase: RhythmPhase = 'ACTIVE',
): Promise<DailyBrief> {
  const greeting = rhythmGreeting(rhythmPhase, userName)

  const criticalCount = signals.filter((s) => s.category === 'CRITICAL').length
  const riskCount = signals.filter((s) => s.category === 'RISK').length
  const wasteCount = signals.filter((s) => s.category === 'WASTE').length
  const stats = { totalSignals: signals.length, criticalCount, riskCount, wasteCount }

  // Check cache
  const dataHash = computeDataHash(focusTasks, signals, projects)
  const cached = briefCache.get(workspaceId)
  if (cached && cached.dataHash === dataHash && Date.now() < cached.expiresAt) {
    return { ...cached.brief, greeting } // refresh greeting (time changes)
  }

  // Try AI
  try {
    const aiBrief = await generateAIBrief(focusTasks, signals, projects, rhythmPhase)
    const brief: DailyBrief = {
      greeting,
      whatMatters: aiBrief.whatMatters,
      biggestRisk: aiBrief.biggestRisk,
      beingIgnored: aiBrief.beingIgnored,
      stats,
      isAI: true,
    }

    // Cache it
    briefCache.set(workspaceId, {
      brief,
      dataHash,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return brief
  } catch (error) {
    console.error('[DailyBrief] AI failed, using fallback:', error)
    return buildFallbackBrief(greeting, focusTasks, signals, stats)
  }
}

// ─────────────────────────────────────────────
// AI generation
// ─────────────────────────────────────────────

type AIBriefOutput = {
  whatMatters: string
  biggestRisk: string
  beingIgnored: string
}

async function generateAIBrief(
  focusTasks: FocusTask[],
  signals: Signal[],
  projects: ProjectOverview[],
  rhythmPhase: RhythmPhase,
): Promise<AIBriefOutput> {
  const payload = {
    rhythmPhase,
    timeOfDay: rhythmPhase === 'OPEN' ? 'morning' : rhythmPhase === 'CLOSURE' ? 'evening' : 'afternoon',
    focusTasks: focusTasks.map((t) => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate?.toISOString().split('T')[0] ?? null,
      projectName: t.projectName,
      ventureName: t.ventureName,
      isOverdue: t.scoreBreakdown.some((b) => b.startsWith('overdue')),
      isStale: t.scoreBreakdown.some((b) => b.startsWith('stale')),
    })),
    signals: signals.slice(0, 10).map((s) => ({
      category: s.category,
      title: s.title,
      description: s.description,
      projectName: s.projectName,
      severity: s.severity,
    })),
    projects: projects.map((p) => ({
      name: p.name,
      priority: p.projectPriority,
      ventureName: p.ventureName,
      tasksTotal: p.taskCounts.total,
      tasksDone: p.taskCounts.done,
      tasksOverdue: p.taskCounts.overdue,
      completionPct: p.taskCounts.total > 0
        ? Math.round((p.taskCounts.done / p.taskCounts.total) * 100)
        : 0,
    })),
  }

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DAILY_BRIEF_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    max_tokens: 300,
  })

  const content = result.choices[0]?.message?.content
  if (!content) throw new Error('Empty AI response for daily brief')

  const parsed = JSON.parse(content) as AIBriefOutput
  if (!parsed.whatMatters || !parsed.biggestRisk || !parsed.beingIgnored) {
    throw new Error('Incomplete AI brief response')
  }

  return parsed
}

// ─────────────────────────────────────────────
// Fallback — hardcoded logic (no AI dependency)
// Used when OPENAI_API_KEY is missing or API fails
// ─────────────────────────────────────────────

function buildFallbackBrief(
  greeting: string,
  focusTasks: FocusTask[],
  signals: Signal[],
  stats: DailyBrief['stats'],
): DailyBrief {
  // whatMatters
  let whatMatters: string
  if (focusTasks.length === 0) {
    whatMatters = 'No urgent tasks right now. Good time to plan ahead or clear backlog.'
  } else {
    const top = focusTasks[0]
    const hasOverdue = focusTasks.some((t) => t.scoreBreakdown.some((b) => b.startsWith('overdue')))
    if (hasOverdue) {
      whatMatters = `You have overdue work — start with "${top.title}" in ${top.projectName}.`
    } else {
      whatMatters = `Start with "${top.title}" in ${top.projectName} — it's your top priority.`
    }
  }

  // biggestRisk
  let biggestRisk: string
  const criticals = signals.filter((s) => s.category === 'CRITICAL')
  if (criticals.length > 0) {
    const worst = criticals[0]
    biggestRisk = `${worst.title}: "${worst.description}" in ${worst.projectName} needs immediate attention.`
  } else if (stats.riskCount > 0) {
    biggestRisk = `${stats.riskCount} risk signal${stats.riskCount > 1 ? 's' : ''} building — nothing critical yet, but watch closely.`
  } else {
    biggestRisk = 'Systems are clean. No critical risks detected.'
  }

  // beingIgnored
  let beingIgnored: string
  const wastes = signals.filter((s) => s.category === 'WASTE')
  const staleRisks = signals.filter((s) => s.category === 'RISK')
  if (wastes.length > 0) {
    const worst = wastes[0]
    beingIgnored = `"${worst.description}" in ${worst.projectName} has been stagnant — ${worst.title.toLowerCase()}.`
  } else if (staleRisks.length > 0) {
    beingIgnored = `${staleRisks.length} task${staleRisks.length > 1 ? 's have' : ' has'} gone silent for 3+ days.`
  } else {
    beingIgnored = 'Nothing is being neglected. All active work has recent activity.'
  }

  return {
    greeting,
    whatMatters,
    biggestRisk,
    beingIgnored,
    stats,
    isAI: false,
  }
}
