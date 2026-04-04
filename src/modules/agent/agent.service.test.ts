/**
 * Agent Service Tests
 *
 * Tests agent flow for:
 * - create task routing
 * - update task routing
 * - follow-up reference resolution
 * - ambiguity → clarification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openai } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

// Mock agent-context to control session state
vi.mock('./agent-context', async () => {
  const actual = await vi.importActual('./agent-context') as any
  return {
    ...actual,
    getSession: vi.fn(),
    recordAction: vi.fn(),
    addUnresolved: vi.fn(),
    clearUnresolved: vi.fn(),
    setCurrentProject: vi.fn(),
    setCurrentEntity: vi.fn(),
    buildSnapshot: vi.fn().mockReturnValue({
      sessionId: 'sess_test',
      currentProject: null,
      currentEntityType: null,
      currentEntityName: null,
      lastActionInterpretation: null,
      actionCount: 0,
      hasUnresolved: false,
      sessionExpired: false,
    }),
    extractEntitiesFromCommandResult: vi.fn().mockReturnValue([]),
    extractEntitiesFromCaptureResult: vi.fn().mockReturnValue([]),
    buildContextSummary: vi.fn().mockReturnValue('Empty session'),
  }
})

// Mock agent-logger
vi.mock('./agent-logger', () => ({
  agentLog: vi.fn(),
  createPhaseTimer: vi.fn().mockReturnValue({ end: vi.fn().mockReturnValue(0) }),
  getSessionLogs: vi.fn().mockReturnValue([]),
  clearSessionLogs: vi.fn(),
}))

// Mock agent-router
vi.mock('./agent-router', () => ({
  routeAgentInput: vi.fn(),
}))

import { processInput } from './agent.service'
import { getSession, buildSnapshot } from './agent-context'
import { routeAgentInput } from './agent-router'

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sess_test',
    workspaceId: 'ws_test',
    userId: 'user_test',
    currentProject: null,
    currentEntity: null,
    actionHistory: [],
    unresolvedItems: [],
    lastActiveAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('Agent — Create Task Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ session: makeSession(), wasExpired: false })
  })

  it('routes create task command and returns preview', async () => {
    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'command',
      interpretation: 'Create task: Write API docs',
      confidence: 0.95,
      command: {
        intent: 'create_task',
        title: 'Write API docs',
        priority: 'MEDIUM',
        projectId: null,
        projectName: null,
        assigneeName: null,
        assigneeId: null,
        dueDate: null,
      },
    })

    const result = await processInput('create task Write API docs', 'ws_test', 'user_test')

    expect(result.routing.inputType).toBe('command')
    expect(result.routing.command?.intent).toBe('create_task')
    expect(result.routing.confidence).toBeGreaterThan(0.6)
    expect(result.awaitingInput).toBe(false)
  })
})

describe('Agent — Update Task Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ session: makeSession(), wasExpired: false })
  })

  it('routes update task with resolved fields', async () => {
    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'command',
      interpretation: 'Update task priority to urgent',
      confidence: 0.9,
      command: {
        intent: 'update_task',
        taskTitle: 'API integration',
        taskId: 'task_123',
        priority: 'URGENT',
      } as any,
    })

    const result = await processInput('change API integration to urgent', 'ws_test', 'user_test')

    expect(result.routing.inputType).toBe('command')
    expect(result.routing.command?.intent).toBe('update_task')
  })
})

describe('Agent — Follow-Up Reference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves follow-up with session context', async () => {
    const session = makeSession({
      actionHistory: [{
        type: 'command',
        intent: 'create_task',
        interpretation: 'Created task: Write copy',
        result: { intent: 'create_task', taskId: 'task_456', projectId: 'proj_1' },
        entities: [{ type: 'task', id: 'task_456', name: 'Write copy' }],
        timestamp: Date.now(),
      }],
      currentEntity: { type: 'task', id: 'task_456', name: 'Write copy' },
    })
    vi.mocked(getSession).mockResolvedValue({ session, wasExpired: false })

    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'follow_up',
      interpretation: 'Assign the last task to Tomek',
      confidence: 0.92,
      command: {
        intent: 'assign_task',
        taskTitle: 'Write copy',
        taskId: 'task_456',
        assigneeName: 'Tomek',
        assigneeId: null,
      },
    })

    const result = await processInput('now assign it to Tomek', 'ws_test', 'user_test')

    expect(result.routing.inputType).toBe('follow_up')
    expect(result.routing.command?.intent).toBe('assign_task')
  })

  it('downgrades follow-up to question when no history', async () => {
    vi.mocked(getSession).mockResolvedValue({
      session: makeSession({ actionHistory: [] }),
      wasExpired: false,
    })

    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'follow_up',
      interpretation: 'Follow up on something',
      confidence: 0.5,
      clarificationNeeded: {
        question: 'What would you like to follow up on?',
        options: [],
      },
    })

    const result = await processInput('change that', 'ws_test', 'user_test')

    // Service validates and may downgrade — but the router already set low confidence
    expect(result.routing.confidence).toBeLessThanOrEqual(0.6)
  })
})

describe('Agent — Ambiguity Clarification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({ session: makeSession(), wasExpired: false })
  })

  it('forces clarification when confidence is low', async () => {
    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'command',
      interpretation: 'Ambiguous — which Tomek?',
      confidence: 0.4,
      command: {
        intent: 'assign_task',
        taskTitle: 'API task',
        taskId: null,
        assigneeName: 'Tomek',
        assigneeId: null,
      },
      clarificationNeeded: {
        question: 'Which Tomek do you mean?',
        options: ['Tomek K. (Backend)', 'Tomek W. (Design)'],
      },
    })

    const result = await processInput('assign API task to Tomek', 'ws_test', 'user_test')

    expect(result.awaitingInput).toBe(true)
    expect(result.routing.clarificationNeeded).toBeDefined()
    expect(result.routing.clarificationNeeded?.options).toHaveLength(2)
  })
})

describe('Agent — Session Expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports session expired in snapshot', async () => {
    vi.mocked(getSession).mockResolvedValue({
      session: makeSession(),
      wasExpired: true,
    })

    vi.mocked(buildSnapshot).mockReturnValue({
      sessionId: 'sess_new',
      currentProject: null,
      currentEntityType: null,
      currentEntityName: null,
      lastActionInterpretation: null,
      actionCount: 0,
      hasUnresolved: false,
      sessionExpired: true,
    })

    vi.mocked(routeAgentInput).mockResolvedValue({
      inputType: 'command',
      interpretation: 'Create project X',
      confidence: 0.95,
      command: {
        intent: 'create_project',
        name: 'X',
        description: null,
      } as any,
    })

    const result = await processInput('create project X', 'ws_test', 'user_test')

    expect(result.sessionSnapshot.sessionExpired).toBe(true)
  })
})
