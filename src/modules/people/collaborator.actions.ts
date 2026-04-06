'use server'

import { requireRole } from '@/lib/action-utils'
import { prisma } from '@/lib/prisma'
import {
  getCollaboratorProfile,
  updateCollaboratorProfile,
  parseCollaboratorFromText,
  suggestAssignee,
} from './collaborator.service'
import {
  updateCollaboratorSchema,
  type CollaboratorProfile,
  type CapturedCollaborator,
  type AssigneeSuggestion,
} from './collaborator.types'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────
// Collaborator Intelligence Actions
//
// Server actions for managing collaborator profiles
// and getting AI-powered assignee suggestions.
// ─────────────────────────────────────────────

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Get a collaborator's profile.
 */
export async function getCollaboratorProfileAction(
  personId: string,
): Promise<ActionResult<CollaboratorProfile>> {
  try {
    await requireRole('OWNER', 'TEAM')
    const profile = await getCollaboratorProfile(personId)
    return { success: true, data: profile }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get profile',
    }
  }
}

/**
 * Update a collaborator's profile with explicit fields.
 */
export async function updateCollaboratorProfileAction(
  input: unknown,
): Promise<ActionResult<CollaboratorProfile>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = updateCollaboratorSchema.parse(input)
    const profile = await updateCollaboratorProfile(validated, session.user.workspaceId!)

    revalidatePath('/people')

    return { success: true, data: profile }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile',
    }
  }
}

/**
 * Parse a collaborator profile from natural language (voice capture).
 * e.g., "add Tomek — backend dev, good with APIs, reliable"
 * → Creates or updates person with structured profile
 */
export async function captureCollaboratorAction(
  text: string,
): Promise<ActionResult<{ personId: string; profile: CapturedCollaborator }>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const workspaceId = session.user.workspaceId!

    // Parse the text into a structured profile
    const captured = await parseCollaboratorFromText(text)

    // Find or create the person
    let person = await prisma.person.findFirst({
      where: {
        workspaceId,
        name: {
          contains: captured.name,
          mode: 'insensitive',
        },
      },
    })

    if (!person) {
      // Create new person
      person = await prisma.person.create({
        data: {
          name: captured.name,
          workspaceId,
        },
      })
    }

    // Update their collaborator profile
    await updateCollaboratorProfile(
      {
        personId: person.id,
        role: captured.role,
        skills: captured.skills,
        strengths: captured.strengths,
        availability: captured.availability,
      },
      workspaceId,
    )

    revalidatePath('/people')

    return {
      success: true,
      data: {
        personId: person.id,
        profile: captured,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture collaborator profile',
    }
  }
}

/**
 * Get AI-powered assignee suggestions for a task.
 */
export async function suggestAssigneeAction(
  taskContext: {
    title: string
    description?: string | null
    projectId?: string
  },
): Promise<ActionResult<AssigneeSuggestion[]>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const suggestions = await suggestAssignee(taskContext, session.user.workspaceId!)
    return { success: true, data: suggestions }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to suggest assignee',
    }
  }
}
