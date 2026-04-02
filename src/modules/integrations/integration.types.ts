import type { NormalizedMessage, OutboundMessage, SendResult } from '@/modules/communications/comms.types'

export interface ChannelAdapter {
  channel: 'TELEGRAM' | 'WHATSAPP'
  parseInbound(rawPayload: unknown): NormalizedMessage | null
  sendOutbound(message: OutboundMessage): Promise<SendResult>
  validateWebhook(request: Request): Promise<boolean>
}
