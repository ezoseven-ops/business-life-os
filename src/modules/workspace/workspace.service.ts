import { prisma } from '@/lib/prisma'

export async function getWorkspace(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, projects: true } },
    },
  })
}

export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string },
) {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data,
  })
}
