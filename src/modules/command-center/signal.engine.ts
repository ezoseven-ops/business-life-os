import { prisma } from '@/lib/prisma'

/**
 * Signal Engine — detects problems in the system and returns structured alerts.
 *
 * Rules:
 *   - ONE signal per task maximum (highest severity wins)
 *   - Categories: CRITICAL, RISK, WASTE
 *   - Sorted by severity descending within each category
 *
 * CRITICAL:
 *   - Overdue HIGH/URGENT tasks → severity 100 + (daysOverdue × 10)
 *   - WAITING tasks blocked 3+ days → severity 80 + (daysSinceUpdate × 5)
 *   - Unassigned HIGH/URGENT tasks → severity 70
 *
 * RISK:
 *   - TODO/IN_PROGRESS with no activity 3+ days (MED+ priority) → severity 50 + (days × 3)
 *
 * WASTE:
 *   - LOW priority stagnation 7+ days → severity 20 + days
 */

export type SignalCategory = 'CRITICAL' | 'RISK' | 'WASTE'

export type Signal = {
  id: string
  category: SignalCategory
  title: string
  description: string
  taskId: string
  projectName: string
  ventureName: string | null
  severity: number
}

// Result type for tasks with included relations (PRISMA_SCHEMA_FIELD)
type TaskWithRelations = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  assigneeId: string | null
  lastActivityAt: Date
  project: {
    name: string
    projectPriority: string
    venture: { name: string } | null
  }
  assignee: { name: string | null } | null
}

export async function getSignals(workspaceId: string): Promise<Signal[]> {
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // PRISMA_SCHEMA_FIELD: project select includes projectPriority + venture
  const tasks = (await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: { not: 'DONE' },
    },
    include: {
      project: {
        select: {
          name: true,
          projectPriority: true,
          venture: { select: { name: true } },
        },
      },
      assignee: { select: { name: true } },
    } as any,
  })) as unknown as TaskWithRelations[]

  // Collect candidate signals per task — then pick highest severity
  const bestSignalPerTask = new Map<string, Signal>()

  for (const task of tasks) {
    const projectName = task.project.name
    const ventureName = task.project.venture?.name ?? null
    const hoursSinceUpdate = (now.getTime() - task.lastActivityAt.getTime()) / (1000 * 60 * 60)
    const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24)

    const candidates: Signal[] = []

    // ── CRITICAL: Overdue HIGH/URGENT tasks ──
    if (
      task.dueDate &&
      task.dueDate < now &&
      (task.priority === 'URGENT' || task.priority === 'HIGH')
    ) {
      const daysOverdue = Math.ceil(
        (now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      candidates.push({
        id: `critical-overdue-${task.id}`,
        category: 'CRITICAL',
        title: `Overdue by ${daysOverdue}d`,
        description: task.title,
        taskId: task.id,
        projectName,
        ventureName,
        severity: 100 + daysOverdue * 10,
      })
    }

    // ── CRITICAL: WAITING tasks blocked 3+ days ──
    if (task.status === 'WAITING' && task.lastActivityAt < threeDaysAgo) {
      candidates.push({
        id: `critical-blocked-${task.id}`,
        category: 'CRITICAL',
        title: `Blocked ${daysSinceUpdate}d`,
        description: task.title,
        taskId: task.id,
        projectName,
        ventureName,
        severity: 80 + daysSinceUpdate * 5,
      })
    }

    // ── CRITICAL: Unassigned HIGH/URGENT tasks ──
    if (
      !task.assigneeId &&
      (task.priority === 'URGENT' || task.priority === 'HIGH')
    ) {
      candidates.push({
        id: `critical-unassigned-${task.id}`,
        category: 'CRITICAL',
        title: 'Unassigned',
        description: task.title,
        taskId: task.id,
        projectName,
        ventureName,
        severity: 70,
      })
    }

    // ── RISK: No updates 3+ days on active tasks (MED+ priority) ──
    if (
      (task.status === 'TODO' || task.status === 'IN_PROGRESS') &&
      task.lastActivityAt < threeDaysAgo &&
      task.priority !== 'LOW'
    ) {
      candidates.push({
        id: `risk-stale-${task.id}`,
        category: 'RISK',
        title: `Silent ${daysSinceUpdate}d`,
        description: task.title,
        taskId: task.id,
        projectName,
        ventureName,
        severity: 50 + daysSinceUpdate * 3,
      })
    }

    // ── WASTE: Low priority stagnation 7+ days ──
    if (
      task.priority === 'LOW' &&
      task.lastActivityAt < sevenDaysAgo
    ) {
      candidates.push({
        id: `waste-stagnant-${task.id}`,
        category: 'WASTE',
        title: `Stagnant ${daysSinceUpdate}d`,
        description: task.title,
        taskId: task.id,
        projectName,
        ventureName,
        severity: 20 + daysSinceUpdate,
      })
    }

    // Pick the highest severity signal for this task
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => (a.severity > b.severity ? a : b))
      const existing = bestSignalPerTask.get(task.id)
      if (!existing || best.severity > existing.severity) {
        bestSignalPerTask.set(task.id, best)
      }
    }
  }

  // Collect, sort by severity descending
  return Array.from(bestSignalPerTask.values()).sort((a, b) => b.severity - a.severity)
}

/** Group signals by category for UI rendering */
export function groupSignals(signals: Signal[]) {
  return {
    critical: signals.filter((s) => s.category === 'CRITICAL'),
    risk: signals.filter((s) => s.category === 'RISK'),
    waste: signals.filter((s) => s.category === 'WASTE'),
  }
}
