import { prisma } from '@/lib/prisma'
import type { CreateTaskInput, UpdateTaskInput } from './task.types'

export async function createTask(input: CreateTaskInput, creatorId: string) {
  return prisma.task.create({
    data: {
      ...input,
      creatorId,
      lastActivityAt: new Date(),
    },
  })
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  return prisma.task.update({
    where: { id },
    data: {
      ...input,
      lastActivityAt: new Date(),
    },
  })
}

/**
 * Touch lastActivityAt without changing any other fields.
 * Use when external events affect a task (e.g., comment added).
 */
export async function touchTaskActivity(taskId: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { lastActivityAt: new Date() },
  })
}

export async function deleteTask(id: string) {
  return prisma.task.delete({
    where: { id },
  })
}
