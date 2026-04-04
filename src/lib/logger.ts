// ─────────────────────────────────────────────
// Structured Logger
//
// Lightweight structured logging for server-side code.
// Outputs JSON in production, human-readable in dev.
// Drop-in replacement for console.log/warn/error.
// ─────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function formatMessage(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext,
): string {
  if (IS_PRODUCTION) {
    return JSON.stringify({
      level,
      module,
      message,
      ...context,
      timestamp: new Date().toISOString(),
    })
  }

  const prefix = `[${module}]`
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `${prefix} ${message}${contextStr}`
}

function createLogger(module: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (!IS_PRODUCTION) {
        console.debug(formatMessage('debug', module, message, context))
      }
    },

    info(message: string, context?: LogContext) {
      console.log(formatMessage('info', module, message, context))
    },

    warn(message: string, context?: LogContext) {
      console.warn(formatMessage('warn', module, message, context))
    },

    error(message: string, context?: LogContext) {
      console.error(formatMessage('error', module, message, context))
    },
  }
}

export { createLogger }
export type { LogContext, LogLevel }
