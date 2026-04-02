// Apple Calendar integration via CalDAV — minimal implementation
// This module reads calendar events to link with tasks
// It does NOT create/modify calendar events

// TODO Phase 5: Implement CalDAV client for Apple Calendar read access
// For now, tasks can store a calendarEventId string for manual linking

export async function getCalendarEvents(
  _workspaceId: string,
  _dateRange: { start: Date; end: Date },
) {
  // Placeholder — returns empty until CalDAV integration is built
  return []
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  source: 'APPLE_CALENDAR'
}
