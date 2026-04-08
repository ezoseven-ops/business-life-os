import { prisma } from '@/lib/prisma'
import type { TaskStatus } from '@prisma/client'

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  assigneePerson: { select: { id: true, name: true, email: true, company: true } },
  creator: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  _count: { select: { comments: true, files: true } },
} as const

export async function getTasksByProject(projectId: string, workspaceId: string) {
  return prisma.task.findMany({
    where: { projectId, project: { workspaceId } },
    include: taskInclude,
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })
}

export async function getTasksByWorkspace(
  workspaceId: string,
  options?: { status?: TaskStatus; assigneeId?: string; limit?: number },
) {
  return prisma.task.findMany({
    where: {
      project: { workspaceId },
      ...(options?.status && { status: options.status }),
      ...(options?.assigneeId && { assigneeId: options.assigneeId }),
    },
    include: taskInclude,
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: options?.limit || 100,
  })
}

export async function getTodaysTasks(workspaceId: string, userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return prisma.task.findMany({
    where: {
      project: { workspaceId },
      OR: [
        { assigneeId: userId, status: { not: 'DONE' } },
        { dueDate: { gte: today, lt: tomorrow } },
      ],
    },
    include: taskInclude,
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    take: 50,
  })
}

/**
 * Get tasks visible to a CLIENT user — assigned tasks or tasks in their projects.
 */
export async function getClientTasks(
  workspaceId: string,
  userId: string,
  options?: { excludeDone?: boolean; limit?: number },
) {
  return prisma.task.findMany({
    where: {
      project: { workspaceId },
      OR: [
        { assigneeId: userId },
        {
          project: {
            projectMembers: {
              some: { userId },
            },
          },
        },
      ],
      ...(options?.excludeDone && { status: { not: 'DONE' } }),
    },
    include: {
      ...taskInclude,
      _count: { select: { comments: true } },
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: options?.limit || 100,
  })
}

/**
 * Get tasks assigned to a specific user with a specific status.
 */
export async function getTasksByAssigneeAndStatus(
  workspaceId: string,
  assigneeId: string,
  status: TaskStatus,
) {
  return prisma.task.findMany({
    where: {
      assigneeId,
      project: { workspaceId },
      status,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'asc' },
  })
}

export async function getTaskById(id: string, workspaceId?: string) {
  return prisma.task.findFirst({
    where: { id, ...(workspaceId && { project: { workspaceId } }) },
    include: {
      ...taskInclude,
      sourceMessage: {
        select: {
          id: true,
          content: true,
          channel: true,
          createdAt: true,
          person: { select: { id: true, name: true } },
        },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      files: true,
    },
  })
}
