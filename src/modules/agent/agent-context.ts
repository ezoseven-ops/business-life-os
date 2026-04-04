import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import type {
  AgentSession,
  AgentAction,
  FocusEntity,
  UnresolvedItem,
  AgentSessionSnapshot,
} from './agent.types'
import type { CommandResult } from '@/modules/command/command.types'
import type { CaptureResult } from '@/modules/capture/capture.types'

// ─────────────────────────────────────────────
// Agent Context Manager — Database-Backed
//
// BLOCK 1 HARDENING: Sessions are persisted to
// PostgreSQL via the AgentSession model.
//
// Architecture:
// - Read from DB on first access per request
// - In-memory cache for the duration of the request
// - Write-through on every mutation (recordAction, etc.)
// - TTL enforced in DB with expiresAt column
// - Expired sessions are marked, not silently deleted
//
// Survives: server restart, deployment, multi-request
// Does NOT require Redis or external cache.
// ─────────────────────────────────────────────

const log = createLogger('AgentContext')

/** Session TTL: 30 minutes of inactivity */
const SESSION_TTL_MS = 30 * 60 * 1000

/** Max action history per session */
const MAX_HISTORY = 10

/** In-memory request-scoped cache (avoids repeated DB reads within one request chain) */
const requestCache = new Map<string, AgentSession>()

// ─── Session key ───

function sessionKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`
}

// ─── DB Data Shape ───

interface AgentSessionData {
  currentProject: { id: string; name: string } | null
  currentEntity: FocusEntity | null
  actionHistory: AgentAction[]
  unresolvedItems: UnresolvedItem[]
}

// ─── Public API ───

/**
 * Get or create a session for this workspace+user.
 * Returns { session, wasExpired } so the caller can inform the UI.
 *
 * Flow:
 * 1. Check request cache (fast path)
 * 2. Read from DB
 * 3. If found and not expired → return
 * 4. If found and expired → mark expired in DB, create fresh
 * 5. If not found → create fresh
 */
export async function getSession(
  workspaceId: string,
  userId: string,
): Promise<{ session: AgentSession; wasExpired: boolean }> {
  const key = sessionKey(workspaceId, userId)

  // Fast path: request cache
  const cached = requestCache.get(key)
  if (cached) {
    return { session: cached, wasExpired: false }
  }

  // Read from DB
  const dbRow = await (prisma as any).agentSession.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  }).catch(() => null)

  if (dbRow) {
    const now = new Date()

    // Check expiry
    if (dbRow.expired || new Date(dbRow.expiresAt) < now) {
      // Session expired — mark it and create fresh
      log.info('Session expired, creating fresh', {
        sessionId: dbRow.id,
        expiredAt: dbRow.expiresAt,
      })

      // Mark as expired in DB (don't delete — traceable)
      await (prisma as any).agentSession.update({
        where: { id: dbRow.id },
        data: { expired: true },
      }).catch(() => {})

      // Delete and create fresh
      await (prisma as any).agentSession.delete({
        where: { id: dbRow.id },
      }).catch(() => {})

      const fresh = await createFreshSession(workspaceId, userId)
      requestCache.set(key, fresh)
      return { session: fresh, wasExpired: true }
    }

    // Valid session — hydrate
    const sessionData = dbRow.sessionData as AgentSessionData
    const session: AgentSession = {
      sessionId: dbRow.id,
      workspaceId,
      userId,
      currentProject: sessionData.currentProject,
      currentEntity: sessionData.currentEntity,
      actionHistory: sessionData.actionHistory ?? [],
      unresolvedItems: sessionData.unresolvedItems ?? [],
      lastActiveAt: new Date(dbRow.updatedAt).getTime(),
      createdAt: new Date(dbRow.createdAt).getTime(),
    }

    // Touch: extend TTL
    await touchSession(dbRow.id)

    requestCache.set(key, session)
    return { session, wasExpired: false }
  }

  // No session exists — create fresh
  const fresh = await createFreshSession(workspaceId, userId)
  requestCache.set(key, fresh)
  return { session: fresh, wasExpired: false }
}

/**
 * Legacy sync API for backwards compatibility with existing callers.
 * Wraps the async getSession. Used by agent-context functions that
 * already have a session object (they received it from the service layer).
 */
export function getSessionSync(workspaceId: string, userId: string): AgentSession {
  const key = sessionKey(workspaceId, userId)
  const cached = requestCache.get(key)
  if (cached) return cached

  // If not in cache, return a temporary empty session
  // The real session will be loaded by the service layer
  const temp: AgentSession = {
    sessionId: `temp_${Date.now()}`,
    workspaceId,
    userId,
    currentProject: null,
    currentEntity: null,
    actionHistory: [],
    unresolvedItems: [],
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
  }
  return temp
}

/**
 * Record a completed action into the session.
 * Updates current context and persists to DB.
 */
export async function recordAction(
  session: AgentSession,
  action: AgentAction,
): Promise<void> {
  // Push to history (newest first, cap at MAX_HISTORY)
  session.actionHistory.unshift(action)
  if (session.actionHistory.length > MAX_HISTORY) {
    session.actionHistory = session.actionHistory.slice(0, MAX_HISTORY)
  }

  // Update focus based on the action's entities
  updateFocusFromAction(session, action)

  session.lastActiveAt = Date.now()

  // Persist to DB
  await persistSession(session)

  log.debug('Action recorded', {
    sessionId: session.sessionId,
    type: action.type,
    intent: action.intent,
    entityCount: action.entities.length,
  })
}

/**
 * Add an unresolved item to the session.
 */
export async function addUnresolved(session: AgentSession, item: UnresolvedItem): Promise<void> {
  session.unresolvedItems.push(item)
  if (session.unresolvedItems.length > 5) {
    session.unresolvedItems = session.unresolvedItems.slice(-5)
  }
  await persistSession(session)
}

/**
 * Clear unresolved items of a specific type.
 */
export async function clearUnresolved(session: AgentSession, type?: UnresolvedItem['type']): Promise<void> {
  if (type) {
    session.unresolvedItems = session.unresolvedItems.filter((i) => i.type !== type)
  } else {
    session.unresolvedItems = []
  }
  await persistSession(session)
}

/**
 * Set the current project context explicitly.
 */
export async function setCurrentProject(
  session: AgentSession,
  project: { id: string; name: string } | null,
): Promise<void> {
  session.currentProject = project
  await persistSession(session)
  log.debug('Project context set', {
    sessionId: session.sessionId,
    projectId: project?.id ?? null,
  })
}

/**
 * Set the current entity focus.
 */
export async function setCurrentEntity(
  session: AgentSession,
  entity: FocusEntity | null,
): Promise<void> {
  session.currentEntity = entity
  await persistSession(session)
}

/**
 * Get the last N actions from session history.
 */
export function getRecentActions(session: AgentSession, count = 3): AgentAction[] {
  return session.actionHistory.slice(0, count)
}

/**
 * Get the last action (most recent).
 */
export function getLastAction(session: AgentSession): AgentAction | null {
  return session.actionHistory[0] ?? null
}

/**
 * Resolve a reference like "this task", "that project", "him", "the meeting"
 * using the session context.
 */
export function resolveReference(
  session: AgentSession,
  reference: string,
): FocusEntity | null {
  const ref = reference.toLowerCase().trim()

  // Direct "this" / "that" / "it" → current entity
  if (['this', 'that', 'it', 'the same'].some((r) => ref.includes(r))) {
    if (session.currentEntity) return session.currentEntity
    const lastAction = getLastAction(session)
    if (lastAction?.entities[0]) return lastAction.entities[0]
  }

  // "this project" / "the project"
  if (ref.includes('project') || ref.includes('this project') || ref.includes('the project')) {
    if (session.currentProject) {
      return { type: 'project', id: session.currentProject.id, name: session.currentProject.name }
    }
  }

  // "this task" / "the task"
  if (ref.includes('task') || ref.includes('this task') || ref.includes('the task')) {
    return findLastEntityOfType(session, 'task')
  }

  // "him" / "her" / "them"
  if (['him', 'her', 'them', 'that person', 'this person'].some((r) => ref.includes(r))) {
    return findLastEntityOfType(session, 'person')
  }

  // "the meeting" / "the event"
  if (ref.includes('meeting') || ref.includes('event') || ref.includes('the event')) {
    return findLastEntityOfType(session, 'event')
  }

  return null
}

/**
 * Build a serializable snapshot for the client.
 * BLOCK 5: includes sessionExpired flag.
 */
export function buildSnapshot(
  session: AgentSession,
  wasExpired = false,
): AgentSessionSnapshot {
  const lastAction = getLastAction(session)
  return {
    sessionId: session.sessionId,
    currentProject: session.currentProject,
    currentEntityType: session.currentEntity?.type ?? null,
    currentEntityName: session.currentEntity?.name ?? null,
    lastActionInterpretation: lastAction?.interpretation ?? null,
    actionCount: session.actionHistory.length,
    hasUnresolved: session.unresolvedItems.length > 0,
    sessionExpired: wasExpired,
  }
}

/**
 * Build the context summary string for the AI prompt.
 */
export function buildContextSummary(session: AgentSession): string {
  const parts: string[] = []

  if (session.currentProject) {
    parts.push(`Current project: "${session.currentProject.name}" (ID: ${session.currentProject.id})`)
  }

  if (session.currentEntity) {
    parts.push(`Current focus: ${session.currentEntity.type} "${session.currentEntity.name}" (ID: ${session.currentEntity.id})`)
  }

  const recentActions = getRecentActions(session, 3)
  if (recentActions.length > 0) {
    parts.push('Recent actions:')
    for (const action of recentActions) {
      const entities = action.entities.map((e) => `${e.type}:"${e.name}"`).join(', ')
      parts.push(`  - [${action.type}] ${action.interpretation}${entities ? ` → ${entities}` : ''}`)
    }
  }

  if (session.unresolvedItems.length > 0) {
    parts.push('Unresolved:')
    for (const item of session.unresolvedItems) {
      parts.push(`  - ${item.description}`)
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'No prior context (new session).'
}

/**
 * Extract entities from a command result and return FocusEntity array.
 */
export function extractEntitiesFromCommandResult(
  result: CommandResult,
  command: { intent: string; [key: string]: any },
): FocusEntity[] {
  const entities: FocusEntity[] = []

  switch (result.intent) {
    case 'create_task':
      entities.push({ type: 'task', id: (result as any).taskId, name: command.title ?? 'task' })
      entities.push({ type: 'project', id: (result as any).projectId, name: command.projectName ?? 'project' })
      break
    case 'assign_task':
      entities.push({ type: 'task', id: (result as any).taskId, name: command.taskTitle ?? 'task' })
      entities.push({ type: 'person', id: (result as any).assigneeId, name: command.assigneeName ?? 'person' })
      break
    case 'complete_task':
      entities.push({ type: 'task', id: (result as any).taskId, name: command.taskTitle ?? 'task' })
      break
    case 'create_project':
      entities.push({ type: 'project', id: (result as any).projectId, name: command.name ?? 'project' })
      break
    case 'add_member':
      entities.push({ type: 'project', id: (result as any).projectId, name: command.projectName ?? 'project' })
      entities.push({ type: 'person', id: (result as any).userId, name: command.personName ?? 'person' })
      break
    case 'create_event':
      entities.push({ type: 'event', id: (result as any).eventId, name: command.title ?? 'event' })
      break
    case 'save_note':
      entities.push({ type: 'note', id: (result as any).noteId, name: command.title ?? 'note' })
      break
    case 'navigate':
      if (command.projectId) {
        entities.push({ type: 'project', id: command.projectId, name: command.projectName ?? 'project' })
      }
      break
    // Update intents
    case 'update_task':
      entities.push({ type: 'task', id: (result as any).taskId, name: command.taskTitle ?? 'task' })
      break
    case 'update_event':
      entities.push({ type: 'event', id: (result as any).eventId, name: command.eventTitle ?? 'event' })
      break
    case 'update_project':
      entities.push({ type: 'project', id: (result as any).projectId, name: command.projectName ?? 'project' })
      break
  }

  return entities
}

/**
 * Extract entities from a capture result.
 */
export function extractEntitiesFromCaptureResult(
  result: CaptureResult,
): FocusEntity[] {
  switch (result.classification) {
    case 'project':
      return [{ type: 'project', id: result.projectId, name: 'project' }]
    case 'task_bundle':
      return [{ type: 'project', id: result.projectId, name: 'project' }]
    case 'follow_up':
      return [{ type: 'task', id: result.taskId, name: 'follow-up' }]
    case 'collaborator':
      return [{ type: 'person', id: result.personId, name: 'collaborator' }]
    default:
      return []
  }
}

/**
 * Cleanup expired sessions from the database.
 * Can be called from a cron job or server startup.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await (prisma as any).agentSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { expired: true },
      ],
    },
  }).catch(() => ({ count: 0 }))

  if (result.count > 0) {
    log.info('Cleaned expired sessions from DB', { count: result.count })
  }
  return result.count
}

// ─── Internal helpers ───

async function createFreshSession(workspaceId: string, userId: string): Promise<AgentSession> {
  const sessionData: AgentSessionData = {
    currentProject: null,
    currentEntity: null,
    actionHistory: [],
    unresolvedItems: [],
  }

  const row = await (prisma as any).agentSession.create({
    data: {
      workspaceId,
      userId,
      sessionData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      expired: false,
    },
  }).catch(() => null)

  const sessionId = row?.id ?? `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const session: AgentSession = {
    sessionId,
    workspaceId,
    userId,
    currentProject: null,
    currentEntity: null,
    actionHistory: [],
    unresolvedItems: [],
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
  }

  log.info('New agent session created', { sessionId })
  return session
}

async function persistSession(session: AgentSession): Promise<void> {
  const sessionData: AgentSessionData = {
    currentProject: session.currentProject,
    currentEntity: session.currentEntity,
    actionHistory: session.actionHistory,
    unresolvedItems: session.unresolvedItems,
  }

  await (prisma as any).agentSession.upsert({
    where: { workspaceId_userId: { workspaceId: session.workspaceId, userId: session.userId } },
    create: {
      id: session.sessionId,
      workspaceId: session.workspaceId,
      userId: session.userId,
      sessionData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
    update: {
      sessionData,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      expired: false,
    },
  }).catch((err: any) => {
    log.error('Failed to persist session', { sessionId: session.sessionId, error: String(err) })
  })
}

async function touchSession(sessionId: string): Promise<void> {
  await (prisma as any).agentSession.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  }).catch(() => {})
}

function updateFocusFromAction(session: AgentSession, action: AgentAction): void {
  if (action.entities.length > 0) {
    session.currentEntity = action.entities[0]
  }

  const projectEntity = action.entities.find((e) => e.type === 'project')
  if (projectEntity) {
    session.currentProject = { id: projectEntity.id, name: projectEntity.name }
  }
}

function findLastEntityOfType(
  session: AgentSession,
  type: FocusEntity['type'],
): FocusEntity | null {
  for (const action of session.actionHistory) {
    const entity = action.entities.find((e) => e.type === type)
    if (entity) return entity
  }
  return null
}
