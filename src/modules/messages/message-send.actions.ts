'use server'

import { requireRole } from '@/lib/action-utils'
import { prisma } from '@/lib/prisma'
import {
  sendMessageFromDraft,
  getAvailableChannels,
  type MessageDraftPayload,
  type MessageSendResult,
} from './message-send.service'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────
// Message Send Actions
//
// Server actions for sending message drafts.
// Safety: requires OWNER or TEAM role. No auto-send.
// ─────────────────────────────────────────────

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Send a message from a draft payload (from capture).
 * Called when user confirms the message draft in CaptureInput.
 */
export async function sendMessageDraftAction(
  draft: MessageDraftPayload,
): Promise<ActionResult<MessageSendResult>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const { workspaceId, id: userId } = session.user

    const result = await sendMessageFromDraft(draft, workspaceId!, userId)

    // Log activity if sent successfully
    if (result.success && result.messageId) {
      await prisma.activity.create({
        data: {
          action: 'CREATED',
          entityType: 'MESSAGE',
          entityId: result.messageId,
          userId,
          metadata: {
            channel: result.channel,
            recipientName: result.recipientName,
          } as any,
        },
      })

      revalidatePath('/inbox')
    }

    return { success: true, data: result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send message',
    }
  }
}

/**
 * Check available channels for a person.
 * Used by UI to show channel selector.
 */
export async function getAvailableChannelsAction(
  personId: string,
): Promise<ActionResult<Array<{ channel: 'TELEGRAM' | 'WHATSAPP'; available: boolean }>>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const channels = await getAvailableChannels(personId, session.user.workspaceId!)
    return { success: true, data: channels }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check channels',
    }
  }
}
