/**
 * Backfill Migration — User → Person Links
 *
 * Creates Person records for all workspace Users who don't have one.
 * Uses the same ensurePersonForUser() logic as the invitation acceptance flow
 * to guarantee consistent behavior.
 *
 * Safe to run multiple times — skips Users who already have a linked Person.
 * Safe to run in production — no destructive operations, only creates/links.
 *
 * Usage: npx tsx prisma/migrations/backfill-user-person-links.ts
 *
 * Run AFTER:
 *   - prisma db push / prisma migrate (schema is current)
 *   - prisma generate (client is fresh)
 *
 * Run BEFORE:
 *   - data-migration-r2.ts (CollaboratorProfile extraction)
 *     because new Person records may need profiles too
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Backfill: User → Person links')
  console.log('─'.repeat(50))

  // Get all Users that belong to a workspace
  const users = await prisma.user.findMany({
    where: {
      workspaceId: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      workspaceId: true,
    },
  })

  console.log(`Found ${users.length} workspace users.`)

  let linked = 0
  let created = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    if (!user.workspaceId) continue

    try {
      // 1. Already linked? Skip.
      const existingLinked = await prisma.person.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (existingLinked) {
        skipped++
        continue
      }

      // 2. Unlinked Person with matching email in this workspace? Link it.
      if (user.email) {
        const emailMatch = await prisma.person.findFirst({
          where: {
            workspaceId: user.workspaceId,
            email: user.email,
            userId: null,
          },
          select: { id: true },
        })

        if (emailMatch) {
          await prisma.person.update({
            where: { id: emailMatch.id },
            data: { userId: user.id },
          })
          linked++
          console.log(`  Linked: ${user.email} → existing Person ${emailMatch.id}`)
          continue
        }
      }

      // 3. No match — create new Person.
      const displayName = user.name || user.email.split('@')[0]
      const newPerson = await prisma.person.create({
        data: {
          name: displayName,
          email: user.email,
          workspaceId: user.workspaceId,
          userId: user.id,
        },
      })
      created++
      console.log(`  Created: ${user.email} → new Person ${newPerson.id}`)
    } catch (e) {
      // Person.userId is @unique — if we hit a conflict, someone else linked concurrently
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Unique constraint')) {
        console.log(`  Skipped (concurrent link): ${user.email}`)
        skipped++
      } else {
        console.error(`  Error for user ${user.id} (${user.email}):`, msg)
        errors++
      }
    }
  }

  console.log('')
  console.log('Backfill complete:')
  console.log(`  Skipped (already linked): ${skipped}`)
  console.log(`  Linked (email match):     ${linked}`)
  console.log(`  Created (new Person):     ${created}`)
  console.log(`  Errors:                   ${errors}`)

  // Verification: count Users without a linked Person
  const unlinked = await prisma.user.findMany({
    where: {
      workspaceId: { not: null },
      linkedPerson: null,
    },
    select: { id: true, email: true },
  })

  if (unlinked.length > 0) {
    console.log('')
    console.log(`WARNING: ${unlinked.length} workspace user(s) still without a Person:`)
    for (const u of unlinked) {
      console.log(`  - ${u.email} (${u.id})`)
    }
  } else {
    console.log('')
    console.log('Verification passed: all workspace Users have a linked Person.')
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
