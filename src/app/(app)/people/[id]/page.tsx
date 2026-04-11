import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getPersonById, getPersonWorkContext } from '@/modules/people/people.service'
import { getCollaboratorProfile } from '@/modules/people/collaborator.service'
import { CollaboratorProfileCard } from '@/modules/people/components/CollaboratorProfileCard'
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

  const [collaboratorProfile, workContext] = await Promise.all([
    getCollaboratorProfile(id),
    getPersonWorkContext(id, session.user.workspaceId!),
  ])

  const activeTasks = workContext.tasks.filter((t) => t.status === 'IN_PROGRESS')
  const waitingTasks = workContext.tasks.filter((t) => t.status === 'WAITING')
  const todoTasks = workContext.tasks.filter((t) => t.status === 'TODO')

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title={person.name} backHref="/people" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24 space-y-4">

        {/* Identity */}
        <div className="flex items-center gap-3.5 px-1">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-cc-accent)' }}>
            <span className="text-base font-bold" style={{ color: 'var(--color-cc-accent)' }}>{person.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--color-cc-text)' }}>{person.name}</h2>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>
              {person.company && <span>{person.company}</span>}
              {person.company && (person.email || person.phone) && <span>·</span>}
              {person.email && <span className="truncate">{person.email}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {person.telegramId && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-cc-info)' }} title="Telegram" />}
            {person.whatsappId && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-cc-success)' }} title="WhatsApp" />}
          </div>
        </div>

        {/* Working on now */}
        {activeTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-cc-accent)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Working on now</span>
            </div>
            <div className="space-y-1.5">
              {activeTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 p-3 rounded-xl active:scale-[0.98]" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-cc-text)' }}>{task.title}</p>
                    {task.project?.name && (
                      <span className="text-[11px]" style={{ color: 'var(--color-cc-text-muted)' }}>{task.project.name}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                    backgroundColor: task.priority === 'URGENT' ? 'var(--color-cc-fire-muted)' : task.priority === 'HIGH' ? 'var(--color-cc-risk-muted)' : 'var(--color-cc-surface)',
                    color: task.priority === 'URGENT' ? 'var(--color-cc-fire)' : task.priority === 'HIGH' ? 'var(--color-cc-risk)' : 'var(--color-cc-text-muted)'
                  }}>{task.priority}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Blocked */}
        {waitingTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-cc-risk)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Blocked</span>
            </div>
            <div className="space-y-1.5">
              {waitingTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 p-3 rounded-xl active:scale-[0.98]" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-cc-text-secondary)' }}>{task.title}</p>
                    {task.project?.name && (
                      <span className="text-[11px]" style={{ color: 'var(--color-cc-text-muted)' }}>{task.project.name}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Queued */}
        {todoTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-cc-text-muted)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Queued ({todoTasks.length})</span>
            </div>
            <div className="space-y-0.5">
              {todoTasks.slice(0, 5).map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-2.5 py-2 px-3 rounded-xl active:scale-[0.98]" style={{ color: 'var(--color-cc-text-secondary)' }}>
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  {task.project?.name && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-cc-text-muted)' }}>{task.project.name}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {workContext.projects.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Projects</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {workContext.projects.map((proj) => (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg active:scale-[0.97]"
                  style={{ backgroundColor: 'var(--color-cc-border)', color: 'var(--color-cc-text-secondary)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    backgroundColor: proj.status === 'ACTIVE' ? 'var(--color-cc-success)' : proj.status === 'PAUSED' ? 'var(--color-cc-risk)' : 'var(--color-cc-text-muted)'
                  }} />
                  {proj.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Collaborator profile */}
        <CollaboratorProfileCard
          personId={person.id}
          personName={person.name}
          initialProfile={collaboratorProfile}
        />

        {/* Contact details */}
        {(person.phone || person.notes || person.telegramId || person.whatsappId) && (
          <div className="p-4 space-y-2 rounded-xl" style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Details</span>
            <div className="space-y-1.5">
              {person.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>Phone</span>
                  <span style={{ color: 'var(--color-cc-text-secondary)' }}>{person.phone}</span>
                </div>
              )}
              {person.telegramId && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>Telegram</span>
                  <span style={{ color: 'var(--color-cc-text-secondary)' }}>{person.telegramId}</span>
                </div>
              )}
              {person.whatsappId && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>WhatsApp</span>
                  <span style={{ color: 'var(--color-cc-text-secondary)' }}>{person.whatsappId}</span>
                </div>
              )}
              {person.notes && (
                <div className="flex items-start gap-3 text-sm">
                  <span className="w-16 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>Notes</span>
                  <span style={{ color: 'var(--color-cc-text-secondary)' }}>{person.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {person.messages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-cc-text-muted)' }}>Messages</span>
              <Link href={`/inbox/${person.id}`} className="text-[11px] font-semibold" style={{ color: 'var(--color-cc-accent)' }}>View all</Link>
            </div>
            <div className="space-y-1">
              {person.messages.slice(0, 5).map((msg) => (
                <div key={msg.id} className="flex items-start gap-2.5 py-2 px-3 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: msg.channel === 'TELEGRAM' ? 'var(--color-cc-info)' : 'var(--color-cc-success)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {msg.direction === 'OUTBOUND' && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-cc-text-muted)' }}>You</span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--color-cc-text-muted)' }}>{formatRelativeTime(msg.createdAt)}</span>
                    </div>
                    {msg.content && <p className="text-[12px] line-clamp-1" style={{ color: 'var(--color-cc-text-secondary)' }}>{msg.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {workContext.tasks.length === 0 && workContext.projects.length === 0 && person.messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-cc-text-muted)' }}>No activity yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
