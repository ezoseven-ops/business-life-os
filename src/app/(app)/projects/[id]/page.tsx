import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { getProjectById, getProjectActivity } from '@/modules/projects/project.queries'
import { getEventsByProject } from '@/modules/events/event.service'
import { EventTime } from '@/modules/events/components/EventTime'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { TaskCheckbox } from '@/modules/tasks/components/TaskCheckbox'
import { PhaseIndicator } from '@/modules/projects/components/PhaseIndicator'
import { ProjectMemberManager } from '@/modules/projects/components/ProjectMemberManager'
import ProjectPeopleManager from "@/modules/projects/components/ProjectPeopleManager"
import { getAvailablePeople } from "@/modules/projects/project-person.service"

const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
  ACTIVE: { text: 'Active', color: '#2dd882', bg: 'rgba(45,216,130,0.12)' },
  PAUSED: { text: 'Paused', color: '#ffb545', bg: 'rgba(255,181,69,0.12)' },
  DONE: { text: 'Done', color: '#7c6ef6', bg: 'rgba(124,110,246,0.12)' },
  ARCHIVED: { text: 'Archived', color: '#6b6b85', bg: 'rgba(255,255,255,0.05)' },
}

const priorityStyles: Record<string, { bg: string; color: string }> = {
  URGENT: { bg: 'rgba(255,90,90,0.12)', color: '#ff5a5a' },
  HIGH: { bg: 'rgba(255,181,69,0.12)', color: '#ffb545' },
  MEDIUM: { bg: 'rgba(124,110,246,0.12)', color: '#7c6ef6' },
  LOW: { bg: 'rgba(255,255,255,0.05)', color: '#6b6b85' },
}

const TABS = ['tasks', 'knowledge', 'activity'] as const
type Tab = (typeof TABS)[number]

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  tasks: {
    label: 'Tasks',
    icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  knowledge: {
    label: 'Knowledge',
    icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  },
  activity: {
    label: 'Activity',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
}

type NoteKind = 'decision' | 'session' | 'message' | 'note'

interface ParsedNote {
  kind: NoteKind
  title: string
  preview: string
  recipientName?: string
  channel?: string
  authorName: string | null
  updatedAt: Date
}

const NOTE_KIND_META: Record<NoteKind, { label: string; color: string; bg: string }> = {
  decision: { label: 'Decision', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  session: { label: 'Session', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  message: { label: 'Message Draft', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  note: { label: 'Note', color: '#2dd882', bg: 'rgba(45,216,130,0.12)' },
}

function classifyNote(note: {
  title: string | null
  content: string
  author: { name: string | null } | null
  updatedAt: Date
}): ParsedNote {
  try {
    const parsed = JSON.parse(note.content)
    if (parsed && typeof parsed === 'object' && parsed.captureType) {
      if (parsed.captureType === 'message') {
        return { kind: 'message', title: note.title ?? `Draft to ${parsed.recipientName}`, preview: parsed.body ?? '', recipientName: parsed.recipientName, channel: parsed.channel, authorName: note.author?.name ?? null, updatedAt: note.updatedAt }
      }
      if (parsed.captureType === 'decision') {
        return { kind: 'decision', title: note.title ?? 'Decision', preview: parsed.context ?? parsed.decision ?? '', authorName: note.author?.name ?? null, updatedAt: note.updatedAt }
      }
      if (parsed.captureType === 'session') {
        return { kind: 'session', title: note.title ?? 'Session', preview: parsed.summary ?? parsed.outcome ?? '', authorName: note.author?.name ?? null, updatedAt: note.updatedAt }
      }
    }
  } catch { /* plain text */ }
  return { kind: 'note', title: note.title ?? 'Untitled', preview: note.content, authorName: note.author?.name ?? null, updatedAt: note.updatedAt }
}

const ACTION_META: Record<string, { verb: string; icon: string; color: string }> = {
  CREATED: { verb: 'created', icon: 'M12 4.5v15m7.5-7.5h-15', color: '#2dd882' },
  UPDATED: { verb: 'updated', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z', color: '#3b82f6' },
  DELETED: { verb: 'removed', icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0', color: '#ff5a5a' },
  COMMENTED: { verb: 'commented on', icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z', color: '#ffb545' },
  STATUS_CHANGED: { verb: 'changed status of', icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5', color: '#a855f7' },
  ASSIGNED: { verb: 'assigned', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0', color: '#06b6d4' },
}

const ENTITY_LABELS: Record<string, string> = {
  TASK: 'task', NOTE: 'note', PROJECT: 'project', MESSAGE: 'message',
  VOICE_NOTE: 'voice note', FILE: 'file', PERSON: 'person', EVENT: 'event',
}

function formatActivityLine(activity: { action: string; entityType: string; metadata: unknown; user: { name: string | null } }): string {
  const meta = ACTION_META[activity.action] ?? ACTION_META.CREATED
  const entity = ENTITY_LABELS[activity.entityType] ?? 'item'
  const md = activity.metadata as Record<string, unknown> | null
  const captureType = md?.type as string | undefined
  if (md?.source === 'capture' && captureType) {
    const typeLabel = captureType === 'task_bundle' ? 'tasks' : captureType === 'follow_up' ? 'follow-up' : captureType
    return `${activity.user.name ?? 'Someone'} ${meta.verb} a ${typeLabel} via capture`
  }
  return `${activity.user.name ?? 'Someone'} ${meta.verb} a ${entity}`
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const { id } = await params
  const { tab: rawTab } = await searchParams

  const project = await getProjectById(id, session.user.workspaceId)
  const availablePeople = await getAvailablePeople(id, session.user.workspaceId)
  if (!project) notFound()

  const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'tasks'

  const activities = activeTab === 'activity'
    ? await getProjectActivity(id, 20)
    : []

  const now = new Date()
  const allProjectEvents = await getEventsByProject(id, session.user.workspaceId)
  const upcomingEvents = allProjectEvents.filter((e) => new Date(e.startAt) >= now)

  const activeTasks = project.tasks.filter((t) => t.status !== 'DONE')
  const doneTasks = project.tasks.filter((t) => t.status === 'DONE')
  const cfg = statusLabel[project.status] || statusLabel.ACTIVE

  const classifiedNotes = project.notes.map(classifyNote)
  const notesByKind = {
    decision: classifiedNotes.filter((n) => n.kind === 'decision'),
    session: classifiedNotes.filter((n) => n.kind === 'session'),
    message: classifiedNotes.filter((n) => n.kind === 'message'),
    note: classifiedNotes.filter((n) => n.kind === 'note'),
  }

  return (
    <>
      <Header
        title={project.name}
        backHref="/projects"
        action={
          <Link href={`/tasks?new=1&projectId=${project.id}`} className="text-sm font-semibold" style={{ color: '#7c6ef6' }}>
            + Task
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto space-y-5 pb-4">
        {/* Project header card */}
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              {project.description && (
                <p className="text-sm leading-relaxed" style={{ color: '#a0a0b8' }}>{project.description}</p>
              )}
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
              {cfg.text}
            </span>
          </div>

          <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <PhaseIndicator
              projectId={project.id}
              currentPhase={project.phase ?? 'PLANNING'}
              canEdit={session.user.role === 'OWNER' || session.user.role === 'TEAM'}
            />
          </div>

          <div className="flex items-center gap-6 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#f0f0f5' }}>{project._count.tasks}</p>
              <p className="text-[11px] font-medium" style={{ color: '#6b6b85' }}>Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#2dd882' }}>{doneTasks.length}</p>
              <p className="text-[11px] font-medium" style={{ color: '#6b6b85' }}>Done</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#f0f0f5' }}>{project._count.notes}</p>
              <p className="text-[11px] font-medium" style={{ color: '#6b6b85' }}>Notes</p>
            </div>
            {project._count.tasks > 0 && (
              <div className="flex-1">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: '#2dd882', width: `${Math.round((doneTasks.length / project._count.tasks) * 100)}%` }} />
                </div>
                <p className="text-[10px] mt-1 text-right" style={{ color: '#6b6b85' }}>
                  {Math.round((doneTasks.length / project._count.tasks) * 100)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Members — interactive management */}
        <ProjectMemberManager
          projectId={project.id}
          members={project.projectMembers as any}
          canEdit={session.user.role === 'OWNER' || session.user.role === 'TEAM'}
        />

        {/* People — non-user associations */}
        <ProjectPeopleManager
          projectId={project.id}
          projectPeople={(project.projectPeople ?? []) as any}
          availablePeople={availablePeople as any}
          canManage={session.user.role === 'OWNER' || session.user.role === 'TEAM'}
        />

        {/* Upcoming Events */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#a0a0b8' }}>Upcoming Events</h3>
              {upcomingEvents.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#6b6b85', backgroundColor: 'rgba(255,255,255,0.06)' }}>{upcomingEvents.length}</span>
              )}
            </div>
            <Link
              href={`/calendar/new?projectId=${id}`}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: '#7c6ef6' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Event
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}?from=project`}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(124,110,246,0.12)' }}>
                    <EventTime date={event.startAt} format="month-short" className="text-[10px] font-bold uppercase leading-none" style={{ color: '#7c6ef6' }} />
                    <EventTime date={event.startAt} format="day" className="text-sm font-bold leading-none mt-0.5" style={{ color: '#7c6ef6' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#f0f0f5' }}>{event.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6b6b85' }}>
                      <EventTime date={event.startAt} format="time" />
                      {event.endAt && <EventTime date={event.endAt} format="time" prefix=" – " />}
                    </p>
                  </div>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#6b6b85' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center py-4" style={{ color: '#6b6b85' }}>No upcoming events</p>
          )}
        </section>

        {/* Tab navigation */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          {TABS.map((t) => {
            const meta = TAB_META[t]
            const isActive = t === activeTab
            return (
              <Link
                key={t}
                href={`/projects/${id}?tab=${t}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all"
                style={isActive
                  ? { backgroundColor: 'rgba(255,255,255,0.08)', color: '#f0f0f5' }
                  : { color: '#6b6b85' }
                }
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2 : 1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                </svg>
                {meta.label}
              </Link>
            )
          })}
        </div>

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <>
            {activeTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#a0a0b8' }}>Active</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#6b6b85', backgroundColor: 'rgba(255,255,255,0.06)' }}>{activeTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {activeTasks.map((task) => {
                    const ps = priorityStyles[task.priority] || priorityStyles.LOW
                    return (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <TaskCheckbox taskId={task.id} status={task.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#f0f0f5' }}>{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.dueDate && <span className="text-xs" style={{ color: '#6b6b85' }}>{formatDate(task.dueDate)}</span>}
                            {task.assignee && (
                              <>
                                {task.dueDate && <span style={{ color: 'rgba(255,255,255,0.1)' }}>&middot;</span>}
                                <span className="text-xs" style={{ color: '#6b6b85' }}>{task.assignee.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: ps.bg, color: ps.color }}>{task.priority}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {doneTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#2dd882' }}>Completed</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#6b6b85', backgroundColor: 'rgba(255,255,255,0.06)' }}>{doneTasks.length}</span>
                </div>
                <div className="space-y-1.5">
                  {doneTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(45,216,130,0.15)' }}>
                        <svg className="w-3 h-3" style={{ color: '#2dd882' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-sm line-through truncate" style={{ color: '#6b6b85' }}>{task.title}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {project.tasks.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <svg className="w-6 h-6" style={{ color: '#6b6b85' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: '#6b6b85' }}>No tasks yet</p>
                <Link href={`/tasks?new=1&projectId=${project.id}`} className="inline-block mt-3 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7c6ef6' }}>
                  Add first task
                </Link>
              </div>
            )}
          </>
        )}

        {/* KNOWLEDGE TAB */}
        {activeTab === 'knowledge' && (
          <>
            {classifiedNotes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <svg className="w-6 h-6" style={{ color: '#6b6b85' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: '#6b6b85' }}>No knowledge yet</p>
                <p className="text-xs mt-1" style={{ color: '#6b6b85' }}>Capture decisions, notes, or sessions to build project knowledge</p>
              </div>
            ) : (
              <>
                {(['decision', 'session', 'message', 'note'] as NoteKind[]).map((kind) => {
                  const items = notesByKind[kind]
                  if (items.length === 0) return null
                  const kindMeta = NOTE_KIND_META[kind]
                  return (
                    <section key={kind}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ backgroundColor: kindMeta.bg, color: kindMeta.color }}>{kindMeta.label}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#6b6b85', backgroundColor: 'rgba(255,255,255,0.06)' }}>{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((note, i) => (
                          <NoteCard key={`${kind}-${i}`} note={note} kind={kind} />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <>
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <svg className="w-6 h-6" style={{ color: '#6b6b85' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: '#6b6b85' }}>No activity yet</p>
                <p className="text-xs mt-1" style={{ color: '#6b6b85' }}>Activity will appear here as you work on this project</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((activity, i) => {
                  const actionMeta = ACTION_META[activity.action] ?? ACTION_META.CREATED
                  const isLast = i === activities.length - 1
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: actionMeta.color + '1a' }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={actionMeta.color}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={actionMeta.icon} />
                          </svg>
                        </div>
                        {!isLast && <div className="w-px flex-1 min-h-[16px]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm leading-snug" style={{ color: '#a0a0b8' }}>{formatActivityLine(activity)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#6b6b85' }}>{formatRelativeTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function NoteCard({ note, kind }: { note: ParsedNote; kind: NoteKind }) {
  const kindMeta = NOTE_KIND_META[kind]
  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start gap-2 mb-1.5">
        <h4 className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: '#f0f0f5' }}>{note.title}</h4>
      </div>
      {kind === 'message' && note.recipientName && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>To: {note.recipientName}</span>
          {note.channel && note.channel !== 'unknown' && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6b6b85' }}>{note.channel}</span>
          )}
        </div>
      )}
      {note.preview && <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#a0a0b8' }}>{note.preview}</p>}
      <div className="flex items-center gap-2 mt-2.5">
        {note.authorName && (
          <>
            <span className="text-[11px]" style={{ color: '#6b6b85' }}>{note.authorName}</span>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>&middot;</span>
          </>
        )}
        <span className="text-[11px]" style={{ color: '#6b6b85' }}>{formatRelativeTime(note.updatedAt)}</span>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: kindMeta.bg, color: kindMeta.color }}>{kindMeta.label}</span>
      </div>
    </div>
  )
}
