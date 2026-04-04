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
  const event = await prisma.event.findFirst({
    where: { id, ...(workspaceId && { workspaceId }) },
    include: {
      creator: { select: { id: true, name: true } },
      attendees: true,
    },
  })

  if (!event) return null

  // Fetch project separately if projectId exists (until prisma generate runs with new schema)
  let project: { id: string; name: string } | null = null
  if ((event as any).projectId) {
    project = await prisma.project.findUnique({
      where: { id: (event as any).projectId },
      select: { id: true, name: true },
    })
  }

  return { ...event, project }
}

export async function getEventsByProject(projectId: string, workspaceId: string, limit = 50) {
  // PRISMA_SCHEMA_FIELD: projectId — requires `prisma generate` after schema update
  return (prisma.event as any).findMany({
    where: {
      projectId,
      workspaceId,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startAt: 'asc' },
    take: limit,
  })
}
