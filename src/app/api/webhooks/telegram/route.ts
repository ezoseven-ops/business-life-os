import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTelegramAdapter } from '@/modules/integrations/adapters/telegram.adapter'
import { saveInboundMessage } from '@/modules/communications/comms.service'
import { findPersonByTelegramId } from '@/modules/people/people.service'
import { createNotification } from '@/modules/notifications/notification.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Find workspace with active Telegram integration
    const integration = await prisma.integration.findFirst({
      where: { type: 'TELEGRAM', enabled: true },
      include: { workspace: { include: { owner: true } } },
    })

    if (!integration) {
      return NextResponse.json({ ok: true }) // Silently ignore
    }

    const adapter = await getTelegramAdapter(integration.workspaceId)
    if (!adapter) {
      return NextResponse.json({ ok: true })
    }

    // Validate webhook
    const isValid = await adapter.validateWebhook(request)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 })
    }

    // Parse message
    const normalized = adapter.parseInbound(body)
    if (!normalized) {
      return NextResponse.json({ ok: true })
    }

    // Try to match person
    const person = normalized.senderExternalId
      ? await findPersonByTelegramId(normalized.senderExternalId, integration.workspaceId)
      : null

    // Save message
    await saveInboundMessage(normalized, integration.workspaceId, person?.id)

    // Notify workspace owner
    await createNotification(integration.workspace.ownerId, {
      type: 'NEW_MESSAGE',
      title: `New Telegram message${person ? ` from ${person.name}` : ''}`,
      body: normalized.content?.slice(0, 100) || 'Media message',
      linkUrl: '/inbox',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook Error]', error)
    return NextResponse.json({ ok: true }) // Don't expose errors to Telegram
  }
}
