import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getNotes } from '@/modules/notes/note.service'
import Link from 'next/link'
import { formatRelativeTime, truncate } from '@/lib/utils'

const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  QUICK: { icon: 'Q', color: 'var(--color-cc-risk)', bg: 'var(--color-cc-risk-muted)' },
  MEETING: { icon: 'M', color: 'var(--color-cc-accent)', bg: 'var(--color-cc-accent-muted)' },
  VOICE: { icon: 'V', color: 'var(--color-cc-fire)', bg: 'var(--color-cc-fire-muted)' },
}

export default async function NotesPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const notes = await getNotes(session.user.workspaceId)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header
        title="Notes"
        action={
          <Link href="/notes/new" className="text-sm font-semibold" style={{ color: 'var(--color-cc-accent)' }}>
            + New
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Capture ideas, meeting notes, and voice memos."
            action={
              <Link href="/notes/new" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--color-cc-bg)]" style={{ backgroundColor: 'var(--color-cc-accent)' }}>
                New note
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const cfg = typeConfig[note.type] || typeConfig.QUICK
              return (
                <Link key={note.id} href={`/notes/${note.id}`} className="p-4 block rounded-xl transition-all active:scale-[0.98]" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                      <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-cc-text)' }}>
                        {note.title || 'Untitled'}
                      </h3>
                      {note.content && (
                        <p className="text-sm mt-0.5 line-clamp-2" style={{ color: 'var(--color-cc-text-secondary)' }}>
                          {truncate(note.content, 120)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>
                        <span>{formatRelativeTime(note.updatedAt)}</span>
                        {note.project && (
                          <>
                            <span style={{ color: 'var(--color-cc-separator)' }}>&middot;</span>
                            <span>{note.project.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
