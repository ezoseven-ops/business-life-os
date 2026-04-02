import { prisma } from '@/lib/prisma'
import type { NormalizedMessage, SendMessageInput } from './comms.types'
import { getTelegramAdapter } from '@/modules/integrations/adapters/telegram.adapter'
import { getWhatsAppAdapter } from '@/modules/integrations/adapters/whatsapp.adapter'

export async function saveInboundMessage(
  message: NormalizedMessage,
  workspaceId: string,
  personId?: string,
) {
  return prisma.message.upsert({
    where: {
      channel_externalId: {
        channel: message.channel,
        externalId: message.externalId,
      },
    },
    update: {},
    create: {
      direction: 'INBOUND',
      channel: message.channel,
      externalId: message.externalId,
      content: message.content,
      mediaUrl: message.mediaUrl,
      status: 'DELIVERED',
      rawPayload: message.rawPayload as any,
      personId,
      workspaceId,
    },
  })
}

export async function sendMessage(input: SendMessageInput, workspaceId: string) {
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
  })
  if (!person) throw new Error('Person not found')

  const adapter = input.channel === 'TELEGRAM'
    ? await getTelegramAdapter(workspaceId)
    : await getWhatsAppAdapter(workspaceId)

  if (!adapter) {
    throw new Error(`${input.channel} integration not configured`)
  }

  const externalId = input.channel === 'TELEGRAM'
    ? person.telegramId
    : person.whatsappId

  if (!externalId) {
    throw new Error(`No ${input.channel} ID for this person`)
  }

  const result = await adapter.sendOutbound({
    channel: input.channel,
    externalId,
    content: input.content,
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to send message')
  }

  return prisma.message.create({
    data: {
      direction: 'OUTBOUND',
      channel: input.channel,
      externalId: result.externalMessageId,
      content: input.content,
      status: 'SENT',
      personId: input.personId,
      workspaceId,
    },
  })
}

export async function getInbox(workspaceId: string, channel?: 'TELEGRAM' | 'WHATSAPP') {
  return prisma.message.findMany({
    where: {
      workspaceId,
      ...(channel && { channel }),
    },
    include: {
      person: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

/** Get conversations grouped by person — latest message per person */
export async function getConversations(workspaceId: string) {
  const people = await prisma.person.findMany({
    where: {
      workspaceId,
      messages: { some: {} },
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, channel: true, direction: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const orphanMessages = await prisma.message.findMany({
    where: { workspaceId, personId: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return { people, orphanMessages }
}

/** Get all messages for a specific person (thread view) */
export async function getThread(personId: string, workspaceId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 200 },
    },
  })
  if (!person || person.workspaceId !== workspaceId) return null
  return person
}

/** Get a single message by ID */
export async function getMessageById(id: string) {
  return prisma.message.findUnique({
    where: { id },
    include: {
      person: { select: { id: true, name: true, telegramId: true, whatsappId: true } },
    },
  })
}
