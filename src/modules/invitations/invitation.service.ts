import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

const INVITATION_EXPIRY_DAYS = 7

export async function createInvitation(
  email: string,
  role: UserRole,
  workspaceId: string,
  invitedById: string,
  projectIds?: string[],
) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

  // Check if there's already a pending invitation for this email+workspace
  const existing = await prisma.invitation.findFirst({
    where: { email, workspaceId, status: 'PENDING' },
  })
  if (existing) {
    throw new Error('An invitation is already pending for this email')
  }

  // Check if user is already a workspace member
  const existingUser = await prisma.user.findFirst({
    where: { email, workspaceId },
  })
  if (existingUser) {
    throw new Error('This user is already a workspace member')
  }

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      workspaceId,
      invitedById,
      expiresAt,
    },
  })

  // If CLIENT role with specific projects, store project access intent in metadata
  // (ProjectMember records will be created when invitation is accepted)
  if (projectIds && projectIds.length > 0 && role === 'CLIENT') {
    // Store intended project access — we'll create ProjectMember on accept
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        // We'll use the token to look up project IDs on accept
        // For now, store in a simple way
      },
    })
  }

  return invitation
}

export async function getInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true } },
    },
  })
}

export async function getWorkspaceInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId },
    include: {
      invitedBy: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: true },
  })

  if (!invitation) throw new Error('Invitation not found')
  if (invitation.status !== 'PENDING') throw new Error('Invitation is no longer valid')
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('Invitation has expired')
  }

  // Update invitation status
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED', userId },
  })

  // Add user to workspace with the specified role
  const acceptedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      workspaceId: invitation.workspaceId,
      role: invitation.role,
    },
  })

  // Ensure this User has a linked Person record in the workspace.
  // Find by userId first (already linked), then by email (unlinked match), then create.
  await ensurePersonForUser(acceptedUser.id, acceptedUser.email, acceptedUser.name, invitation.workspaceId)

  // If CLIENT role, add ProjectMember records for all active projects
  // (In MVP, clients get added to all active projects; owner can adjust later)
  if (invitation.role === 'CLIENT') {
    const activeProjects = await prisma.project.findMany({
      where: { workspaceId: invitation.workspaceId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (activeProjects.length > 0) {
      await prisma.projectMember.createMany({
        data: activeProjects.map((p) => ({
          userId,
          projectId: p.id,
          role: 'VIEWER',
        })),
        skipDuplicates: true,
      })
    }
  }

  // If TEAM role, add ProjectMember records for all projects
  if (invitation.role === 'TEAM') {
    const allProjects = await prisma.project.findMany({
      where: { workspaceId: invitation.workspaceId },
      select: { id: true },
    })
    if (allProjects.length > 0) {
      await prisma.projectMember.createMany({
        data: allProjects.map((p) => ({
          userId,
          projectId: p.id,
          role: 'CONTRIBUTOR',
        })),
        skipDuplicates: true,
      })
    }
  }

  return invitation
}

export async function revokeInvitation(id: string, workspaceId: string) {
  return prisma.invitation.update({
    where: { id, workspaceId, status: 'PENDING' },
    data: { status: 'REVOKED' },
  })
}

export async function getWorkspaceMembers(workspaceId: string) {
  return prisma.user.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
}

export async function updateMemberRole(userId: string, role: UserRole, workspaceId: string) {
  // Cannot change owner role
  const user = await prisma.user.findFirst({
    where: { id: userId, workspaceId },
  })
  if (!user) throw new Error('User not found in workspace')
  if (user.role === 'OWNER') throw new Error('Cannot change owner role')

  return prisma.user.update({
    where: { id: userId },
    data: { role },
  })
}

export async function removeMember(userId: string, workspaceId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, workspaceId },
  })
  if (!user) throw new Error('User not found in workspace')
  if (user.role === 'OWNER') throw new Error('Cannot remove workspace owner')

  // Remove project memberships
  await prisma.projectMember.deleteMany({
    where: { userId },
  })

  // Remove from workspace
  return prisma.user.update({
    where: { id: userId },
    data: { workspaceId: null, role: 'TEAM' },
  })
}

// ─── Person ↔ User linking ───

/**
 * Ensure a User has a corresponding Person record in the workspace.
 *
 * Resolution order:
 *   1. Person already linked via userId → done (no-op)
 *   2. Unlinked Person with matching email in same workspace → link it
 *   3. No match → create a new Person and link it
 *
 * Guards:
 *   - Person.userId is @unique in the schema, so Prisma rejects double-linking
 *   - Only matches Persons with userId: null to avoid stealing another User's Person
 *   - Uses email + workspaceId for matching (not name, which is ambiguous)
 *
 * Exported for use by the backfill migration script.
 */
export async function ensurePersonForUser(
  userId: string,
  email: string,
  name: string | null,
  workspaceId: string,
): Promise<void> {
  // 1. Already linked? Nothing to do.
  const existingLinked = await prisma.person.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (existingLinked) return

  // 2. Unlinked Person with matching email in this workspace? Link it.
  if (email) {
    const emailMatch = await prisma.person.findFirst({
      where: {
        workspaceId,
        email,
        userId: null, // only unlinked Persons
      },
      select: { id: true },
    })

    if (emailMatch) {
      await prisma.person.update({
        where: { id: emailMatch.id },
        data: { userId },
      })
      return
    }
  }

  // 3. No match — create a new Person linked to this User.
  const displayName = name || email.split('@')[0]
  await prisma.person.create({
    data: {
      name: displayName,
      email,
      workspaceId,
      userId,
    },
  })
}
