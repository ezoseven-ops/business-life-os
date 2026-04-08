import { prisma } from '@/lib/prisma'
import type { ProjectMemberRole } from '@prisma/client'

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
  workspaceId: string,
) {
  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  })
  if (!project) throw new Error('Project not found in workspace')

  // Verify user belongs to workspace
  const user = await prisma.user.findFirst({
    where: { id: userId, workspaceId },
    select: { id: true },
  })
  if (!user) throw new Error('User not found in workspace')

  // Upsert to prevent duplicate constraint errors
  return prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: { role },
    create: { userId, projectId, role },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  workspaceId: string,
) {
  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  })
  if (!project) throw new Error('Project not found in workspace')

  return prisma.projectMember.delete({
    where: { userId_projectId: { userId, projectId } },
  })
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
  workspaceId: string,
) {
  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  })
  if (!project) throw new Error('Project not found in workspace')

  return prisma.projectMember.update({
    where: { userId_projectId: { userId, projectId } },
    data: { role },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

/**
 * Get workspace members who are NOT yet members of the given project.
 * Used to populate the "Add member" dropdown.
 */
export async function getAvailableMembers(
  projectId: string,
  workspaceId: string,
) {
  const existingMemberIds = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  })

  const excludeIds = existingMemberIds.map((m) => m.userId)

  return prisma.user.findMany({
    where: {
      workspaceId,
      id: { notIn: excludeIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
}
