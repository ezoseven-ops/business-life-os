'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace, requireRole } from '@/lib/action-utils'
import { createComment, deleteComment, createCommentSchema } from './comment.service'
import { logActivity } from '@/modules/activity/activity.service'
import { createNotification } from '@/modules/notifications/notification.service'
import { getTaskById } from '@/modules/tasks/task.queries'

export async function addCommentAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM', 'CLIENT')
    const validated = createCommentSchema.parse(input)

    // CLIENT users can only comment on tasks they're assigned to
    if (session.user.role === 'CLIENT' && validated.taskId) {
      const task = await getTaskById(validated.taskId, session.workspaceId)
      if (!task || task.assigneeId !== session.user.id) {
        throw new Error('Access denied: you can only comment on tasks assigned to you')
      }
    }

    // CLIENT users cannot comment on notes
    if (session.user.role === 'CLIENT' && validated.noteId) {
      throw new Error('Access denied: clients cannot comment on notes')
    }
    const comment = await createComment(validated, session.user.id)

    if (validated.taskId) {
      await logActivity('COMMENTED', 'TASK', validated.taskId, session.user.id)

      // Notify the task assignee or creator (not the commenter themselves)
      const task = await getTaskById(validated.taskId, session.workspaceId)
      if (task) {
        const recipientId = task.assigneeId && task.assigneeId !== session.user.id
          ? task.assigneeId
          : task.creatorId !== session.user.id
            ? task.creatorId
            : null
        if (recipientId) {
          await createNotification(recipientId, {
            type: 'COMMENT_ADDED',
            title: 'New comment on your task',
            body: `Comment added on "${task.title}"`,
            linkUrl: `/tasks/${validated.taskId}`,
          })
        }
      }

      revalidatePath(`/tasks`)
      revalidatePath(`/tasks/${validated.taskId}`)
    }
    if (validated.noteId) {
      await logActivity('COMMENTED', 'NOTE', validated.noteId, session.user.id)
      revalidatePath(`/notes`)
    }
    revalidatePath('/')
    return comment
  })
}

export async function deleteCommentAction(id: string) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM', 'CLIENT')
    await deleteComment(id, session.user.id)
    revalidatePath('/tasks')
    revalidatePath('/')
  })
}
