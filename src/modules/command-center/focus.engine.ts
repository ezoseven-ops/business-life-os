import { prisma } from '@/lib/prisma'

/**
 * Focus Engine — returns the top 3 tasks a user should work on RIGHT NOW.
 *
 * Rules:
 *   - Only TODO and IN_PROGRESS tasks (WAITING = blocked, not actionable)
 *   - Only tasks assigned to this user (unassigned = not your focus)
 *   - Scored by priority, deadline, project weight, venture weight, staleness
 *   - Tiebreaker: dueDate ascending (earlier deadline wins), then createdAt ascending
 *
 * Scoring:
 *   base    = PRIORITY_WEIGHT[task.priority]
 *   overdue = task is past due? +40
 *   urgent  = due within 24h? +20
 *   project = PROJECT_PRIORITY_WEIGHT[project.projectPriority]
 *   venture = (6 - venture.priority) * 3  (venture priority 1 = +15, priority 5 = +3)
 *   stale   = no activity 3+ days? +10
 *   active  = IN_PROGRESS? +8 (you already started — finish it)
 */

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 40,
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
}

const PROJECT_PRIORITY_WEIGHT: Record<string, number> = {
  P0: 20,
  P1: 12,
  P2: 6,
  P3: 2,
}

export type FocusTask = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  score: number
  projectName: string
  projectPriority: string
  ventureName: string | null
  assigneeName: string | null
  scoreBreakdown: string[]
}

// Result type for tasks with included relations (PRISMA_SCHEMA_FIELD)
type TaskWithRelations = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | null
  lastActivityAt: Date
  createdAt: Date
  project: {
    name: string
    projectPriority: string
    venture: { name: string; priority: number } | null
  }
  assignee: { name: string | null } | null
}

export async function getFocusTasks(
  workspaceId: string,
  userId: string,
): Promise<FocusTask[]> {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  // PRISMA_SCHEMA_FIELD: project select includes projectPriority + venture
  const tasks = (await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: { in: ['TODO', 'IN_PROGRESS'] },
      assigneeId: userId,
    },
    include: {
      project: {
        select: {
          name: true,
          projectPriority: true,
          venture: { select: { name: true, priority: true } },
        },
      },
      assignee: { select: { name: true } },
    } as any,
    take: 100,
  })) as unknown as TaskWithRelations[]

  const scored: FocusTask[] = tasks.map((task) => {
    let score = 0
    const breakdown: string[] = []

    // Task priority weight
    const pw = PRIORITY_WEIGHT[task.priority] ?? 15
    score += pw
    breakdown.push(`priority:+${pw}`)

    // Overdue boost
    if (task.dueDate && task.dueDate < now) {
      score += 40
      breakdown.push('overdue:+40')
    }
    // Due within 24h
    else if (task.dueDate && task.dueDate <= in24h) {
      score += 20
      breakdown.push('due-soon:+20')
    }

    // Project priority weight
    const ppw = PROJECT_PRIORITY_WEIGHT[task.project.projectPriority] ?? 6
    score += ppw
    breakdown.push(`project-${task.project.projectPriority}:+${ppw}`)

    // Venture priority
    if (task.project.venture) {
      const vw = (6 - task.project.venture.priority) * 3
      score += vw
      breakdown.push(`venture-p${task.project.venture.priority}:+${vw}`)
    }

    // Stale boost (no activity 3+ days)
    if (task.lastActivityAt < threeDaysAgo) {
      score += 10
      breakdown.push('stale:+10')
    }

    // IN_PROGRESS tasks get a small boost (you already started)
    if (task.status === 'IN_PROGRESS') {
      score += 8
      breakdown.push('in-progress:+8')
    }

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      score,
      projectName: task.project.name,
      projectPriority: task.project.projectPriority,
      ventureName: task.project.venture?.name ?? null,
      assigneeName: task.assignee?.name ?? null,
      scoreBreakdown: breakdown,
    }
  })

  // Sort by score descending, tiebreak by dueDate asc then createdAt asc
  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Earlier deadline wins tie
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime()
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
    .slice(0, 3)
}
