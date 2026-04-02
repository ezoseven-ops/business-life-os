'use server'

import { revalidatePath } from 'next/cache'
import { safeAction, requireWorkspace } from '@/lib/action-utils'
import * as notifService from './notification.service'

export async function markNotificationReadAction(id: string) {
  return safeAction(async () => {
    const session = await requireWorkspace()
    await notifService.markAsRead(id, session.user.id)
    revalidatePath('/notifications')
    revalidatePath('/')
  })
}

export async function markAllNotificationsReadAction() {
  return safeAction(async () => {
    const session = await requireWorkspace()
    await notifService.markAllAsRead(session.user.id)
    revalidatePath('/notifications')
    revalidatePath('/')
  })
}
