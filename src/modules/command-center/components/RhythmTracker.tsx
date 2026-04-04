'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { RhythmPhase } from '../rhythm.engine'

/**
 * RhythmTracker — invisible client component that:
 * 1. Writes a heartbeat cookie on mount + tab refocus (secondary signal only)
 * 2. Provides "Close day" manual trigger
 *
 * The heartbeat is a SECONDARY signal — the Activity table is primary truth.
 * Cookie only matters for brand-new users with zero DB activity.
 *
 * Mobile Safari note:
 *   JS execution is suspended when tab is backgrounded.
 *   visibilitychange fires on tab return → fresh heartbeat written immediately.
 *   No interval needed — on-visibility is sufficient and battery-friendly.
 */

const HEARTBEAT_COOKIE = 'cc-heartbeat'
const MANUAL_CLOSE_COOKIE = 'cc-day-closed'

function writeHeartbeat() {
  const now = new Date().toISOString()
  // 24h max-age, SameSite=Lax — compatible with Safari ITP
  document.cookie = `${HEARTBEAT_COOKIE}=${now};path=/;max-age=86400;SameSite=Lax`
}

export function RhythmTracker({ phase }: { phase: RhythmPhase }) {
  const router = useRouter()

  useEffect(() => {
    // Write heartbeat on mount (page load / navigation)
    writeHeartbeat()

    // Write on tab refocus — this is the primary client signal.
    // No setInterval — saves battery on mobile, and the Activity table
    // is the real source of truth anyway.
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        writeHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const handleCloseDay = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    document.cookie = `${MANUAL_CLOSE_COOKIE}=${today};path=/;max-age=86400;SameSite=Lax`
    router.refresh()
  }, [router])

  // Only show close button during ACTIVE phase
  if (phase !== 'ACTIVE') return null

  return (
    <button
      onClick={handleCloseDay}
      className="flex items-center gap-2 px-4 py-3 w-full rounded-xl transition-all active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--color-cc-surface)',
        border: '1px solid var(--color-cc-border)',
      }}
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        style={{ color: 'var(--color-cc-text-muted)' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
      <span
        className="text-[13px] font-medium"
        style={{ color: 'var(--color-cc-text-muted)' }}
      >
        Close day
      </span>
    </button>
  )
}
