/**
 * Open Day — AI Summary Generator
 *
 * Phase C: Generates operator-style narrative summary from the assembled briefing.
 * Uses OpenAI when available, falls back to deterministic summary.
 *
 * Spec reference: section 5 (AI Role)
 * - AI receives structured data, not raw DB output
 * - AI role is strictly narrative
 * - Must use operator-appropriate language
 * - Must highlight the single most important thing first
 */

import { openai } from '@/lib/openai'
import { env } from '@/lib/env'
import type { OpenDayBriefing } from './open-day.types'

// ─── Types ───

export interface SummaryResult {
  aiNarrative: string
  isAI: boolean // true = LLM-generated, false = deterministic fallback
}

// ─── System Prompt ───

const OPEN_DAY_SYSTEM_PROMPT = `You are the operator briefing engine for Business Life OS.
You generate a concise morning briefing for a founder-operator who manages multiple projects.

RULES:
- Write 3-5 sentences maximum.
- First sentence: the single most important thing today.
- Be concise, direct, action-oriented. No fluff, no motivation.
- Reference project names and people by name when relevant.
- Mention blockers, overdue pressure, approaching deadlines, and calendar conflicts if present.
- If nothing critical: say so clearly and suggest what to focus on.
- Use operator tone: you are a trusted operations system, not a coach.
- Do NOT reorder or filter items — you narrate what the system already prioritized.

OUTPUT: Return a JSON object with exactly one field:
{ "narrative": "Your 3-5 sentence briefing here." }
`

// ─── AI Generation ───

async function generateAISummary(
  briefing: OpenDayBriefing,
  language: string,
  guidance: string,
): Promise<string> {
  // Build a compact data payload for the LLM
  const payload = {
    date: briefing.metadata.date,
    dayOfWeek: briefing.metadata.dayOfWeek,
    summary: briefing.summary,
    criticalItems: briefing.criticalItems.map((c) => ({
      type: c.type,
      title: c.title,
      projectName: c.projectName,
      detail: c.detail,
    })),
    topProjects: briefing.todayByProject.slice(0, 5).map((p) => ({
      name: p.projectName,
      priority: p.projectPriority,
      score: p.projectScore,
      overdueCount: p.tasks.overdue.length,
      todayCount: p.tasks.today.length,
      blockedCount: p.tasks.blocked.length,
      eventCount: p.events.length,
      followUpCount: p.followUps.length,
    })),
    tomorrowPreview: {
      taskCount: briefing.tomorrowPreview.taskCount,
      eventCount: briefing.tomorrowPreview.eventCount,
    },
    globalPriorities: {
      approachingDeadlines: briefing.globalPriorities.projectsApproachingDeadline.map(
        (p) => ({ name: p.name, deadline: p.deadline }),
      ),
      stalledCount: briefing.globalPriorities.stalledProjects.length,
      unassignedHighPriority: briefing.globalPriorities.highPriorityUnassignedTasks.length,
    },
    language,
    guidance,
  }

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: OPEN_DAY_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    max_tokens: 400,
  })

  const content = result.choices[0]?.message?.content
  if (!content) throw new Error('Empty AI response for Open Day summary')

  const parsed = JSON.parse(content) as { narrative: string }
  if (!parsed.narrative || typeof parsed.narrative !== 'string') {
    throw new Error('Invalid AI summary response structure')
  }

  return parsed.narrative
}

// ─── Deterministic Fallback ───

function buildFallbackSummary(briefing: OpenDayBriefing): string {
  const { summary, criticalItems, todayByProject, globalPriorities } = briefing
  const parts: string[] = []

  // Sentence 1: the single most important thing
  if (criticalItems.length > 0) {
    const top = criticalItems[0]
    parts.push(`Critical: ${top.detail}.`)
  } else if (summary.totalTasksOverdue > 0) {
    parts.push(
      `${summary.totalTasksOverdue} overdue task${summary.totalTasksOverdue > 1 ? 's' : ''} need attention today.`,
    )
  } else if (summary.totalTasksToday > 0) {
    const topProject = todayByProject[0]
    parts.push(
      `Top priority: ${topProject?.projectName ?? 'your tasks'} with ${topProject?.tasks.today.length ?? summary.totalTasksToday} task${(topProject?.tasks.today.length ?? summary.totalTasksToday) > 1 ? 's' : ''} due today.`,
    )
  } else {
    parts.push('No tasks due today. Good time to clear backlog or plan ahead.')
  }

  // Sentence 2: blockers/overdue pressure
  const totalBlocked = todayByProject.reduce((n, p) => n + p.tasks.blocked.length, 0)
  if (totalBlocked > 0) {
    parts.push(
      `${totalBlocked} task${totalBlocked > 1 ? 's are' : ' is'} blocked across projects.`,
    )
  }

  // Sentence 3: calendar pressure
  if (summary.totalEventsToday > 0) {
    parts.push(
      `${summary.totalEventsToday} event${summary.totalEventsToday > 1 ? 's' : ''} on calendar today.`,
    )
  }

  // Sentence 4: follow-ups
  if (summary.totalFollowUps > 0) {
    parts.push(
      `${summary.totalFollowUps} follow-up${summary.totalFollowUps > 1 ? 's' : ''} pending.`,
    )
  }

  // Sentence 5: approaching deadlines
  const approaching = globalPriorities.projectsApproachingDeadline.length
  if (approaching > 0) {
    parts.push(
      `${approaching} project${approaching > 1 ? 's' : ''} approaching deadline this week.`,
    )
  }

  // Cap at 5 sentences
  return parts.slice(0, 5).join(' ')
}

// ─── Public API ───

/**
 * Generate Open Day summary narrative.
 * Uses AI when available, deterministic fallback otherwise.
 */
export async function generateOpenDaySummary(
  briefing: OpenDayBriefing,
  options: { language?: string; guidance?: string } = {},
): Promise<SummaryResult> {
  const language = options.language ?? 'pl'
  const guidance = options.guidance ?? '3-5 sentences, concise, action-oriented'

  // Try AI if configured
  if (env.hasOpenAI) {
    try {
      const narrative = await generateAISummary(briefing, language, guidance)
      return { aiNarrative: narrative, isAI: true }
    } catch (error) {
      console.error('[OpenDay] AI summary failed, using fallback:', error)
    }
  }

  // Deterministic fallback
  const narrative = buildFallbackSummary(briefing)
  return { aiNarrative: narrative, isAI: false }
}
