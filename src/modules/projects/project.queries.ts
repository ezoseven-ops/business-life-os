import { prisma } from '@/lib/prisma'
import type { ProjectStatus } from '@prisma/client'

export async function getProjects(
  workspaceId: string,
  status?: ProjectStatus,
) {
  return prisma.project.findMany({
    where: {
      workspaceId,
      ...(status && { status }),
    },
    include: {
      _count: {
        select: {
          tasks: true,
          notes: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getProjectById(id: string, workspaceId: string) {
  return prisma.project.findFirst({
    where: { id, workspaceId },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          author: { select: { id: true, name: true } },
        },
      },
      _count: { select: { tasks: true, notes: true } },
    },
  })
}

/**
 * Fetch recent activity for a specific project.
 * Activity records store projectId in metadata (from capture pipeline)
 * or reference the project entity directly.
 */
export async function getProjectActivity(projectId: string, limit = 20) {
  // Activities related to this project are either:
  // 1. entityType=PROJECT, entityId=projectId (project-level events)
  // 2. metadata contains projectId (task/note creation within project)
  // Prisma JSON filtering: metadata path ['projectId'] equals projectId
  return prisma.activity.findMany({
    where: {
      OR: [
        { entityType: 'PROJECT', entityId: projectId },
        { metadata: { path: ['projectId'], equals: projectId } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
