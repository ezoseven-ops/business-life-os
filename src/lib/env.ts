// ─────────────────────────────────────────────
// Environment Variable Validation
//
// Validates required env vars at startup.
// Throws early if critical vars are missing.
// Optional vars are documented but not enforced.
// ─────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] || fallback
}

/** Validated environment — access these instead of process.env directly */
export const env = {
  // Database (required)
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Auth (required)
  AUTH_SECRET: requireEnv('AUTH_SECRET'),
  AUTH_URL: optionalEnv('AUTH_URL', 'http://localhost:3000'),

  // Google OAuth (optional — features degrade gracefully)
  GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET'),

  // Email (optional)
  RESEND_API_KEY: optionalEnv('RESEND_API_KEY'),
  EMAIL_FROM: optionalEnv('EMAIL_FROM', 'noreply@businesslifeos.com'),

  // File Storage (optional)
  R2_ACCOUNT_ID: optionalEnv('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: optionalEnv('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: optionalEnv('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: optionalEnv('R2_BUCKET_NAME', 'blos-files'),
  R2_PUBLIC_URL: optionalEnv('R2_PUBLIC_URL'),

  // AI (optional — AI features disabled without it)
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY'),

  // Messaging (optional)
  TELEGRAM_WEBHOOK_SECRET: optionalEnv('TELEGRAM_WEBHOOK_SECRET'),
  WHATSAPP_VERIFY_TOKEN: optionalEnv('WHATSAPP_VERIFY_TOKEN'),
  WHATSAPP_APP_SECRET: optionalEnv('WHATSAPP_APP_SECRET'),

  // Google Calendar (optional)
  GOOGLE_CALENDAR_CLIENT_ID: optionalEnv('GOOGLE_CALENDAR_CLIENT_ID'),
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),

  // Sentry (optional)
  SENTRY_DSN: optionalEnv('SENTRY_DSN'),

  // App
  NEXT_PUBLIC_APP_URL: optionalEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),

  /** Helper: is production environment */
  get isProduction() {
    return this.NODE_ENV === 'production'
  },

  /** Helper: is Google Calendar configured */
  get hasGoogleCalendar() {
    return !!(this.GOOGLE_CALENDAR_CLIENT_ID && this.GOOGLE_CALENDAR_CLIENT_SECRET)
  },

  /** Helper: is Google OAuth configured */
  get hasGoogleOAuth() {
    return !!(this.GOOGLE_CLIENT_ID && this.GOOGLE_CLIENT_SECRET)
  },

  /** Helper: is OpenAI configured */
  get hasOpenAI() {
    return !!this.OPENAI_API_KEY
  },
}
