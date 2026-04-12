/**
 * Open Day — Builder (Data Assembly / Aggregation)
 *
 * Implements spec section 3.1 Steps 2–5:
 *   Step 2: Project Aggregation (project-first grouping)
 *   Step 3: Prioritization (scoring + sorting)
 *   Step 4: Critical Items Extraction
 *   Step 5: Briefing Assembly
 *
 * Phase B scope: deterministic only — no AI, no persistence, no voice.
 */

import type {
  OpenDayQueryResults,
  OpenDayBriefing,
  OpenDayConfig,
  ProjectDayContext,
  CriticalItem,
  TaskSnapshot,
  EventSnapshot,
  MessageSnapshot,
  NoteSnapshot,
  PersonSnapshot,
  ProjectSnapshot,
  PriorityWeights,
} from './open-day.types'
import { DEFAULT_OPEN_DAY_CONFIG } from './open-day.types'

// ─── Constants ───

const UNASSIGNED_PROJECT_ID = '_UNASSIGNED'
const UNASSIGNED_PROJECT_NAME = '_UNASSIGNED'

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

// ─── Helpers ───

function diffDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000
  return Math.floor((a.getTime() - b.getTime()) / msPerDay)
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Step 3: Priority Scoring ───

function computeProjectScore(
  ctx: {
    priority: string
    overdue: TaskSnapshot[]
    blocked: TaskSnapshot[]
    deadline: Date | null
  },
  date: Date,
  weights: PriorityWeights,
): number {
  // Base priority from configurable weights (spec: "MUST be configurable, not hardcoded")
  const priorityKey = ctx.priority.toUpperCase()
  const base =
    priorityKey === 'URGENT' ? weights.urgent :
    priorityKey === 'HIGH'   ? weights.high :
    priorityKey === 'MEDIUM' ? weights.medium :
    priorityKey === 'LOW'    ? weights.low :
    weights.low // safe fallback for unknown priority values

  // Overdue weight: count * multiplier, capped
  const overdueWeight = Math.min(
    ctx.overdue.length * weights.overdueMultiplier,
    weights.overdueMax,
  )

  // Deadline weight
  let deadlineWeight = 0
  if (ctx.deadline) {
    const daysUntil = diffDays(ctx.deadline, date)
    if (daysUntil <= 3 && daysUntil >= 0) {
      deadlineWeight = weights.deadlineClose
    } else if (daysUntil <= 7 && daysUntil > 3) {
      deadlineWeight = weights.deadlineMedium
    }
  }

  // Blocker weight: count * multiplier, capped
  const blockerWeight = Math.min(
    ctx.blocked.length * weights.blockerMultiplier,
    weights.blockerMax,
  )

  return base + overdueWeight + deadlineWeight + blockerWeight
}

// ─── Step 4: Critical Items Extraction ───

function extractCriticalItems(
  data: OpenDayQueryResults,
  date: Date,
  config: OpenDayConfig,
): CriticalItem[] {
  const items: CriticalItem[] = []

  // 1. BLOCKED tasks (any project)
  for (const t of data.tasksBlocked) {
    items.push({
      type: 'BLOCKED_TASK',
      title: t.title,
      projectName: t.projectName,
      projectId: t.projectId,
      detail: `Task "${t.title}" is BLOCKED in project ${t.projectName}`,
      entityType: 'TASK',
      entityId: t.id,
      daysSince: t.dueDate ? diffDays(date, t.dueDate) : null,
    })
  }

  // 2. Tasks overdue by more than criticalOverdueDays (default: 3)
  for (const t of data.tasksOverdue) {
    if (!t.dueDate) continue
    const overdueDays = diffDays(date, t.dueDate)
    if (overdueDays > config.criticalOverdueDays) {
      items.push({
        type: 'OVERDUE_CRITICAL',
        title: t.title,
        projectName: t.projectName,
        projectId: t.projectId,
        detail: `Task "${t.title}" is ${overdueDays} days overdue (project: ${t.projectName})`,
        entityType: 'TASK',
        entityId: t.id,
        daysSince: overdueDays,
      })
    }
  }

  // 3. URGENT tasks due today
  for (const t of data.tasksToday) {
    if (t.priority === 'URGENT') {
      items.push({
        type: 'URGENT_TODAY',
        title: t.title,
        projectName: t.projectName,
        projectId: t.projectId,
        detail: `URGENT task "${t.title}" is due today (project: ${t.projectName})`,
        entityType: 'TASK',
        entityId: t.id,
        daysSince: null,
      })
    }
  }

  // 4. Project deadline within 3 days with incomplete URGENT tasks
  for (const p of data.activeProjects) {
    if (!p.deadline) continue
    const daysUntil = diffDays(p.deadline, date)
    if (daysUntil > 3 || daysUntil < 0) continue

    // Check if project has incomplete URGENT tasks
    const hasUrgentIncomplete = data.tasksToday
      .concat(data.tasksOverdue)
      .some(
        (t) =>
          t.projectId === p.id &&
          t.priority === 'URGENT' &&
          t.status !== 'DONE',
      )

    if (hasUrgentIncomplete) {
      items.push({
        type: 'DEADLINE_RISK',
        title: p.name,
        projectName: p.name,
        projectId: p.id,
        detail: `Project "${p.name}" deadline in ${daysUntil} day(s) with incomplete URGENT tasks`,
        entityType: 'PROJECT',
        entityId: p.id,
        daysSince: daysUntil,
      })
    }
  }

  // 5. Follow-up messages older than followUpStaleDays (default: 3 = 72h)
  for (const m of data.messagesFollowUp) {
    const daysSince = diffDays(date, m.receivedAt)
    if (daysSince >= config.followUpStaleDays) {
      items.push({
        type: 'STALE_FOLLOWUP',
        title: m.personName
          ? `Follow-up from ${m.personName}`
          : 'Follow-up pending',
        projectName: m.projectName ?? UNASSIGNED_PROJECT_NAME,
        projectId: m.projectId ?? UNASSIGNED_PROJECT_ID,
        detail: `Follow-up pending for ${daysSince} days${m.personName ? ` (from ${m.personName})` : ''}`,
        entityType: 'MESSAGE',
        entityId: m.id,
        daysSince,
      })
    }
  }

  return items
}

// ─── Step 2: Project Aggregation ───

interface ProjectBucket {
  projectId: string
  projectName: string
  projectPriority: string
  projectPhase: string
  projectDeadline: Date | null
  projectTeam: PersonSnapshot[]
  tasksOverdue: TaskSnapshot[]
  tasksToday: TaskSnapshot[]
  tasksBlocked: TaskSnapshot[]
  events: EventSnapshot[]
  followUps: MessageSnapshot[]
  awaitingResponses: MessageSnapshot[]
  unreadMessages: MessageSnapshot[]
  recentNotes: NoteSnapshot[]
}

function buildProjectBuckets(
  data: OpenDayQueryResults,
): Map<string, ProjectBucket> {
  const buckets = new Map<string, ProjectBucket>()

  // Seed buckets from active projects
  for (const p of data.activeProjects) {
    buckets.set(p.id, {
      projectId: p.id,
      projectName: p.name,
      projectPriority: p.priority,
      projectPhase: p.phase,
      projectDeadline: p.deadline,
      projectTeam: data.projectTeams.get(p.id) ?? [],
      tasksOverdue: [],
      tasksToday: [],
      tasksBlocked: [],
      events: [],
      followUps: [],
      awaitingResponses: [],
      unreadMessages: [],
      recentNotes: [],
    })
  }

  // Helper: get or create bucket (for _UNASSIGNED fallback)
  function getBucket(projectId: string | null): ProjectBucket {
    const id = projectId ?? UNASSIGNED_PROJECT_ID
    let bucket = buckets.get(id)
    if (!bucket) {
      bucket = {
        projectId: id,
        projectName: id === UNASSIGNED_PROJECT_ID ? UNASSIGNED_PROJECT_NAME : id,
        projectPriority: 'LOW',
        projectPhase: 'UNKNOWN',
        projectDeadline: null,
        projectTeam: [],
        tasksOverdue: [],
        tasksToday: [],
        tasksBlocked: [],
        events: [],
        followUps: [],
        awaitingResponses: [],
        unreadMessages: [],
        recentNotes: [],
      }
      buckets.set(id, bucket)
    }
    return bucket
  }

  // Distribute tasks
  for (const t of data.tasksOverdue) {
    getBucket(t.projectId).tasksOverdue.push(t)
  }
  for (const t of data.tasksToday) {
    getBucket(t.projectId).tasksToday.push(t)
  }
  for (const t of data.tasksBlocked) {
    getBucket(t.projectId).tasksBlocked.push(t)
  }

  // Distribute events
  for (const e of data.eventsToday) {
    getBucket(e.projectId).events.push(e)
  }

  // Distribute messages
  for (const m of data.messagesFollowUp) {
    getBucket(m.projectId).followUps.push(m)
  }
  for (const m of data.messagesAwaiting) {
    getBucket(m.projectId).awaitingResponses.push(m)
  }
  for (const m of data.messagesUnread) {
    getBucket(m.projectId).unreadMessages.push(m)
  }

  // Distribute notes
  for (const n of data.notesRecent) {
    getBucket(n.projectId).recentNotes.push(n)
  }

  // Enforce task-level sorting within each bucket (spec 3.1 Step 3):
  // OVERDUE → oldest dueDate first; TODAY → priority DESC; BLOCKED → priority DESC
  const priorityRank: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

  for (const bucket of buckets.values()) {
    bucket.tasksOverdue.sort((a, b) => {
      const aTime = a.dueDate?.getTime() ?? 0
      const bTime = b.dueDate?.getTime() ?? 0
      return aTime - bTime // oldest first
    })
    bucket.tasksToday.sort((a, b) => {
      return (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0)
    })
    bucket.tasksBlocked.sort((a, b) => {
      return (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0)
    })
  }

  return buckets
}

// ─── Step 5: Briefing Assembly ───

/**
 * Build the complete Open Day Briefing from raw query results.
 *
 * This is the main entry point for Phase B.
 * It runs Steps 2–5 of spec section 3.1 deterministically.
 */
export function buildOpenDayBriefing(
  data: OpenDayQueryResults,
  userId: string,
  date: Date,
  config: OpenDayConfig = DEFAULT_OPEN_DAY_CONFIG,
): OpenDayBriefing {
  // ── Step 2: Project Aggregation ──
  const buckets = buildProjectBuckets(data)

  // ── Step 3: Prioritization ──
  const projectContexts: ProjectDayContext[] = []

  for (const bucket of buckets.values()) {
    const score = computeProjectScore(
      {
        priority: bucket.projectPriority,
        overdue: bucket.tasksOverdue,
        blocked: bucket.tasksBlocked,
        deadline: bucket.projectDeadline,
      },
      date,
      config.priorityWeights,
    )

    projectContexts.push({
      projectId: bucket.projectId,
      projectName: bucket.projectName,
      projectPriority: bucket.projectPriority,
      projectPhase: bucket.projectPhase,
      projectDeadline: bucket.projectDeadline,
      projectScore: score,
      projectTeam: bucket.projectTeam,
      tasks: {
        overdue: bucket.tasksOverdue,
        today: bucket.tasksToday,
        blocked: bucket.tasksBlocked,
      },
      events: bucket.events,
      followUps: bucket.followUps,
      awaitingResponses: bucket.awaitingResponses,
      unreadMessages: bucket.unreadMessages,
      recentNotes: bucket.recentNotes,
    })
  }

  // Sort projects: Score DESC, then name ASC for ties
  projectContexts.sort((a, b) => {
    if (b.projectScore !== a.projectScore) {
      return b.projectScore - a.projectScore
    }
    return a.projectName.localeCompare(b.projectName)
  })

  // ── Step 4: Critical Items Extraction ──
  const criticalItems = extractCriticalItems(data, date, config)

  // ── Tomorrow Preview ──
  const tomorrowByProject = new Map<string, { projectName: string; tasks: TaskSnapshot[] }>()
  for (const t of data.tasksTomorrow) {
    const key = t.projectId ?? UNASSIGNED_PROJECT_ID
    let entry = tomorrowByProject.get(key)
    if (!entry) {
      entry = { projectName: t.projectName ?? UNASSIGNED_PROJECT_NAME, tasks: [] }
      tomorrowByProject.set(key, entry)
    }
    entry.tasks.push(t)
  }

  // ── Global Priorities ──

  // Projects approaching deadline (within deadlineWarningDays)
  const projectsApproachingDeadline = data.activeProjects.filter((p) => {
    if (!p.deadline) return false
    const daysUntil = diffDays(p.deadline, date)
    return daysUntil >= 0 && daysUntil <= config.deadlineWarningDays
  })

  // Stalled projects: active projects with 0 done tasks and taskCountOverdue > 0
  // Approximation: projects where done/total ratio is very low and overdue exists
  // A more accurate "no activity in N days" check would require a last-activity timestamp
  // which the current schema doesn't track. For now, use overdue+low completion as proxy.
  const stalledProjects = data.activeProjects.filter((p) => {
    if (p.taskCountTotal === 0) return false
    const completionRate = (p.taskCountDone / p.taskCountTotal) * 100
    return p.taskCountOverdue > 0 && completionRate < 30
  })

  // High priority unassigned tasks (T-NO-DATE: HIGH/URGENT without due date)
  const highPriorityUnassignedTasks = data.tasksNoDate

  // ── Step 5: Final Assembly ──
  const briefing: OpenDayBriefing = {
    metadata: {
      date: formatDate(date),
      generatedAt: new Date(),
      userId,
      dayOfWeek: DAYS_OF_WEEK[date.getDay()],
    },
    summary: {
      totalTasksToday: data.tasksToday.length,
      totalTasksOverdue: data.tasksOverdue.length,
      totalEventsToday: data.eventsToday.length,
      totalFollowUps: data.messagesFollowUp.length,
      totalUnreadMessages: data.messagesUnread.length,
      criticalItemCount: criticalItems.length,
    },
    criticalItems,
    todayByProject: projectContexts,
    tomorrowPreview: {
      taskCount: data.tasksTomorrow.length,
      eventCount: data.eventsTomorrow.length,
      tasksByProject: Array.from(tomorrowByProject.values()),
      events: data.eventsTomorrow,
    },
    globalPriorities: {
      projectsApproachingDeadline,
      stalledProjects,
      highPriorityUnassignedTasks,
    },
  }

  return briefing
}
