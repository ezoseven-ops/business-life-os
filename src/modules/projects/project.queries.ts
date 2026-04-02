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
        take: 20,
      },
      _count: { select: { tasks: true, notes: true } },
    },
  })
}
