import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getPeople } from '@/modules/people/people.service'
import { PeoplePageClient } from '@/modules/people/components/PeoplePageClient'
import Link from 'next/link'

function timeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

const avatarColors = [
  '#7c6ef6', '#2dd882', '#ffb545', '#ff5a5a',
  '#06b6d4', '#a855f7', '#14b8a6', '#f97316',
]

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const session = await auth()
  if (!session?.user?.workspaceId) return null

  const params = await searchParams
  const people = await getPeople(session.user.workspaceId)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header
        title="People"
        action={
          <Link prefetch={false} href="/people?new=1" style={{ color: 'var(--color-cc-accent)' }} className="font-medium text-sm">
            + Add
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        <PeoplePageClient showInitially={params.new === '1'} />

        {people.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Add collaborators and team members."
          />
        ) : (
          <div className="space-y-2">
            {people.map((person: any, idx: number) => {
              const profile = person.collaboratorProfile
              const lastMessage = person.messages?.[0]
              const avatarColor = avatarColors[idx % avatarColors.length]
              const channels: { label: string; color: string }[] = []
              if (person.telegramId) channels.push({ label: 'TG', color: 'var(--color-cc-info)' })
              if (person.whatsappId) channels.push({ label: 'WA', color: 'var(--color-cc-success)' })

              // Get projects from user's project memberships
              const projects = person.user?.projectMembers?.map((m: any) => m.project) ?? []

              return (
                <Link
                  key={person.id}
                  href={`/people/${person.id}`}
                  prefetch={false}
                  className="block rounded-2xl p-4 transition-all active:scale-[0.98]"
                  style={{ background: 'var(--color-cc-surface-subtle)', border: '1px solid var(--color-cc-border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: avatarColor + '1a' }}>
                      <span className="text-base font-bold" style={{ color: avatarColor }}>
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-cc-text)' }}>{person.name}</p>
                      {(person.company || profile?.role) && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-cc-text-secondary)' }}>
                          {profile?.role && <span>{profile.role}</span>}
                          {profile?.role && person.company && <span> · </span>}
                          {person.company && <span>{person.company}</span>}
                        </p>
                      )}
                    </div>
                    {lastMessage && (
                      <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>
                        {timeAgo(new Date(lastMessage.createdAt))}
                      </span>
                    )}
                  </div>

                  {profile?.skills && profile.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {profile.skills.slice(0, 4).map((skill: string) => (
                        <span key={skill} className="px-2 py-0.5 text-[11px] font-medium rounded-full" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-cc-text-secondary)' }}>
                          {skill}
                        </span>
                      ))}
                      {profile.skills.length > 4 && (
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full" style={{ backgroundColor: 'var(--color-cc-surface)', color: 'var(--color-cc-text-muted)' }}>
                          +{profile.skills.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Project membership */}
                  {projects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {projects.slice(0, 3).map((proj: any) => (
                        <span
                          key={proj.id}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{ backgroundColor: 'var(--color-cc-surface)', color: 'var(--color-cc-text-secondary)' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{
                            backgroundColor: proj.status === 'ACTIVE' ? 'var(--color-cc-success)' : proj.status === 'PAUSED' ? 'var(--color-cc-risk)' : 'var(--color-cc-text-muted)'
                          }} />
                          {proj.name}
                        </span>
                      ))}
                      {projects.length > 3 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ backgroundColor: 'var(--color-cc-surface)', color: 'var(--color-cc-text-muted)' }}>
                          +{projects.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-cc-surface-faint)' }}>
                    <div className="flex items-center gap-2">
                      {channels.map((ch) => (
                        <span key={ch.label} className="px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ backgroundColor: ch.color + '1a', color: ch.color }}>
                          {ch.label}
                        </span>
                      ))}
                      {channels.length === 0 && (
                        <span className="text-[11px]" style={{ color: 'var(--color-cc-text-muted)' }}>No channels</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-cc-text-muted)' }}>
                      {person._count.messages > 0 && (
                        <span>{person._count.messages} msg{person._count.messages !== 1 ? 's' : ''}</span>
                      )}
                      {profile?.availability && (
                        <span className="font-medium" style={{ color: profile.availability === 'HIGH' || profile.availability === 'FULL_TIME' ? 'var(--color-cc-success)' : profile.availability === 'MEDIUM' || profile.availability === 'PART_TIME' ? 'var(--color-cc-risk)' : 'var(--color-cc-text-muted)' }}>
                          {profile.availability.toLowerCase().replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
