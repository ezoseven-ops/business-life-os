import { z } from 'zod'

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().default(false),
  location: z.string().max(500).optional(),
  projectId: z.string().nullable().optional(),
})

export const updateEventSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(500).nullable().optional(),
  projectId: z.string().nullable().optional(),
})

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
