'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireRole } from '@/lib/action-utils'
import * as commsService from './comms.service'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/modules/activity/activity.service'
import { createNotification } from '@/modules/notifications/notification.service'
import { createTaskSchema } from '@/modules/tasks/task.types'
import { sendMessageSchema } from './comms.types'

/** Convert a message into a task */
export async function messageToTaskAction(input: {
  messageId: string
  projectId: string
  title: string
  description?: string
}) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')

    const message = await commsService.getMessageById(input.messageId)
    if (!message) throw new Error('Message not found')

    const validated = createTaskSchema.parse({
      title: input.title,
      description: input.description || message.content || '',
      projectId: input.projectId,
      priority: 'MEDIUM',
    })

    const task = await prisma.task.create({
      data: {
        ...validated,
        creatorId: session.user.id,
        sourceMessageId: input.messageId,
      },
    })

    await logActivity('CREATED', 'TASK', task.id, session.user.id, {
      source: 'message',
      messageId: input.messageId,
    })

    await createNotification(session.user.id, {
      type: 'TASK_FROM_MESSAGE',
      title: 'Task created from message',
      body: `"${task.title}" created from conversation`,
      linkUrl: `/tasks`,
    })

    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath(`/projects/${validated.projectId}`)
    revalidatePath('/inbox')
    return task
  })
}

/** Send a reply message to a person */
export async function sendReplyAction(input: unknown) {
  return safeAction(async () => {
    const session = await requireRole('OWNER', 'TEAM')
    const validated = sendMessageSchema.parse(input)
    const message = await commsService.sendMessage(validated, session.workspaceId)
    await logActivity('CREATED', 'MESSAGE', message.id, session.user.id)
    revalidatePath('/inbox')
    revalidatePath(`/inbox/${validated.personId}`)
    return message
  })
}
