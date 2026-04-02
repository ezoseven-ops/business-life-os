'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireOwner, requireWorkspace } from '@/lib/action-utils'
import * as workspaceService from './workspace.service'

export async function getWorkspaceAction() {
  return safeAction(async () => {
    const session = await requireWorkspace()
    return workspaceService.getWorkspace(session.workspaceId)
  })
}

export async function updateWorkspaceAction(data: { name: string }) {
  return safeAction(async () => {
    const session = await requireOwner()
    const result = await workspaceService.updateWorkspace(
      session.user.workspaceId!,
      data,
    )
    revalidatePath('/settings')
    return result
  })
}
