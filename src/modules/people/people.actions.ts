'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import * as peopleService from './people.service'
import { logActivity } from '@/modules/activity/activity.service'
import { createPersonSchema, updatePersonSchema } from './people.types'

export async function getPeopleAction() {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    return peopleService.getPeople(session.workspaceId)
  })
}

export async function createPersonAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = createPersonSchema.parse(input)
    const person = await peopleService.createPerson(validated, session.workspaceId)
    await logActivity('CREATED', 'PERSON', person.id, session.user.id)
    revalidatePath('/people')
    return person
  })
}

export async function updatePersonAction(id: string, input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = updatePersonSchema.parse(input)

    // Verify person belongs to this workspace before updating
    const existing = await peopleService.getPersonById(id, session.workspaceId)
    if (!existing) throw new Error('Person not found')

    const person = await peopleService.updatePerson(id, validated)
    await logActivity('UPDATED', 'PERSON', id, session.user.id)
    revalidatePath('/people')
    return person
  })
}

export async function deletePersonAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Verify person belongs to this workspace before deleting
    const existing = await peopleService.getPersonById(id, session.workspaceId)
    if (!existing) throw new Error('Person not found')

    await peopleService.deletePerson(id)
    await logActivity('DELETED', 'PERSON', id, session.user.id)
    revalidatePath('/people')
  })
}
