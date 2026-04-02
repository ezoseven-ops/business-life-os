import { prisma } from '@/lib/prisma'
import type { CreateProjectInput, UpdateProjectInput } from './project.types'

export async function createProject(
  input: CreateProjectInput,
  workspaceId: string,
  ownerId: string,
) {
  return prisma.project.create({
    data: {
      ...input,
      workspaceId,
      ownerId,
    },
  })
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  workspaceId: string,
) {
  return prisma.project.update({
    where: { id, workspaceId },
    data: input,
  })
}

export async function deleteProject(id: string, workspaceId: string) {
  return prisma.project.delete({
    where: { id, workspaceId },
  })
}
