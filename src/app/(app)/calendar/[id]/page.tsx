import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getEventById } from '@/modules/events/event.service'
import { EventDetailClient } from '@/modules/events/components/EventDetailClient'
import { notFound } from 'next/navigation'

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const event = await getEventById(id, session.user.workspaceId!)

  if (!event) {
    notFound()
  }

  return (
    <div className="min-h-dvh bg-white">
      <Header title={event.title} backHref="/calendar" />
      <EventDetailClient event={event} />
    </div>
  )
}
