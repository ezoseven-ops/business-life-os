/**
 * Open Day / Close Day — Query Layer
 *
 * Implements all queries from spec section 2 (Data Inputs).
 * Each function returns snapshot types for deterministic pipeline consumption.
 *
 * Phase B scope: queries only — no aggregation, no AI, no persistence.
 */

import { prisma } from '@/lib/prisma'
import type {
  TaskSnapshot,
  ProjectSnapshot,
  EventSnapshot,
  MessageSnapshot,
  NoteSnapshot,
  PersonSnapshot,
} from './open-day.types'

// ─── Helpers ───

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function snippet(content: string | null, maxLen = 200): string | null {
  if (!content) return null
  return content.length <= maxLen ? content : content.slice(0, maxLen) + '…'
}

// ─── Task include for snapshot mapping ───

const taskSelect = {
  id: true,
  title: true,
  projectId: true,
  priority: true,
  status: true,
  dueDate: true,
  completedAt: true,
  assigneeId: true,
  assigneePersonId: true,
  createdAt: true,
  sourceMessageId: true,
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  assigneePerson: { select: { id: true, name: true } },
} as const

type RawTask = Awaited<ReturnType<typeof prisma.task.findFirst<{ select: typeof taskSelect }>>>

function mapTask(t: NonNullable<RawTask>): TaskSnapshot {
  return {
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    projectName: t.project?.name ?? '_UNKNOWN',
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    assigneePersonId: t.assigneePersonId,
    assigneePersonName: t.assigneePerson?.name ?? null,
    createdAt: t.createdAt,
    source: t.sourceMessageId,
  }
}

// ─── 2.1 Task Queries ───

/** T-TODAY: Tasks due today, not done */
export async function queryTasksToday(
  workspaceId: string,
  date: Date,
): Promise<TaskSnapshot[]> {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      dueDate: { gte: dayStart, lte: dayEnd },
      status: { not: 'DONE' },
    },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-OVERDUE: Tasks overdue (dueDate < today, not done) */
export async function queryTasksOverdue(
  workspaceId: string,
  date: Date,
): Promise<TaskSnapshot[]> {
  const dayStart = startOfDay(date)

  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      dueDate: { lt: dayStart },
      status: { not: 'DONE' },
    },
    select: taskSelect,
    orderBy: [{ dueDate: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-TOMORROW: Tasks due tomorrow, not done */
export async function queryTasksTomorrow(
  workspaceId: string,
  date: Date,
): Promise<TaskSnapshot[]> {
  const tomorrow = addDays(date, 1)
  const tomorrowStart = startOfDay(tomorrow)
  const tomorrowEnd = endOfDay(tomorrow)

  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { not: 'DONE' },
    },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-BLOCKED: Tasks with status BLOCKED (any date) */
export async function queryTasksBlocked(
  workspaceId: string,
): Promise<TaskSnapshot[]> {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      status: 'BLOCKED',
    },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-NO-DATE: High/Urgent tasks without due date, not done */
export async function queryTasksNoDate(
  workspaceId: string,
): Promise<TaskSnapshot[]> {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      dueDate: null,
      status: { not: 'DONE' },
      priority: { in: ['URGENT', 'HIGH'] },
    },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-COMPLETED-TODAY: Tasks completed today */
export async function queryTasksCompletedToday(
  workspaceId: string,
  date: Date,
): Promise<TaskSnapshot[]> {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      completedAt: { gte: dayStart, lte: dayEnd },
    },
    select: taskSelect,
    orderBy: [{ completedAt: 'asc' }],
  })

  return tasks.map(mapTask)
}

/** T-FAILED-TODAY: Tasks due today that are NOT done (Close Day) */
export async function queryTasksFailedToday(
  workspaceId: string,
  date: Date,
): Promise<TaskSnapshot[]> {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      dueDate: { gte: dayStart, lte: dayEnd },
      status: { not: 'DONE' },
    },
    select: taskSelect,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })

  return tasks.map(mapTask)
}

// ─── 2.2 Project Queries ───

/** P-ACTIVE: Active projects with task counts */
export async function queryActiveProjects(
  workspaceId: string,
  date: Date,
): Promise<ProjectSnapshot[]> {
  const dayStart = startOfDay(date)

  const projects = await prisma.project.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      status: true,
      phase: true,
      projectPriority: true,
      deadline: true,
      _count: { select: { tasks: true } },
      tasks: {
        where: { status: 'DONE' },
        select: { id: true },
      },
    },
    orderBy: { projectPriority: 'asc' },
  })

  // Count overdue tasks per project in a separate query for accuracy
  const overdueCountsByProject = await prisma.task.groupBy({
    by: ['projectId'],
    where: {
      project: { workspaceId, status: 'ACTIVE' },
      dueDate: { lt: dayStart },
      status: { not: 'DONE' },
    },
    _count: { id: true },
  })

  const overdueMap = new Map(
    overdueCountsByProject.map((g) => [g.projectId, g._count.id]),
  )

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    phase: p.phase,
    priority: p.projectPriority,
    deadline: p.deadline,
    taskCountTotal: p._count.tasks,
    taskCountDone: p.tasks.length,
    taskCountOverdue: overdueMap.get(p.id) ?? 0,
  }))
}

/** P-TEAM: Project team (both User-members and Person-associates) */
export async function queryProjectTeams(
  workspaceId: string,
): Promise<Map<string, PersonSnapshot[]>> {
  const [members, people] = await Promise.all([
    prisma.projectMember.findMany({
      where: { project: { workspaceId, status: 'ACTIVE' } },
      select: {
        projectId: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            linkedPerson: { select: { id: true } },
          },
        },
      },
    }),
    prisma.projectPerson.findMany({
      where: { project: { workspaceId, status: 'ACTIVE' } },
      select: {
        projectId: true,
        role: true,
        person: { select: { id: true, name: true } },
      },
    }),
  ])

  const teamMap = new Map<string, PersonSnapshot[]>()

  for (const m of members) {
    const list = teamMap.get(m.projectId) ?? []
    list.push({
      id: m.user.linkedPerson?.id ?? m.user.id,
      name: m.user.name ?? 'Unknown',
      role: m.role,
    })
    teamMap.set(m.projectId, list)
  }

  for (const p of people) {
    const list = teamMap.get(p.projectId) ?? []
    // Avoid duplicates if person is already listed via User link
    if (!list.some((existing) => existing.id === p.person.id)) {
      list.push({
        id: p.person.id,
        name: p.person.name,
        role: p.role,
      })
    }
    teamMap.set(p.projectId, list)
  }

  return teamMap
}

// ─── 2.3 Event Queries ───

const eventSelect = {
  id: true,
  title: true,
  startAt: true,
  endAt: true,
  projectId: true,
  allDay: true,
  location: true,
  project: { select: { id: true, name: true } },
  attendees: {
    select: {
      user: { select: { name: true } },
    },
  },
} as const

type RawEvent = Awaited<ReturnType<typeof prisma.event.findFirst<{ select: typeof eventSelect }>>>

function mapEvent(
  e: NonNullable<RawEvent>,
  googleEventIds: Set<string>,
): EventSnapshot {
  return {
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    projectId: e.projectId,
    projectName: e.project?.name ?? null,
    attendees: e.attendees.map((a) => a.user.name ?? 'Unknown'),
    location: e.location,
    allDay: e.allDay,
    isGoogleCalendar: googleEventIds.has(e.id),
  }
}

/** Bulk lookup: which event IDs have a GOOGLE_CALENDAR sync record */
async function lookupGoogleEventIds(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set()
  const syncRecords = await prisma.calendarSyncMap.findMany({
    where: {
      eventId: { in: eventIds },
      provider: 'GOOGLE_CALENDAR',
    },
    select: { eventId: true },
  })
  return new Set(syncRecords.map((r) => r.eventId))
}

/** E-TODAY: Events today */
export async function queryEventsToday(
  workspaceId: string,
  date: Date,
): Promise<EventSnapshot[]> {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const events = await prisma.event.findMany({
    where: {
      workspaceId,
      startAt: { gte: dayStart, lte: dayEnd },
    },
    select: eventSelect,
    orderBy: { startAt: 'asc' },
  })

  const googleIds = await lookupGoogleEventIds(events.map((e) => e.id))
  return events.map((e) => mapEvent(e, googleIds))
}

/** E-TOMORROW: Events tomorrow */
export async function queryEventsTomorrow(
  workspaceId: string,
  date: Date,
): Promise<EventSnapshot[]> {
  const tomorrow = addDays(date, 1)
  const tomorrowStart = startOfDay(tomorrow)
  const tomorrowEnd = endOfDay(tomorrow)

  const events = await prisma.event.findMany({
    where: {
      workspaceId,
      startAt: { gte: tomorrowStart, lte: tomorrowEnd },
    },
    select: eventSelect,
    orderBy: { startAt: 'asc' },
  })

  const googleIds = await lookupGoogleEventIds(events.map((e) => e.id))
  return events.map((e) => mapEvent(e, googleIds))
}

// ─── 2.4 Message Queries ───

const messageSelect = {
  id: true,
  personId: true,
  channel: true,
  content: true,
  projectId: true,
  createdAt: true,
  person: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const

type RawMessage = Awaited<ReturnType<typeof prisma.message.findFirst<{ select: typeof messageSelect }>>>

function mapMessage(m: NonNullable<RawMessage>): MessageSnapshot {
  return {
    id: m.id,
    personId: m.personId,
    personName: m.person?.name ?? null,
    channel: m.channel,
    projectId: m.projectId,
    projectName: m.project?.name ?? null,
    snippet: snippet(m.content),
    receivedAt: m.createdAt,
  }
}

/** M-UNREAD: Messages with readAt = null */
export async function queryMessagesUnread(
  workspaceId: string,
): Promise<MessageSnapshot[]> {
  const messages = await prisma.message.findMany({
    where: {
      workspaceId,
      readAt: null,
      direction: 'INBOUND',
    },
    select: messageSelect,
    orderBy: { createdAt: 'asc' },
  })

  return messages.map(mapMessage)
}

/** M-FOLLOWUP: Messages requiring follow-up (not yet completed) */
export async function queryMessagesFollowUp(
  workspaceId: string,
): Promise<MessageSnapshot[]> {
  const messages = await prisma.message.findMany({
    where: {
      workspaceId,
      followUpRequired: true,
      followUpCompletedAt: null,
    },
    select: messageSelect,
    orderBy: { createdAt: 'asc' },
  })

  return messages.map(mapMessage)
}

/** M-AWAITING: Messages awaiting response (not yet responded) */
export async function queryMessagesAwaiting(
  workspaceId: string,
): Promise<MessageSnapshot[]> {
  const messages = await prisma.message.findMany({
    where: {
      workspaceId,
      awaitingResponse: true,
      respondedAt: null,
    },
    select: messageSelect,
    orderBy: { createdAt: 'asc' },
  })

  return messages.map(mapMessage)
}

// ─── 2.5 Note Queries ───

/** N-RECENT: Recent notes with action items (within 48 hours) */
export async function queryNotesRecent(
  workspaceId: string,
  date: Date,
): Promise<NoteSnapshot[]> {
  const cutoff = addDays(date, -2)

  const notes = await prisma.note.findMany({
    where: {
      workspaceId,
      hasActionItems: true,
      createdAt: { gte: cutoff },
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      createdAt: true,
      hasActionItems: true,
      project: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    projectId: n.projectId,
    projectName: n.project?.name ?? null,
    createdAt: n.createdAt,
    hasActionItems: n.hasActionItems,
    actionItemCount: n._count.comments, // best available proxy — no dedicated action-item model yet
  }))
}

// ─── Composite: Run All Open Day Queries ───

import type { OpenDayQueryResults, CloseDayQueryResults } from './open-day.types'

/**
 * Execute all Open Day data queries in parallel.
 * Returns raw query results for the builder to aggregate.
 */
export async function runOpenDayQueries(
  workspaceId: string,
  date: Date,
): Promise<OpenDayQueryResults> {
  const [
    tasksToday,
    tasksOverdue,
    tasksTomorrow,
    tasksBlocked,
    tasksNoDate,
    activeProjects,
    projectTeams,
    eventsToday,
    eventsTomorrow,
    messagesUnread,
    messagesFollowUp,
    messagesAwaiting,
    notesRecent,
  ] = await Promise.all([
    queryTasksToday(workspaceId, date),
    queryTasksOverdue(workspaceId, date),
    queryTasksTomorrow(workspaceId, date),
    queryTasksBlocked(workspaceId),
    queryTasksNoDate(workspaceId),
    queryActiveProjects(workspaceId, date),
    queryProjectTeams(workspaceId),
    queryEventsToday(workspaceId, date),
    queryEventsTomorrow(workspaceId, date),
    queryMessagesUnread(workspaceId),
    queryMessagesFollowUp(workspaceId),
    queryMessagesAwaiting(workspaceId),
    queryNotesRecent(workspaceId, date),
  ])

  return {
    tasksToday,
    tasksOverdue,
    tasksTomorrow,
    tasksBlocked,
    tasksNoDate,
    activeProjects,
    projectTeams,
    eventsToday,
    eventsTomorrow,
    messagesUnread,
    messagesFollowUp,
    messagesAwaiting,
    notesRecent,
  }
}

// ─── Composite: Run All Close Day Queries ───

/**
 * Execute all Close Day data queries in parallel.
 * Returns raw query results for the Close Day builder to aggregate.
 */
export async function runCloseDayQueries(
  workspaceId: string,
  date: Date,
): Promise<CloseDayQueryResults> {
  const [
    tasksCompleted,
    tasksFailed,
    tasksOverdue,
    tasksTomorrow,
    tasksBlocked,
    activeProjects,
    projectTeams,
    eventsTomorrow,
    messagesFollowUp,
  ] = await Promise.all([
    queryTasksCompletedToday(workspaceId, date),
    queryTasksFailedToday(workspaceId, date),
    queryTasksOverdue(workspaceId, date),
    queryTasksTomorrow(workspaceId, date),
    queryTasksBlocked(workspaceId),
    queryActiveProjects(workspaceId, date),
    queryProjectTeams(workspaceId),
    queryEventsTomorrow(workspaceId, date),
    queryMessagesFollowUp(workspaceId),
  ])

  return {
    tasksCompleted,
    tasksFailed,
    tasksOverdue,
    tasksTomorrow,
    tasksBlocked,
    activeProjects,
    projectTeams,
    eventsTomorrow,
    messagesFollowUp,
  }
}
