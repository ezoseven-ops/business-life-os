'use client'

import { useState, useEffect } from 'react'
import {
  getGoogleCalendarConnectUrlAction,
  disconnectGoogleCalendarAction,
  pullCalendarEventsAction,
  getCalendarConnectionStatusAction,
  getFailedSyncEntriesAction,
  retrySyncAction,
} from '@/modules/calendar/calendar-sync.actions'

// ─────────────────────────────────────────────
// Google Calendar Settings
//
// Displays connection status, connect/disconnect buttons,
// manual sync trigger. Mobile-first, ≥44px touch targets.
// All errors surfaced in UI — no silent failures.
// ─────────────────────────────────────────────

type ConnectionState = 'loading' | 'connected' | 'disconnected' | 'error' | 'not_configured'
type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface SyncResult {
  created: number
  updated: number
  errors: number
}

interface FailedSyncEntry {
  id: string
  eventId: string
  eventTitle: string
  syncError: string
  lastSyncAt: Date
  retryCount: number
}

export function GoogleCalendarSettings({
  initialConnected,
  isOwner,
  oauthConfigured,
  callbackMessage,
}: {
  initialConnected: boolean
  isOwner: boolean
  oauthConfigured: boolean
  callbackMessage: { type: 'success' | 'error'; text: string } | null
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    if (!oauthConfigured) return 'not_configured'
    return initialConnected ? 'connected' : 'disconnected'
  })
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(
    callbackMessage,
  )
  const [failedSyncs, setFailedSyncs] = useState<FailedSyncEntry[]>([])
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // Load failed sync entries when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      loadFailedSyncs()
    }
  }, [connectionState])

  async function loadFailedSyncs() {
    try {
      const result = await getFailedSyncEntriesAction()
      if (result.success) {
        setFailedSyncs(result.data)
      }
    } catch {
      // Non-critical — don't block UI
    }
  }

  async function handleRetrySync(eventId: string) {
    setRetryingId(eventId)
    try {
      const result = await retrySyncAction(eventId)
      if (result.success) {
        setToast({ type: 'success', text: 'Sync retried successfully' })
        // Refresh the list
        await loadFailedSyncs()
      } else {
        setToast({ type: 'error', text: result.error })
      }
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Retry failed' })
    } finally {
      setRetryingId(null)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // Clear callback URL params after reading
  useEffect(() => {
    if (callbackMessage) {
      const url = new URL(window.location.href)
      url.searchParams.delete('calendar_connected')
      url.searchParams.delete('calendar_error')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [callbackMessage])

  // ── Connect ──
  async function handleConnect() {
    setError(null)
    setConnecting(true)
    try {
      const result = await getGoogleCalendarConnectUrlAction()
      if (!result.success) {
        setError(result.error)
        setConnecting(false)
        return
      }
      // Redirect to Google OAuth
      window.location.href = result.data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start connection')
      setConnecting(false)
    }
  }

  // ── Disconnect ──
  async function handleDisconnect() {
    setError(null)
    setDisconnecting(true)
    try {
      const result = await disconnectGoogleCalendarAction()
      if (!result.success) {
        setError(result.error)
        setDisconnecting(false)
        return
      }
      setConnectionState('disconnected')
      setSyncResult(null)
      setToast({ type: 'success', text: 'Google Calendar disconnected' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Sync ──
  async function handleSync() {
    setError(null)
    setSyncState('syncing')
    setSyncResult(null)
    try {
      const result = await pullCalendarEventsAction()
      if (!result.success) {
        setSyncState('error')
        setError(result.error)
        return
      }
      setSyncState('success')
      setSyncResult(result.data)
      const { created, updated, errors } = result.data
      // Refresh failed sync list after sync
      await loadFailedSyncs()
      if (errors > 0) {
        setToast({ type: 'error', text: `Synced with ${errors} error(s)` })
      } else {
        setToast({
          type: 'success',
          text: `Synced: ${created} new, ${updated} updated`,
        })
      }
    } catch (err) {
      setSyncState('error')
      setError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  // ── Verify connection (re-check live status) ──
  async function handleVerify() {
    setError(null)
    setVerifying(true)
    try {
      const result = await getCalendarConnectionStatusAction()
      if (!result.success) {
        setConnectionState('error')
        setError(result.error)
        return
      }
      setConnectionState(result.data.connected ? 'connected' : 'disconnected')
      if (result.data.connected) {
        setToast({ type: 'success', text: 'Connection verified' })
      }
    } catch (err) {
      setConnectionState('error')
      setError(err instanceof Error ? err.message : 'Failed to verify connection')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <section className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
          Google Calendar
        </h3>
        <StatusBadge state={connectionState} />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200/60">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="flex-1 text-[13px] leading-relaxed text-amber-800">{error}</p>
        </div>
      )}

      {/* Not configured state */}
      {connectionState === 'not_configured' && (
        <p className="text-sm text-text-secondary">
          Google Calendar integration is not configured. Set <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GOOGLE_CALENDAR_CLIENT_ID</code> and <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GOOGLE_CALENDAR_CLIENT_SECRET</code> environment variables.
        </p>
      )}

      {/* Disconnected state — show Connect */}
      {connectionState === 'disconnected' && oauthConfigured && (
        <>
          <p className="text-sm text-text-secondary">
            Connect your Google Calendar to sync events between Business Life OS and Google.
          </p>
          {isOwner ? (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-white font-medium text-sm transition-colors"
              style={{ minHeight: 48, opacity: connecting ? 0.6 : 1 }}
            >
              {connecting ? (
                <Spinner />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {connecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          ) : (
            <p className="text-sm text-text-secondary italic">
              Only the workspace owner can connect Google Calendar.
            </p>
          )}
        </>
      )}

      {/* Connected state — show Sync + Disconnect */}
      {connectionState === 'connected' && (
        <div className="space-y-3">
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-sm transition-colors"
            style={{ minHeight: 48, opacity: syncState === 'syncing' ? 0.6 : 1 }}
          >
            {syncState === 'syncing' ? (
              <>
                <Spinner light />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                Sync Now
              </>
            )}
          </button>

          {/* Sync result */}
          {syncResult && syncState === 'success' && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded-lg py-2">
                <p className="text-lg font-bold text-green-700">{syncResult.created}</p>
                <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">New</p>
              </div>
              <div className="bg-blue-50 rounded-lg py-2">
                <p className="text-lg font-bold text-blue-700">{syncResult.updated}</p>
                <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Updated</p>
              </div>
              {syncResult.errors > 0 && (
                <div className="bg-red-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-red-700">{syncResult.errors}</p>
                  <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide">Errors</p>
                </div>
              )}
            </div>
          )}

          {/* Failed sync entries */}
          {failedSyncs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                Failed Syncs ({failedSyncs.length})
              </p>
              <div className="space-y-1.5">
                {failedSyncs.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.eventTitle}
                      </p>
                      <p className="text-xs text-red-600 truncate">
                        {entry.syncError}
                      </p>
                      {entry.retryCount > 0 && (
                        <p className="text-[10px] text-gray-500">
                          Retried {entry.retryCount}x
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRetrySync(entry.eventId)}
                      disabled={retryingId === entry.eventId}
                      className="shrink-0 flex items-center justify-center rounded-lg bg-white border border-red-200 text-xs font-medium text-red-700 transition-colors"
                      style={{ minHeight: 36, minWidth: 60, opacity: retryingId === entry.eventId ? 0.5 : 1 }}
                    >
                      {retryingId === entry.eventId ? <Spinner /> : 'Retry'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verify + Disconnect row */}
          <div className="flex gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white text-sm font-medium text-text-secondary transition-colors"
              style={{ minHeight: 44, opacity: verifying ? 0.6 : 1 }}
            >
              {verifying ? <Spinner /> : null}
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
            {isOwner && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700 transition-colors"
                style={{ minHeight: 44, opacity: disconnecting ? 0.6 : 1 }}
              >
                {disconnecting ? <Spinner /> : null}
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error connection state — show retry */}
      {connectionState === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            Could not verify connection. The token may have expired or been revoked.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleVerify}
              className="flex-1 flex items-center justify-center rounded-xl border border-border bg-white text-sm font-medium"
              style={{ minHeight: 44 }}
            >
              Retry
            </button>
            {isOwner && (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700"
                style={{ minHeight: 44 }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Helpers ──

function StatusBadge({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { label: string; bg: string; text: string }> = {
    loading: { label: 'Checking...', bg: 'bg-gray-100', text: 'text-gray-600' },
    connected: { label: 'Connected', bg: 'bg-green-100', text: 'text-green-700' },
    disconnected: { label: 'Not connected', bg: 'bg-gray-100', text: 'text-gray-600' },
    error: { label: 'Error', bg: 'bg-red-100', text: 'text-red-700' },
    not_configured: { label: 'Not configured', bg: 'bg-amber-100', text: 'text-amber-700' },
  }
  const c = config[state]
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke={light ? 'white' : 'currentColor'}
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill={light ? 'white' : 'currentColor'}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
