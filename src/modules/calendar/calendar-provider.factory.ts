import { prisma } from '@/lib/prisma'
import type { CalendarProvider, CalendarProviderType } from './calendar.types'
import { GoogleCalendarProvider } from './providers/google-calendar.provider'
import { createAppleCalendarProvider } from './providers/apple-calendar.provider'
import type { GoogleCalendarTokens } from './calendar.types'

// ─────────────────────────────────────────────
// Calendar Provider Factory
//
// Registry pattern for calendar providers.
// Resolves the appropriate provider for a workspace.
// Supports multiple providers per workspace (future).
// ─────────────────────────────────────────────

/**
 * Get all connected calendar providers for a workspace.
 */
export async function getCalendarProviders(
  workspaceId: string,
): Promise<CalendarProvider[]> {
  const integrations = await prisma.integration.findMany({
    where: {
      workspaceId,
      enabled: true,
      // Calendar-related integrations
      type: { in: ['APPLE_CALENDAR', 'GOOGLE_CALENDAR'] },
    },
  })

  const providers: CalendarProvider[] = []

  for (const integration of integrations) {
    const config = integration.config as Record<string, any>
    if (!config) continue

    // Google Calendar
    if (config.provider === 'GOOGLE_CALENDAR') {
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
      const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
      if (clientId && clientSecret) {
        const tokens: GoogleCalendarTokens = {
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
          expiresAt: config.expiresAt ?? 0,
          calendarId: config.calendarId ?? 'primary',
        }
        providers.push(
          new GoogleCalendarProvider(tokens, clientId, clientSecret, async (newTokens) => {
            await prisma.integration.update({
              where: { id: integration.id },
              data: {
                config: {
                  ...config,
                  accessToken: newTokens.accessToken,
                  expiresAt: newTokens.expiresAt,
                },
              },
            })
          }),
        )
      }
    }

    // Apple Calendar (CalDAV)
    if (config.provider === 'APPLE_CALENDAR') {
      const appleProvider = createAppleCalendarProvider(config)
      if (appleProvider) {
        providers.push(appleProvider)
      }
    }
  }

  return providers
}

/**
 * Get a specific provider by type for a workspace.
 */
export async function getCalendarProvider(
  workspaceId: string,
  type: CalendarProviderType,
): Promise<CalendarProvider | null> {
  const providers = await getCalendarProviders(workspaceId)
  return providers.find(p => p.type === type) ?? null
}

/**
 * Push an event to ALL connected calendar providers.
 * Returns results per provider.
 */
export async function pushEventToAllProviders(
  workspaceId: string,
  input: {
    title: string
    description?: string | null
    startAt: Date
    endAt: Date
    allDay?: boolean
    location?: string | null
    attendees?: Array<{ email: string; name?: string }>
  },
): Promise<Array<{ provider: CalendarProviderType; externalId: string | null; error: string | null }>> {
  const providers = await getCalendarProviders(workspaceId)
  const results: Array<{ provider: CalendarProviderType; externalId: string | null; error: string | null }> = []

  for (const provider of providers) {
    try {
      const result = await provider.createEvent(input)
      results.push({ provider: provider.type, externalId: result.externalId, error: null })
    } catch (err) {
      results.push({
        provider: provider.type,
        externalId: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return results
}
