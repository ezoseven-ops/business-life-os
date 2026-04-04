// ─────────────────────────────────────────────
// Calendar Provider Abstraction
//
// Unified interface for calendar providers:
// - Google Calendar (OAuth + REST API)
// - Apple Calendar (CalDAV — future)
// - Internal events (Prisma Event model)
//
// Bidirectional sync: app ↔ provider
// Conflict handling: update, don't duplicate
// ─────────────────────────────────────────────

export type CalendarProviderType = 'GOOGLE_CALENDAR' | 'APPLE_CALENDAR'

/** A calendar event in the provider's format, normalized */
export interface ExternalCalendarEvent {
  externalId: string
  title: string
  description: string | null
  startAt: Date
  endAt: Date
  allDay: boolean
  location: string | null
  attendees: Array<{
    email: string
    name: string | null
    status: 'accepted' | 'declined' | 'tentative' | 'needsAction'
  }>
  /** Provider-specific metadata */
  raw?: unknown
}

/** Input for creating/updating events on the provider */
export interface CalendarEventInput {
  title: string
  description?: string | null
  startAt: Date
  endAt: Date
  allDay?: boolean
  location?: string | null
  attendees?: Array<{ email: string; name?: string }>
}

/** Sync status for an event */
export interface CalendarSyncStatus {
  eventId: string
  externalId: string | null
  provider: CalendarProviderType
  lastSyncedAt: Date | null
  syncError: string | null
}

/** OAuth tokens stored in Integration.config */
export interface GoogleCalendarTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp ms
  calendarId: string // Usually 'primary'
}

/** CalDAV credentials stored in Integration.config */
export interface AppleCalendarConfig {
  serverUrl: string
  username: string
  password: string // App-specific password
  calendarPath: string
}

/**
 * Calendar Provider Interface
 *
 * All providers implement this interface for unified sync.
 * The sync engine calls these methods regardless of provider type.
 */
export interface CalendarProvider {
  readonly type: CalendarProviderType

  /** Check if the provider is properly configured and tokens are valid */
  isConnected(): Promise<boolean>

  /** Fetch events from the provider within a date range */
  fetchEvents(range: { start: Date; end: Date }): Promise<ExternalCalendarEvent[]>

  /** Push a new event to the provider. Returns external ID. */
  createEvent(input: CalendarEventInput): Promise<{ externalId: string }>

  /** Update an existing event on the provider */
  updateEvent(externalId: string, input: CalendarEventInput): Promise<void>

  /** Delete an event from the provider */
  deleteEvent(externalId: string): Promise<void>
}
