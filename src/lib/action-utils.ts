import { ZodError } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown }

export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.flatten().fieldErrors,
      }
    }
    console.error('[Action Error]', error)
    return { success: false, error: 'Something went wrong' }
  }
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireWorkspace() {
  const session = await requireAuth()
  if (!session.user.workspaceId) {
    throw new Error('No workspace found')
  }
  return {
    ...session,
    workspaceId: session.user.workspaceId,
  }
}

export async function requireOwner() {
  const session = await requireAuth()
  if (session.user.role !== 'OWNER') {
    throw new Error('Owner access required')
  }
  return session
}

/**
 * Require the user to have one of the specified roles.
 * Returns the session with guaranteed workspaceId.
 */
export async function requireRole(...allowedRoles: UserRole[]) {
  const session = await requireWorkspace()
  const role = session.user.role
  if (!role || !allowedRoles.includes(role)) {
    throw new Error(`Access denied. Required role: ${allowedRoles.join(' or ')}`)
  }
  return session
}

/**
 * Check if the user is a member (any role) of the specified project.
 * OWNER and TEAM roles with workspace access are always allowed.
 * CLIENT role must have an explicit ProjectMember record.
 */
export async function requireProjectAccess(projectId: string, workspaceId: string, userId: string, role?: UserRole) {
  // OWNER and MEMBER (team) have workspace-wide project access
  if (role === 'OWNER' || role === 'TEAM') {
    // Just verify the project belongs to this workspace
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    })
    if (!project) throw new Error('Project not found in workspace')
    return project
  }

  // CLIENT must have explicit ProjectMember entry
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: { select: { id: true, workspaceId: true } } },
  })
  if (!membership || membership.project.workspaceId !== workspaceId) {
    throw new Error('Access denied to this project')
  }
  return membership.project
}

/**
 * Check if the user has access to a specific task.
 * OWNER/TEAM: workspace-scoped access.
 * CLIENT: must be assigned to the task, or be a member of the task's project.
 */
export async function requireTaskAccess(taskId: string, workspaceId: string, userId: string, role?: UserRole) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspaceId } },
    select: { id: true, projectId: true, assigneeId: true, creatorId: true },
  })
  if (!task) throw new Error('Task not found')

  // OWNER and MEMBER have full access
  if (role === 'OWNER' || role === 'TEAM') return task

  // CLIENT: must be assigned OR have project membership
  if (task.assigneeId === userId) return task

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: task.projectId } },
  })
  if (!membership) throw new Error('Access denied to this task')

  return task
}
