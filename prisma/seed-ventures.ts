import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed ventures and backfill existing projects.
 * Run AFTER the main seed and the ventures migration.
 *
 *   npx tsx prisma/seed-ventures.ts
 */
async function main() {
  console.log('Seeding ventures + backfilling projects...\n')

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)

  // Find the workspace
  const workspace = await prisma.workspace.findFirst()
  if (!workspace) {
    console.error('No workspace found. Run the main seed first.')
    process.exit(1)
  }

  // ── VENTURES ──

  const ventureProduct = await prisma.venture.upsert({
    where: { id: 'seed-venture-product' },
    update: {},
    create: {
      id: 'seed-venture-product',
      name: 'Business Life OS',
      priority: 1, // top priority
      status: 'ACTIVE',
      workspaceId: workspace.id,
    },
  })

  const ventureAgency = await prisma.venture.upsert({
    where: { id: 'seed-venture-agency' },
    update: {},
    create: {
      id: 'seed-venture-agency',
      name: 'Agency Services',
      priority: 3,
      status: 'ACTIVE',
      workspaceId: workspace.id,
    },
  })

  const ventureSide = await prisma.venture.upsert({
    where: { id: 'seed-venture-side' },
    update: {},
    create: {
      id: 'seed-venture-side',
      name: 'Side Project X',
      priority: 5,
      status: 'PAUSED',
      workspaceId: workspace.id,
    },
  })

  console.log('  Ventures: 3 (Business Life OS p1, Agency p3, Side Project p5)')

  // ── BACKFILL existing projects ──

  // Mobile App → Business Life OS venture, P0
  await prisma.project.update({
    where: { id: 'seed-proj-app' },
    data: {
      ventureId: ventureProduct.id,
      projectPriority: 'P0',
    },
  })

  // Marketing Website → Business Life OS venture, P1
  await prisma.project.update({
    where: { id: 'seed-proj-web' },
    data: {
      ventureId: ventureProduct.id,
      projectPriority: 'P1',
    },
  })

  console.log('  Projects backfilled: Mobile App → P0, Marketing Website → P1')

  // ── Add a couple more projects for variety ──

  await prisma.project.upsert({
    where: { id: 'seed-proj-client-site' },
    update: {},
    create: {
      id: 'seed-proj-client-site',
      name: 'Acme Corp Website',
      description: 'Client website redesign project',
      status: 'ACTIVE',
      projectPriority: 'P1',
      workspaceId: workspace.id,
      ownerId: (await prisma.user.findFirst({ where: { role: 'OWNER' } }))!.id,
      ventureId: ventureAgency.id,
    },
  })

  await prisma.project.upsert({
    where: { id: 'seed-proj-experiment' },
    update: {},
    create: {
      id: 'seed-proj-experiment',
      name: 'AI Chat Widget',
      description: 'Experimental side project',
      status: 'PAUSED',
      projectPriority: 'P3',
      workspaceId: workspace.id,
      ownerId: (await prisma.user.findFirst({ where: { role: 'OWNER' } }))!.id,
      ventureId: ventureSide.id,
    },
  })

  console.log('  New projects: Acme Corp Website (Agency, P1), AI Chat Widget (Side, P3)')

  // ── BACKFILL lastActivityAt on tasks ──

  const tasks = await prisma.task.findMany({ select: { id: true, updatedAt: true } })
  for (const task of tasks) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "lastActivityAt" = "updatedAt" WHERE "id" = $1`,
      task.id,
    )
  }

  console.log(`  Backfilled lastActivityAt for ${tasks.length} tasks`)

  // ── Add tasks to new projects for signal engine demo ──

  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } })
  const team = await prisma.user.findFirst({ where: { role: 'TEAM' } })

  const extraTasks = [
    {
      id: 'seed-task-acme-1',
      title: 'Design homepage mockups',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      projectId: 'seed-proj-client-site',
      creatorId: owner!.id,
      assigneeId: team!.id,
      dueDate: daysAgo(-2), // due in 2 days
    },
    {
      id: 'seed-task-acme-2',
      title: 'Collect client brand guidelines',
      status: 'WAITING' as const,
      priority: 'URGENT' as const,
      projectId: 'seed-proj-client-site',
      creatorId: owner!.id,
      assigneeId: null,
      dueDate: daysAgo(2), // 2 days overdue
    },
    {
      id: 'seed-task-side-1',
      title: 'Research embedding models',
      status: 'TODO' as const,
      priority: 'LOW' as const,
      projectId: 'seed-proj-experiment',
      creatorId: owner!.id,
      assigneeId: owner!.id,
    },
  ]

  for (const t of extraTasks) {
    const { id, dueDate, ...data } = t
    await prisma.task.upsert({
      where: { id },
      update: {},
      create: { id, ...data, dueDate: dueDate ?? null },
    })
  }

  // Set stale lastActivityAt for signal demo
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "lastActivityAt" = $1 WHERE "id" = $2`,
    daysAgo(5),
    'seed-task-acme-2',
  )
  await prisma.$executeRawUnsafe(
    `UPDATE "Task" SET "lastActivityAt" = $1 WHERE "id" = $2`,
    daysAgo(10),
    'seed-task-side-1',
  )

  console.log('  Extra tasks: 3 (agency + side project)')

  console.log('\n✅ Venture seed complete!')
  console.log('─'.repeat(50))
  console.log('VENTURES:')
  console.log('  Business Life OS  — priority 1 (top)')
  console.log('  Agency Services   — priority 3')
  console.log('  Side Project X    — priority 5 (lowest, paused)')
  console.log('\nPROJECTS:')
  console.log('  Mobile App         → BLO venture, P0')
  console.log('  Marketing Website  → BLO venture, P1')
  console.log('  Acme Corp Website  → Agency venture, P1')
  console.log('  AI Chat Widget     → Side venture, P3 (paused)')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
