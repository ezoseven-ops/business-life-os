import { z } from 'zod'

export const createNoteSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(50000).default(''),
  type: z.enum(['QUICK', 'MEETING', 'VOICE']).default('QUICK'),
  projectId: z.string().min(1).optional(),
})

export const updateNoteSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(50000).optional(),
  projectId: z.string().min(1).nullable().optional(),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
