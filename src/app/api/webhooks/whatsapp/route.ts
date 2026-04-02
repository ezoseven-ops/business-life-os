import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWhatsAppAdapter } from '@/modules/integrations/adapters/whatsapp.adapter'
import { saveInboundMessage } from '@/modules/communications/comms.service'
import { createNotification } from '@/modules/notifications/notification.service'

// Webhook verification (WhatsApp requires GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Incoming messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const integration = await prisma.integration.findFirst({
      where: { type: 'WHATSAPP', enabled: true },
      include: { workspace: { include: { owner: true } } },
    })

    if (!integration) {
      return NextResponse.json({ ok: true })
    }

    const adapter = await getWhatsAppAdapter(integration.workspaceId)
    if (!adapter) {
      return NextResponse.json({ ok: true })
    }

    // Validate webhook signature
    const isValid = await adapter.validateWebhook(request)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const normalized = adapter.parseInbound(body)
    if (!normalized) {
      return NextResponse.json({ ok: true })
    }

    // Save message (person matching by whatsappId TBD)
    await saveInboundMessage(normalized, integration.workspaceId)

    // Notify owner
    await createNotification(integration.workspace.ownerId, {
      type: 'NEW_MESSAGE',
      title: 'New WhatsApp message',
      body: normalized.content?.slice(0, 100) || 'Media message',
      linkUrl: '/inbox',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error)
    return NextResponse.json({ ok: true })
  }
}
