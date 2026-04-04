import { NextResponse } from 'next/server'
import { handleGoogleCalendarCallbackAction } from '@/modules/calendar/calendar-sync.actions'

// ─────────────────────────────────────────────
// Google Calendar OAuth Callback
//
// Google redirects here after the user grants calendar access.
// Exchanges the auth code for tokens, stores them,
// and redirects back to settings.
// ─────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // User denied access
  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?calendar_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?calendar_error=missing_params`)
  }

  // Decode and validate state (contains workspaceId + CSRF nonce + timestamp)
  let workspaceId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    workspaceId = decoded.workspaceId
    if (!workspaceId) throw new Error('No workspaceId in state')

    // Reject state older than 10 minutes to prevent replay attacks
    const MAX_STATE_AGE_MS = 10 * 60 * 1000
    if (decoded.ts && Date.now() - decoded.ts > MAX_STATE_AGE_MS) {
      return NextResponse.redirect(`${appUrl}/settings?calendar_error=state_expired`)
    }
  } catch {
    return NextResponse.redirect(`${appUrl}/settings?calendar_error=invalid_state`)
  }

  // Exchange code for tokens and store
  const result = await handleGoogleCalendarCallbackAction(code, workspaceId)

  if (result.success) {
    return NextResponse.redirect(`${appUrl}/settings?calendar_connected=true`)
  }

  return NextResponse.redirect(
    `${appUrl}/settings?calendar_error=${encodeURIComponent(result.error)}`,
  )
}
