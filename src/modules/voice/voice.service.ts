import { prisma } from '@/lib/prisma'
import { uploadFile, generateFileKey } from '@/lib/r2'

export async function createVoiceNote(
  audio: { data: Buffer; mimeType: string; duration: number },
  workspaceId: string,
  authorId: string,
  projectId?: string,
) {
  const key = generateFileKey(workspaceId, `voice-${Date.now()}.webm`)
  const audioUrl = await uploadFile(key, audio.data, audio.mimeType)

  const note = await prisma.note.create({
    data: {
      title: `Voice note ${new Date().toLocaleDateString()}`,
      content: '',
      type: 'VOICE',
      workspaceId,
      authorId,
      projectId,
      voiceNote: {
        create: {
          audioUrl,
          duration: audio.duration,
          status: 'UPLOADED',
        },
      },
    },
    include: { voiceNote: true },
  })

  return note
}

export async function updateTranscription(voiceNoteId: string, transcription: string) {
  const voiceNote = await prisma.voiceNote.update({
    where: { id: voiceNoteId },
    data: {
      transcription,
      status: 'DONE',
    },
    include: { note: true },
  })

  // Also update the note content with the transcription
  await prisma.note.update({
    where: { id: voiceNote.noteId },
    data: { content: transcription },
  })

  return voiceNote
}

export async function markTranscriptionFailed(voiceNoteId: string) {
  return prisma.voiceNote.update({
    where: { id: voiceNoteId },
    data: { status: 'FAILED' },
  })
}

export async function markTranscribing(voiceNoteId: string) {
  return prisma.voiceNote.update({
    where: { id: voiceNoteId },
    data: { status: 'TRANSCRIBING' },
  })
}
