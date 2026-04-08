import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getTaskById } from '@/modules/tasks/task.queries'
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

  // Query workspace Users for assignee dropdown
  const workspaceUsers = await prisma.user.findMany({
    where: { workspaceId: session.user.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // Query project people (Persons attached to this task's project)
  const projectPeople = await prisma.projectPerson.findMany({
    where: { projectId: task.projectId },
    include: {
      person: {
        select: { id: true, name: true, email: true, company: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const projectPersons = projectPeople.map((pp) => ({
    id: pp.person.id,
    name: pp.person.name ?? "",
    email: pp.person.email,
    company: pp.person.company,
  }))

  return (
    <>
      <Header title={task.title} backHref={`/projects/${task.projectId}`} />
      <TaskDetailClient
        task={task as any}
        workspaceUsers={workspaceUsers.map(u => ({ id: u.id, name: u.name ?? "" }))}
        projectPersons={projectPersons}
        currentUserId={session.user.id}
      />
    </>
  )
}
