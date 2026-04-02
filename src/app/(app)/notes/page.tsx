import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getNotes } from '@/modules/notes/note.service'
import Link from 'next/link'
import { formatRelativeTime, truncate } from '@/lib/utils'

const typeConfig = {
  QUICK: { icon: 'Q', bg: 'bg-amber-50', color: 'text-amber-600' },
  MEETING: { icon: 'M', bg: 'bg-purple-50', color: 'text-purple-600' },
  VOICE: { icon: 'V', bg: 'bg-red-50', color: 'text-red-600' },
}

export default async function NotesPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const notes = await getNotes(session.user.workspaceId)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header
        title="Notes"
        action={
          <Link href="/notes/new" className="text-sm font-semibold text-primary">
            + New
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Capture your first idea."
            action={
              <Link href="/notes/new" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
                New note
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const cfg = typeConfig[note.type]
              return (
                <Link key={note.id} href={`/notes/${note.id}`} className="card p-4 block">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {note.title || 'Untitled'}
                      </h3>
                      {note.content && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                          {truncate(note.content, 120)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{formatRelativeTime(note.updatedAt)}</span>
                        {note.project && (
                          <>
                            <span className="text-gray-300">&middot;</span>
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
