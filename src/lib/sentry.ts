/**
 * Sentry Error Monitoring
 *
 * Lightweight wrapper around @sentry/nextjs.
 * Only initializes if SENTRY_DSN is configured.
 * Safe to import anywhere — no-ops if Sentry is not configured.
 */
import { env } from '@/lib/env'

let sentryInitialized = false

interface SentryContext {
  module?: string
  action?: string
  userId?: string
  workspaceId?: string
  [key: string]: unknown
}

/**
 * Initialize Sentry. Call once at app startup.
 * No-ops if SENTRY_DSN is not set.
 */
export async function initSentry() {
  if (sentryInitialized || !env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.isProduction ? 0.1 : 1.0,
      // Don't send PII
      sendDefaultPii: false,
      // Ignore common non-actionable errors
      ignoreErrors: [
        'NEXT_NOT_FOUND',
        'NEXT_REDIRECT',
        'AbortError',
        'cancelled',
      ],
    })
    sentryInitialized = true
  } catch {
    // Sentry package not available — silent no-op
  }
}

/**
 * Capture an error with contextual tags.
 * No-ops if Sentry is not initialized.
 */
export async function captureError(error: unknown, context?: SentryContext) {
  if (!sentryInitialized) return

  try {
    const Sentry = await import('@sentry/nextjs')

    Sentry.withScope((scope) => {
      if (context?.module) scope.setTag('module', context.module)
      if (context?.action) scope.setTag('action', context.action)
      if (context?.userId) scope.setUser({ id: context.userId })
      if (context?.workspaceId) scope.setTag('workspaceId', context.workspaceId)

      // Add extra context data
      const extras = { ...context }
      delete extras.module
      delete extras.action
      delete extras.userId
      delete extras.workspaceId
      if (Object.keys(extras).length > 0) {
        scope.setExtras(extras)
      }

      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(String(error), 'error')
      }
    })
  } catch {
    // Sentry not available — silent
  }
}

/**
 * Capture a message (non-error) with context.
 */
export async function captureMessage(message: string, context?: SentryContext) {
  if (!sentryInitialized) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.withScope((scope) => {
      if (context?.module) scope.setTag('module', context.module)
      if (context?.action) scope.setTag('action', context.action)
      if (context?.userId) scope.setUser({ id: context.userId })
      scope.setLevel('warning')
      Sentry.captureMessage(message)
    })
  } catch {
    // silent
  }
}
