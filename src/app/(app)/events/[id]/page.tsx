import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getEventById } from '@/modules/events/event.service'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EventDetailClient } from '@/modules/events/components/EventDetailClient'

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const { from } = await searchParams
  const event = await getEventById(id, session.user.workspaceId)
  if (!event) notFound()

  const backHref = from === 'calendar'
    ? '/calendar'
    : from === 'project' && event.project
      ? `/projects/${event.project.id}`
      : event.project
        ? `/projects/${event.project.id}`
        : '/calendar'

  return (
    <>
      <Header
        title="Event"
        backHref={backHref}
      />

      {/* Project linkage badge */}
      {event.project && (
        <div className="px-5 pt-3 max-w-lg mx-auto">
          <Link
            href={`/projects/${event.project.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'rgba(124,110,246,0.12)', color: '#7c6ef6' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            {event.project.name}
          </Link>
        </div>
      )}

      <EventDetailClient event={event} />
    </>
  )
}
