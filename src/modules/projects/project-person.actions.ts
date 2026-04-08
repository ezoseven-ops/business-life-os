'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireRole } from '@/lib/action-utils'
import * as personService from './project-person.service'
import { logActivity } from '@/modules/activity/activity.service'

export async function addProjectPersonAction(
  projectId: string,
  personId: string,
  role: string | null,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    const result = await personService.addProjectPerson(
      projectId,
      personId,
      role,
      session.workspaceId,
    )

    await logActivity('ASSIGNED', 'PROJECT', projectId, session.user.id, {
      projectId,
      personId,
      personName: result.person.name,
      role,
      type: 'person_added',
    })

    revalidatePath(`/projects/${projectId}`)

    return { personName: result.person.name }
  })
}

export async function removeProjectPersonAction(
  projectId: string,
  personId: string,
  personName: string,
) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    await personService.removeProjectPerson(projectId, personId, session.workspaceId)

    await logActivity('DELETED', 'PROJECT', projectId, session.user.id, {
      projectId,
      personId,
      personName,
      type: 'person_removed',
    })

    revalidatePath(`/projects/${projectId}`)

    return { personName }
  })
}
