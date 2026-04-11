import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getThread } from '@/modules/communications/comms.service'
import { getProjects } from '@/modules/projects/project.queries'
import { formatRelativeTime } from '@/lib/utils'
import { ThreadActions } from './ThreadActions'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ personId: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { personId } = await params
  const person = await getThread(personId, session.user.workspaceId)
  if (!person) return notFound()

  const projects = await getProjects(session.user.workspaceId)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header
        title={person.name}
        backHref="/inbox"
        action={
          <Link href={`/people/${person.id}`} className="text-sm font-medium text-[var(--color-cc-accent)]">
            Profile
          </Link>
        }
      />

      {/* Person info bar */}
      <div className="bg-[var(--color-cc-bg)] border-b border-white/6 px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-cc-accent)]/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--color-cc-accent)]">{person.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--color-cc-text-muted)]">
              {person.company && <span>{person.company}</span>}
              {person.telegramId && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Telegram
                </span>
              )}
              {person.whatsappId && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> WhatsApp
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-[var(--color-cc-text-muted)]">{person.messages.length} messages</span>
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 max-w-lg mx-auto pb-32">
        <div className="space-y-3">
          {person.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.direction === 'OUTBOUND'
                  ? 'bg-[var(--color-cc-accent)] text-[var(--color-cc-bg)] rounded-br-md'
                  : 'bg-white/5 border border-white/6 text-[var(--color-cc-text)] rounded-bl-md'
              }`}>
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.mediaUrl && (
                  <p className="text-xs italic opacity-70 mt-1">Media attachment</p>
                )}
                <div className={`flex items-center justify-between gap-3 mt-1 ${
                  msg.direction === 'OUTBOUND' ? 'text-white/60' : 'text-[var(--color-cc-text-muted)]'
                }`}>
                  <span className="text-[10px]">{formatRelativeTime(msg.createdAt)}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${msg.channel === 'TELEGRAM' ? 'bg-blue-400' : 'bg-green-400'}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom actions bar */}
      <ThreadActions
        personId={person.id}
        personName={person.name}
        projects={projects.map(p => ({ id: p.id, name: p.name }))}
        messages={person.messages.map(m => ({ id: m.id, content: m.content }))}
        hasTelegram={!!person.telegramId}
        hasWhatsApp={!!person.whatsappId}
      />
    </div>
  )
}
