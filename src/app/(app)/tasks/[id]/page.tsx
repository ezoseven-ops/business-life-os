import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getTaskById } from '@/modules/tasks/task.queries'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { TaskDetailClient } from './TaskDetailClient'
import { prisma } from '@/lib/prisma'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const task = await getTaskById(id, session.user.workspaceId)
  if (!task) return notFound()

  // Query workspace Users (not People) for assignee dropdown
  const workspaceUsers = await prisma.user.findMany({
    where: { workspaceId: session.user.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header title="Task" backHref="/tasks" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        <TaskDetailClient
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString() || null,
            assigneeId: task.assigneeId,
            projectId: task.projectId,
            projectName: task.project.name,
            assigneeName: task.assignee?.name || null,
            creatorName: task.creator.name || 'Unknown',
            createdAt: task.createdAt.toISOString(),
            sourceMessageId: task.sourceMessageId || null,
            sourcePersonName: task.sourceMessage?.person?.name || null,
            sourcePersonId: task.sourceMessage?.person?.id || null,
            comments: task.comments.map(c => ({
              id: c.id,
              content: c.content,
              authorName: c.author.name || 'Unknown',
              createdAt: c.createdAt.toISOString(),
            })),
          }}
          users={workspaceUsers.map(u => ({ id: u.id, name: u.name || 'Unnamed' }))}
        />
      </div>
    </div>
  )
}
