/**
 * Open Day / Close Day — Type Definitions
 *
 * Aligned with: docs/systems/open-day-system.md sections 4.1, 4.2
 * Phase B scope: types only — no AI, no voice, no UI
 */

// ─── Shared Primitives ───

export interface TaskSnapshot {
  id: string
  title: string
  projectId: string
  projectName: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'BLOCKED' | 'DONE'
  dueDate: Date | null
  completedAt: Date | null
  assigneeId: string | null
  assigneeName: string | null
  assigneePersonId: string | null
  assigneePersonName: string | null
  createdAt: Date
  source: string | null // sourceMessageId
}

export interface ProjectSnapshot {
  id: string
  name: string
  status: string
  phase: string
  priority: string // ProjectPriority enum value
  deadline: Date | null
  taskCountTotal: number
  taskCountDone: number
  taskCountOverdue: number
}

export interface EventSnapshot {
  id: string
  title: string
  startAt: Date
  endAt: Date | null
  projectId: string | null
  projectName: string | null
  attendees: string[] // attendee names
  location: string | null
  allDay: boolean
}

export interface MessageSnapshot {
  id: string
  personId: string | null
  personName: string | null
  channel: 'TELEGRAM' | 'WHATSAPP'
  projectId: string | null
  projectName: string | null
  snippet: string | null // first ~200 chars of content
  receivedAt: Date
}

export interface NoteSnapshot {
  id: string
  title: string | null
  projectId: string | null
  projectName: string | null
  createdAt: Date
  hasActionItems: boolean
}

export interface PersonSnapshot {
  id: string
  name: string
  role: string | null // ProjectMember or ProjectPerson role
}

// ─── Critical Items (spec section 3.1 Step 4) ───

export type CriticalItemType =
  | 'BLOCKED_TASK'
  | 'OVERDUE_CRITICAL'
  | 'URGENT_TODAY'
  | 'DEADLINE_RISK'
  | 'STALE_FOLLOWUP'

export interface CriticalItem {
  type: CriticalItemType
  title: string
  projectName: string
  projectId: string
  detail: string
  entityType: 'TASK' | 'PROJECT' | 'MESSAGE'
  entityId: string
  daysSince: number | null
}

// ─── Project Day Context (spec section 3.1 Step 2) ───

export interface ProjectDayContext {
  projectId: string
  projectName: string
  projectPriority: string
  projectPhase: string
  projectDeadline: Date | null
  projectScore: number // computed in Step 3
  projectTeam: PersonSnapshot[]
  tasks: {
    overdue: TaskSnapshot[]
    today: TaskSnapshot[]
    blocked: TaskSnapshot[]
  }
  events: EventSnapshot[]
  followUps: MessageSnapshot[]
  awaitingResponses: MessageSnapshot[]
  unreadMessages: MessageSnapshot[]
  recentNotes: NoteSnapshot[]
}

// ─── Open Day Briefing (spec section 4.1) ───

export interface OpenDayBriefing {
  metadata: {
    date: string // "YYYY-MM-DD"
    generatedAt: Date
    userId: string
    dayOfWeek: string
  }

  summary: {
    totalTasksToday: number
    totalTasksOverdue: number
    totalEventsToday: number
    totalFollowUps: number
    totalUnreadMessages: number
    criticalItemCount: number
    // aiNarrative is omitted — Phase C concern
  }

  criticalItems: CriticalItem[]

  todayByProject: ProjectDayContext[]

  tomorrowPreview: {
    taskCount: number
    eventCount: number
    tasksByProject: Array<{
      projectName: string
      tasks: TaskSnapshot[]
    }>
    events: EventSnapshot[]
  }

  globalPriorities: {
    projectsApproachingDeadline: ProjectSnapshot[]
    stalledProjects: ProjectSnapshot[]
    highPriorityUnassignedTasks: TaskSnapshot[]
  }
}

// ─── Builder Input (what the builder receives) ───

export interface OpenDayQueryResults {
  tasksToday: TaskSnapshot[]
  tasksOverdue: TaskSnapshot[]
  tasksTomorrow: TaskSnapshot[]
  tasksBlocked: TaskSnapshot[]
  tasksNoDate: TaskSnapshot[]
  activeProjects: ProjectSnapshot[]
  projectTeams: Map<string, PersonSnapshot[]>
  eventsToday: EventSnapshot[]
  eventsTomorrow: EventSnapshot[]
  messagesUnread: MessageSnapshot[]
  messagesFollowUp: MessageSnapshot[]
  messagesAwaiting: MessageSnapshot[]
  notesRecent: NoteSnapshot[]
}

// ─── Config subset needed for scoring ───

export interface PriorityWeights {
  urgent: number
  high: number
  medium: number
  low: number
  overdueMultiplier: number
  overdueMax: number
  deadlineClose: number  // within 3 days
  deadlineMedium: number // within 7 days
  blockerMultiplier: number
  blockerMax: number
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  urgent: 40,
  high: 30,
  medium: 20,
  low: 10,
  overdueMultiplier: 5,
  overdueMax: 25,
  deadlineClose: 15,
  deadlineMedium: 8,
  blockerMultiplier: 8,
  blockerMax: 24,
}

export interface OpenDayConfig {
  criticalOverdueDays: number  // default: 3
  deadlineWarningDays: number  // default: 7
  stalledProjectDays: number   // default: 7
  followUpStaleDays: number    // default: 3 (72 hours)
  priorityWeights: PriorityWeights
}

export const DEFAULT_OPEN_DAY_CONFIG: OpenDayConfig = {
  criticalOverdueDays: 3,
  deadlineWarningDays: 7,
  stalledProjectDays: 7,
  followUpStaleDays: 3,
  priorityWeights: DEFAULT_PRIORITY_WEIGHTS,
}
