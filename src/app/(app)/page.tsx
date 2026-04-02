import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { getTodaysTasks } from '@/modules/tasks/task.queries'
import { getRecentActivity } from '@/modules/activity/activity.service'
import { getUnreadCount } from '@/modules/notifications/notification.service'
import { getOwnerSignals, getStaleTasks, dispatchLazyNudges } from '@/modules/operational/staleness.service'
import { formatRelativeTime } from '@/lib/utils'
import { TaskCheckbox } from '@/modules/tasks/components/TaskCheckbox'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const isOwner = session.user.role === 'OWNER'

  const [tasks, activity, unreadCount, ownerSignals, staleTasks] = await Promise.all([
    getTodaysTasks(session.user.workspaceId, session.user.id),
    getRecentActivity(session.user.workspaceId, 10),
    getUnreadCount(session.user.id),
    isOwner ? getOwnerSignals(session.user.workspaceId) : null,
    isOwner ? getStaleTasks(session.user.workspaceId) : null,
  ])

  // Lazy nudge dispatch for owner (fire-and-forget, non-blocking)
  if (isOwner) {
    dispatchLazyNudges(session.user.workspaceId, session.user.id).catch(() => {})
  }

  const greeting = getGreeting()
  const activeTasks = tasks.filter(t => t.status !== 'DONE')
  const doneTasks = tasks.filter(t => t.status === 'DONE')

  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <Header
        title="Home"
        action={
          <Link href="/notifications" className="relative p-2">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        }
      />

      <div className="px-4 py-5 max-w-lg mx-auto space-y-6 pb-24">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {greeting}, {session.user.name?.split(' ')[0] || 'there'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeTasks.length > 0
              ? `${activeTasks.length} task${activeTasks.length === 1 ? '' : 's'} to focus on today`
              : "You're all clear today"}
          </p>
        </div>

        {/* Owner Signals */}
        {isOwner && ownerSignals && (ownerSignals.overdueTasks > 0 || ownerSignals.waitingTasks > 0 || ownerSignals.unassignedTasks > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {ownerSignals.overdueTasks > 0 && (
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-600">{ownerSignals.overdueTasks}</p>
                <p className="text-[10px] font-medium text-red-500 uppercase">Overdue</p>
              </div>
            )}
            {ownerSignals.waitingTasks > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{ownerSignals.waitingTasks}</p>
                <p className="text-[10px] font-medium text-amber-500 uppercase">Waiting</p>
              </div>
            )}
            {ownerSignals.unassignedTasks > 0 && (
              <div className="bg-gray-100 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-600">{ownerSignals.unassignedTasks}</p>
                <p className="text-[10px] font-medium text-gray-500 uppercase">Unassigned</p>
              </div>
            )}
          </div>
        )}

        {/* Stale Tasks (Owner only) */}
        {isOwner && staleTasks && staleTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-bold text-red-600 mb-2">Needs Attention</h3>
            <div className="space-y-2">
              {staleTasks.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className={`block rounded-xl border p-3 ${
                    task.stalenessLevel === 'critical'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      task.stalenessLevel === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {task.stalenessLevel === 'critical' ? 'CRITICAL' : 'STALE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{task.stalenessReason}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{task.projectName}</span>
                    {task.assigneeName && (
                      <span className="text-[10px] text-gray-400">• {task.assigneeName}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          <Link href="/tasks?new=1" className="card card-hover flex flex-col items-center gap-2.5 p-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-700">Task</span>
          </Link>
          <Link href="/calendar/new" className="card card-hover flex flex-col items-center gap-2.5 p-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-700">Event</span>
          </Link>
          <Link href="/notes/new" className="card card-hover flex flex-col items-center gap-2.5 p-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-700">Note</span>
          </Link>
          <Link href="/voice" className="card card-hover flex flex-col items-center gap-2.5 p-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-700">Voice</span>
          </Link>
        </div>

        {/* Today's tasks */}
        {activeTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">Today&apos;s Focus</h3>
              <Link href="/tasks" className="text-sm font-medium text-primary">See all</Link>
            </div>
            <div className="space-y-2">
              {activeTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="card flex items-center gap-3 px-4 py-3.5">
                  <TaskCheckbox taskId={task.id} status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{task.project.name}</p>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Done tasks */}
        {doneTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Completed today</h3>
            <div className="space-y-1.5">
              {doneTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-50">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 line-through truncate">{task.title}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent activity */}
        {activity.length > 0 && (
          <section>
            <h3 className="text-base font-bold text-gray-900 mb-3">Activity</h3>
            <div className="space-y-3">
              {activity.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-500">
                      {item.user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{item.user.name || 'Someone'}</span>
                      {' '}{formatAction(item.action)}{' '}
                      a {item.entityType.toLowerCase().replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    COMMENTED: 'commented on',
    STATUS_CHANGED: 'changed status of',
    ASSIGNED: 'assigned',
  }
  return map[action] || action.toLowerCase()
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    URGENT: 'bg-red-50 text-red-600',
    HIGH: 'bg-orange-50 text-orange-600',
    MEDIUM: 'bg-blue-50 text-blue-600',
    LOW: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${styles[priority] || styles.MEDIUM}`}>
      {priority}
    </span>
  )
}
