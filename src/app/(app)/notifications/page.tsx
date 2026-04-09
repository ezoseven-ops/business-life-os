import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getNotifications } from '@/modules/notifications/notification.service'
import { formatRelativeTime, cn } from '@/lib/utils'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const notifications = await getNotifications(session.user.id)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
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
                className={cn(
                  'p-3 rounded-xl border',
                  notif.read
                    ? 'bg-surface border-border'
                    : 'bg-primary/5 border-primary/20',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn('text-sm', !notif.read && 'font-semibold')}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-sm text-text-secondary mt-0.5">{notif.body}</p>
                    )}
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1">
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
