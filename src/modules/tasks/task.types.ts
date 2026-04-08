import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500),
  description: z.string().max(5000).optional(),
  projectId: z.string().min(1, 'Project is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.coerce.date().optional(),
  assigneeId: z.string().min(1).optional(),
  assigneePersonId: z.string().min(1).optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'WAITING', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneePersonId: z.string().nullable().optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
