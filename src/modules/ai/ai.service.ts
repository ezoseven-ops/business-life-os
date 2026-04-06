import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import { TASK_EXTRACTION_SYSTEM_PROMPT } from './prompts/task-extraction'
import { taskExtractionOutputSchema, type TaskExtractionOutput } from './ai.types'
import type { EntityType } from '@prisma/client'

export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Fetch audio from R2
  const response = await fetch(audioUrl)
  const audioBuffer = Buffer.from(await response.arrayBuffer())

  const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })

  // No language param — Whisper auto-detects language
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  })

  return transcription.text
}

export async function extractTasks(
  text: string,
  entityType: EntityType,
  entityId: string,
  projectContext?: string,
): Promise<TaskExtractionOutput> {
  const job = await prisma.aiJob.create({
    data: {
      type: 'TASK_EXTRACTION',
      status: 'PROCESSING',
      input: { text, projectContext },
      entityType,
      entityId,
    },
  })

  try {
    const userMessage = projectContext
      ? `Project context: ${projectContext}\n\nText:\n${text}`
      : text

    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TASK_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const content = result.choices[0]?.message?.content
    if (!content) throw new Error('Empty AI response')

    const parsed = taskExtractionOutputSchema.parse(JSON.parse(content))

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: 'DONE', output: parsed ?? undefined },
    })

    return parsed
  } catch (error) {
    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    throw error
  }
}

export async function approveAiJob(jobId: string, userId: string) {
  return prisma.aiJob.update({
    where: { id: jobId },
    data: { approvedAt: new Date(), approvedById: userId },
  })
}
