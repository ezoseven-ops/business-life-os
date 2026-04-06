/**
 * R2 Data Migration — CollaboratorProfile extraction
 *
 * Migrates collaborator profile data from Person.notes JSON blob
 * into the new CollaboratorProfile table.
 *
 * Run AFTER `prisma migrate dev` or `prisma db push` has created the new table.
 *
 * Usage: npx tsx prisma/migrations/data-migration-r2.ts
 *
 * Safe to run multiple times — skips persons who already have a CollaboratorProfile row.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map old lowercase preferredChannel values to new enum values
const CHANNEL_MAP: Record<string, string> = {
  telegram: 'TELEGRAM',
  whatsapp: 'WHATSAPP',
  email: 'EMAIL',
  internal: 'INTERNAL',
}

// Map old availability values (already uppercase, but ensure consistency)
const AVAILABILITY_VALUES = new Set([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'OCCASIONAL',
  'UNKNOWN',
])

async function main() {
  console.log('R2 Data Migration: Starting CollaboratorProfile extraction...')

  // Get all persons with non-null notes
  const persons = await prisma.person.findMany({
    where: { notes: { not: null } },
    select: { id: true, notes: true },
  })

  console.log(`Found ${persons.length} persons with notes.`)

  let migrated = 0
  let skipped = 0
  let cleaned = 0
  let errors = 0

  for (const person of persons) {
    if (!person.notes) continue

    try {
      const parsed = JSON.parse(person.notes)

      // Only process if it contains our collaborator profile blob
      if (!parsed._collaboratorProfile) {
        skipped++
        continue
      }

      const profile = parsed._collaboratorProfile

      // Check if CollaboratorProfile already exists for this person
      const existing = await prisma.collaboratorProfile.findUnique({
        where: { personId: person.id },
      })

      if (existing) {
        skipped++
        continue
      }

      // Map preferredChannel from lowercase to enum
      let preferredChannel: string | null = null
      if (profile.preferredChannel) {
        preferredChannel =
          CHANNEL_MAP[profile.preferredChannel] ?? null
      }

      // Validate availability
      let availability = 'UNKNOWN'
      if (
        profile.availability &&
        AVAILABILITY_VALUES.has(profile.availability)
      ) {
        availability = profile.availability
      }

      // Create the CollaboratorProfile row
      await prisma.collaboratorProfile.create({
        data: {
          personId: person.id,
          role: profile.role ?? null,
          skills: Array.isArray(profile.skills) ? profile.skills : [],
          strengths: Array.isArray(profile.strengths)
            ? profile.strengths
            : [],
          availability: availability as any,
          reliabilityScore:
            typeof profile.reliabilityScore === 'number'
              ? Math.max(0, Math.min(100, profile.reliabilityScore))
              : 50,
          timezone: profile.timezone ?? null,
          preferredChannel: preferredChannel as any,
          lastProfileUpdate: profile.lastProfileUpdate
            ? new Date(profile.lastProfileUpdate)
            : null,
        },
      })

      // Clean Person.notes — restore plain text or set null
      const plainNotes = parsed._plainNotes ?? null
      await prisma.person.update({
        where: { id: person.id },
        data: { notes: plainNotes },
      })

      migrated++
      cleaned++
    } catch (e) {
      // Notes are plain text (not JSON), leave as-is
      if (e instanceof SyntaxError) {
        skipped++
      } else {
        console.error(`Error migrating person ${person.id}:`, e)
        errors++
      }
    }
  }

  console.log(`\nR2 Data Migration Complete:`)
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log(`  Cleaned:  ${cleaned} (notes restored to plain text)`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
