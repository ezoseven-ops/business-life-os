import { prisma } from '@/lib/prisma'

export type ProjectOverview = {
  id: string
  name: string
  status: string
  projectPriority: string
  ventureName: string | null
  taskCounts: {
    total: number
    done: number
    overdue: number
  }
}

// Result type for projects with included relations (PRISMA_SCHEMA_FIELD)
type ProjectWithRelations = {
  id: string
  name: string
  status: string
  projectPriority: string
  venture: { name: string } | null
  tasks: Array<{ status: string; dueDate: Date | null }>
}

export async function getProjectOverview(workspaceId: string): Promise<ProjectOverview[]> {
  const now = new Date()

  // PRISMA_SCHEMA_FIELD: include venture, orderBy projectPriority
  const projects = (await prisma.project.findMany({
    where: {
      workspaceId,
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    include: {
      venture: { select: { name: true } },
      tasks: {
        select: {
          status: true,
          dueDate: true,
        },
      },
    } as any,
    orderBy: [
      { projectPriority: 'asc' }, // P0 first
      { updatedAt: 'desc' },
    ] as any,
  })) as unknown as ProjectWithRelations[]

  return projects.map((project) => {
    const total = project.tasks.length
    const done = project.tasks.filter((t: { status: string }) => t.status === 'DONE').length
    const overdue = project.tasks.filter(
      (t: { status: string; dueDate: Date | null }) =>
        t.status !== 'DONE' && t.dueDate && t.dueDate < now,
    ).length

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      projectPriority: project.projectPriority,
      ventureName: project.venture?.name ?? null,
      taskCounts: { total, done, overdue },
    }
  })
}
