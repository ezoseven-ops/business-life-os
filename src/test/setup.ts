/**
 * Vitest global test setup.
 *
 * Mocks external dependencies (Prisma, OpenAI, Auth)
 * so unit tests run without real database or API connections.
 */
import { vi } from 'vitest'

// ── Mock Prisma ──
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'proj_test', name: 'Test' }),
      update: vi.fn(),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'task_test', title: 'Test', projectId: 'proj_test' }),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'evt_test', title: 'Test', workspaceId: 'ws_test' }),
      update: vi.fn(),
    },
    note: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'note_test', title: 'Test', workspaceId: 'ws_test' }),
      update: vi.fn(),
    },
    person: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'person_test', name: 'Test Person' }),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    projectMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    agentSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    activity: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    integration: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    calendarSyncMap: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}))

// ── Mock OpenAI ──
vi.mock('@/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({ isCommand: false }),
            },
          }],
        }),
      },
    },
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Test transcription' }),
      },
    },
  },
}))

// ── Mock Auth ──
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'user_test',
      email: 'test@example.com',
      name: 'Test User',
      role: 'OWNER',
      workspaceId: 'ws_test',
    },
  }),
}))

// ── Mock Logger (no-op) ──
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ── Mock Sentry (no-op) ──
vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}))

// ── Mock Rate Limit (always allow) ──
vi.mock('@/lib/rate-limit', () => ({
  checkAiRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  aiRateLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterMs: 0 }) },
  aiHourlyRateLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 50, retryAfterMs: 0 }) },
  webhookRateLimiter: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 30, retryAfterMs: 0 }) },
}))
