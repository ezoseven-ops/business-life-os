'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import * as taskService from './task.service'
import * as taskQueries from './task.queries'
import { logActivity } from '@/modules/activity/activity.service'
import { createNotification } from '@/modules/notifications/notification.service'
import { createTaskSchema, updateTaskSchema } from './task.types'
import type { TaskStatus } from '@prisma/client'

export async function getTasksAction(projectId?: string) {
  return safeAction(async () => {
    const session = await requireWorkspace()
    if (projectId) {
      return taskQueries.getTasksByProject(projectId, session.workspaceId)
    }
    return taskQueries.getTasksByWorkspace(session.workspaceId)
  })
}

export async function getTodaysTasksAction() {
  return safeAction(async () => {
    const session = await requireWorkspace()
    return taskQueries.getTodaysTasks(session.workspaceId, session.user.id)
  })
}

export async function createTaskAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = createTaskSchema.parse(input)
    const task = await taskService.createTask(validated, session.user.id)
    await logActivity('CREATED', 'TASK', task.id, session.user.id)
    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath(`/projects/${validated.projectId}`)
    return task
  })
}

export async function updateTaskAction(id: string, input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM', 'CLIENT')
    const validated = updateTaskSchema.parse(input)

    const oldTask = await taskQueries.getTaskById(id, session.workspaceId)
    if (!oldTask) throw new Error('Task not found')

    // CLIENT can only change status on tasks assigned to them
    if (session.user.role === 'CLIENT') {
      if (oldTask.assigneeId !== session.user.id) {
        throw new Error('Access denied: you can only update tasks assigned to you')
      }
      // Only allow status changes — strip everything else
      const statusOnly = { status: validated.status }
      if (!statusOnly.status) {
        throw new Error('Access denied: clients can only change task status')
      }
      const task = await taskService.updateTask(id, statusOnly)
      await logActivity('STATUS_CHANGED', 'TASK', id, session.user.id, {
        from: oldTask.status,
        to: statusOnly.status,
      })
      revalidatePath('/tasks')
      revalidatePath('/')
      revalidatePath(`/projects/${task.projectId}`)
      return task
    }

    const task = await taskService.updateTask(id, validated)

    if (validated.status && validated.status !== oldTask.status) {
      await logActivity('STATUS_CHANGED', 'TASK', id, session.user.id, {
        from: oldTask.status,
        to: validated.status,
      })
    } else if (validated.assigneeId !== undefined) {
      await logActivity('ASSIGNED', 'TASK', id, session.user.id, {
        assigneeId: validated.assigneeId,
      })
      if (validated.assigneeId) {
        await createNotification(validated.assigneeId, {
          type: 'TASK_ASSIGNED',
          title: 'Task assigned to you',
          body: `"${oldTask.title}" was assigned to you`,
          linkUrl: `/tasks/${id}`,
        })
      }
    } else {
      await logActivity('UPDATED', 'TASK', id, session.user.id)
    }

    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath(`/projects/${task.projectId}`)
    return task
  })
}

export async function quickStatusAction(id: string, status: TaskStatus) {
  return safeAction(async () => {
    const session = await requireWorkspace()

    // Verify task belongs to this workspace before updating
    const existing = await taskQueries.getTaskById(id, session.workspaceId)
    if (!existing) throw new Error('Task not found')

    const task = await taskService.updateTask(id, { status })
    await logActivity('STATUS_CHANGED', 'TASK', id, session.user.id, {
      from: existing.status,
      to: status,
    })
    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath(`/projects/${task.projectId}`)
    return task
  })
}

export async function deleteTaskAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const task = await taskQueries.getTaskById(id, session.workspaceId)
    if (!task) throw new Error('Task not found')
    await taskService.deleteTask(id)
    await logActivity('DELETED', 'TASK', id, session.user.id)
    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath(`/projects/${task.projectId}`)
  })
}
