'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import * as projectService from './project.service'
import * as projectQueries from './project.queries'
import { logActivity } from '@/modules/activity/activity.service'
import { createProjectSchema, updateProjectSchema } from './project.types'

export async function getProjectsAction() {
  return safeAction(async () => {
    const session = await requireWorkspace()
    return projectQueries.getProjects(session.workspaceId)
  })
}

export async function getProjectAction(id: string) {
  return safeAction(async () => {
    const session = await requireWorkspace()
    return projectQueries.getProjectById(id, session.workspaceId)
  })
}

export async function createProjectAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = createProjectSchema.parse(input)
    const project = await projectService.createProject(
      validated,
      session.workspaceId,
      session.user.id,
    )
    await logActivity('CREATED', 'PROJECT', project.id, session.user.id)
    revalidatePath('/projects')
    return project
  })
}

export async function updateProjectAction(id: string, input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = updateProjectSchema.parse(input)
    const project = await projectService.updateProject(id, validated, session.workspaceId)
    await logActivity('UPDATED', 'PROJECT', project.id, session.user.id)
    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    return project
  })
}

export async function deleteProjectAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER')
    await projectService.deleteProject(id, session.workspaceId)
    await logActivity('DELETED', 'PROJECT', id, session.user.id)
    revalidatePath('/projects')
  })
}
