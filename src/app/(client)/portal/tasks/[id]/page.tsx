import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ClientTaskDetailClient } from './ClientTaskDetailClient'

export default async function ClientTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params

  // Find task — must be in client's workspace
  const task = await prisma.task.findFirst({
    where: { id, project: { workspaceId: session.user.workspaceId } },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
      comments: {
        where: { internal: false }, // Hide internal comments from clients
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!task) return notFound()

  // Verify client has access (assigned or project member)
  const hasAccess =
    task.assigneeId === session.user.id ||
    (await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId: task.projectId } },
    }))

  if (!hasAccess) return notFound()

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
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header title="Task" backHref="/portal/tasks" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24 space-y-4">
        {/* Task Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <h1 className="text-lg font-bold text-gray-900">{task.title}</h1>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <span className="text-[11px] text-gray-400">{task.project.name}</span>
          </div>

          {task.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
          )}

          <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
            {task.assignee && <span>Assigned to: {task.assignee.name}</span>}
            {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Comments ({task.comments.length})
          </h2>

          {task.comments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-sm text-gray-400">No comments yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {task.comments.map((comment) => (
                <div key={comment.id} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">
                        {comment.author.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-700">{comment.author.name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Comment (client can comment, but not mark as internal) */}
        <ClientTaskDetailClient taskId={task.id} />
      </div>
    </div>
  )
}
