import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getUpcomingEvents } from '@/modules/events/event.service'
import Link from 'next/link'

function formatEventDate(date: Date): string {
  const now = new Date()
  const eventDate = new Date(date)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())

  if (eventDay.getTime() === today.getTime()) return 'Today'
  if (eventDay.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatEventTime(date: Date, allDay: boolean): string {
  if (allDay) return 'All day'
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function groupByDate(events: Array<{ startAt: Date; [key: string]: unknown }>) {
  const groups: Record<string, typeof events> = {}
  for (const event of events) {
    const key = formatEventDate(event.startAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  return Object.entries(groups)
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const events = await getUpcomingEvents(session.user.workspaceId)
  const grouped = groupByDate(events)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header
        title="Calendar"
        action={
          <Link href="/calendar/new" className="text-sm font-semibold text-primary">
            + New
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {events.length === 0 ? (
          <EmptyState
            title="No upcoming events"
            description="Add your first event to get started."
            action={
              <Link href="/calendar/new" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
                New event
              </Link>
            }
          />
        ) : (
          <div className="space-y-5">
            {grouped.map(([dateLabel, dateEvents]) => (
              <div key={dateLabel}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {dateLabel}
                </h3>
                <div className="space-y-2">
                  {dateEvents.map((event: Record<string, unknown>) => (
                    <Link
                      key={event.id as string}
                      href={`/calendar/${event.id as string}`}
                      className="card p-4 block"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {event.title as string}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>{formatEventTime(event.startAt as Date, event.allDay as boolean)}</span>
                            {(event.location as string | undefined) && (
                              <>
                                <span className="text-gray-300">&middot;</span>
                                <span className="truncate">{event.location as string}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
