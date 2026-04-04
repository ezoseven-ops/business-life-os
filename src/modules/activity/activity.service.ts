import { prisma } from '@/lib/prisma'
import type { ActivityAction, EntityType, Prisma } from '@prisma/client'

export async function logActivity(
  action: ActivityAction,
  entityType: EntityType,
  entityId: string,
  userId: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.activity.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function getRecentActivity(workspaceId: string, limit = 20) {
  return prisma.activity.findMany({
    where: {
      user: { workspaceId },
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
