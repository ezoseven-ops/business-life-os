import { z } from 'zod'

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['TEAM', 'CLIENT']),
  projectIds: z.array(z.string()).optional(), // For CLIENT role: which projects they can access
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
