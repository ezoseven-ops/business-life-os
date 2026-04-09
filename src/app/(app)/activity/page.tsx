import { auth } from '@/lib/auth'
import Link from 'next/link'
import { getRecentActivity } from '@/modules/activity/activity.service'

function formatAction(action: string): string {
  const map: Record<string, string> = {
    CREATED: 'created',
    STATUS_CHANGED: 'updated',
    ASSIGNED: 'assigned',
    COMMENTED: 'commented on',
    DELETED: 'removed',
    UPDATED: 'updated',
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

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const activities = await getRecentActivity(session.user.workspaceId, 50).catch(() => [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-cc-bg, #0a0a0f)' }}>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-cc-text, #fff)' }}
          >
            Activity
          </h1>
          <Link
            href="/"
          prefetch={false}
            className="text-[12px] font-medium"
            style={{ color: 'var(--color-cc-accent, #7c6ef6)' }}
          >
            Back
          </Link>
        </div>
      </div>

      <div className="px-5">
        {activities.length === 0 ? (
          <div className="text-center py-16">
            <p
              className="text-sm"
              style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
            >
              No activity yet
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {activities.map((act, i) => (
              <div
                key={act.id}
                className="flex items-center gap-3.5 py-3.5 px-4"
                style={{
                  borderBottom:
                    i < activities.length - 1
                      ? '1px solid rgba(255, 255, 255, 0.04)'
                      : 'none',
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      act.action === 'CREATED'
                        ? 'rgba(124, 110, 246, 0.12)'
                        : act.action === 'STATUS_CHANGED'
                          ? 'rgba(45, 216, 130, 0.12)'
                          : 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <span
                    className="w-[6px] h-[6px] rounded-full"
                    style={{
                      backgroundColor:
                        act.action === 'CREATED'
                          ? '#7c6ef6'
                          : act.action === 'STATUS_CHANGED'
                            ? '#2dd882'
                            : '#6b6b85',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[14px] truncate block font-medium"
                    style={{ color: 'var(--color-cc-text-secondary, #e0e0e8)' }}
                  >
                    {act.user?.name ?? 'System'}{' '}
                    <span style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}>
                      {formatAction(act.action)}{' '}
                      {act.entityType.toLowerCase()}
                    </span>
                  </span>
                </div>
                <span
                  className="text-[12px] flex-shrink-0"
                  style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
                >
                  {formatTime(act.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
