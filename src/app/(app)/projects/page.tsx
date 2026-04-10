import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getProjects } from '@/modules/projects/project.queries'
import { ProjectsPageClient } from '@/modules/projects/components/ProjectsPageClient'
import Link from 'next/link'

const statusConfig: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: 'var(--color-cc-success)', bg: 'var(--color-cc-success-muted)' },
  PAUSED: { color: 'var(--color-cc-risk)', bg: 'var(--color-cc-risk-muted)' },
  DONE: { color: 'var(--color-cc-accent)', bg: 'var(--color-cc-accent-glow)' },
  ARCHIVED: { color: 'var(--color-cc-text-muted)', bg: 'var(--color-cc-surface)' },
}

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const projects = await getProjects(session.user.workspaceId)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Projects" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {/* Inline project creation */}
        <ProjectsPageClient />

        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to structure your work."
          />
        ) : (
          <div className="space-y-3 mt-4">
            {projects.map((project) => {
              const cfg = statusConfig[project.status] || statusConfig.ACTIVE
              const totalTasks = project._count.tasks
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card card-hover block p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold" style={{ color: 'var(--color-cc-text)' }}>{project.name}</h3>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {project.status}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--color-cc-text-secondary)' }}>{project.description}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span>{totalTasks} tasks</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-cc-text-muted)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                      <span>{project._count.notes} notes</span>
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
