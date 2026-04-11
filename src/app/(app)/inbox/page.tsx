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
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Inbox" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {!hasAnything ? (
          <EmptyState
            title="No messages yet"
            description="Connect a messaging channel in Settings to get started."
            action={
              <Link href="/settings" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--color-cc-bg)]" style={{ backgroundColor: 'var(--color-cc-accent)' }}>
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
                  className="p-4 block rounded-xl transition-all active:scale-[0.98]"
                  style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-cc-accent)' }}>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-cc-accent)' }}>
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-cc-text)' }}>{person.name}</span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lastMsg.channel === 'TELEGRAM' ? 'var(--color-cc-info)' : 'var(--color-cc-success)' }} />
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-cc-text-muted)' }}>{formatRelativeTime(lastMsg.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {lastMsg.direction === 'OUTBOUND' && (
                          <span className="text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>You:</span>
                        )}
                        <p className="text-sm truncate" style={{ color: 'var(--color-cc-text-secondary)' }}>
                          {lastMsg.content || 'Media message'}
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-cc-text-muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              )
            })}

            {orphanMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4 pb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-cc-text-muted)' }}>Unknown Senders</h3>
                </div>
                {orphanMessages.map((msg) => (
                  <div key={msg.id} className="p-4 rounded-xl" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: msg.channel === 'TELEGRAM' ? 'var(--color-cc-info)' : 'var(--color-cc-success)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-cc-text)' }}>{msg.channel}</span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    {msg.content && (
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--color-cc-text-secondary)' }}>{msg.content}</p>
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
