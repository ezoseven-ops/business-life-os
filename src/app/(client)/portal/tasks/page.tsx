import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getClientTasks } from '@/modules/tasks/task.queries'
import Link from 'next/link'

export default async function ClientTasksPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const tasks = await getClientTasks(session.user.workspaceId, session.user.id)

  const activeTasks = tasks.filter((t) => t.status !== 'DONE')
  const completedTasks = tasks.filter((t) => t.status === 'DONE')

  const priorityColors: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    LOW: 'bg-gray-100 text-gray-600',
  }

  const statusColors: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    WAITING: 'bg-amber-100 text-amber-700',
    DONE: 'bg-green-100 text-green-700',
  }

  return (
    <div>
      <Header title="Tasks" />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-5">
        {/* Active Tasks */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            Active ({activeTasks.length})
          </h2>
          {activeTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-sm text-gray-400">No active tasks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/portal/tasks/${task.id}`}
                  className="block bg-white rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-2 ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-gray-400">{task.project.name}</span>
                    {task._count.comments > 0 && (
                      <span className="text-[11px] text-gray-400">{task._count.comments} comments</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Completed ({completedTasks.length})
            </h2>
            <div className="space-y-2">
              {completedTasks.slice(0, 10).map((task) => (
                <Link
                  key={task.id}
                  href={`/portal/tasks/${task.id}`}
                  className="block bg-white rounded-xl border border-gray-100 p-3 opacity-60"
                >
                  <p className="text-sm font-medium text-gray-900 line-through">{task.title}</p>
                  <span className="text-[11px] text-gray-400">{task.project.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
