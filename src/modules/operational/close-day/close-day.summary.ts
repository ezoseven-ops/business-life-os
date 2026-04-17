/**
 * Close Day — AI Summary Generator
 *
 * Phase C: Generates operator-style debrief narrative from the assembled briefing.
 * Uses OpenAI when available, falls back to deterministic summary.
 *
 * Spec reference: section 5 (AI Role)
 * - AI receives structured data, not raw DB output
 * - AI role is strictly narrative
 * - Must use operator-appropriate language
 * - Debrief tone: what was delivered, what slipped, what carries over
 */

import { openai } from '@/lib/openai'
import { env } from '@/lib/env'
import type { CloseDayBriefing } from '../open-day/open-day.types'

// ─── System Prompt ───

const CLOSE_DAY_SYSTEM_PROMPT = `You are the operator debrief engine for Business Life OS.
You generate a concise end-of-day debrief for a founder-operator who manages multiple projects.

RULES:
- Write 3-5 sentences maximum.
- First sentence: the headline result of the day (e.g. completion rate, key delivery, or key miss).
- Mention what was delivered, what slipped, and what carries over to tomorrow.
- Reference project names and people by name when relevant.
- If escalations or risks exist, call them out concisely.
- If everything was delivered: acknowledge it briefly and preview tomorrow.
- Use debrief tone: you are a trusted operations system closing the day, not a coach.
- Do NOT reorder or filter items — you narrate what the system already prioritized.

OUTPUT: Return a JSON object with exactly one field:
{ "narrative": "Your 3-5 sentence debrief here." }
`

// ─── AI Generation ───

async function generateAISummary(
  briefing: CloseDayBriefing,
  language: string,
  guidance: string,
): Promise<string> {
  const payload = {
    date: briefing.metadata.date,
    dayOfWeek: briefing.metadata.dayOfWeek,
    summary: briefing.summary,
    delivered: {
      count: briefing.delivered.count,
      tasks: briefing.delivered.tasksCompleted.slice(0, 10).map((t) => ({
        title: t.title,
        projectName: t.projectName,
        priority: t.priority,
      })),
    },
    notDelivered: {
      count: briefing.notDelivered.count,
      tasks: briefing.notDelivered.tasksFailed.slice(0, 10).map((t) => ({
        title: t.title,
        projectName: t.projectName,
        priority: t.priority,
      })),
    },
    carryOver: {
      count: briefing.carryOver.count,
    },
    escalations: briefing.escalations.items.map((c) => ({
      type: c.type,
      title: c.title,
      projectName: c.projectName,
      detail: c.detail,
    })),
    risks: briefing.risks.items.map((c) => ({
      type: c.type,
      title: c.title,
      projectName: c.projectName,
      detail: c.detail,
    })),
    tomorrowOutlook: {
      tasksPlanned: briefing.tomorrowOutlook.tasksPlanned.length,
      carryOverCount: briefing.tomorrowOutlook.carryOverCount,
      events: briefing.tomorrowOutlook.events.length,
    },
    language,
    guidance,
  }

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: CLOSE_DAY_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    temperature: 0.4,
    max_tokens: 400,
  })

  const content = result.choices[0]?.message?.content
  if (!content) throw new Error('Empty AI response for Close Day summary')

  const parsed = JSON.parse(content) as { narrative: string }
  if (!parsed.narrative || typeof parsed.narrative !== 'string') {
    throw new Error('Invalid AI summary response structure')
  }

  return parsed.narrative
}

// ─── Deterministic Fallback ───

function buildFallbackSummary(briefing: CloseDayBriefing): string {
  const { summary, escalations, risks, tomorrowOutlook } = briefing
  const parts: string[] = []

  // Sentence 1: headline result
  const rate = Math.round(summary.completionRate * 100)
  if (summary.totalDelivered > 0 && summary.totalNotDelivered === 0) {
    parts.push(
      `All ${summary.totalDelivered} task${summary.totalDelivered > 1 ? 's' : ''} delivered today.`,
    )
  } else if (summary.totalDelivered > 0) {
    parts.push(
      `${summary.totalDelivered} of ${summary.totalDelivered + summary.totalNotDelivered} task${summary.totalDelivered + summary.totalNotDelivered > 1 ? 's' : ''} delivered (${rate}% completion).`,
    )
  } else if (summary.totalNotDelivered > 0) {
    parts.push(
      `No tasks delivered today — ${summary.totalNotDelivered} task${summary.totalNotDelivered > 1 ? 's' : ''} missed.`,
    )
  } else {
    parts.push('No tasks were scheduled for today.')
  }

  // Sentence 2: carry-over
  if (summary.totalCarryOver > 0) {
    parts.push(
      `${summary.totalCarryOver} task${summary.totalCarryOver > 1 ? 's' : ''} carrying over to tomorrow.`,
    )
  }

  // Sentence 3: escalations
  if (escalations.count > 0) {
    const top = escalations.items[0]
    parts.push(`Escalation: ${top.detail}.`)
  }

  // Sentence 4: risks
  if (risks.count > 0) {
    parts.push(
      `${risks.count} risk${risks.count > 1 ? 's' : ''} flagged for attention.`,
    )
  }

  // Sentence 5: tomorrow preview
  const tPlanned = tomorrowOutlook.tasksPlanned.length
  const tEvents = tomorrowOutlook.events.length
  if (tPlanned > 0 || tEvents > 0) {
    const segments: string[] = []
    if (tPlanned > 0) segments.push(`${tPlanned} task${tPlanned > 1 ? 's' : ''}`)
    if (tEvents > 0) segments.push(`${tEvents} event${tEvents > 1 ? 's' : ''}`)
    parts.push(`Tomorrow: ${segments.join(' and ')} planned.`)
  }

  return parts.slice(0, 5).join(' ')
}

// ─── Public API ───

/**
 * Generate Close Day summary narrative.
 * Uses AI when available, deterministic fallback otherwise.
 */
export async function generateCloseDaySummary(
  briefing: CloseDayBriefing,
  options?: {
    language?: string
    guidance?: string
  },
): Promise<{
  aiNarrative: string
  isAI: boolean
}> {
  const language = options?.language ?? 'pl'
  const guidance = options?.guidance ?? '3-5 sentences, concise, debrief tone'

  // Try AI if configured
  if (env.hasOpenAI) {
    try {
      const narrative = await generateAISummary(briefing, language, guidance)
      return { aiNarrative: narrative, isAI: true }
    } catch (error) {
      console.error('[CloseDay] AI summary failed, using fallback:', error)
    }
  }

  // Deterministic fallback
  const narrative = buildFallbackSummary(briefing)
  return { aiNarrative: narrative, isAI: false }
}
