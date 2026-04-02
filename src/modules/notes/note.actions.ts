'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import * as noteService from './note.service'
import { logActivity } from '@/modules/activity/activity.service'
import { createNoteSchema, updateNoteSchema } from './note.types'

export async function getNotesAction(projectId?: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    return noteService.getNotes(session.workspaceId, projectId)
  })
}

export async function getNoteAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    return noteService.getNoteById(id, session.workspaceId)
  })
}

export async function createNoteAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = createNoteSchema.parse(input)
    const note = await noteService.createNote(
      validated,
      session.workspaceId,
      session.user.id,
    )
    await logActivity('CREATED', 'NOTE', note.id, session.user.id)
    revalidatePath('/notes')
    return note
  })
}

export async function updateNoteAction(id: string, input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = updateNoteSchema.parse(input)
    const note = await noteService.updateNote(id, validated)
    await logActivity('UPDATED', 'NOTE', id, session.user.id)
    revalidatePath('/notes')
    return note
  })
}

export async function deleteNoteAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    await noteService.deleteNote(id)
    await logActivity('DELETED', 'NOTE', id, session.user.id)
    revalidatePath('/notes')
  })
}
