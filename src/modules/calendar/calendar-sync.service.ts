import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/sentry'
import type {
  CalendarProvider,
  CalendarEventInput,
  ExternalCalendarEvent,
  GoogleCalendarTokens,
} from './calendar.types'
import { GoogleCalendarProvider } from './providers/google-calendar.provider'

// ─────────────────────────────────────────────
// Calendar Sync Engine
//
// Bidirectional sync between app events and external calendar providers.
// - Push: app event created/updated → push to Google/Apple Calendar
// - Pull: fetch from provider → create/update app events
// - Conflict: match by externalId, update — never duplicate
//
// Sync state persisted in CalendarSyncMap table.
// ─────────────────────────────────────────────

/**
 * Get the Google Calendar provider for a workspace.
 * Returns null if not configured.
 */
export async function getGoogleCalendarProvider(
  workspaceId: string,
): Promise<GoogleCalendarProvider | null> {
  const integration = await prisma.integration.findFirst({
    where: {
      workspaceId,
      enabled: true,
      type: 'GOOGLE_CALENDAR',
    },
  })

  const config = integration?.config as Record<string, any> | null
  if (!config?.accessToken || !config?.refreshToken) return null

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  const tokens: GoogleCalendarTokens = {
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    expiresAt: config.expiresAt ?? 0,
    calendarId: config.calendarId ?? 'primary',
  }

  return new GoogleCalendarProvider(
    tokens,
    clientId,
    clientSecret,
    async (newTokens) => {
      await prisma.integration.update({
        where: { id: integration!.id },
        data: {
          config: {
            ...config,
            accessToken: newTokens.accessToken,
            expiresAt: newTokens.expiresAt,
          },
        },
      })
    },
  )
}

// ── Sync Map (database-backed) ──

async function getSyncEntry(eventId: string, provider: 'GOOGLE_CALENDAR' | 'APPLE_CALENDAR') {
  return prisma.calendarSyncMap.findUnique({
    where: { eventId_provider: { eventId, provider } },
  })
}

async function upsertSyncEntry(eventId: string, externalId: string, provider: 'GOOGLE_CALENDAR' | 'APPLE_CALENDAR') {
  return prisma.calendarSyncMap.upsert({
    where: { eventId_provider: { eventId, provider } },
    update: { externalId, lastSyncAt: new Date(), syncError: null, syncStatus: 'SUCCESS' },
    create: { eventId, externalId, provider, syncStatus: 'SUCCESS' },
  })
}

async function deleteSyncEntry(eventId: string, provider: 'GOOGLE_CALENDAR' | 'APPLE_CALENDAR') {
  return prisma.calendarSyncMap.deleteMany({
    where: { eventId, provider },
  })
}

async function findSyncByExternalId(externalId: string, provider: 'GOOGLE_CALENDAR' | 'APPLE_CALENDAR') {
  return prisma.calendarSyncMap.findFirst({
    where: { externalId, provider },
  })
}

/**
 * Push an app event to the connected calendar provider.
 * Creates on provider if new, updates if already synced.
 */
export async function pushEventToCalendar(
  eventId: string,
  workspaceId: string,
): Promise<{ externalId: string; provider: string } | null> {
  const provider = await getGoogleCalendarProvider(workspaceId)
  if (!provider) return null

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      attendees: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  })

  if (!event) return null

  const input: CalendarEventInput = {
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt ?? new Date(event.startAt.getTime() + 60 * 60 * 1000),
    allDay: event.allDay,
    location: event.location,
    attendees: event.attendees
      .filter(a => a.user.email)
      .map(a => ({
        email: a.user.email!,
        name: a.user.name ?? undefined,
      })),
  }

  try {
    const existing = await getSyncEntry(eventId, 'GOOGLE_CALENDAR')
    if (existing) {
      await provider.updateEvent(existing.externalId, input)
      await upsertSyncEntry(eventId, existing.externalId, 'GOOGLE_CALENDAR')
      return { externalId: existing.externalId, provider: 'GOOGLE_CALENDAR' }
    }

    const result = await provider.createEvent(input)
    await upsertSyncEntry(eventId, result.externalId, 'GOOGLE_CALENDAR')

    return { externalId: result.externalId, provider: 'GOOGLE_CALENDAR' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown push error'
    console.error(`[CalendarSync] Failed to push event ${eventId}:`, message)
    captureError(err, { module: 'calendar-sync', action: 'pushEvent', eventId })
    // Record error in sync map for traceability
    try {
      await prisma.calendarSyncMap.upsert({
        where: { eventId_provider: { eventId, provider: 'GOOGLE_CALENDAR' } },
        update: { syncError: message, syncStatus: 'FAILED', lastSyncAt: new Date() },
        create: { eventId, externalId: '', provider: 'GOOGLE_CALENDAR', syncError: message, syncStatus: 'FAILED' },
      })
    } catch { /* best effort — don't mask original error */ }
    return null
  }
}

/**
 * Pull events from the connected calendar provider.
 * Creates or updates app events based on externalId matching.
 */
export async function pullEventsFromCalendar(
  workspaceId: string,
  userId: string,
  range: { start: Date; end: Date },
): Promise<{ created: number; updated: number; errors: number }> {
  const provider = await getGoogleCalendarProvider(workspaceId)
  if (!provider) return { created: 0, updated: 0, errors: 0 }

  let created = 0
  let updated = 0
  let errors = 0

  try {
    const externalEvents = await provider.fetchEvents(range)

    for (const ext of externalEvents) {
      try {
        const result = await syncExternalEvent(ext, workspaceId, userId)
        if (result === 'created') created++
        else updated++
      } catch (syncErr) {
        console.error(`[CalendarSync] Failed to sync event "${ext.title}":`, syncErr)
        captureError(syncErr, { module: 'calendar-sync', action: 'syncExternalEvent', eventTitle: ext.title })
        errors++
      }
    }
  } catch (err) {
    console.error('[CalendarSync] Failed to pull events:', err)
    captureError(err, { module: 'calendar-sync', action: 'pullEvents', workspaceId })
    errors++
  }

  return { created, updated, errors }
}

/**
 * Sync a single external event into the app.
 * Uses CalendarSyncMap for precise matching, falls back to title+startAt.
 */
async function syncExternalEvent(
  ext: ExternalCalendarEvent,
  workspaceId: string,
  userId: string,
): Promise<'created' | 'updated'> {
  // Check sync map first
  const syncEntry = await findSyncByExternalId(ext.externalId, 'GOOGLE_CALENDAR')
  if (syncEntry) {
    await prisma.event.update({
      where: { id: syncEntry.eventId },
      data: {
        title: ext.title,
        description: ext.description,
        endAt: ext.endAt,
        allDay: ext.allDay,
        location: ext.location,
      },
    })
    await upsertSyncEntry(syncEntry.eventId, ext.externalId, 'GOOGLE_CALENDAR')
    return 'updated'
  }

  // Fallback: match by title + startAt to prevent duplicates
  const existing = await prisma.event.findFirst({
    where: {
      workspaceId,
      title: ext.title,
      startAt: ext.startAt,
    },
  })

  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        title: ext.title,
        description: ext.description,
        endAt: ext.endAt,
        allDay: ext.allDay,
        location: ext.location,
      },
    })
    await upsertSyncEntry(existing.id, ext.externalId, 'GOOGLE_CALENDAR')
    return 'updated'
  }

  // Create new app event
  const event = await prisma.event.create({
    data: {
      title: ext.title,
      description: ext.description,
      startAt: ext.startAt,
      endAt: ext.endAt,
      allDay: ext.allDay,
      location: ext.location,
      workspaceId,
      creatorId: userId,
    },
  })

  await upsertSyncEntry(event.id, ext.externalId, 'GOOGLE_CALENDAR')
  return 'created'
}

/**
 * Get failed sync entries for a workspace.
 * Used by UI to surface sync failures and offer manual retry.
 */
export async function getFailedSyncEntries(
  workspaceId: string,
): Promise<Array<{ id: string; eventId: string; eventTitle: string; syncError: string; lastSyncAt: Date; retryCount: number }>> {
  // Get all events in this workspace
  const events = await prisma.event.findMany({
    where: { workspaceId },
    select: { id: true, title: true },
  })
  const eventIds = events.map(e => e.id)
  if (eventIds.length === 0) return []

  const failedEntries = await prisma.calendarSyncMap.findMany({
    where: {
      eventId: { in: eventIds },
      syncStatus: 'FAILED',
    },
    orderBy: { lastSyncAt: 'desc' },
  })

  const eventMap = new Map(events.map(e => [e.id, e.title]))

  return failedEntries.map((entry: any) => ({
    id: entry.id,
    eventId: entry.eventId,
    eventTitle: eventMap.get(entry.eventId) ?? 'Unknown event',
    syncError: entry.syncError ?? 'Unknown error',
    lastSyncAt: entry.lastSyncAt,
    retryCount: entry.retryCount ?? 0,
  }))
}

/**
 * Retry a failed sync for a specific event.
 * Increments retry count and re-attempts push.
 */
export async function retrySyncForEvent(
  eventId: string,
  workspaceId: string,
): Promise<{ success: boolean; error?: string }> {
  // Increment retry count
  const existing = await getSyncEntry(eventId, 'GOOGLE_CALENDAR')
  if (existing) {
    await prisma.calendarSyncMap.update({
      where: { id: existing.id },
      data: { retryCount: (existing.retryCount ?? 0) + 1, syncStatus: 'PENDING' },
    })
  }

  const result = await pushEventToCalendar(eventId, workspaceId)
  if (result) {
    return { success: true }
  }
  return { success: false, error: 'Push failed — check sync status for details' }
}

/**
 * Delete an event from the connected calendar provider.
 */
export async function deleteEventFromCalendar(
  eventId: string,
  workspaceId: string,
): Promise<boolean> {
  const provider = await getGoogleCalendarProvider(workspaceId)
  if (!provider) return false

  const existing = await getSyncEntry(eventId, 'GOOGLE_CALENDAR')
  if (!existing) return false

  try {
    await provider.deleteEvent(existing.externalId)
    await deleteSyncEntry(eventId, 'GOOGLE_CALENDAR')
    return true
  } catch (err) {
    console.error(`[CalendarSync] Failed to delete event ${eventId}:`, err)
    captureError(err, { module: 'calendar-sync', action: 'deleteEvent', eventId })
    return false
  }
}
