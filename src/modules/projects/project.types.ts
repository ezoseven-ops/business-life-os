import { z } from 'zod'

export const projectPhaseEnum = z.enum(['PLANNING', 'EXECUTION', 'REVIEW', 'COMPLETE'])

export type ProjectPhase = z.infer<typeof projectPhaseEnum>

/** Ordered phase progression */
export const PHASE_ORDER: ProjectPhase[] = ['PLANNING', 'EXECUTION', 'REVIEW', 'COMPLETE']

export const PHASE_META: Record<ProjectPhase, { label: string; color: string; icon: string }> = {
  PLANNING: { label: 'Planning', color: '#8b5cf6', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
  EXECUTION: { label: 'Execution', color: '#3b82f6', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  REVIEW: { label: 'Review', color: '#f59e0b', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  COMPLETE: { label: 'Complete', color: '#10b981', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
}

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DONE', 'ARCHIVED']).optional(),
  phase: projectPhaseEnum.optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
