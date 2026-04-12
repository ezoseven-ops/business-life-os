import { auth } from '@/lib/auth'
import Link from 'next/link'
import { getFocusTasks } from '@/modules/command-center/focus.engine'
import { getRecentActivity } from '@/modules/activity/activity.service'
import { TaskCheckboxWrapper } from '@/modules/tasks/components/TaskCheckboxWrapper'
import { CommandCenterInput } from '@/modules/agent/components/CommandCenterInput'

export default async function CommandCenter() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const [focusTasks, recentActivity] = await Promise.all([
    getFocusTasks(session.user.workspaceId, session.user.id).catch(() => []),
    getRecentActivity(session.user.workspaceId, 5).catch(() => []),
  ])

  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  const greeting = getGreeting(firstName)
  const topFocus = focusTasks.slice(0, 5)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <div className="px-6 max-w-lg mx-auto pb-32">

        {/* ── Greeting — bold, high contrast ── */}
        <div className="pt-16 pb-2">
          <p
            className="text-[14px] font-medium uppercase tracking-[0.08em] mb-3"
            style={{ color: 'var(--color-cc-accent)' }}
          >
            Dashboard
          </p>
          <h1
            className="text-[34px] font-bold tracking-[-0.03em] leading-[1.1]"
            style={{ color: 'var(--color-cc-text)' }}
          >
            {greeting}
          </h1>
          <p
            className="text-[15px] mt-2 font-normal"
            style={{ color: 'var(--color-cc-text-muted)' }}
          >
            What needs your attention today?
          </p>
        </div>

        {/* ── Input — premium glass command bar ── */}
        <div className="pt-7 pb-2">
          <CommandCenterInput />
        </div>

        {/* ── Quick Stats row ── */}
        <div className="pt-8 grid grid-cols-3 gap-3">
          {[
            { label: 'Tasks', value: topFocus.length.toString(), color: '#7c6ef6' },
            { label: 'Activity', value: recentActivity.length.toString(), color: '#2dd882' },
            { label: 'Focus', value: topFocus.length > 0 ? 'Active' : 'Clear', color: '#ffb545' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl px-4 py-4 text-center"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <p
                className="text-[22px] font-bold tracking-[-0.02em]"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
              <p
                className="text-[11px] font-medium uppercase tracking-[0.06em] mt-1"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Open Day ── */}
        <div className="pt-8">
          <Link
            href="/open-day"
            prefetch={false}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-4 active:scale-[0.98]"
            style={{
              background: 'rgba(124, 110, 246, 0.06)',
              border: '1px solid rgba(124, 110, 246, 0.12)',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(124, 110, 246, 0.12)' }}
            >
              <svg className="w-5 h-5" style={{ color: '#7c6ef6' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[15px] font-semibold leading-snug"
                style={{ color: 'var(--color-cc-text)' }}
              >
                Open Day
              </p>
              <p
                className="text-[12px] mt-0.5"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                Daily operator briefing
              </p>
            </div>
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-cc-text-muted)' }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>

        {/* ── Recent Activity ── */}
        {recentActivity.length > 0 && (
          <div className="pt-10">
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[13px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                Recent Activity
              </p>
              <Link
                href="/activity"
              prefetch={false}
                className="text-[12px] font-medium"
                style={{ color: 'var(--color-cc-accent)' }}
              >
                See all
              </Link>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {recentActivity.map((act, i) => (
                <div
                  key={act.id}
                  className="flex items-center gap-3.5 py-3.5 px-4"
                  style={{
                    borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        act.action === 'CREATED' ? 'rgba(124, 110, 246, 0.12)'
                        : act.action === 'STATUS_CHANGED' ? 'rgba(45, 216, 130, 0.12)'
                        : 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <span
                      className="w-[6px] h-[6px] rounded-full"
                      style={{
                        backgroundColor:
                          act.action === 'CREATED' ? '#7c6ef6'
                          : act.action === 'STATUS_CHANGED' ? '#2dd882'
                          : '#6b6b85',
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[14px] truncate block font-medium"
                      style={{ color: 'var(--color-cc-text-secondary)' }}
                    >
                      {act.user?.name ?? 'System'}{' '}
                      <span style={{ color: 'var(--color-cc-text-muted)' }}>
                        {formatAction(act.action)}{' '}
                        {act.entityType.toLowerCase()}
                      </span>
                    </span>
                  </div>
                  <span
                    className="text-[12px] tabular-nums flex-shrink-0"
                    style={{ color: 'var(--color-cc-text-dim)' }}
                  >
                    {formatTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Focus Tasks ── */}
        {topFocus.length > 0 && (
          <div className="pt-10">
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-[13px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                Focus
              </p>
              <Link
                href="/tasks"
                className="text-[12px] font-medium"
                style={{ color: 'var(--color-cc-accent)' }}
              >
                All tasks
              </Link>
            </div>
            <div className="space-y-2.5">
              {topFocus.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-3.5 py-4 px-4 rounded-2xl active:scale-[0.98]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <TaskCheckboxWrapper taskId={task.id} status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[15px] font-semibold truncate leading-snug"
                      style={{ color: 'var(--color-cc-text)' }}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="text-[12px] font-medium px-2 py-0.5 rounded-md"
                        style={{
                          color: 'var(--color-cc-text-muted)',
                          background: 'rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        {task.projectName}
                      </span>
                      {task.dueDate && (
                        <DueBadge dueDate={task.dueDate} />
                      )}
                    </div>
                  </div>
                  <PriorityDot priority={task.priority} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {focusTasks.length === 0 && recentActivity.length === 0 && (
          <div className="text-center pt-20">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{
                background: 'rgba(124, 110, 246, 0.1)',
                boxShadow: '0 0 40px rgba(124, 110, 246, 0.1)',
              }}
            >
              <svg className="w-7 h-7" style={{ color: '#7c6ef6' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p
              className="text-[18px] font-semibold"
              style={{ color: 'var(--color-cc-text)' }}
            >
              All clear
            </p>
            <p
              className="text-[14px] mt-2 max-w-[240px] mx-auto"
              style={{ color: 'var(--color-cc-text-muted)' }}
            >
              Use the command bar above to create tasks, notes, or events.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Helpers ───

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    URGENT: '#ff5a5a',
    HIGH: '#ff8a45',
    MEDIUM: '#7c6ef6',
    LOW: '#4a4a60',
  }
  return (
    <span
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: colors[priority] ?? colors.MEDIUM,
        boxShadow: priority === 'URGENT' ? '0 0 8px rgba(255, 90, 90, 0.4)' : 'none',
      }}
    />
  )
}

function DueBadge({ dueDate }: { dueDate: Date }) {
  const now = new Date()
  const isOverdue = dueDate < now
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let label: string
  if (isOverdue) label = `${Math.abs(diffDays)}d late`
  else if (diffDays === 0) label = 'Today'
  else if (diffDays === 1) label = 'Tomorrow'
  else label = `${diffDays}d`

  const color = isOverdue
    ? '#ff5a5a'
    : diffDays <= 1
    ? '#ffb545'
    : 'var(--color-cc-text-muted)'

  return (
    <span
      className="text-[12px] font-medium px-2 py-0.5 rounded-md"
      style={{
        color,
        background: isOverdue ? 'rgba(255, 90, 90, 0.1)' : 'rgba(255, 255, 255, 0.04)',
      }}
    >
      {label}
    </span>
  )
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    CREATED: 'created',
    STATUS_CHANGED: 'updated',
    ASSIGNED: 'assigned',
    COMMENTED: 'commented on',
    DELETED: 'removed',
  }
  return map[action] ?? action.toLowerCase()
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
