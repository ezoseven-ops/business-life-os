import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/sentry'
import { sendMessage } from '@/modules/communications/comms.service'
import { getTelegramAdapter } from '@/modules/integrations/adapters/telegram.adapter'
import { getWhatsAppAdapter } from '@/modules/integrations/adapters/whatsapp.adapter'

// ─────────────────────────────────────────────
// Message Send Service
//
// Resolves a message draft into a REAL sent message.
// Flow: draft payload → resolve person → check adapter → send → log
// Safety: NO auto-send. Always requires explicit user confirmation.
// ─────────────────────────────────────────────

export interface MessageDraftPayload {
  recipientName: string
  recipientId: string | null
  channel: 'internal' | 'telegram' | 'whatsapp' | 'email' | 'unknown'
  subject: string
  body: string
  projectId: string | null
  followUpAction: string | null
}

export interface MessageSendResult {
  success: boolean
  messageId: string | null
  channel: 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null
  recipientName: string
  error: string | null
}

/**
 * Get available sending channels for a person in a workspace.
 * Returns which adapters are configured + which IDs the person has.
 */
export async function getAvailableChannels(
  personId: string,
  workspaceId: string,
): Promise<Array<{ channel: 'TELEGRAM' | 'WHATSAPP'; available: boolean }>> {
  const [person, telegramAdapter, whatsappAdapter] = await Promise.all([
    prisma.person.findUnique({
      where: { id: personId },
      select: { telegramId: true, whatsappId: true },
    }),
    getTelegramAdapter(workspaceId),
    getWhatsAppAdapter(workspaceId),
  ])

  if (!person) return []

  return [
    {
      channel: 'TELEGRAM' as const,
      available: !!(telegramAdapter && person.telegramId),
    },
    {
      channel: 'WHATSAPP' as const,
      available: !!(whatsappAdapter && person.whatsappId),
    },
  ]
}

/**
 * Resolve a person from the draft payload.
 * Tries recipientId first, then fuzzy name match.
 */
async function resolvePerson(
  draft: MessageDraftPayload,
  workspaceId: string,
) {
  // Direct ID match
  if (draft.recipientId) {
    const person = await prisma.person.findFirst({
      where: { id: draft.recipientId, workspaceId },
    })
    if (person) return person
  }

  // Fuzzy name match
  const people = await prisma.person.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      telegramId: true,
      whatsappId: true,
      email: true,
    },
  })

  const nameLower = draft.recipientName.toLowerCase()

  // Exact match first
  const exact = people.find(p => p.name.toLowerCase() === nameLower)
  if (exact) return exact

  // Partial match
  const partial = people.find(
    p => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase()),
  )
  if (partial) return partial

  return null
}

/**
 * Determine the best channel for sending.
 * Priority: explicit channel from draft → telegram → whatsapp → email
 */
function resolveChannel(
  draft: MessageDraftPayload,
  person: { telegramId: string | null; whatsappId: string | null; email: string | null },
  hasTelegram: boolean,
  hasWhatsApp: boolean,
): 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null {
  // If draft specifies a channel, try it
  if (draft.channel === 'telegram' && person.telegramId && hasTelegram) return 'TELEGRAM'
  if (draft.channel === 'whatsapp' && person.whatsappId && hasWhatsApp) return 'WHATSAPP'
  if (draft.channel === 'email' && person.email) return 'EMAIL'

  // Auto-detect best available
  if (person.telegramId && hasTelegram) return 'TELEGRAM'
  if (person.whatsappId && hasWhatsApp) return 'WHATSAPP'
  if (person.email) return 'EMAIL'

  return null
}

/**
 * Send a message from a draft payload.
 * Resolves person, picks best channel, sends via adapter, creates Message record.
 */
export async function sendMessageFromDraft(
  draft: MessageDraftPayload,
  workspaceId: string,
  _userId: string,
): Promise<MessageSendResult> {
  // 1. Resolve person
  const person = await resolvePerson(draft, workspaceId)
  if (!person) {
    return {
      success: false,
      messageId: null,
      channel: null,
      recipientName: draft.recipientName,
      error: `Could not find "${draft.recipientName}" in your contacts`,
    }
  }

  // 2. Check which adapters are available
  const [telegramAdapter, whatsappAdapter] = await Promise.all([
    getTelegramAdapter(workspaceId),
    getWhatsAppAdapter(workspaceId),
  ])

  // 3. Resolve channel
  const channel = resolveChannel(
    draft,
    person,
    !!telegramAdapter,
    !!whatsappAdapter,
  )

  if (!channel) {
    return {
      success: false,
      messageId: null,
      channel: null,
      recipientName: person.name,
      error: `No messaging channel available for ${person.name}. Configure Telegram or WhatsApp integration, or add contact details.`,
    }
  }

  // 4. Send via appropriate channel
  if (channel === 'EMAIL') {
    // Email sending — structure ready, implementation placeholder
    // TODO: Implement via Resend when ready
    return {
      success: false,
      messageId: null,
      channel: 'EMAIL',
      recipientName: person.name,
      error: 'Email sending is not yet configured. Use Telegram or WhatsApp.',
    }
  }

  // 5. Send via Telegram or WhatsApp adapter
  try {
    // Compose message: subject + body
    const messageContent = draft.subject !== draft.body
      ? `*${draft.subject}*\n\n${draft.body}`
      : draft.body

    const msg = await sendMessage(
      {
        personId: person.id,
        channel,
        content: messageContent,
      },
      workspaceId,
    )

    return {
      success: true,
      messageId: msg.id,
      channel,
      recipientName: person.name,
      error: null,
    }
  } catch (err) {
    captureError(err, { module: 'message-send', action: 'sendMessageFromDraft', channel, recipientName: person.name })
    return {
      success: false,
      messageId: null,
      channel,
      recipientName: person.name,
      error: err instanceof Error ? err.message : 'Failed to send message',
    }
  }
}
