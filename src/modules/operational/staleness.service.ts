import { prisma } from '@/lib/prisma'

/**
 * Staleness thresholds (in hours).
 * These are computed at query time, not stored.
 */
const STALENESS_THRESHOLDS = {
  WAITING_HOURS: 48,    // Task in WAITING status for > 48h = stale
  TODO_HOURS: 72,       // Task in TODO status for > 72h with no activity = stale
  OVERDUE_GRACE_HOURS: 24, // Task past due date by 24h = critical
}

export type StalenessLevel = 'critical' | 'warning' | 'ok'

export type StaleTask = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  updatedAt: Date
  projectName: string
  assigneeName: string | null
  stalenessLevel: StalenessLevel
  stalenessReason: string
  hoursStale: number
}

/**
 * Get all stale/problematic tasks in a workspace.
 * Computed at query time — no stored staleness fields.
 */
export async function getStaleTasks(workspaceId: string): Promise<StaleTask[]> {
  const now = new Date()

  // Get all active tasks (not DONE)
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: { not: 'DONE' },
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true } },
    },
    orderBy: { updatedAt: 'asc' },
  })

  const staleTasks: StaleTask[] = []

  for (const task of tasks) {
    const hoursSinceUpdate = (now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60)
    let stalenessLevel: StalenessLevel = 'ok'
    let stalenessReason = ''
    let hoursStale = 0

    // Check overdue (critical)
    if (task.dueDate && task.dueDate < now) {
      const hoursOverdue = (now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60)
      if (hoursOverdue > STALENESS_THRESHOLDS.OVERDUE_GRACE_HOURS) {
        stalenessLevel = 'critical'
        stalenessReason = `Overdue by ${Math.round(hoursOverdue)}h`
        hoursStale = hoursOverdue
      }
    }

    // Check WAITING staleness
    if (stalenessLevel === 'ok' && task.status === 'WAITING') {
      if (hoursSinceUpdate > STALENESS_THRESHOLDS.WAITING_HOURS) {
        stalenessLevel = 'warning'
        stalenessReason = `Waiting for ${Math.round(hoursSinceUpdate)}h with no update`
        hoursStale = hoursSinceUpdate
      }
    }

    // Check TODO staleness (no activity)
    if (stalenessLevel === 'ok' && task.status === 'TODO') {
      if (hoursSinceUpdate > STALENESS_THRESHOLDS.TODO_HOURS) {
        stalenessLevel = 'warning'
        stalenessReason = `In TODO for ${Math.round(hoursSinceUpdate)}h — may need attention`
        hoursStale = hoursSinceUpdate
      }
    }

    if (stalenessLevel !== 'ok') {
      staleTasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        projectName: task.project.name,
        assigneeName: task.assignee?.name || null,
        stalenessLevel,
        stalenessReason,
        hoursStale,
      })
    }
  }

  // Sort: critical first, then by hours stale descending
  return staleTasks.sort((a, b) => {
    if (a.stalenessLevel === 'critical' && b.stalenessLevel !== 'critical') return -1
    if (a.stalenessLevel !== 'critical' && b.stalenessLevel === 'critical') return 1
    return b.hoursStale - a.hoursStale
  })
}

/**
 * Get owner dashboard operational signals.
 * All computed lazily — no cron jobs needed.
 */
export async function getOwnerSignals(workspaceId: string) {
  const now = new Date()

  const [
    overdueTasks,
    waitingTasks,
    unassignedTasks,
    totalActiveTasks,
    totalDoneThisWeek,
  ] = await Promise.all([
    // Overdue tasks
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: { not: 'DONE' },
        dueDate: { lt: now },
      },
    }),
    // Tasks in WAITING status
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: 'WAITING',
      },
    }),
    // Unassigned tasks
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: { not: 'DONE' },
        assigneeId: null,
      },
    }),
    // Total active tasks
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: { not: 'DONE' },
      },
    }),
    // Done this week
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: 'DONE',
        updatedAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
        },
      },
    }),
  ])

  return {
    overdueTasks,
    waitingTasks,
    unassignedTasks,
    totalActiveTasks,
    totalDoneThisWeek,
  }
}

/**
 * Lazy nudge dispatch — called when owner views dashboard.
 * Creates notifications for stale items if not already notified recently.
 */
export async function dispatchLazyNudges(workspaceId: string, ownerId: string) {
  const staleTasks = await getStaleTasks(workspaceId)
  const criticalTasks = staleTasks.filter((t) => t.stalenessLevel === 'critical')

  if (criticalTasks.length === 0) return

  // Check if we already sent a nudge notification in the last 24h
  const recentNudge = await prisma.notification.findFirst({
    where: {
      userId: ownerId,
      type: 'STALENESS_NUDGE',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  if (recentNudge) return // Already nudged recently

  // Create nudge notification
  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: 'STALENESS_NUDGE',
      title: `${criticalTasks.length} task(s) need attention`,
      body: criticalTasks.slice(0, 3).map((t) => t.title).join(', '),
      linkUrl: '/',
    },
  })
}
