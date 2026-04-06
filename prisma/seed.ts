import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database for RBAC testing...\n')

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)

  // ──────────────────────────────────────
  // 1. USERS — 3 roles
  // ──────────────────────────────────────

  const owner = await prisma.user.upsert({
    where: { email: 'karol@businesslifeos.com' },
    update: { role: 'OWNER' },
    create: {
      email: 'karol@businesslifeos.com',
      name: 'Karol (Owner)',
      role: 'OWNER',
      emailVerified: new Date(),
    },
  })

  const teamMember = await prisma.user.upsert({
    where: { email: 'anna@businesslifeos.com' },
    update: { role: 'TEAM' },
    create: {
      email: 'anna@businesslifeos.com',
      name: 'Anna (Team)',
      role: 'TEAM',
      emailVerified: new Date(),
    },
  })

  const client = await prisma.user.upsert({
    where: { email: 'client@acme.com' },
    update: { role: 'CLIENT' },
    create: {
      email: 'client@acme.com',
      name: 'John (Client)',
      role: 'CLIENT',
      emailVerified: new Date(),
    },
  })

  console.log('  Users created: Owner, Team, Client')

  // ──────────────────────────────────────
  // 2. WORKSPACE
  // ──────────────────────────────────────

  const workspace = await prisma.workspace.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      name: "Karol's Workspace",
      slug: 'karol-workspace',
      ownerId: owner.id,
    },
  })

  // Link all users to workspace
  await prisma.user.updateMany({
    where: { id: { in: [owner.id, teamMember.id, client.id] } },
    data: { workspaceId: workspace.id },
  })

  console.log('  Workspace created + all users linked')

  // ──────────────────────────────────────
  // 2b. PERSON records for each User (Person ↔ User bridge)
  // ──────────────────────────────────────

  const userPersonPairs = [
    { user: owner, name: 'Karol (Owner)' },
    { user: teamMember, name: 'Anna (Team)' },
    { user: client, name: 'John (Client)' },
  ]

  for (const { user } of userPersonPairs) {
    // Only create if no Person is already linked to this User
    const existing = await prisma.person.findUnique({ where: { userId: user.id } })
    if (!existing) {
      await prisma.person.create({
        data: {
          name: user.name ?? user.email.split('@')[0],
          email: user.email,
          workspaceId: workspace.id,
          userId: user.id,
        },
      })
    }
  }

  console.log('  Person records linked to all users')

  // ──────────────────────────────────────
  // 3. PROJECTS — 2 projects
  // ──────────────────────────────────────

  const projectApp = await prisma.project.upsert({
    where: { id: 'seed-proj-app' },
    update: {},
    create: {
      id: 'seed-proj-app',
      name: 'Mobile App',
      description: 'Main product — PWA mobile app',
      status: 'ACTIVE',
      workspaceId: workspace.id,
      ownerId: owner.id,
    },
  })

  const projectWebsite = await prisma.project.upsert({
    where: { id: 'seed-proj-web' },
    update: {},
    create: {
      id: 'seed-proj-web',
      name: 'Marketing Website',
      description: 'Landing page and blog',
      status: 'ACTIVE',
      workspaceId: workspace.id,
      ownerId: owner.id,
    },
  })

  console.log('  Projects: Mobile App, Marketing Website')

  // ──────────────────────────────────────
  // 4. PROJECT MEMBERS
  // ──────────────────────────────────────

  const projectMembers = [
    // Owner = LEAD on both projects
    { userId: owner.id, projectId: projectApp.id, role: 'LEAD' as const },
    { userId: owner.id, projectId: projectWebsite.id, role: 'LEAD' as const },
    // Team = CONTRIBUTOR on both
    { userId: teamMember.id, projectId: projectApp.id, role: 'CONTRIBUTOR' as const },
    { userId: teamMember.id, projectId: projectWebsite.id, role: 'CONTRIBUTOR' as const },
    // Client = VIEWER on Mobile App ONLY (not website)
    { userId: client.id, projectId: projectApp.id, role: 'VIEWER' as const },
  ]

  for (const pm of projectMembers) {
    await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: pm.userId, projectId: pm.projectId } },
      update: { role: pm.role },
      create: pm,
    })
  }

  console.log('  ProjectMembers: Owner=LEAD both, Team=CONTRIBUTOR both, Client=VIEWER app only')

  // ──────────────────────────────────────
  // 5. TASKS — varied statuses, assignments
  // ──────────────────────────────────────

  const taskData = [
    // Mobile App tasks
    {
      id: 'seed-task-1',
      title: 'Set up CI/CD pipeline',
      status: 'DONE' as const,
      priority: 'HIGH' as const,
      projectId: projectApp.id,
      creatorId: owner.id,
      assigneeId: teamMember.id,
      updatedAt: daysAgo(2),
    },
    {
      id: 'seed-task-2',
      title: 'Implement push notifications',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      projectId: projectApp.id,
      creatorId: owner.id,
      assigneeId: teamMember.id,
      updatedAt: hoursAgo(6),
    },
    {
      id: 'seed-task-3',
      title: 'Review app store screenshots',
      description: 'Client needs to review and approve the screenshots before submission.',
      status: 'WAITING' as const,
      priority: 'MEDIUM' as const,
      projectId: projectApp.id,
      creatorId: owner.id,
      assigneeId: client.id,  // ← assigned to CLIENT
      updatedAt: daysAgo(3),  // stale — 3 days in WAITING
    },
    {
      id: 'seed-task-4',
      title: 'Provide brand assets',
      description: 'We need logo files, color palette, and fonts from client.',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      projectId: projectApp.id,
      creatorId: teamMember.id,
      assigneeId: client.id,  // ← assigned to CLIENT
      dueDate: daysAgo(1),    // overdue!
      updatedAt: daysAgo(4),
    },
    {
      id: 'seed-task-5',
      title: 'Fix memory leak on dashboard',
      status: 'TODO' as const,
      priority: 'URGENT' as const,
      projectId: projectApp.id,
      creatorId: owner.id,
      assigneeId: null,        // unassigned
      updatedAt: daysAgo(5),   // stale — 5 days
    },
    {
      id: 'seed-task-6',
      title: 'Add dark mode toggle',
      status: 'TODO' as const,
      priority: 'LOW' as const,
      projectId: projectApp.id,
      creatorId: teamMember.id,
      assigneeId: teamMember.id,
      updatedAt: hoursAgo(12),
    },
    // Website tasks
    {
      id: 'seed-task-7',
      title: 'Write landing page copy',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      projectId: projectWebsite.id,
      creatorId: owner.id,
      assigneeId: owner.id,
      updatedAt: hoursAgo(2),
    },
    {
      id: 'seed-task-8',
      title: 'SEO audit',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      projectId: projectWebsite.id,
      creatorId: owner.id,
      assigneeId: teamMember.id,
      updatedAt: daysAgo(1),
    },
  ]

  for (const t of taskData) {
    const { id, updatedAt, dueDate, ...data } = t
    await prisma.task.upsert({
      where: { id },
      update: {},
      create: { id, ...data, dueDate: dueDate ?? null },
    })
    // Force updatedAt via raw update (Prisma auto-sets it)
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "updatedAt" = $1 WHERE "id" = $2`,
      updatedAt,
      id,
    )
  }

  console.log('  Tasks: 8 total (2 client-assigned, 1 overdue, 1 unassigned, varied statuses)')

  // ──────────────────────────────────────
  // 6. COMMENTS — normal + internal
  // ──────────────────────────────────────

  const comments = [
    // Normal comments on task-3 (client's task)
    {
      id: 'seed-comment-1',
      content: 'Screenshots uploaded to the shared drive. Please review when you can.',
      taskId: 'seed-task-3',
      authorId: teamMember.id,
      internal: false,
      createdAt: daysAgo(2),
    },
    {
      id: 'seed-comment-2',
      content: 'Thanks, I will check them tomorrow.',
      taskId: 'seed-task-3',
      authorId: client.id,
      internal: false,
      createdAt: daysAgo(1),
    },
    // INTERNAL comment — client should NOT see this
    {
      id: 'seed-comment-3',
      content: 'FYI: client is slow to respond. If no reply by Friday, escalate to their PM.',
      taskId: 'seed-task-3',
      authorId: owner.id,
      internal: true,
      createdAt: hoursAgo(12),
    },
    // Comment on task-4 (client's overdue task)
    {
      id: 'seed-comment-4',
      content: 'This is blocking our design work. Please prioritize.',
      taskId: 'seed-task-4',
      authorId: teamMember.id,
      internal: false,
      createdAt: daysAgo(1),
    },
    // Internal comment on task-5
    {
      id: 'seed-comment-5',
      content: 'Likely caused by the new staleness service polling. Check getStaleTasks query.',
      taskId: 'seed-task-5',
      authorId: owner.id,
      internal: true,
      createdAt: hoursAgo(3),
    },
    // Comment on website task
    {
      id: 'seed-comment-6',
      content: 'First draft of hero section is ready for review.',
      taskId: 'seed-task-7',
      authorId: owner.id,
      internal: false,
      createdAt: hoursAgo(1),
    },
  ]

  for (const c of comments) {
    const { id, createdAt, ...data } = c
    await prisma.comment.upsert({
      where: { id },
      update: {},
      create: { id, ...data },
    })
  }

  console.log('  Comments: 6 total (2 internal, 4 normal)')

  // ──────────────────────────────────────
  // 7. PEOPLE (CRM contacts)
  // ──────────────────────────────────────

  await prisma.person.upsert({
    where: { id: 'seed-person-1' },
    update: {},
    create: {
      id: 'seed-person-1',
      name: 'John Smith',
      email: 'john@acme.com',
      company: 'Acme Corp',
      telegramId: '123456789',
      workspaceId: workspace.id,
    },
  })

  await prisma.person.upsert({
    where: { id: 'seed-person-2' },
    update: {},
    create: {
      id: 'seed-person-2',
      name: 'Sarah Lee',
      email: 'sarah@partner.co',
      company: 'Partner Co',
      phone: '+1234567890',
      workspaceId: workspace.id,
    },
  })

  console.log('  People: 2 contacts')

  // ──────────────────────────────────────
  // 8. EVENTS
  // ──────────────────────────────────────

  await prisma.event.upsert({
    where: { id: 'seed-event-1' },
    update: {},
    create: {
      id: 'seed-event-1',
      title: 'Sprint Review',
      description: 'Demo new features to stakeholders.',
      startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      endAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // +1h
      workspaceId: workspace.id,
      creatorId: owner.id,
    },
  })

  await prisma.event.upsert({
    where: { id: 'seed-event-2' },
    update: {},
    create: {
      id: 'seed-event-2',
      title: 'Client Check-in Call',
      description: 'Weekly sync with Acme Corp.',
      startAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // in 5 days
      allDay: false,
      workspaceId: workspace.id,
      creatorId: teamMember.id,
    },
  })

  console.log('  Events: 2 upcoming')

  // ──────────────────────────────────────
  // 9. NOTIFICATIONS
  // ──────────────────────────────────────

  const notifications = [
    {
      userId: owner.id,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      body: '"Fix memory leak on dashboard" needs assignment',
      linkUrl: '/tasks/seed-task-5',
      read: false,
    },
    {
      userId: owner.id,
      type: 'COMMENT_ADDED',
      title: 'New comment on task',
      body: 'Anna commented on "Implement push notifications"',
      linkUrl: '/tasks/seed-task-2',
      read: false,
    },
    {
      userId: owner.id,
      type: 'STALENESS_NUDGE',
      title: '2 task(s) need attention',
      body: 'Review app store screenshots, Provide brand assets',
      linkUrl: '/',
      read: true, // already seen
    },
    {
      userId: teamMember.id,
      type: 'TASK_ASSIGNED',
      title: 'Task assigned to you',
      body: '"SEO audit" was assigned to you',
      linkUrl: '/tasks/seed-task-8',
      read: false,
    },
    {
      userId: client.id,
      type: 'COMMENT_ADDED',
      title: 'New comment on your task',
      body: 'Comment added on "Provide brand assets"',
      linkUrl: '/tasks/seed-task-4',
      read: false,
    },
  ]

  for (const n of notifications) {
    await prisma.notification.create({ data: n })
  }

  console.log('  Notifications: 5 (owner: 3, team: 1, client: 1)')

  // ──────────────────────────────────────
  // 10. MESSAGES (inbox thread)
  // ──────────────────────────────────────

  const messages = [
    {
      id: 'seed-msg-1',
      direction: 'INBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Hi Karol, can we move the deadline to next Friday?',
      status: 'DELIVERED' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: hoursAgo(4),
    },
    {
      id: 'seed-msg-2',
      direction: 'OUTBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Let me check with the team and get back to you.',
      status: 'SENT' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: hoursAgo(3),
    },
  ]

  for (const msg of messages) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {},
      create: msg,
    })
  }

  console.log('  Messages: 2 (inbox thread)')

  // ──────────────────────────────────────
  // DONE
  // ──────────────────────────────────────

  console.log('\n✅ Seed complete!')
  console.log('─'.repeat(50))
  console.log('DEV LOGIN CREDENTIALS:')
  console.log(`  OWNER:  karol@businesslifeos.com`)
  console.log(`  TEAM:   anna@businesslifeos.com`)
  console.log(`  CLIENT: client@acme.com`)
  console.log('─'.repeat(50))
  console.log('TEST DATA:')
  console.log('  Workspace: 1')
  console.log('  Projects: 2 (Mobile App, Marketing Website)')
  console.log('  Tasks: 8 (2 assigned to client, 1 overdue, 1 unassigned)')
  console.log('  Comments: 6 (2 internal)')
  console.log('  People: 2')
  console.log('  Events: 2')
  console.log('  Notifications: 5')
  console.log('  Messages: 2')
  console.log('')
  console.log('CLIENT test points:')
  console.log('  - Has 2 assigned tasks: "Review app store screenshots" (WAITING) + "Provide brand assets" (overdue)')
  console.log('  - Is VIEWER on Mobile App project only (NOT on Marketing Website)')
  console.log('  - Task seed-task-3 has 1 internal comment he should NOT see')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
