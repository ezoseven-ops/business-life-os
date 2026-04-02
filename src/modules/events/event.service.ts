import { prisma } from '@/lib/prisma'
import type { CreateEventInput, UpdateEventInput } from './event.types'

export async function createEvent(
  input: CreateEventInput,
  workspaceId: string,
  creatorId: string,
) {
  return prisma.event.create({
    data: {
      ...input,
      workspaceId,
      creatorId,
    },
  })
}

export async function updateEvent(id: string, input: UpdateEventInput) {
  return prisma.event.update({
    where: { id },
    data: input,
  })
}

export async function deleteEvent(id: string) {
  return prisma.event.delete({ where: { id } })
}

export async function getUpcomingEvents(workspaceId: string, limit = 50) {
  const now = new Date()
  return prisma.event.findMany({
    where: {
      workspaceId,
      startAt: { gte: now },
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: limit,
  })
}

export async function getAllEvents(workspaceId: string, limit = 100) {
  return prisma.event.findMany({
    where: { workspaceId },
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: limit,
  })
}

export async function getEventById(id: string, workspaceId?: string) {
  return prisma.event.findFirst({
    where: { id, ...(workspaceId && { workspaceId }) },
    include: {
      creator: { select: { id: true, name: true } },
    },
  })
}
