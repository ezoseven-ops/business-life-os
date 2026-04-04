import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getConversations } from '@/modules/communications/comms.service'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'

export default async function InboxPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { people, orphanMessages } = await getConversations(session.user.workspaceId)
  const hasAnything = people.length > 0 || orphanMessages.length > 0

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header title="Inbox" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {!hasAnything ? (
          <EmptyState
            title="No messages yet"
            description="Connect a messaging channel in Settings to get started."
            action={
              <Link href="/settings" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
                Settings
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {people.map((person) => {
              const lastMsg = person.messages[0]
              if (!lastMsg) return null
              return (
                <Link
                  key={person.id}
                  href={`/inbox/${person.id}`}
                  className="card p-4 block hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">{person.name}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lastMsg.channel === 'TELEGRAM' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(lastMsg.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {lastMsg.direction === 'OUTBOUND' && (
                          <span className="text-xs text-gray-400">You:</span>
                        )}
                        <p className="text-sm text-gray-500 truncate">
                          {lastMsg.content || 'Media message'}
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              )
            })}

            {orphanMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4 pb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Unknown Senders</h3>
                </div>
                {orphanMessages.map((msg) => (
                  <div key={msg.id} className="card p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${msg.channel === 'TELEGRAM' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <span className="text-sm font-semibold text-gray-900">{msg.channel}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    {msg.content && (
                      <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
