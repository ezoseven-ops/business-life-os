import { z } from 'zod'
import type { MessageChannel, MessageDirection } from '@prisma/client'

// Normalized message format — all adapters convert to this
export interface NormalizedMessage {
  externalId: string
  channel: MessageChannel
  direction: MessageDirection
  content: string | null
  mediaUrl: string | null
  senderExternalId: string | null
  senderName: string | null
  rawPayload: unknown
}

export interface OutboundMessage {
  channel: MessageChannel
  externalId: string  // recipient external ID
  content: string
  mediaUrl?: string
}

export interface SendResult {
  success: boolean
  externalMessageId?: string
  error?: string
}

export const sendMessageSchema = z.object({
  personId: z.string().min(1),
  channel: z.enum(['TELEGRAM', 'WHATSAPP']),
  content: z.string().min(1).max(4000),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
