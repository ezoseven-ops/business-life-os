'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireRole } from '@/lib/action-utils'
import * as invitationService from './invitation.service'
import { createInvitationSchema } from './invitation.types'
import { logActivity } from '@/modules/activity/activity.service'
import { createNotification } from '@/modules/notifications/notification.service'
import type { UserRole } from '@prisma/client'

export async function inviteUserAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    const validated = createInvitationSchema.parse(input)

    const invitation = await invitationService.createInvitation(
      validated.email,
      validated.role as UserRole,
      session.workspaceId,
      session.user.id,
      validated.projectIds,
    )

    await logActivity('CREATED', 'PERSON', invitation.id, session.user.id, {
      type: 'invitation',
      email: validated.email,
      role: validated.role,
    })

    revalidatePath('/settings')
    return invitation
  })
}

export async function getInvitationsAction() {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    return invitationService.getWorkspaceInvitations(session.workspaceId)
  })
}

export async function revokeInvitationAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    await invitationService.revokeInvitation(id, session.workspaceId)
    revalidatePath('/settings')
  })
}

export async function getTeamMembersAction() {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    return invitationService.getWorkspaceMembers(session.workspaceId)
  })
}

export async function updateMemberRoleAction(userId: string, role: UserRole) {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    const user = await invitationService.updateMemberRole(userId, role, session.workspaceId)

    await logActivity('UPDATED', 'PERSON', userId, session.user.id, {
      type: 'role_change',
      newRole: role,
    })

    revalidatePath('/settings')
    return user
  })
}

export async function removeMemberAction(userId: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    await invitationService.removeMember(userId, session.workspaceId)

    await logActivity('DELETED', 'PERSON', userId, session.user.id, {
      type: 'member_removed',
    })

    revalidatePath('/settings')
  })
}

/**
 * Accept an invitation — called from the /invite/[token] page.
 * This action only requires authentication (not workspace membership).
 */
export async function acceptInvitationAction(token: string) {
  return safeAction(async () => {
    const { auth } = await import('@/lib/auth')
    const session = await auth()
    if (!session?.user?.id) throw new Error('Please sign in first')

    // If user already has a workspace, they can't join another (MVP limitation)
    if (session.user.workspaceId) {
      throw new Error('You are already a member of a workspace. Multi-workspace is not supported yet.')
    }

    const invitation = await invitationService.acceptInvitation(token, session.user.id)

    await createNotification(invitation.invitedById, {
      type: 'INVITATION_ACCEPTED',
      title: 'Invitation accepted',
      body: `${session.user.email} has joined your workspace`,
      linkUrl: '/settings',
    })

    return { workspaceId: invitation.workspaceId, role: invitation.role }
  })
}
