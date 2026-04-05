/**
 * Sentry Error Monitoring — STUB
 *
 * @sentry/nextjs is not yet compatible with Next.js 16.
 * All exports are no-ops until Sentry adds support.
 */

interface SentryContext {
  module?: string
  action?: string
  userId?: string
  workspaceId?: string
  [key: string]: unknown
}

export async function initSentry() {
  // no-op
}

export async function captureError(_error: unknown, _context?: SentryContext) {
  // no-op
}

export async function captureMessage(_message: string, _context?: SentryContext) {
  // no-op
}
