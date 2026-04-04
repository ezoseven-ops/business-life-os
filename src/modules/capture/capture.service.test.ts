/**
 * Capture Service Tests
 *
 * Tests capture classification and execution for:
 * - collaborator parsing
 * - note creation
 * - message draft
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'

import { parseCapture, executeCapture } from './capture.service'

describe('Capture Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies collaborator description correctly', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            classification: 'collaborator',
            interpretation: 'New collaborator: Tomek, backend developer',
            collaborator: {
              name: 'Tomek',
              role: 'Backend Developer',
              skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
              strengths: ['reliable', 'fast learner'],
              availability: 'FULL_TIME',
            },
          }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await parseCapture(
      'Tomek — backend dev, TypeScript expert, reliable, available full time',
      'ws_test',
    )

    expect(result.classification).toBe('collaborator')
    if (result.classification === 'collaborator') {
      expect(result.collaborator.name).toBe('Tomek')
      expect(result.collaborator.skills).toContain('TypeScript')
    }
  })

  it('classifies note input correctly', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            classification: 'note',
            interpretation: 'Quick note about API design',
            note: {
              title: 'API Design Notes',
              content: 'We should use REST for the public API and GraphQL for internal services',
              projectId: null,
              projectName: 'Backend Platform',
            },
          }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await parseCapture(
      'Note: we should use REST for public API and GraphQL for internal',
      'ws_test',
    )

    expect(result.classification).toBe('note')
    if (result.classification === 'note') {
      expect(result.note.title).toBeTruthy()
      expect(result.note.content).toBeTruthy()
    }
  })

  it('classifies message draft correctly', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            classification: 'message',
            interpretation: 'Message to Tomek about the deadline',
            message: {
              recipientName: 'Tomek',
              recipientId: null,
              channel: 'telegram',
              subject: 'Deadline Update',
              body: 'Hey Tomek, the deadline has been moved to next Friday.',
              projectId: null,
              projectName: null,
              followUpAction: null,
            },
          }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await parseCapture(
      'Send Tomek a message on telegram: the deadline moved to next Friday',
      'ws_test',
    )

    expect(result.classification).toBe('message')
    if (result.classification === 'message') {
      expect(result.message.recipientName).toBe('Tomek')
      expect(result.message.channel).toBe('telegram')
    }
  })
})

describe('Capture Execution — Note', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a note successfully', async () => {
    vi.mocked(prisma.note.create).mockResolvedValue({
      id: 'note_test',
      title: 'API Design Notes',
      content: 'REST for public, GraphQL for internal',
      workspaceId: 'ws_test',
      projectId: null,
    } as any)

    const result = await executeCapture(
      {
        classification: 'note',
        note: {
          title: 'API Design Notes',
          content: 'REST for public, GraphQL for internal',
          projectId: null,
          projectName: null,
        },
      },
      'ws_test',
      'user_test',
    )

    expect(result.classification).toBe('note')
    expect((result as any).noteId).toBe('note_test')
  })
})

describe('Capture Execution — Collaborator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates person with collaborator profile', async () => {
    // No existing person
    vi.mocked(prisma.person.findFirst).mockResolvedValue(null)

    vi.mocked(prisma.person.create).mockResolvedValue({
      id: 'person_tomek',
      name: 'Tomek',
      notes: null,
    } as any)

    vi.mocked(prisma.person.upsert).mockResolvedValue({
      id: 'person_tomek',
      name: 'Tomek',
      notes: JSON.stringify({
        _collaboratorProfile: {
          role: 'Backend Developer',
          skills: ['TypeScript'],
          strengths: ['reliable'],
          availability: 'FULL_TIME',
        },
      }),
    } as any)

    const result = await executeCapture(
      {
        classification: 'collaborator',
        collaborator: {
          name: 'Tomek',
          role: 'Backend Developer',
          skills: ['TypeScript'],
          strengths: ['reliable'],
          availability: 'FULL_TIME',
        },
      },
      'ws_test',
      'user_test',
    )

    expect(result.classification).toBe('collaborator')
    expect((result as any).personId).toBeTruthy()
  })
})
