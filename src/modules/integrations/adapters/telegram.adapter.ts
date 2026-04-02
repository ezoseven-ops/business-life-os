import type { ChannelAdapter } from '../integration.types'
import type { NormalizedMessage, OutboundMessage, SendResult } from '@/modules/communications/comms.types'
import { getIntegration } from '../integration.service'

interface TelegramConfig {
  botToken: string
  webhookSecret?: string
}

class TelegramAdapter implements ChannelAdapter {
  channel = 'TELEGRAM' as const
  private botToken: string
  private webhookSecret?: string

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken
    this.webhookSecret = config.webhookSecret
  }

  parseInbound(rawPayload: unknown): NormalizedMessage | null {
    const update = rawPayload as any
    const message = update?.message

    if (!message) return null

    return {
      externalId: String(message.message_id),
      channel: 'TELEGRAM',
      direction: 'INBOUND',
      content: message.text || message.caption || null,
      mediaUrl: null, // TODO: handle photos/documents
      senderExternalId: String(message.from?.id),
      senderName: [message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(' ') || null,
      rawPayload,
    }
  }

  async sendOutbound(message: OutboundMessage): Promise<SendResult> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.externalId,
            text: message.content,
            parse_mode: 'Markdown',
          }),
        },
      )

      const data = await response.json()

      if (!data.ok) {
        return { success: false, error: data.description }
      }

      return {
        success: true,
        externalMessageId: String(data.result.message_id),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async validateWebhook(request: Request): Promise<boolean> {
    if (!this.webhookSecret) return true
    const token = request.headers.get('x-telegram-bot-api-secret-token')
    return token === this.webhookSecret
  }
}

export async function getTelegramAdapter(workspaceId: string): Promise<TelegramAdapter | null> {
  const integration = await getIntegration(workspaceId, 'TELEGRAM')
  if (!integration?.enabled) return null

  const config = integration.config as unknown as TelegramConfig
  if (!config.botToken) return null

  return new TelegramAdapter(config)
}
