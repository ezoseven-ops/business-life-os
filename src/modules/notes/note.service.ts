import { prisma } from '@/lib/prisma'
import type { CreateNoteInput, UpdateNoteInput } from './note.types'

export async function createNote(
  input: CreateNoteInput,
  workspaceId: string,
  authorId: string,
) {
  return prisma.note.create({
    data: {
      ...input,
      workspaceId,
      authorId,
    },
  })
}

export async function updateNote(id: string, input: UpdateNoteInput) {
  return prisma.note.update({
    where: { id },
    data: input,
  })
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } })
}

export async function getNotes(workspaceId: string, projectId?: string) {
  return prisma.note.findMany({
    where: {
      workspaceId,
      ...(projectId && { projectId }),
    },
    include: {
      author: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      voiceNote: { select: { id: true, status: true, duration: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
}

export async function getNoteById(id: string, workspaceId?: string) {
  return prisma.note.findFirst({
    where: { id, ...(workspaceId && { workspaceId }) },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      project: { select: { id: true, name: true } },
      voiceNote: true,
      comments: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      files: true,
    },
  })
}
