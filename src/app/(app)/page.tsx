import { auth } from '@/lib/auth'
import Link from 'next/link'
import { getFocusTasks } from '@/modules/command-center/focus.engine'
import { getSignals, groupSignals } from '@/modules/command-center/signal.engine'
import { getDailyBrief } from '@/modules/command-center/daily-brief.engine'
import { getProjectOverview } from '@/modules/command-center/project-overview.query'
import { getClosureBrief } from '@/modules/command-center/closure.engine'
import { detectRhythm } from '@/modules/command-center/rhythm.engine'
import { TaskCheckbox } from '@/modules/tasks/components/TaskCheckbox'
import { CommandCenterInput } from '@/modules/agent/components/CommandCenterInput'
import { RhythmTracker } from '@/modules/command-center/components/RhythmTracker'

export default async function CommandCenter() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  // Core data — these must succeed for the page to render
  const [focusTasks, signals, projects] = await Promise.all([
    getFocusTasks(session.user.workspaceId, session.user.id).catch(() => []),
    getSignals(session.user.workspaceId).catch(() => []),
    getProjectOverview(session.user.workspaceId).catch(() => []),
  ])

  const grouped = groupSignals(signals)

  // Detect operating rhythm — OPEN / ACTIVE / CLOSURE
  const rhythm = await detectRhythm(session.user.workspaceId, session.user.id)
    .catch(() => ({
      phase: 'ACTIVE' as const,
      profile: 'default' as const,
      inactivityMinutes: 0,
      hasActivityToday: false,
      completedToday: 0,
      lastActivityAt: null,
      manualClosure: false,
    }))

  // AI Daily Brief — rhythm-aware (graceful degradation built into getDailyBrief)
  const brief = await getDailyBrief(
    session.user.name ?? 'Founder',
    focusTasks,
    signals,
    projects,
    session.user.workspaceId,
    rhythm.phase,
  )

  // Closure brief — only when rhythm engine says CLOSURE
  let closureBrief = null
  if (rhythm.phase === 'CLOSURE') {
    closureBrief = await getClosureBrief(
      session.user.workspaceId,
      session.user.id,
      focusTasks,
      signals,
    ).catch(() => null)
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(8, 8, 13, 0.85)',
          borderBottom: '1px solid var(--color-cc-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between h-14 px-5 max-w-2xl mx-auto">
          <h1
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: 'var(--color-cc-text)', letterSpacing: '-0.01em' }}
          >
            Command Center
          </h1>
          <Link
            href="/notifications"
            className="p-3 -mr-3 rounded-xl transition-colors active:scale-[0.9]"
            style={{ color: 'var(--color-cc-text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-5 max-w-2xl mx-auto pb-28">

        {/* ═══════════════════════════════════════════
            ZONE 1: AI DAILY BRIEF
            3 decision sentences — what matters, biggest risk, being ignored
        ═══════════════════════════════════════════ */}
        <section className="pt-8 pb-2">
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-cc-text)', letterSpacing: '-0.025em' }}
          >
            {brief.greeting}
          </h2>

          {/* What matters today */}
          <div className="mt-4 space-y-2.5">
            <BriefLine
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              }
              iconColor="var(--color-cc-accent)"
              text={brief.whatMatters}
              textColor="var(--color-cc-text)"
            />

            {/* Biggest risk */}
            <BriefLine
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
              iconColor="var(--color-cc-fire)"
              text={brief.biggestRisk}
              textColor="var(--color-cc-text-secondary)"
            />

            {/* Being ignored */}
            <BriefLine
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              iconColor="var(--color-cc-risk)"
              text={brief.beingIgnored}
              textColor="var(--color-cc-text-muted)"
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            ZONE 2: CAPTURE — chaos → structure
            Always visible. The most important input surface.
        ═══════════════════════════════════════════ */}
        <section className="cc-zone">
          <ZoneHeader title="Capture" />
          <CommandCenterInput />
        </section>

        {/* ═══════════════════════════════════════════
            ZONE 3: FOCUS — TOP 3 TASKS
            Dominant section. "This is what I do now."
        ═══════════════════════════════════════════ */}
        {focusTasks.length > 0 && (
          <section className="cc-zone">
            <ZoneHeader title="Focus" count={focusTasks.length} />
            <div className="space-y-2.5">
              {focusTasks.map((task, i) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="cc-card cc-card-hover block px-4 py-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="pt-0.5" onClick={(e) => e.preventDefault()}>
                      <TaskCheckbox taskId={task.id} status={task.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color: 'var(--color-cc-text-dim)' }}
                        >
                          {i + 1}
                        </span>
                        <PriorityPill priority={task.priority} />
                        <p
                          className="text-[14px] font-medium truncate"
                          style={{ color: 'var(--color-cc-text)' }}
                        >
                          {task.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[12px]"
                          style={{ color: 'var(--color-cc-text-muted)' }}
                        >
                          {task.projectName}
                        </span>
                        {task.ventureName && (
                          <>
                            <span style={{ color: 'var(--color-cc-text-dim)' }}>·</span>
                            <span
                              className="text-[12px]"
                              style={{ color: 'var(--color-cc-text-dim)' }}
                            >
                              {task.ventureName}
                            </span>
                          </>
                        )}
                        {task.dueDate && (
                          <>
                            <span style={{ color: 'var(--color-cc-text-dim)' }}>·</span>
                            <DueBadge dueDate={task.dueDate} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            ZONE 4: SIGNALS — the radar
            CRITICAL = dangerous. RISK = urgent. WASTE = time drain.
        ═══════════════════════════════════════════ */}
        {signals.length > 0 && (
          <section className="cc-zone">
            <ZoneHeader title="Signals" count={signals.length} />
            <div className="space-y-5">
              {grouped.critical.length > 0 && (
                <SignalGroup label="Critical" variant="fire" signals={grouped.critical} />
              )}
              {grouped.risk.length > 0 && (
                <SignalGroup label="Risk" variant="risk" signals={grouped.risk} />
              )}
              {grouped.waste.length > 0 && (
                <SignalGroup label="Waste" variant="waste" signals={grouped.waste} />
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            ZONE 5: PROJECTS — progress overview
        ═══════════════════════════════════════════ */}
        {projects.length > 0 && (
          <section className="cc-zone">
            <ZoneHeader title="Projects" count={projects.length} />
            <div className="space-y-1.5">
              {projects.map((project) => {
                const pct = project.taskCounts.total > 0
                  ? Math.round((project.taskCounts.done / project.taskCounts.total) * 100)
                  : 0
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="cc-card cc-card-hover flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold tracking-wide"
                          style={{ color: 'var(--color-cc-text-dim)' }}
                        >
                          {project.projectPriority}
                        </span>
                        <p
                          className="text-[13px] font-medium truncate"
                          style={{ color: 'var(--color-cc-text-secondary)' }}
                        >
                          {project.name}
                        </p>
                        {project.ventureName && (
                          <span
                            className="text-[11px] truncate flex-shrink-0"
                            style={{ color: 'var(--color-cc-text-dim)' }}
                          >
                            {project.ventureName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-16 h-1 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--color-cc-border)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: project.taskCounts.overdue > 0
                                ? 'var(--color-cc-fire)'
                                : pct === 100
                                  ? 'var(--color-cc-success)'
                                  : 'var(--color-cc-accent)',
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] tabular-nums"
                          style={{ color: 'var(--color-cc-text-muted)' }}
                        >
                          {project.taskCounts.done}/{project.taskCounts.total}
                        </span>
                      </div>
                      {project.taskCounts.overdue > 0 && (
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: 'var(--color-cc-fire)' }}
                        >
                          {project.taskCounts.overdue} late
                        </span>
                      )}
                      <ProjectStatusDot status={project.status} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            ZONE 6: EVENING CLOSURE (after 5pm only)
            What was completed, what slipped, tomorrow prep
        ═══════════════════════════════════════════ */}
        {closureBrief && (
          <section className="cc-zone">
            <ZoneHeader title="Day Close" />
            <div className="cc-card-elevated px-4 py-4 space-y-3">
              {/* Stats row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    style={{ color: 'var(--color-cc-success)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--color-cc-success)' }}>
                    {closureBrief.completedToday} done
                  </span>
                </div>
                {closureBrief.blockedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      style={{ color: 'var(--color-cc-risk)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--color-cc-risk)' }}>
                      {closureBrief.blockedCount} blocked
                    </span>
                  </div>
                )}
              </div>

              {/* AI closure lines */}
              <div className="space-y-2">
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-cc-text-secondary)' }}>
                  {closureBrief.closureSummary}
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-cc-text-muted)' }}>
                  {closureBrief.slipped}
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-cc-accent)' }}>
                  {closureBrief.tomorrowPrep}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── CLOSE DAY (only in ACTIVE phase) + invisible heartbeat ── */}
        <RhythmTracker phase={rhythm.phase} />

        {/* ── RHYTHM PHASE INDICATOR ── */}
        {rhythm.phase === 'OPEN' && (
          <div
            className="flex items-center gap-2 mt-6 px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--color-cc-surface)' }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--color-cc-accent)' }}
            />
            <span className="text-[12px]" style={{ color: 'var(--color-cc-text-dim)' }}>
              Fresh session — {rhythm.inactivityMinutes >= 60
                ? `${Math.round(rhythm.inactivityMinutes / 60)}h since last activity`
                : 'first visit today'
              }
            </span>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {focusTasks.length === 0 && signals.length === 0 && projects.length === 0 && (
          <div className="text-center py-20">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-cc-surface-elevated)' }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-cc-text-muted)' }}>
              No data yet. Use Capture above to drop your first thought.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-components — premium, token-driven
// ─────────────────────────────────────────────

function BriefLine({
  icon,
  iconColor,
  text,
  textColor,
}: {
  icon: React.ReactNode
  iconColor: string
  text: string
  textColor: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0" style={{ color: iconColor }}>
        {icon}
      </div>
      <p className="text-[14px] leading-relaxed" style={{ color: textColor }}>
        {text}
      </p>
    </div>
  )
}

function ZoneHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h3
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-cc-text-muted)', letterSpacing: '0.1em' }}
      >
        {title}
      </h3>
      {count !== undefined && (
        <span
          className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
          style={{
            color: 'var(--color-cc-text-dim)',
            backgroundColor: 'var(--color-cc-border)',
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

function PriorityPill({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    URGENT: { bg: 'var(--color-cc-fire-muted)', color: 'var(--color-cc-fire)' },
    HIGH: { bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316' },
    MEDIUM: { bg: 'rgba(99, 102, 241, 0.10)', color: 'var(--color-cc-accent)' },
    LOW: { bg: 'var(--color-cc-border)', color: 'var(--color-cc-text-muted)' },
  }
  const s = styles[priority] ?? styles.MEDIUM
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {priority}
    </span>
  )
}

function DueBadge({ dueDate }: { dueDate: Date }) {
  const now = new Date()
  const isOverdue = dueDate < now
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let label: string
  if (isOverdue) {
    label = `${Math.abs(diffDays)}d overdue`
  } else if (diffDays === 0) {
    label = 'Today'
  } else if (diffDays === 1) {
    label = 'Tomorrow'
  } else {
    label = `${diffDays}d`
  }

  const color = isOverdue
    ? 'var(--color-cc-fire)'
    : diffDays <= 1
      ? 'var(--color-cc-risk)'
      : 'var(--color-cc-text-muted)'

  return (
    <span className="text-[11px] font-medium" style={{ color }}>
      {label}
    </span>
  )
}

function ProjectStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'var(--color-cc-success)',
    PAUSED: 'var(--color-cc-risk)',
    DONE: 'var(--color-cc-text-dim)',
    ARCHIVED: 'var(--color-cc-text-dim)',
  }
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: colors[status] ?? 'var(--color-cc-text-dim)' }}
    />
  )
}

function SignalGroup({
  label,
  variant,
  signals,
}: {
  label: string
  variant: 'fire' | 'risk' | 'waste'
  signals: { id: string; title: string; description: string; projectName: string; taskId: string }[]
}) {
  const tokens = {
    fire: {
      labelBg: 'var(--color-cc-fire-muted)',
      labelColor: 'var(--color-cc-fire)',
      border: 'rgba(239, 68, 68, 0.15)',
    },
    risk: {
      labelBg: 'var(--color-cc-risk-muted)',
      labelColor: 'var(--color-cc-risk)',
      border: 'rgba(245, 158, 11, 0.15)',
    },
    waste: {
      labelBg: 'var(--color-cc-waste-muted)',
      labelColor: 'var(--color-cc-waste)',
      border: 'var(--color-cc-border)',
    },
  }
  const t = tokens[variant]

  return (
    <div>
      <span
        className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-2.5"
        style={{ backgroundColor: t.labelBg, color: t.labelColor }}
      >
        {label} · {signals.length}
      </span>
      <div className="space-y-1.5">
        {signals.slice(0, 5).map((signal) => (
          <Link
            key={signal.id}
            href={`/tasks/${signal.taskId}`}
            className="cc-card cc-card-hover block px-3.5 py-2.5"
            style={{ borderColor: t.border }}
          >
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-[12px] font-medium truncate"
                style={{ color: 'var(--color-cc-text-secondary)' }}
              >
                {signal.description}
              </p>
              <span
                className="text-[10px] font-semibold flex-shrink-0"
                style={{ color: t.labelColor }}
              >
                {signal.title}
              </span>
            </div>
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: 'var(--color-cc-text-dim)' }}
            >
              {signal.projectName}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
