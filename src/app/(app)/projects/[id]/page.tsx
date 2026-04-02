import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getProjectById } from '@/modules/projects/project.queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { TaskCheckbox } from '@/modules/tasks/components/TaskCheckbox'

const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
  ACTIVE: { text: 'Active', color: 'text-green-700', bg: 'bg-green-50' },
  PAUSED: { text: 'Paused', color: 'text-amber-700', bg: 'bg-amber-50' },
  DONE: { text: 'Done', color: 'text-blue-700', bg: 'bg-blue-50' },
  ARCHIVED: { text: 'Archived', color: 'text-gray-500', bg: 'bg-gray-100' },
}

const priorityStyles: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-600',
  HIGH: 'bg-orange-50 text-orange-600',
  MEDIUM: 'bg-blue-50 text-blue-600',
  LOW: 'bg-gray-100 text-gray-500',
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const project = await getProjectById(id, session.user.workspaceId)
  if (!project) notFound()

  const activeTasks = project.tasks.filter((t) => t.status !== 'DONE')
  const doneTasks = project.tasks.filter((t) => t.status === 'DONE')
  const cfg = statusLabel[project.status] || statusLabel.ACTIVE

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header
        title={project.name}
        backHref="/projects"
        action={
          <Link href={`/tasks?new=1&projectId=${project.id}`} className="text-sm font-semibold text-primary">
            + Task
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-6 pb-24">
        {/* Project header info */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              {project.description && (
                <p className="text-sm text-gray-500 leading-relaxed">{project.description}</p>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
              {cfg.text}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{project._count.tasks}</p>
              <p className="text-[11px] text-gray-400 font-medium">Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{doneTasks.length}</p>
              <p className="text-[11px] text-gray-400 font-medium">Done</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{project._count.notes}</p>
              <p className="text-[11px] text-gray-400 font-medium">Notes</p>
            </div>
            {project._count.tasks > 0 && (
              <div className="flex-1">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.round((doneTasks.length / project._count.tasks) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  {Math.round((doneTasks.length / project._count.tasks) * 100)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Active
              </h3>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {activeTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <div key={task.id} className="card flex items-center gap-3 px-4 py-3.5">
                  <TaskCheckbox taskId={task.id} status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.dueDate && (
                        <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                      )}
                      {task.assignee && (
                        <>
                          {task.dueDate && <span className="text-gray-300">&middot;</span>}
                          <span className="text-xs text-gray-400">{task.assignee.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${priorityStyles[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed tasks */}
        {doneTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-green-600">
                Completed
              </h3>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {doneTasks.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {doneTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 line-through truncate">{task.title}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No tasks state */}
        {project.tasks.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No tasks yet</p>
            <Link
              href={`/tasks?new=1&projectId=${project.id}`}
              className="inline-block mt-3 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
            >
              Add first task
            </Link>
          </div>
        )}

        {/* Notes */}
        {project.notes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Notes
              </h3>
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {project.notes.length}
              </span>
            </div>
            <div className="space-y-2">
              {project.notes.map((note) => (
                <div key={note.id} className="card p-4">
                  <h4 className="text-sm font-semibold text-gray-900">{note.title || 'Untitled'}</h4>
                  {note.content && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{note.content}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatRelativeTime(note.updatedAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
