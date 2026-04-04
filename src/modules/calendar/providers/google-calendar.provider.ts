import type {
  CalendarProvider,
  ExternalCalendarEvent,
  CalendarEventInput,
  GoogleCalendarTokens,
} from '../calendar.types'

// ─────────────────────────────────────────────
// Google Calendar Provider
//
// Implements bidirectional sync via Google Calendar REST API.
// Uses OAuth2 with refresh tokens stored in Integration table.
// No external dependencies — pure fetch() calls.
// ─────────────────────────────────────────────

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export class GoogleCalendarProvider implements CalendarProvider {
  readonly type = 'GOOGLE_CALENDAR' as const

  private tokens: GoogleCalendarTokens
  private clientId: string
  private clientSecret: string
  private onTokenRefresh: (tokens: GoogleCalendarTokens) => Promise<void>

  constructor(
    tokens: GoogleCalendarTokens,
    clientId: string,
    clientSecret: string,
    onTokenRefresh: (tokens: GoogleCalendarTokens) => Promise<void>,
  ) {
    this.tokens = tokens
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.onTokenRefresh = onTokenRefresh
  }

  // ── Auth ──

  private async getAccessToken(): Promise<string> {
    // If token is still valid (with 5min buffer), use it
    if (this.tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.tokens.accessToken
    }

    // Refresh the token
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to refresh Google token: ${res.statusText}`)
    }

    const data = await res.json()

    this.tokens = {
      ...this.tokens,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    // Persist refreshed tokens
    await this.onTokenRefresh(this.tokens)

    return this.tokens.accessToken
  }

  private async apiRequest(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = await this.getAccessToken()
    const calendarId = this.tokens.calendarId || 'primary'
    const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}${path}`

    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  // ── CalendarProvider interface ──

  async isConnected(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      const res = await fetch(`${GOOGLE_API_BASE}/calendars/primary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    } catch {
      return false
    }
  }

  async fetchEvents(range: { start: Date; end: Date }): Promise<ExternalCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })

    const res = await this.apiRequest(`/events?${params}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch Google events: ${res.statusText}`)
    }

    const data = await res.json()
    const items: any[] = data.items || []

    return items.map((item): ExternalCalendarEvent => ({
      externalId: item.id,
      title: item.summary || '(No title)',
      description: item.description || null,
      startAt: new Date(item.start?.dateTime || item.start?.date),
      endAt: new Date(item.end?.dateTime || item.end?.date),
      allDay: !!item.start?.date,
      location: item.location || null,
      attendees: (item.attendees || []).map((a: any) => ({
        email: a.email,
        name: a.displayName || null,
        status: a.responseStatus || 'needsAction',
      })),
      raw: item,
    }))
  }

  async createEvent(input: CalendarEventInput): Promise<{ externalId: string }> {
    const body = this.toGoogleEvent(input)

    const res = await this.apiRequest('/events', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to create Google event: ${errText}`)
    }

    const data = await res.json()
    return { externalId: data.id }
  }

  async updateEvent(externalId: string, input: CalendarEventInput): Promise<void> {
    const body = this.toGoogleEvent(input)

    const res = await this.apiRequest(`/events/${externalId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Failed to update Google event: ${errText}`)
    }
  }

  async deleteEvent(externalId: string): Promise<void> {
    const res = await this.apiRequest(`/events/${externalId}`, {
      method: 'DELETE',
    })

    if (!res.ok && res.status !== 410) {
      throw new Error(`Failed to delete Google event: ${res.statusText}`)
    }
  }

  // ── Helpers ──

  private toGoogleEvent(input: CalendarEventInput): Record<string, any> {
    const event: Record<string, any> = {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
    }

    if (input.allDay) {
      // All-day events use date format YYYY-MM-DD
      event.start = { date: input.startAt.toISOString().split('T')[0] }
      event.end = { date: input.endAt.toISOString().split('T')[0] }
    } else {
      event.start = { dateTime: input.startAt.toISOString() }
      event.end = { dateTime: input.endAt.toISOString() }
    }

    if (input.attendees?.length) {
      event.attendees = input.attendees.map(a => ({
        email: a.email,
        displayName: a.name,
      }))
    }

    return event
  }
}

// ─────────────────────────────────────────────
// OAuth Helpers
// ─────────────────────────────────────────────

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

/**
 * Build the Google OAuth authorization URL.
 * Redirect the user here to connect their Google Calendar.
 */
export function buildGoogleOAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string // workspace ID + CSRF token
}): string {
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', params.state)
  return url.toString()
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeGoogleCode(params: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleCalendarTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google token exchange failed: ${errText}`)
  }

  const data = await res.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    calendarId: 'primary',
  }
}
