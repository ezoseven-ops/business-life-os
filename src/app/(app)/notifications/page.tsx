import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getNotifications } from '@/modules/notifications/notification.service'
import { formatRelativeTime } from '@/lib/utils'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const notifications = await getNotifications(session.user.id)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Notifications" backHref="/" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {notifications.length === 0 ? (
          <EmptyState
            title="No notifications"
            description="Nothing to review right now."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3 rounded-xl"
                style={{
                  background: notif.read ? 'var(--color-cc-surface-subtle)' : 'rgba(124,110,246,0.08)',
                  border: notif.read ? '1px solid var(--color-cc-border)' : '1px solid rgba(124,110,246,0.2)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-cc-text)', fontWeight: notif.read ? 400 : 600 }}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--color-cc-text-secondary)' }}>{notif.body}</p>
                    )}
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--color-cc-accent)' }} />
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-cc-text-muted)' }}>
                  {formatRelativeTime(notif.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
