import { prisma } from '@/lib/prisma'
import type { CreatePersonInput, UpdatePersonInput } from './people.types'

export async function createPerson(input: CreatePersonInput, workspaceId: string) {
  return prisma.person.create({
    data: { ...input, email: input.email || null, workspaceId },
  })
}

export async function updatePerson(id: string, input: UpdatePersonInput) {
  return prisma.person.update({
    where: { id },
    data: { ...input, email: input.email || null },
  })
}

export async function deletePerson(id: string) {
  return prisma.person.delete({ where: { id } })
}

export async function getPeople(workspaceId: string) {
  return prisma.person.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, content: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getPersonById(id: string, workspaceId?: string) {
  return prisma.person.findFirst({
    where: { id, ...(workspaceId && { workspaceId }) },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })
}

/**
 * Get a person's work context: assigned tasks, related projects, recent activity.
 * Used by the person detail page to show what this person is working on.
 */
export async function getPersonWorkContext(personId: string, workspaceId: string) {
  const person = await prisma.person.findFirst({
    where: { id: personId, workspaceId },
    select: { userId: true },
  })

  if (!person?.userId) {
    return { tasks: [], projects: [], activity: [] }
  }

  const [tasks, projectMemberships, activity] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: person.userId,
        project: { workspaceId },
        status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.projectMember.findMany({
      where: { userId: person.userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            _count: { select: { tasks: true } },
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: { userId: person.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    tasks,
    projects: projectMemberships.map((m) => ({
      ...m.project,
      role: m.role,
    })),
    activity,
  }
}

export async function findPersonByTelegramId(telegramId: string, workspaceId: string) {
  return prisma.person.findFirst({
    where: { telegramId, workspaceId },
  })
}
