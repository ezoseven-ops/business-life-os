import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  taskId: z.string().min(1).optional(),
  noteId: z.string().min(1).optional(),
  internal: z.boolean().optional().default(false),
}).refine(
  (data) => data.taskId || data.noteId,
  { message: 'Comment must be attached to a task or note' },
)

export type CreateCommentInput = z.infer<typeof createCommentSchema>

export async function createComment(input: CreateCommentInput, authorId: string) {
  return prisma.comment.create({
    data: { ...input, authorId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
}

/**
 * Get comments for an entity, filtering out internal comments for CLIENT users.
 */
export async function getComments(
  entityType: 'task' | 'note',
  entityId: string,
  includeInternal: boolean = true,
) {
  return prisma.comment.findMany({
    where: {
      ...(entityType === 'task' ? { taskId: entityId } : { noteId: entityId }),
      ...(!includeInternal && { internal: false }),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function deleteComment(id: string, authorId: string) {
  return prisma.comment.delete({
    where: { id, authorId },
  })
}
