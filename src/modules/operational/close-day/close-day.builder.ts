/**
 * Close Day — Deterministic Builder
 *
 * Pure function: no DB, no AI, no side effects.
 * Aggregates CloseDayQueryResults into a CloseDayBriefing.
 *
 * Aligned with: docs/systems/open-day-system.md section 3.2 / 4.2
 */

import type {
  CloseDayBriefing,
  CloseDayQueryResults,
  CriticalItem,
  CriticalItemType,
  ProjectSnapshot,
  TaskSnapshot,
  MessageSnapshot,
} from '../open-day/open-day.types'

// ─── Priority Helpers ───

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

function priorityRank(p: string): number {
  return PRIORITY_RANK[p] ?? 99
}

/** Deterministic sort: priority desc (URGENT first), then dueDate asc, then createdAt asc */
function sortByUrgency(tasks: readonly TaskSnapshot[]): TaskSnapshot[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityRank(a.priority) - priorityRank(b.priority)
    if (pa !== 0) return pa

    // dueDate ascending — nulls last
    if (a.dueDate && b.dueDate) {
      const dd = a.dueDate.getTime() - b.dueDate.getTime()
      if (dd !== 0) return dd
    } else if (a.dueDate && !b.dueDate) {
      return -1
    } else if (!a.dueDate && b.dueDate) {
      return 1
    }

    // fallback: createdAt ascending
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

// ─── Date Helpers ───

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000
  return Math.floor((b.getTime() - a.getTime()) / msPerDay)
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayOfWeek(date: Date): string {
  return DAY_NAMES[date.getDay()]
}

// ─── Deduplication ───

function deduplicateTasksById(tasks: TaskSnapshot[]): TaskSnapshot[] {
  const seen = new Set<string>()
  const out: TaskSnapshot[] = []
  for (const t of tasks) {
    if (!seen.has(t.id)) {
      seen.add(t.id)
      out.push(t)
    }
  }
  return out
}

// ─── Escalation Builder ───

const MAX_ESCALATIONS = 10

function buildEscalations(
  results: CloseDayQueryResults,
  date: Date,
): CriticalItem[] {
  const items: CriticalItem[] = []
  const seen = new Set<string>()

  function add(item: CriticalItem): void {
    const key = `${item.entityType}:${item.entityId}:${item.type}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  // 1. Blocked tasks
  for (const t of results.tasksBlocked) {
    add({
      type: 'BLOCKED_TASK',
      title: t.title,
      projectName: t.projectName,
      projectId: t.projectId,
      detail: `Task blocked in ${t.projectName}`,
      entityType: 'TASK',
      entityId: t.id,
      daysSince: t.dueDate ? daysBetween(t.dueDate, date) : null,
    })
  }

  // 2. Overdue HIGH/URGENT tasks
  for (const t of results.tasksOverdue) {
    if (t.priority !== 'URGENT' && t.priority !== 'HIGH') continue
    add({
      type: 'OVERDUE_CRITICAL',
      title: t.title,
      projectName: t.projectName,
      projectId: t.projectId,
      detail: `${t.priority} task overdue${t.dueDate ? ` by ${daysBetween(t.dueDate, date)}d` : ''}`,
      entityType: 'TASK',
      entityId: t.id,
      daysSince: t.dueDate ? daysBetween(t.dueDate, date) : null,
    })
  }

  // 3. Stale follow-up messages (present in backlog = escalation-worthy)
  for (const m of results.messagesFollowUp) {
    const staleDays = daysBetween(m.receivedAt, date)
    if (staleDays < 1) continue // same-day follow-ups are not escalations yet
    add({
      type: 'STALE_FOLLOWUP',
      title: m.snippet ?? 'Follow-up pending',
      projectName: m.projectName ?? '_UNKNOWN',
      projectId: m.projectId ?? '',
      detail: `Follow-up pending ${staleDays}d from ${m.personName ?? 'unknown'}`,
      entityType: 'MESSAGE',
      entityId: m.id,
      daysSince: staleDays,
    })
  }

  // Sort: BLOCKED first, then OVERDUE_CRITICAL, then STALE_FOLLOWUP; within same type by daysSince desc
  const TYPE_ORDER: Record<CriticalItemType, number> = {
    BLOCKED_TASK: 0,
    OVERDUE_CRITICAL: 1,
    URGENT_TODAY: 2,
    DEADLINE_RISK: 3,
    STALE_FOLLOWUP: 4,
  }

  items.sort((a, b) => {
    const to = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
    if (to !== 0) return to
    return (b.daysSince ?? 0) - (a.daysSince ?? 0)
  })

  return items.slice(0, MAX_ESCALATIONS)
}

// ─── Risk Builder ───

const MAX_RISKS = 10
const DEADLINE_WARNING_DAYS = 7

function buildRisks(
  results: CloseDayQueryResults,
  date: Date,
): CriticalItem[] {
  const items: CriticalItem[] = []
  const seen = new Set<string>()

  function add(item: CriticalItem): void {
    const key = `${item.entityType}:${item.entityId}:${item.type}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  // 1. Overdue tasks signal systemic risk
  for (const t of results.tasksOverdue) {
    add({
      type: 'OVERDUE_CRITICAL',
      title: t.title,
      projectName: t.projectName,
      projectId: t.projectId,
      detail: `Overdue task${t.dueDate ? ` (${daysBetween(t.dueDate, date)}d past due)` : ''}`,
      entityType: 'TASK',
      entityId: t.id,
      daysSince: t.dueDate ? daysBetween(t.dueDate, date) : null,
    })
  }

  // 2. Blocked tasks = delivery risk
  for (const t of results.tasksBlocked) {
    add({
      type: 'BLOCKED_TASK',
      title: t.title,
      projectName: t.projectName,
      projectId: t.projectId,
      detail: `Blocked — cannot progress`,
      entityType: 'TASK',
      entityId: t.id,
      daysSince: t.dueDate ? daysBetween(t.dueDate, date) : null,
    })
  }

  // 3. Follow-up backlog = communication risk
  if (results.messagesFollowUp.length > 0) {
    const oldest = results.messagesFollowUp.reduce<MessageSnapshot | null>(
      (prev, cur) => (!prev || cur.receivedAt < prev.receivedAt ? cur : prev),
      null,
    )
    if (oldest) {
      const staleDays = daysBetween(oldest.receivedAt, date)
      add({
        type: 'STALE_FOLLOWUP',
        title: `${results.messagesFollowUp.length} follow-up(s) pending`,
        projectName: oldest.projectName ?? '_UNKNOWN',
        projectId: oldest.projectId ?? '',
        detail: `Oldest pending ${staleDays}d`,
        entityType: 'MESSAGE',
        entityId: oldest.id,
        daysSince: staleDays,
      })
    }
  }

  // 4. Projects approaching deadline
  for (const p of results.activeProjects) {
    if (!p.deadline) continue
    const daysToDeadline = daysBetween(date, p.deadline)
    if (daysToDeadline <= 0) {
      // Past deadline
      add({
        type: 'DEADLINE_RISK',
        title: p.name,
        projectName: p.name,
        projectId: p.id,
        detail: `Project deadline passed ${Math.abs(daysToDeadline)}d ago`,
        entityType: 'PROJECT',
        entityId: p.id,
        daysSince: Math.abs(daysToDeadline),
      })
    } else if (daysToDeadline <= DEADLINE_WARNING_DAYS) {
      add({
        type: 'DEADLINE_RISK',
        title: p.name,
        projectName: p.name,
        projectId: p.id,
        detail: `Project deadline in ${daysToDeadline}d`,
        entityType: 'PROJECT',
        entityId: p.id,
        daysSince: null,
      })
    }
  }

  // Sort: DEADLINE_RISK first, then OVERDUE, then BLOCKED, then STALE; daysSince desc within
  const TYPE_ORDER: Record<CriticalItemType, number> = {
    DEADLINE_RISK: 0,
    OVERDUE_CRITICAL: 1,
    BLOCKED_TASK: 2,
    STALE_FOLLOWUP: 3,
    URGENT_TODAY: 4,
  }

  items.sort((a, b) => {
    const to = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
    if (to !== 0) return to
    return (b.daysSince ?? 0) - (a.daysSince ?? 0)
  })

  return items.slice(0, MAX_RISKS)
}

// ─── Main Builder ───

export function buildCloseDayBriefing(args: {
  results: CloseDayQueryResults
  userId: string
  date: Date
}): CloseDayBriefing {
  const { results, userId, date } = args
  const now = new Date()

  // 1. Delivered
  const delivered = {
    tasksCompleted: [...results.tasksCompleted],
    count: results.tasksCompleted.length,
  }

  // 2. Not Delivered
  const notDelivered = {
    tasksFailed: [...results.tasksFailed],
    count: results.tasksFailed.length,
  }

  // 3. Carry Over — deduplicated union of failed + overdue (not DONE), sorted by urgency
  const carryOverRaw = [
    ...results.tasksFailed.filter((t) => t.status !== 'DONE'),
    ...results.tasksOverdue.filter((t) => t.status !== 'DONE'),
  ]
  const carryOverDeduped = deduplicateTasksById(carryOverRaw)
  const carryOverSorted = sortByUrgency(carryOverDeduped)
  const carryOver = {
    toTomorrow: carryOverSorted,
    count: carryOverSorted.length,
  }

  // 4. Escalations
  const escalationItems = buildEscalations(results, date)
  const escalations = {
    items: escalationItems,
    count: escalationItems.length,
  }

  // 5. Risks
  const riskItems = buildRisks(results, date)
  const risks = {
    items: riskItems,
    count: riskItems.length,
  }

  // 6. Tomorrow Outlook
  const tomorrowOutlook = {
    tasksPlanned: [...results.tasksTomorrow],
    carryOverCount: carryOver.count,
    events: [...results.eventsTomorrow],
  }

  // 7. Summary
  const totalDelivered = delivered.count
  const totalNotDelivered = notDelivered.count
  const denominator = totalDelivered + totalNotDelivered
  const completionRate = denominator > 0
    ? Math.round((totalDelivered / denominator) * 100) / 100
    : 0

  const summary = {
    totalDelivered,
    totalNotDelivered,
    totalCarryOver: carryOver.count,
    completionRate,
  }

  return {
    metadata: {
      date: formatDate(date),
      generatedAt: now,
      userId,
      dayOfWeek: dayOfWeek(date),
    },
    delivered,
    notDelivered,
    carryOver,
    escalations,
    risks,
    tomorrowOutlook,
    summary,
  }
}
