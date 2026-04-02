import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { prisma } from '@/lib/prisma'
import { getClientTasks, getTasksByAssigneeAndStatus } from '@/modules/tasks/task.queries'
import Link from 'next/link'

export default async function ClientDashboard() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const userId = session.user.id
  const workspaceId = session.user.workspaceId

  // Use module queries instead of raw prisma
  const [projectMemberships, myTasks, waitingTasks, notifications] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId, project: { workspaceId } },
      include: {
        project: {
          select: { id: true, name: true, status: true, _count: { select: { tasks: true } } },
        },
      },
    }),
    getClientTasks(workspaceId, userId, { excludeDone: true, limit: 10 }),
    getTasksByAssigneeAndStatus(workspaceId, userId, 'WAITING'),
    prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const greeting = new Date().getHours() < 12
    ? 'Good morning'
    : new Date().getHours() < 18
      ? 'Good afternoon'
      : 'Good evening'

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
      <div className="px-4 pt-6 pb-4">
        <p className="text-sm text-gray-500">{greeting},</p>
        <h1 className="text-2xl font-bold text-gray-900">{session.user.name || 'there'}</h1>
      </div>

      <div className="px-4 space-y-5 pb-8">
        {/* Needs Your Attention */}
        {waitingTasks.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2.5">
              Needs Your Attention ({waitingTasks.length})
            </h2>
            <div className="space-y-2">
              {waitingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/portal/tasks/${task.id}`}
                  className="block bg-amber-50 border border-amber-200 rounded-xl p-3"
                >
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{task.project.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Active Tasks */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            Your Tasks ({myTasks.length})
          </h2>
          {myTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-sm text-gray-400">No active tasks assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map((task) => (
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
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-gray-400">{task.project.name}</span>
                    {task.dueDate && (
                      <span className="text-[11px] text-gray-400">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        {projectMemberships.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Your Projects
            </h2>
            <div className="space-y-2">
              {projectMemberships.map(({ project }) => (
                <div key={project.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{project.name}</p>
                    <p className="text-[11px] text-gray-400">{project._count.tasks} tasks</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    project.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {project.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Unread Notifications */}
        {notifications.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
              Updates
            </h2>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="text-[11px] text-gray-500 mt-0.5">{n.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
