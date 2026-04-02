import { prisma } from '@/lib/prisma'

export async function createNotification(
  userId: string,
  data: { type: string; title: string; body?: string; linkUrl?: string },
) {
  return prisma.notification.create({
    data: { ...data, userId },
  })
}

export async function getNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly && { read: false }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, read: false },
  })
}

export async function markAsRead(id: string, userId: string) {
  return prisma.notification.update({
    where: { id, userId },
    data: { read: true },
  })
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
}
