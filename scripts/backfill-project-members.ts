/**
 * Backfill script: Create ProjectMember records for existing users.
 *
 * After adding the ProjectMember model, existing OWNER/TEAM users need
 * ProjectMember entries for all projects in their workspace.
 *
 * Run: npx tsx scripts/backfill-project-members.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting ProjectMember backfill...')

  // Get all workspaces
  const workspaces = await prisma.workspace.findMany({
    include: {
      members: { select: { id: true, role: true } },
      projects: { select: { id: true } },
    },
  })

  let created = 0

  for (const workspace of workspaces) {
    for (const member of workspace.members) {
      // Map UserRole to ProjectMemberRole
      // Map UserRole → ProjectMemberRole: OWNER→LEAD, CLIENT→VIEWER, TEAM→CONTRIBUTOR
      const projectRole = member.role === 'OWNER' ? 'LEAD' : member.role === 'CLIENT' ? 'VIEWER' : 'CONTRIBUTOR'

      for (const project of workspace.projects) {
        try {
          await prisma.projectMember.create({
            data: {
              userId: member.id,
              projectId: project.id,
              role: projectRole as any,
            },
          })
          created++
        } catch {
          // Skip duplicates (already exists)
        }
      }
    }
  }

  console.log(`Created ${created} ProjectMember records.`)
  console.log('Backfill complete.')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
