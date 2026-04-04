/**
 * Next.js Instrumentation Hook
 *
 * Called once when the server starts. Used to initialize
 * monitoring and other server-side singletons.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Initialize Sentry error monitoring (no-ops if SENTRY_DSN not set)
  const { initSentry } = await import('@/lib/sentry')
  await initSentry()

  // Start periodic agent session cleanup (every 5 min)
  const { startSessionCleanupInterval } = await import('@/lib/session-cleanup')
  startSessionCleanupInterval()
}
