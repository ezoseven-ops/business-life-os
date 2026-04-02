import { prisma } from '@/lib/prisma'
import { uploadFile, deleteFile as deleteR2File, generateFileKey } from '@/lib/r2'

export async function createFile(
  file: { name: string; data: Buffer; mimeType: string; size: number },
  workspaceId: string,
  attachTo?: { taskId?: string; noteId?: string },
) {
  const key = generateFileKey(workspaceId, file.name)
  const url = await uploadFile(key, file.data, file.mimeType)

  return prisma.file.create({
    data: {
      name: file.name,
      url,
      size: file.size,
      mimeType: file.mimeType,
      workspaceId,
      taskId: attachTo?.taskId,
      noteId: attachTo?.noteId,
    },
  })
}

export async function removeFile(id: string) {
  const file = await prisma.file.findUnique({ where: { id } })
  if (!file) throw new Error('File not found')

  // Delete from R2 if it's a key (not a full URL)
  if (!file.url.startsWith('http')) {
    await deleteR2File(file.url)
  }

  return prisma.file.delete({ where: { id } })
}

export async function getFilesByWorkspace(workspaceId: string) {
  return prisma.file.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}
