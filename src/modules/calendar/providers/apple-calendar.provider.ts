import type {
  CalendarProvider,
  ExternalCalendarEvent,
  CalendarEventInput,
  AppleCalendarConfig,
} from '../calendar.types'

// ─────────────────────────────────────────────
// Apple Calendar Provider (CalDAV)
//
// Real CalDAV implementation for Apple iCloud Calendar.
// Uses PROPFIND, REPORT, PUT, DELETE over HTTP.
//
// Apple iCloud CalDAV endpoint:
// https://caldav.icloud.com/{userId}/calendars/{calendarName}/
//
// Authentication: Basic auth with app-specific password.
// Data format: iCalendar (RFC 5545)
// ─────────────────────────────────────────────

export class AppleCalendarProvider implements CalendarProvider {
  readonly type = 'APPLE_CALENDAR' as const

  private config: AppleCalendarConfig
  private authHeader: string

  constructor(config: AppleCalendarConfig) {
    this.config = config
    this.authHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
  }

  private get calendarUrl(): string {
    const base = this.config.serverUrl.replace(/\/$/, '')
    const path = this.config.calendarPath.replace(/^\//, '').replace(/\/$/, '')
    return path ? `${base}/${path}/` : `${base}/`
  }

  private async caldavRequest(
    method: string,
    url: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/xml; charset=utf-8',
      ...extraHeaders,
    }

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body).toString()
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body || undefined,
    })

    return response
  }

  async isConnected(): Promise<boolean> {
    if (!this.config.serverUrl || !this.config.username || !this.config.password) {
      return false
    }

    try {
      // PROPFIND on calendar root to verify credentials
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`

      const response = await this.caldavRequest('PROPFIND', this.calendarUrl, body, {
        Depth: '0',
      })

      return response.status === 207 // Multi-Status
    } catch (err) {
      console.error('[AppleCalendar] Connection check failed:', err)
      return false
    }
  }

  async fetchEvents(range: { start: Date; end: Date }): Promise<ExternalCalendarEvent[]> {
    const startStr = toICalDate(range.start)
    const endStr = toICalDate(range.end)

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startStr}" end="${endStr}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`

    try {
      const response = await this.caldavRequest('REPORT', this.calendarUrl, body, {
        Depth: '1',
      })

      if (response.status !== 207) {
        console.error('[AppleCalendar] fetchEvents failed with status:', response.status)
        return []
      }

      const xml = await response.text()
      return parseCalendarMultiget(xml)
    } catch (err) {
      console.error('[AppleCalendar] fetchEvents error:', err)
      return []
    }
  }

  async createEvent(input: CalendarEventInput): Promise<{ externalId: string }> {
    const uid = generateUID()
    const ical = buildVCalendar(uid, input)
    const eventUrl = `${this.calendarUrl}${uid}.ics`

    const response = await this.caldavRequest('PUT', eventUrl, ical, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'If-None-Match': '*', // Only create, don't overwrite
    })

    if (response.status !== 201 && response.status !== 204) {
      throw new Error(`Apple Calendar create failed: ${response.status} ${response.statusText}`)
    }

    return { externalId: uid }
  }

  async updateEvent(externalId: string, input: CalendarEventInput): Promise<void> {
    const ical = buildVCalendar(externalId, input)
    const eventUrl = `${this.calendarUrl}${externalId}.ics`

    const response = await this.caldavRequest('PUT', eventUrl, ical, {
      'Content-Type': 'text/calendar; charset=utf-8',
    })

    if (response.status !== 204 && response.status !== 201) {
      throw new Error(`Apple Calendar update failed: ${response.status} ${response.statusText}`)
    }
  }

  async deleteEvent(externalId: string): Promise<void> {
    const eventUrl = `${this.calendarUrl}${externalId}.ics`

    const response = await this.caldavRequest('DELETE', eventUrl)

    if (response.status !== 204 && response.status !== 200 && response.status !== 404) {
      throw new Error(`Apple Calendar delete failed: ${response.status} ${response.statusText}`)
    }
  }
}

// ─── iCalendar Helpers ───

function generateUID(): string {
  const hex = () => Math.random().toString(16).substring(2, 10)
  return `${hex()}-${hex()}-${hex()}-${hex()}@blos`
}

function toICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function toICalDateValue(date: Date, allDay?: boolean): string {
  if (allDay) {
    return date.toISOString().split('T')[0].replace(/-/g, '')
  }
  return toICalDate(date)
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function buildVCalendar(uid: string, input: CalendarEventInput): string {
  const now = toICalDate(new Date())
  const dtStart = toICalDateValue(input.startAt, input.allDay)
  const dtEnd = toICalDateValue(input.endAt, input.allDay)

  let vevent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BusinessLifeOS//BLOS//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART${input.allDay ? ';VALUE=DATE' : ''}:${dtStart}
DTEND${input.allDay ? ';VALUE=DATE' : ''}:${dtEnd}
SUMMARY:${escapeICalText(input.title)}`

  if (input.description) {
    vevent += `\nDESCRIPTION:${escapeICalText(input.description)}`
  }

  if (input.location) {
    vevent += `\nLOCATION:${escapeICalText(input.location)}`
  }

  if (input.attendees) {
    for (const attendee of input.attendees) {
      const cn = attendee.name ? `;CN=${escapeICalText(attendee.name)}` : ''
      vevent += `\nATTENDEE${cn}:mailto:${attendee.email}`
    }
  }

  vevent += `\nEND:VEVENT
END:VCALENDAR`

  return vevent
}

// ─── XML / iCalendar Response Parser ───

function parseCalendarMultiget(xml: string): ExternalCalendarEvent[] {
  const events: ExternalCalendarEvent[] = []

  // Extract calendar-data from DAV:multistatus response
  // Simple regex-based parsing — sufficient for CalDAV responses
  const calDataRegex = /<(?:cal|c):calendar-data[^>]*>([\s\S]*?)<\/(?:cal|c):calendar-data>/gi
  let match: RegExpExecArray | null

  while ((match = calDataRegex.exec(xml)) !== null) {
    const icalData = decodeXmlEntities(match[1].trim())

    try {
      const parsed = parseVEvent(icalData)
      if (parsed) events.push(parsed)
    } catch (err) {
      console.warn('[AppleCalendar] Failed to parse VEVENT:', err)
    }
  }

  return events
}

function parseVEvent(ical: string): ExternalCalendarEvent | null {
  const veventMatch = ical.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/)
  if (!veventMatch) return null

  const block = veventMatch[1]

  const uid = extractField(block, 'UID')
  const summary = extractField(block, 'SUMMARY')
  if (!uid || !summary) return null

  const dtStart = extractField(block, 'DTSTART')
  const dtEnd = extractField(block, 'DTEND')
  const description = extractField(block, 'DESCRIPTION')
  const location = extractField(block, 'LOCATION')

  const isAllDay = block.includes('VALUE=DATE') && !block.includes('VALUE=DATE-TIME')

  return {
    externalId: uid,
    title: unescapeICalText(summary),
    description: description ? unescapeICalText(description) : null,
    startAt: parseICalDate(dtStart || ''),
    endAt: parseICalDate(dtEnd || dtStart || ''),
    allDay: isAllDay,
    location: location ? unescapeICalText(location) : null,
    attendees: parseAttendees(block),
  }
}

function extractField(block: string, field: string): string | null {
  // Handle both simple fields and fields with parameters (e.g., DTSTART;VALUE=DATE:20240101)
  const regex = new RegExp(`^${field}(?:[;:][^\\n]*?)?:(.+)`, 'mi')
  const match = block.match(regex)
  if (!match) return null

  // Handle line folding (RFC 5545: continuation lines start with space/tab)
  let value = match[1].trim()
  const lines = block.split('\n')
  const startIdx = lines.findIndex(l => l.match(new RegExp(`^${field}(?:[;:])`)))
  if (startIdx >= 0) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith(' ') || lines[i].startsWith('\t')) {
        value += lines[i].substring(1).trim()
      } else {
        break
      }
    }
  }

  return value
}

function parseICalDate(dateStr: string): Date {
  // Handle YYYYMMDD (all-day)
  if (/^\d{8}$/.test(dateStr)) {
    return new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T00:00:00Z`)
  }

  // Handle YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const cleaned = dateStr.replace(/[^0-9TZ]/g, '')
  if (/^\d{8}T\d{6}Z?$/.test(cleaned)) {
    const y = cleaned.substring(0, 4)
    const mo = cleaned.substring(4, 6)
    const d = cleaned.substring(6, 8)
    const h = cleaned.substring(9, 11)
    const mi = cleaned.substring(11, 13)
    const s = cleaned.substring(13, 15)
    const tz = cleaned.endsWith('Z') ? 'Z' : ''
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${tz}`)
  }

  // Fallback: try native parsing
  return new Date(dateStr)
}

function parseAttendees(block: string): ExternalCalendarEvent['attendees'] {
  const attendees: ExternalCalendarEvent['attendees'] = []
  const regex = /ATTENDEE[^:]*(?:;CN=([^;:]+))?[^:]*:mailto:(\S+)/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(block)) !== null) {
    attendees.push({
      email: match[2].trim(),
      name: match[1] ? unescapeICalText(match[1].trim()) : null,
      status: 'needsAction',
    })
  }

  return attendees
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Factory function — resolves Apple Calendar provider from Integration config.
 * Returns null if not configured.
 */
export function createAppleCalendarProvider(
  config: Record<string, any>,
): AppleCalendarProvider | null {
  if (!config.serverUrl || !config.username || !config.password) {
    return null
  }

  return new AppleCalendarProvider({
    serverUrl: config.serverUrl,
    username: config.username,
    password: config.password,
    calendarPath: config.calendarPath || '/',
  })
}
