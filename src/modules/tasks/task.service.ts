import { prisma } from '@/lib/prisma'
import type { CreateTaskInput, UpdateTaskInput } from './task.types'

export async function createTask(input: CreateTaskInput, creatorId: string) {
  return prisma.task.create({
    data: {
      ...input,
      creatorId,
    },
  })
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  return prisma.task.update({
    where: { id },
    data: input,
  })
}

export async function deleteTask(id: string) {
  return prisma.task.delete({
    where: { id },
  })
}
