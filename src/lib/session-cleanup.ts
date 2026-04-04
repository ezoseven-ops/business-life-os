/**
 * Agent Session Cleanup
 *
 * Periodically removes expired agent sessions from the database.
 * Uses a simple interval with throttle guard to prevent overlapping runs.
 *
 * Call `startSessionCleanupInterval()` once at server startup
 * (from instrumentation.ts). Safe to call multiple times — only
 * the first call starts the interval.
 */

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
let intervalHandle: ReturnType<typeof setInterval> | null = null
let isRunning = false
let lastCleanupAt = 0

/**
 * Start the periodic session cleanup.
 * No-ops if already started.
 */
export function startSessionCleanupInterval(): void {
  if (intervalHandle) return

  // Run once immediately after a short delay (let server finish starting)
  setTimeout(() => runCleanup(), 10_000)

  intervalHandle = setInterval(() => runCleanup(), CLEANUP_INTERVAL_MS)

  // Don't prevent process exit
  if (intervalHandle && typeof intervalHandle === 'object' && 'unref' in intervalHandle) {
    intervalHandle.unref()
  }
}

/**
 * Run cleanup once. Throttled: skips if already running or ran recently.
 * Safe to call from health checks or other triggers.
 */
export async function runCleanup(): Promise<number> {
  // Throttle: don't run more than once per minute
  if (isRunning || Date.now() - lastCleanupAt < 60_000) return 0

  isRunning = true
  try {
    // Dynamic import to avoid pulling Prisma into edge contexts
    const { cleanupExpiredSessions } = await import('@/modules/agent/agent-context')
    const deleted = await cleanupExpiredSessions()
    lastCleanupAt = Date.now()
    if (deleted > 0) {
      console.log(`[SessionCleanup] Removed ${deleted} expired sessions`)
    }
    return deleted
  } catch (err) {
    console.error('[SessionCleanup] Failed:', err)
    return 0
  } finally {
    isRunning = false
  }
}
