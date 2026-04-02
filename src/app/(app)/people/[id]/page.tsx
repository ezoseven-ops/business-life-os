import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getPersonById } from '@/modules/people/people.service'
import { formatRelativeTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const person = await getPersonById(id, session.user.workspaceId!)
  if (!person) return notFound()

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header title={person.name} backHref="/people" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24 space-y-4">
        {/* Profile card */}
        <div className="card p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{person.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{person.name}</h2>
              {person.company && <p className="text-sm text-gray-500">{person.company}</p>}
            </div>
          </div>

          <div className="space-y-2.5">
            {person.email && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-20">Email</span>
                <span className="text-gray-900">{person.email}</span>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-20">Phone</span>
                <span className="text-gray-900">{person.phone}</span>
              </div>
            )}
            {person.telegramId && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-20">Telegram</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-900">{person.telegramId}</span>
                </span>
              </div>
            )}
            {person.whatsappId && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-20">WhatsApp</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-900">{person.whatsappId}</span>
                </span>
              </div>
            )}
            {person.notes && (
              <div className="flex items-start gap-3 text-sm pt-1">
                <span className="text-gray-400 w-20">Notes</span>
                <span className="text-gray-700">{person.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          {person.messages.length > 0 && (
            <Link
              href={`/inbox/${person.id}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              Messages
            </Link>
          )}
        </div>

        {/* Recent messages */}
        {person.messages.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Recent Messages ({person.messages.length})
            </h3>
            <div className="space-y-2">
              {person.messages.slice(0, 10).map((msg) => (
                <div key={msg.id} className="card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${msg.channel === 'TELEGRAM' ? 'bg-blue-500' : 'bg-green-500'}`} />
                      {msg.direction === 'OUTBOUND' && (
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
                  </div>
                  {msg.content && <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
