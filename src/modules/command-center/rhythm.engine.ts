import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

/**
 * Operating Rhythm Engine
 *
 * Detects which phase of the daily loop the user is in — WITHOUT fixed hours.
 *
 * PRIMARY DATA SOURCE: Activity table (server-side truth of real user actions).
 * SECONDARY SIGNAL: Heartbeat cookie (client-side passive presence).
 *   Cookie only used as tiebreaker when no DB activity exists.
 *
 * PHASES:
 *   OPEN    — user returns after long inactivity (8h+ default). Fresh start.
 *   ACTIVE  — user is engaged or in short-burst mode (gap < 3h default).
 *   CLOSURE — user returns after significant gap with completed work today.
 *             OR user manually closes the day.
 *
 * ZERO CONFIG: works perfectly with no user settings.
 * Optional profiles (default/night/irregular) only shift thresholds.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type RhythmPhase = 'OPEN' | 'ACTIVE' | 'CLOSURE'

export type RhythmProfile = 'default' | 'night' | 'irregular'

export type RhythmState = {
  phase: RhythmPhase
  profile: RhythmProfile
  inactivityMinutes: number
  hasActivityToday: boolean
  completedToday: number
  lastActivityAt: Date | null
  manualClosure: boolean
}

// ─────────────────────────────────────────────
// Thresholds per profile (in minutes)
//
// Rationale:
//   Founders work in bursts. 2-3h gaps between bursts are normal.
//   OPEN  = clearly a new day/session (slept, traveled, etc.)
//   CLOSURE = genuine end-of-session, not just a lunch break.
//   ACTIVE = everything in between. Safe default.
// ─────────────────────────────────────────────

type Thresholds = {
  openGapMinutes: number       // inactivity gap that triggers OPEN
  closureGapMinutes: number    // gap + completed work → CLOSURE
  activeWindowMinutes: number  // max gap that stays ACTIVE
}

const PROFILE_THRESHOLDS: Record<RhythmProfile, Thresholds> = {
  default: {
    openGapMinutes: 480,       // 8 hours → clearly a new session
    closureGapMinutes: 240,    // 4 hours + completed work → wind-down
    activeWindowMinutes: 180,  // under 3h → still mid-session
  },
  night: {
    openGapMinutes: 600,       // 10 hours → night owl recovery
    closureGapMinutes: 300,    // 5 hours
    activeWindowMinutes: 240,  // 4h tolerance
  },
  irregular: {
    openGapMinutes: 600,       // 10 hours
    closureGapMinutes: 360,    // 6 hours — very high bar
    activeWindowMinutes: 300,  // 5h tolerance, almost never leaves ACTIVE
  },
}

// ─────────────────────────────────────────────
// Cookie names
// ─────────────────────────────────────────────

const HEARTBEAT_COOKIE = 'cc-heartbeat'
const PROFILE_COOKIE = 'cc-rhythm-profile'
const MANUAL_CLOSE_COOKIE = 'cc-day-closed'

// ─────────────────────────────────────────────
// Main: Detect current rhythm phase
// ─────────────────────────────────────────────

export async function detectRhythm(
  workspaceId: string,
  userId: string,
): Promise<RhythmState> {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  // Read cookies
  const cookieStore = await cookies()
  const heartbeatRaw = cookieStore.get(HEARTBEAT_COOKIE)?.value
  const profileRaw = cookieStore.get(PROFILE_COOKIE)?.value
  const manualCloseRaw = cookieStore.get(MANUAL_CLOSE_COOKIE)?.value

  const profile: RhythmProfile =
    profileRaw && ['night', 'irregular'].includes(profileRaw)
      ? (profileRaw as RhythmProfile)
      : 'default'

  const thresholds = PROFILE_THRESHOLDS[profile]

  // Manual closure? Valid for today only.
  const manualClosure = manualCloseRaw === startOfDay.toISOString().split('T')[0]

  // ── PRIMARY: Last activity from DB ──
  const [lastDbActivity, completedCount] = await Promise.all([
    prisma.activity.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.task.count({
      where: {
        project: { workspaceId },
        status: 'DONE',
        updatedAt: { gte: startOfDay },
        OR: [{ assigneeId: userId }, { creatorId: userId }],
      },
    }),
  ])

  // ── SECONDARY: Heartbeat cookie (tiebreaker only) ──
  // Only used when DB has no activity at all (new user, or browsing without actions).
  let lastTouchpoint: Date | null = lastDbActivity?.createdAt ?? null

  if (!lastTouchpoint && heartbeatRaw) {
    const heartbeatDate = new Date(heartbeatRaw)
    if (!isNaN(heartbeatDate.getTime())) {
      lastTouchpoint = heartbeatDate
    }
  }

  // Has there been any activity today?
  const hasActivityToday = lastTouchpoint
    ? lastTouchpoint >= startOfDay
    : false

  // Inactivity gap
  const inactivityMs = lastTouchpoint
    ? now.getTime() - lastTouchpoint.getTime()
    : Infinity
  const inactivityMinutes = Math.round(inactivityMs / (1000 * 60))

  // ── Phase decision ──

  let phase: RhythmPhase

  if (manualClosure) {
    // 1. User explicitly closed the day → respect it
    phase = 'CLOSURE'
  } else if (!lastTouchpoint || inactivityMinutes >= thresholds.openGapMinutes) {
    // 2. No prior activity ever, or gap ≥ 8h → fresh start
    phase = 'OPEN'
  } else if (inactivityMinutes <= thresholds.activeWindowMinutes) {
    // 3. Recent activity → still mid-session
    phase = 'ACTIVE'
  } else if (
    hasActivityToday &&
    inactivityMinutes >= thresholds.closureGapMinutes &&
    completedCount >= 1
  ) {
    // 4. Significant gap + productive session today → genuine wind-down
    //    Requires at least 1 completed task to confirm work actually happened.
    phase = 'CLOSURE'
  } else {
    // 5. Gap is between active window and closure threshold,
    //    or no completed tasks → stay ACTIVE. Don't assume closure.
    phase = 'ACTIVE'
  }

  // Soft late-night hint: if it's very late AND significant completed work,
  // nudge toward closure. Still requires a gap — not instant.
  if (
    phase === 'ACTIVE' &&
    completedCount >= 3 &&
    new Date().getHours() >= 22 &&
    inactivityMinutes >= 60
  ) {
    phase = 'CLOSURE'
  }

  return {
    phase,
    profile,
    inactivityMinutes,
    hasActivityToday,
    completedToday: completedCount,
    lastActivityAt: lastTouchpoint,
    manualClosure,
  }
}

// ─────────────────────────────────────────────
// Greeting generator — rhythm-aware
// ─────────────────────────────────────────────

export function rhythmGreeting(phase: RhythmPhase, userName: string): string {
  const firstName = userName.split(' ')[0]
  const hour = new Date().getHours()

  switch (phase) {
    case 'OPEN': {
      if (hour < 12) return `Good morning, ${firstName}`
      if (hour < 18) return `Welcome back, ${firstName}`
      return `Evening, ${firstName}`
    }
    case 'ACTIVE': {
      return `${firstName}`
    }
    case 'CLOSURE': {
      if (hour >= 21) return `Closing out, ${firstName}`
      return `Wrapping up, ${firstName}`
    }
  }
}
