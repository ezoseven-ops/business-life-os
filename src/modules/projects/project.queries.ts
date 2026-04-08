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
            assigneePerson: { select: { id: true, name: true, email: true } },
        },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          author: { select: { id: true, name: true } },
        },
      },
      projectMembers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              linkedPerson: { select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      projectPeople: {
        include: {
          person: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { startAt: { gte: new Date() } },
        orderBy: { startAt: 'asc' },
        take: 10,
        select: { id: true, title: true, startAt: true, endAt: true, allDay: true, location: true },
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
