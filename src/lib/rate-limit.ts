/**
 * In-Memory Rate Limiter
 *
 * Sliding-window counter per user.
 * Works per-process — not distributed.
 * For single-server deployment this is sufficient.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 })
 *   const { allowed, remaining, retryAfterMs } = limiter.check(userId)
 */

interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number
  /** Maximum requests per window */
  maxRequests: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

interface WindowEntry {
  timestamps: number[]
}

export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, WindowEntry>()

  // Periodic cleanup every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    const cutoff = now - config.windowMs * 2
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, 5 * 60 * 1000)

  // Allow GC if module is unloaded
  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref()
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const windowStart = now - config.windowMs

      let entry = store.get(key)
      if (!entry) {
        entry = { timestamps: [] }
        store.set(key, entry)
      }

      // Remove expired timestamps
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

      if (entry.timestamps.length >= config.maxRequests) {
        // Over limit — calculate retry time
        const oldestInWindow = entry.timestamps[0]
        const retryAfterMs = oldestInWindow + config.windowMs - now

        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(retryAfterMs, 1000),
        }
      }

      // Under limit — record this request
      entry.timestamps.push(now)

      return {
        allowed: true,
        remaining: config.maxRequests - entry.timestamps.length,
        retryAfterMs: 0,
      }
    },

    /** Reset a key (e.g., for testing) */
    reset(key: string) {
      store.delete(key)
    },

    /** Get current state size (for monitoring) */
    get size() {
      return store.size
    },
  }
}

// ─── Pre-configured limiters for Business Life OS ───

/** AI calls: 10/minute per user */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
})

/** AI calls: 50/hour per user (secondary limit) */
export const aiHourlyRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
})

/** Webhook calls: 30/minute per workspace (prevent spam) */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
})

/**
 * Check both per-minute and per-hour AI rate limits.
 * Returns the strictest result.
 */
export function checkAiRateLimit(userId: string): RateLimitResult {
  const minuteResult = aiRateLimiter.check(userId)
  if (!minuteResult.allowed) return minuteResult

  const hourResult = aiHourlyRateLimiter.check(userId)
  if (!hourResult.allowed) return hourResult

  return {
    allowed: true,
    remaining: Math.min(minuteResult.remaining, hourResult.remaining),
    retryAfterMs: 0,
  }
}
