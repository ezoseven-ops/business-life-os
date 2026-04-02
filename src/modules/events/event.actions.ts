'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import * as eventService from './event.service'
import { logActivity } from '@/modules/activity/activity.service'
import { createEventSchema, updateEventSchema } from './event.types'

export async function createEventAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = createEventSchema.parse(input)
    const event = await eventService.createEvent(
      validated,
      session.workspaceId,
      session.user.id,
    )
    await logActivity('CREATED', 'EVENT', event.id, session.user.id)
    revalidatePath('/calendar')
    return event
  })
}

export async function updateEventAction(id: string, input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = updateEventSchema.parse(input)

    // Verify event belongs to this workspace before updating
    const existing = await eventService.getEventById(id, session.workspaceId)
    if (!existing) throw new Error('Event not found')

    const event = await eventService.updateEvent(id, validated)
    await logActivity('UPDATED', 'EVENT', id, session.user.id)
    revalidatePath('/calendar')
    revalidatePath(`/calendar/${id}`)
    return event
  })
}

export async function deleteEventAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    // Verify event belongs to this workspace before deleting
    const existing = await eventService.getEventById(id, session.workspaceId)
    if (!existing) throw new Error('Event not found')

    await eventService.deleteEvent(id)
    await logActivity('DELETED', 'EVENT', id, session.user.id)
    revalidatePath('/calendar')
  })
}
