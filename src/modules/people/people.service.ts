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
    },
    orderBy: { name: 'asc' },
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

export async function findPersonByTelegramId(telegramId: string, workspaceId: string) {
  return prisma.person.findFirst({
    where: { telegramId, workspaceId },
  })
}
