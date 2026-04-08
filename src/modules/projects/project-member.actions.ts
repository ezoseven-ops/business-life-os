'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireRole } from '@/lib/action-utils'
import * as memberService from './project-member.service'
import { logActivity } from '@/modules/activity/activity.service'
import type { ProjectMemberRole } from '@prisma/client'

const VALID_ROLES: ProjectMemberRole[] = ['LEAD', 'CONTRIBUTOR', 'VIEWER']

export async function addProjectMemberAction(projectId: string, userId: string, role: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    if (!VALID_ROLES.includes(role as ProjectMemberRole)) {
      throw new Error('Invalid role. Must be LEAD, CONTRIBUTOR, or VIEWER')
    }

    const member = await memberService.addProjectMember(
      projectId,
      userId,
      role as ProjectMemberRole,
      session.workspaceId,
    )

    await logActivity('ASSIGNED', 'PROJECT', projectId, session.user.id, {
      projectId,
      memberId: userId,
      memberName: member.user.name,
      role,
    })

    revalidatePath(`/projects/${projectId}`)
    return member
  })
}

export async function removeProjectMemberAction(projectId: string, userId: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    await memberService.removeProjectMember(projectId, userId, session.workspaceId)

    await logActivity('DELETED', 'PROJECT', projectId, session.user.id, {
      projectId,
      removedUserId: userId,
      type: 'member_removed',
    })

    revalidatePath(`/projects/${projectId}`)
  })
}

export async function updateProjectMemberRoleAction(
  projectId: string,
  userId: string,
  role: string,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    if (!VALID_ROLES.includes(role as ProjectMemberRole)) {
      throw new Error('Invalid role. Must be LEAD, CONTRIBUTOR, or VIEWER')
    }

    const member = await memberService.updateProjectMemberRole(
      projectId,
      userId,
      role as ProjectMemberRole,
      session.workspaceId,
    )

    await logActivity('UPDATED', 'PROJECT', projectId, session.user.id, {
      projectId,
      memberId: userId,
      memberName: member.user.name,
      newRole: role,
      type: 'role_change',
    })

    revalidatePath(`/projects/${projectId}`)
    return member
  })
}

export async function getAvailableMembersAction(projectId: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    return memberService.getAvailableMembers(projectId, session.workspaceId)
  })
}
