import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getTasksByWorkspace } from '@/modules/tasks/task.queries'
import { getProjects } from '@/modules/projects/project.queries'
import { formatDate } from '@/lib/utils'
import { TaskCheckbox } from '@/modules/tasks/components/TaskCheckbox'
import { TasksPageClient } from '@/modules/tasks/components/TasksPageClient'
import Link from 'next/link'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const params = await searchParams
  const [tasks, projects] = await Promise.all([
    getTasksByWorkspace(session.user.workspaceId),
    getProjects(session.user.workspaceId),
  ])

  const grouped = {
    TODO: tasks.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS'),
    WAITING: tasks.filter((t) => t.status === 'WAITING'),
    DONE: tasks.filter((t) => t.status === 'DONE'),
  }

  const statusConfig = {
    TODO: { label: 'To Do', color: 'var(--color-cc-text-muted)' },
    IN_PROGRESS: { label: 'In Progress', color: 'var(--color-cc-info)' },
    WAITING: { label: 'Waiting', color: 'var(--color-cc-risk)' },
    DONE: { label: 'Completed', color: 'var(--color-cc-success)' },
  }

  const priorityStyles: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: 'var(--color-cc-fire-muted)', color: 'var(--color-cc-fire)' },
    HIGH: { bg: 'var(--color-cc-risk-muted)', color: 'var(--color-cc-risk)' },
    MEDIUM: { bg: 'var(--color-cc-surface)', color: 'var(--color-cc-info)' },
    LOW: { bg: 'var(--color-cc-surface)', color: 'var(--color-cc-text-muted)' },
  }

  const defaultProjectId = projects[0]?.id

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Tasks" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {/* Inline add task */}
        <TasksPageClient
          defaultProjectId={defaultProjectId}
          showInitially={params.new === '1'}
        />

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Create a task to start organizing work."
          />
        ) : (
          <div className="space-y-6 mt-4">
            {(Object.keys(grouped) as Array<keyof typeof grouped>)
              .filter((status) => grouped[status].length > 0)
              .map((status) => (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: statusConfig[status].color }}>
                      {statusConfig[status].label}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: 'var(--color-cc-text-muted)', backgroundColor: 'var(--color-cc-surface)' }}>
                      {grouped[status].length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped[status].map((task) => (
                      <div key={task.id} className="card flex items-center gap-3 px-4 py-3.5">
                        <TaskCheckbox taskId={task.id} status={task.status} />
                        <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            task.status === 'DONE' ? 'line-through' : ''
                          }`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>{task.project.name}</span>
                            {task.assignee && (
                              <>
                                <span style={{ color: 'var(--color-cc-text-dim)' }}>&middot;</span>
                                <span className="text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>{task.assignee.name}</span>
                              </>
                            )}
                            {task.dueDate && (
                              <>
                                <span style={{ color: 'var(--color-cc-text-dim)' }}>&middot;</span>
                                <span className="text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>{formatDate(task.dueDate)}</span>
                              </>
                            )}
                          </div>
                        </Link>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: priorityStyles[task.priority].bg, color: priorityStyles[task.priority].color }}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
