/**
 * Command Service Tests
 *
 * Tests command classification and execution for critical intents:
 * create_task, update_task, create_event, update_event
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'

// Must import AFTER mocks are set up by setup.ts
import { classifyInput, executeCommand } from './command.service'

describe('Command Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('classifies "create task" input as command', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            isCommand: true,
            isMultiStep: false,
            interpretation: 'Create task: Write homepage copy',
            command: {
              intent: 'create_task',
              title: 'Write homepage copy',
              priority: 'MEDIUM',
              projectId: null,
              projectName: 'Marketing',
              assigneeName: null,
              assigneeId: null,
              dueDate: null,
            },
          }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await classifyInput('create task Write homepage copy in Marketing', 'ws_test')

    expect(result.isCommand).toBe(true)
    if (result.isCommand && !result.isMultiStep) {
      expect(result.command.intent).toBe('create_task')
      expect(result.command.title).toBe('Write homepage copy')
    }
  })

  it('classifies non-command input as capture', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({ isCommand: false }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await classifyInput('I just had a meeting with the investors about funding', 'ws_test')

    expect(result.isCommand).toBe(false)
  })

  it('classifies multi-step input correctly', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            isCommand: true,
            isMultiStep: true,
            interpretation: 'Create task and assign',
            commands: [
              { intent: 'create_task', title: 'Review PR', priority: 'HIGH', projectId: null, projectName: null, assigneeName: null, assigneeId: null, dueDate: null },
              { intent: 'assign_task', taskTitle: 'Review PR', taskId: null, assigneeName: 'Tomek', assigneeId: null },
            ],
          }),
        },
      }],
    }
    vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse as any)

    const result = await classifyInput('create task Review PR and assign to Tomek', 'ws_test')

    expect(result.isCommand).toBe(true)
    if (result.isCommand && result.isMultiStep) {
      expect(result.commands).toHaveLength(2)
      expect(result.commands[0].intent).toBe('create_task')
      expect(result.commands[1].intent).toBe('assign_task')
    }
  })
})

describe('Command Execution — create_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a task with resolved project', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_marketing',
      name: 'Marketing',
      workspaceId: 'ws_test',
    } as any)

    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task_new',
      title: 'Write copy',
      projectId: 'proj_marketing',
      status: 'TODO',
      priority: 'MEDIUM',
    } as any)

    const result = await executeCommand(
      {
        intent: 'create_task',
        title: 'Write copy',
        priority: 'MEDIUM',
        projectId: null,
        projectName: 'Marketing',
        assigneeName: null,
        assigneeId: null,
        dueDate: null,
      },
      'ws_test',
      'user_test',
    )

    expect(result.intent).toBe('create_task')
    expect((result as any).taskId).toBe('task_new')
    expect((result as any).projectId).toBe('proj_marketing')
  })

  it('creates Inbox project when no project specified', async () => {
    // No existing project
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null)

    // Create Inbox project
    vi.mocked(prisma.project.create).mockResolvedValue({
      id: 'proj_inbox',
      name: 'Inbox',
      workspaceId: 'ws_test',
    } as any)

    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task_inbox',
      title: 'Quick task',
      projectId: 'proj_inbox',
    } as any)

    const result = await executeCommand(
      {
        intent: 'create_task',
        title: 'Quick task',
        priority: 'LOW',
        projectId: null,
        projectName: null,
        assigneeName: null,
        assigneeId: null,
        dueDate: null,
      },
      'ws_test',
      'user_test',
    )

    expect(result.intent).toBe('create_task')
  })
})

describe('Command Execution — update_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates task priority only', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_123',
      title: 'API integration',
      projectId: 'proj_1',
      status: 'TODO',
      priority: 'MEDIUM',
    } as any)

    vi.mocked(prisma.task.update).mockResolvedValue({
      id: 'task_123',
      title: 'API integration',
      priority: 'URGENT',
    } as any)

    const result = await executeCommand(
      {
        intent: 'update_task',
        taskTitle: 'API integration',
        taskId: null,
        priority: 'URGENT',
      } as any,
      'ws_test',
      'user_test',
    )

    expect(result.intent).toBe('update_task')
    expect((result as any).updatedFields).toContain('priority')
  })

  it('rejects update with no fields to change', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue({
      id: 'task_123',
      title: 'API integration',
    } as any)

    await expect(
      executeCommand(
        {
          intent: 'update_task',
          taskTitle: 'API integration',
          taskId: null,
        } as any,
        'ws_test',
        'user_test',
      ),
    ).rejects.toThrow()
  })
})

describe('Command Execution — create_event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an event with start and auto-end', async () => {
    vi.mocked(prisma.event.create).mockResolvedValue({
      id: 'evt_new',
      title: 'Team Standup',
      startAt: new Date('2026-04-05T10:00:00Z'),
      endAt: new Date('2026-04-05T11:00:00Z'),
    } as any)

    const result = await executeCommand(
      {
        intent: 'create_event',
        title: 'Team Standup',
        startAt: '2026-04-05T10:00:00Z',
        endAt: null,
        location: null,
        attendeeNames: [],
        projectId: null,
        projectName: null,
      },
      'ws_test',
      'user_test',
    )

    expect(result.intent).toBe('create_event')
    expect((result as any).eventId).toBe('evt_new')
  })
})

describe('Command Execution — update_event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates event location only', async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: 'evt_123',
      title: 'Board Meeting',
      startAt: new Date('2026-04-10T14:00:00Z'),
      endAt: new Date('2026-04-10T15:00:00Z'),
      workspaceId: 'ws_test',
    } as any)

    vi.mocked(prisma.event.update).mockResolvedValue({
      id: 'evt_123',
      location: 'Room 4B',
    } as any)

    const result = await executeCommand(
      {
        intent: 'update_event',
        eventTitle: 'Board Meeting',
        eventId: null,
        location: 'Room 4B',
      } as any,
      'ws_test',
      'user_test',
    )

    expect(result.intent).toBe('update_event')
    expect((result as any).updatedFields).toContain('location')
  })
})
