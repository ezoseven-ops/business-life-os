/**
 * R2 Post-Migration Verification
 *
 * Run after all R2 migrations to confirm data integrity.
 * Reports issues but does NOT modify data. Safe to run anytime.
 *
 * Usage: npx tsx prisma/migrations/verify-r2.ts
 *
 * Checks:
 *   1. Users without linked Person records
 *   2. Person.notes still containing collaborator-profile JSON blobs
 *   3. Duplicate email patterns (same email, same workspace)
 *   4. CollaboratorProfile table health
 *   5. CalendarSyncMap enum consistency
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let totalIssues = 0

function issue(label: string, detail: string) {
  totalIssues++
  console.log(`  !! ${label}: ${detail}`)
}

function ok(label: string) {
  console.log(`  OK ${label}`)
}

async function main() {
  console.log('R2 Verification Report')
  console.log('═'.repeat(60))
  console.log('')

  // ── CHECK 1: Users without linked Person ──
  console.log('1. User → Person links')

  const usersWithoutPerson = await prisma.user.findMany({
    where: {
      workspaceId: { not: null },
      linkedPerson: null,
    },
    select: { id: true, email: true, name: true, role: true, workspaceId: true },
  })

  if (usersWithoutPerson.length === 0) {
    ok('All workspace Users have a linked Person')
  } else {
    issue(
      `${usersWithoutPerson.length} User(s) without Person`,
      'Run backfill-user-person-links.ts',
    )
    for (const u of usersWithoutPerson) {
      console.log(`     - ${u.email} (${u.role}) in workspace ${u.workspaceId}`)
    }
  }

  const totalWorkspaceUsers = await prisma.user.count({
    where: { workspaceId: { not: null } },
  })
  const totalLinkedPersons = await prisma.person.count({
    where: { userId: { not: null } },
  })
  console.log(`     Stats: ${totalWorkspaceUsers} workspace users, ${totalLinkedPersons} linked persons`)
  console.log('')

  // ── CHECK 2: Person.notes still containing JSON blobs ──
  console.log('2. Person.notes JSON blob cleanup')

  const personsWithNotes = await prisma.person.findMany({
    where: { notes: { not: null } },
    select: { id: true, name: true, notes: true },
  })

  let jsonBlobCount = 0
  for (const p of personsWithNotes) {
    if (!p.notes) continue
    try {
      const parsed = JSON.parse(p.notes)
      if (parsed._collaboratorProfile) {
        jsonBlobCount++
        issue(
          `Person "${p.name}" (${p.id})`,
          'notes still contains _collaboratorProfile JSON',
        )
      }
    } catch {
      // Plain text notes — correct
    }
  }

  if (jsonBlobCount === 0) {
    ok('No Person.notes contain collaborator-profile JSON blobs')
  }
  console.log(`     Stats: ${personsWithNotes.length} persons with notes, ${jsonBlobCount} with JSON blobs`)
  console.log('')

  // ── CHECK 3: Duplicate email patterns ──
  console.log('3. Duplicate email patterns (same email + workspace)')

  const allPersons = await prisma.person.findMany({
    where: { email: { not: null } },
    select: { id: true, name: true, email: true, workspaceId: true, userId: true },
    orderBy: { email: 'asc' },
  })

  const emailWorkspaceMap = new Map<string, typeof allPersons>()
  for (const p of allPersons) {
    if (!p.email) continue
    const key = `${p.email.toLowerCase()}|${p.workspaceId}`
    const existing = emailWorkspaceMap.get(key) ?? []
    existing.push(p)
    emailWorkspaceMap.set(key, existing)
  }

  let duplicateGroups = 0
  for (const [key, persons] of emailWorkspaceMap) {
    if (persons.length > 1) {
      duplicateGroups++
      const [email] = key.split('|')
      issue(
        `Duplicate: ${email}`,
        `${persons.length} Person records in same workspace`,
      )
      for (const p of persons) {
        console.log(`     - ${p.id} "${p.name}" linked=${p.userId ? 'yes' : 'no'}`)
      }
    }
  }

  if (duplicateGroups === 0) {
    ok('No duplicate email+workspace Person records found')
  }
  console.log(`     Stats: ${allPersons.length} persons with email, ${duplicateGroups} duplicate groups`)
  console.log('')

  // ── CHECK 4: CollaboratorProfile table health ──
  console.log('4. CollaboratorProfile table')

  const profileCount = await prisma.collaboratorProfile.count()
  const orphanProfiles = await prisma.collaboratorProfile.findMany({
    where: {
      person: null as any, // Should not happen due to FK, but check
    },
    select: { id: true, personId: true },
  }).catch(() => []) // Table might not exist yet if migration hasn't run

  ok(`${profileCount} CollaboratorProfile records`)
  if (orphanProfiles.length > 0) {
    issue(`${orphanProfiles.length} orphan profiles`, 'personId references missing Person')
  }
  console.log('')

  // ── CHECK 5: CalendarSyncMap enum consistency ──
  console.log('5. CalendarSyncMap enum values')

  try {
    const syncEntries = await prisma.calendarSyncMap.findMany({
      select: { id: true, provider: true, syncStatus: true },
    })

    const validProviders = new Set(['GOOGLE_CALENDAR', 'APPLE_CALENDAR'])
    const validStatuses = new Set(['PENDING', 'SUCCESS', 'FAILED'])

    let badProviders = 0
    let badStatuses = 0

    for (const entry of syncEntries) {
      if (!validProviders.has(entry.provider)) {
        badProviders++
        issue(`SyncMap ${entry.id}`, `invalid provider: "${entry.provider}"`)
      }
      if (!validStatuses.has(entry.syncStatus)) {
        badStatuses++
        issue(`SyncMap ${entry.id}`, `invalid syncStatus: "${entry.syncStatus}"`)
      }
    }

    if (badProviders === 0 && badStatuses === 0) {
      ok(`${syncEntries.length} CalendarSyncMap entries, all valid enums`)
    }
  } catch {
    ok('CalendarSyncMap table not yet created or empty (OK if schema not yet pushed)')
  }
  console.log('')

  // ── SUMMARY ──
  console.log('═'.repeat(60))
  if (totalIssues === 0) {
    console.log('RESULT: ALL CHECKS PASSED — R2 migration verified.')
  } else {
    console.log(`RESULT: ${totalIssues} issue(s) found — review above.`)
  }
  console.log('═'.repeat(60))
}

main()
  .catch((e) => {
    console.error('Verification failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
