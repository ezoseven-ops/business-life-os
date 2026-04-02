import { auth } from '@/lib/auth'
import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import { getPeople } from '@/modules/people/people.service'
import { PeoplePageClient } from '@/modules/people/components/PeoplePageClient'
import Link from 'next/link'

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
    <div>
      <Header
        title="People"
        action={
          <Link href="/people?new=1" className="text-primary font-medium text-sm">
            Add
          </Link>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto">
        <PeoplePageClient showInitially={params.new === '1'} />

        {people.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description="Add people you work with."
          />
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{person.name}</p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    {person.company && <span>{person.company}</span>}
                    {person._count.messages > 0 && <span>{person._count.messages} messages</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {person.telegramId && (
                    <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">T</span>
                  )}
                  {person.whatsappId && (
                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-[10px]">W</span>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
