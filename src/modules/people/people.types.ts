import { z } from 'zod'

export const createPersonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  telegramId: z.string().max(100).optional(),
  whatsappId: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
})

export const updatePersonSchema = createPersonSchema.partial()

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
