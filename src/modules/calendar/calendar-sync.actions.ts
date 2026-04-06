'use server'

import { requireRole } from '@/lib/action-utils'
import { prisma } from '@/lib/prisma'
import {
  pushEventToCalendar,
  pullEventsFromCalendar,
  getGoogleCalendarProvider,
  getFailedSyncEntries,
  retrySyncForEvent,
} from './calendar-sync.service'
import {
  buildGoogleOAuthUrl,
  exchangeGoogleCode,
} from './providers/google-calendar.provider'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────
// Calendar Sync Actions
//
// Server actions for calendar integration management.
// Handles OAuth connection, sync triggers, and status checks.
// ─────────────────────────────────────────────

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Get the Google Calendar OAuth URL to start the connection flow.
 */
export async function getGoogleCalendarConnectUrlAction(): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await requireRole('OWNER')
    const workspaceId = session.user.workspaceId!

    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
    if (!clientId) {
      return { success: false, error: 'Google Calendar not configured. Set GOOGLE_CALENDAR_CLIENT_ID.' }
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`
    // CSRF protection: include nonce + timestamp in state
    const nonce = crypto.randomUUID()
    const state = Buffer.from(
      JSON.stringify({ workspaceId, nonce, ts: Date.now() }),
    ).toString('base64url')

    const url = buildGoogleOAuthUrl({ clientId, redirectUri, state })

    return { success: true, data: { url } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to build OAuth URL',
    }
  }
}

/**
 * Handle the Google Calendar OAuth callback.
 * Called from the API route after Google redirects back.
 */
export async function handleGoogleCalendarCallbackAction(
  code: string,
  workspaceId: string,
): Promise<ActionResult<{ connected: boolean }>> {
  try {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`

    const tokens = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })

    // Store tokens in Integration table
    await prisma.integration.upsert({
      where: {
        workspaceId_type: {
          workspaceId,
          type: 'GOOGLE_CALENDAR',
        },
      },
      update: {
        config: {
          provider: 'GOOGLE_CALENDAR',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          calendarId: tokens.calendarId,
        },
        enabled: true,
      },
      create: {
        workspaceId,
        type: 'GOOGLE_CALENDAR',
        config: {
          provider: 'GOOGLE_CALENDAR',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          calendarId: tokens.calendarId,
        },
        enabled: true,
      },
    })

    revalidatePath('/settings')

    return { success: true, data: { connected: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to connect Google Calendar',
    }
  }
}

/**
 * Check if Google Calendar is connected for the workspace.
 */
export async function getCalendarConnectionStatusAction(): Promise<
  ActionResult<{ connected: boolean; provider: string | null }>
> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const workspaceId = session.user.workspaceId!

    const provider = await getGoogleCalendarProvider(workspaceId)
    const connected = provider ? await provider.isConnected() : false

    return {
      success: true,
      data: {
        connected,
        provider: connected ? 'GOOGLE_CALENDAR' : null,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check calendar status',
    }
  }
}

/**
 * Push an app event to the connected calendar.
 * Called automatically after event creation/update.
 */
export async function pushEventToCalendarAction(
  eventId: string,
): Promise<ActionResult<{ externalId: string | null }>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const workspaceId = session.user.workspaceId!

    const result = await pushEventToCalendar(eventId, workspaceId)

    return {
      success: true,
      data: { externalId: result?.externalId ?? null },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to push event to calendar',
    }
  }
}

/**
 * Pull events from Google Calendar into the app.
 * Syncs events for the next 30 days by default.
 */
export async function pullCalendarEventsAction(
  range?: { start: string; end: string },
): Promise<ActionResult<{ created: number; updated: number; errors: number }>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const { workspaceId, id: userId } = session.user

    const dateRange = range
      ? { start: new Date(range.start), end: new Date(range.end) }
      : {
          start: new Date(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }

    const result = await pullEventsFromCalendar(workspaceId!, userId, dateRange)

    revalidatePath('/calendar')

    return { success: true, data: result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to pull calendar events',
    }
  }
}

/**
 * Get failed calendar sync entries for the workspace.
 * Surfaces sync failures so the user can retry.
 */
export async function getFailedSyncEntriesAction(): Promise<
  ActionResult<Array<{ id: string; eventId: string; eventTitle: string; syncError: string; lastSyncAt: Date; retryCount: number }>>
> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const workspaceId = session.user.workspaceId!
    const entries = await getFailedSyncEntries(workspaceId)
    return { success: true, data: entries }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get sync status',
    }
  }
}

/**
 * Manually retry syncing a failed event to the calendar.
 */
export async function retrySyncAction(
  eventId: string,
): Promise<ActionResult<{ retried: boolean }>> {
  try {
    const session = await requireRole('OWNER', 'TEAM')
    const workspaceId = session.user.workspaceId!

    const result = await retrySyncForEvent(eventId, workspaceId)
    if (!result.success) {
      return { success: false, error: result.error ?? 'Retry failed' }
    }

    revalidatePath('/calendar')
    return { success: true, data: { retried: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retry sync',
    }
  }
}

/**
 * Disconnect Google Calendar from the workspace.
 * Deletes the Integration row (tokens gone) and clears all CalendarSyncMap entries.
 */
export async function disconnectGoogleCalendarAction(): Promise<ActionResult<{ disconnected: boolean }>> {
  try {
    const session = await requireRole('OWNER')
    const workspaceId = session.user.workspaceId!

    // Find the integration to get its ID
    const integration = await prisma.integration.findFirst({
      where: {
        workspaceId,
        type: 'GOOGLE_CALENDAR',
      },
      select: { id: true },
    })

    if (integration) {
      // Get all app event IDs that have sync entries for this provider
      const syncEntries = await prisma.calendarSyncMap.findMany({
        where: { provider: 'GOOGLE_CALENDAR' },
        select: { eventId: true },
      })

      // Only delete sync entries for events belonging to this workspace
      if (syncEntries.length > 0) {
        const workspaceEventIds = await prisma.event.findMany({
          where: {
            workspaceId,
            id: { in: syncEntries.map((s: { eventId: string }) => s.eventId) },
          },
          select: { id: true },
        })
        const eventIdSet = new Set(workspaceEventIds.map(e => e.id))

        if (eventIdSet.size > 0) {
          await prisma.calendarSyncMap.deleteMany({
            where: {
              provider: 'GOOGLE_CALENDAR',
              eventId: { in: Array.from(eventIdSet) },
            },
          })
        }
      }

      // Delete the integration row entirely — tokens gone
      await prisma.integration.delete({
        where: { id: integration.id },
      })
    }

    revalidatePath('/settings')
    revalidatePath('/calendar')

    return { success: true, data: { disconnected: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to disconnect Google Calendar',
    }
  }
}
