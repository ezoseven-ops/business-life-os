import type { ChannelAdapter } from '../integration.types'
import type { NormalizedMessage, OutboundMessage, SendResult } from '@/modules/communications/comms.types'
import { getIntegration } from '../integration.service'
import { createHmac, timingSafeEqual } from 'crypto'

interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  appSecret: string
}

class WhatsAppAdapter implements ChannelAdapter {
  channel = 'WHATSAPP' as const
  private config: WhatsAppConfig

  constructor(config: WhatsAppConfig) {
    this.config = config
  }

  parseInbound(rawPayload: unknown): NormalizedMessage | null {
    const body = rawPayload as any
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const message = change?.value?.messages?.[0]

    if (!message) return null

    const contact = change?.value?.contacts?.[0]

    return {
      externalId: message.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      content: message.text?.body || null,
      mediaUrl: null,
      senderExternalId: message.from,
      senderName: contact?.profile?.name || null,
      rawPayload,
    }
  }

  async sendOutbound(message: OutboundMessage): Promise<SendResult> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: message.externalId,
            type: 'text',
            text: { body: message.content },
          }),
        },
      )

      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return {
        success: true,
        externalMessageId: data.messages?.[0]?.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async validateWebhook(request: Request): Promise<boolean> {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) return false

    const body = await request.text()
    const expectedSig = 'sha256=' + createHmac('sha256', this.config.appSecret)
      .update(body)
      .digest('hex')

    try {
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig),
      )
    } catch {
      return false
    }
  }
}

export async function getWhatsAppAdapter(workspaceId: string): Promise<WhatsAppAdapter | null> {
  const integration = await getIntegration(workspaceId, 'WHATSAPP')
  if (!integration?.enabled) return null

  const config = integration.config as unknown as WhatsAppConfig
  if (!config.accessToken) return null

  return new WhatsAppAdapter(config)
}
