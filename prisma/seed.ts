import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'karol@businesslifeos.com' },
    update: {},
    create: {
      email: 'karol@businesslifeos.com',
      name: 'Karol',
      role: 'OWNER',
      emailVerified: new Date(),
    },
  })

  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { ownerId: user.id },
    update: {},
    create: {
      name: "Karol's Workspace",
      slug: 'karol-workspace',
      ownerId: user.id,
    },
  })

  // Link user to workspace
  await prisma.user.update({
    where: { id: user.id },
    data: { workspaceId: workspace.id },
  })

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      name: 'Business Life OS',
      description: 'Building the command center',
      status: 'ACTIVE',
      workspaceId: workspace.id,
      ownerId: user.id,
    },
  })

  // Create sample tasks
  const tasks = [
    { title: 'Set up auth system', status: 'DONE' as const, priority: 'HIGH' as const },
    { title: 'Build task management', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const },
    { title: 'Design mobile navigation', status: 'TODO' as const, priority: 'MEDIUM' as const },
    { title: 'Connect Telegram bot', status: 'TODO' as const, priority: 'MEDIUM' as const },
    { title: 'Add voice recording', status: 'TODO' as const, priority: 'LOW' as const },
  ]

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: project.id,
        creatorId: user.id,
        assigneeId: user.id,
      },
    })
  }

  // Create sample person (with Telegram ID so thread actions work)
  await prisma.person.upsert({
    where: { id: 'seed-person-1' },
    update: { telegramId: '123456789' },
    create: {
      id: 'seed-person-1',
      name: 'John Client',
      email: 'john@example.com',
      company: 'Acme Corp',
      telegramId: '123456789',
      workspaceId: workspace.id,
    },
  })

  // Create seed messages for realistic inbox/thread testing
  const now = new Date()
  const messages = [
    {
      id: 'seed-msg-1',
      direction: 'INBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Hi Karol, I wanted to discuss the new product launch timeline. Can we move the deadline to next Friday?',
      status: 'DELIVERED' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4h ago
    },
    {
      id: 'seed-msg-2',
      direction: 'OUTBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Hey John, let me check with the team and get back to you today.',
      status: 'SENT' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000), // 3.5h ago
    },
    {
      id: 'seed-msg-3',
      direction: 'INBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Thanks! Also, we need the updated contract for Acme Corp signed by end of week. Can you handle that?',
      status: 'DELIVERED' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3h ago
    },
    {
      id: 'seed-msg-4',
      direction: 'OUTBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Sure, I\'ll create a task for the contract. The deadline extension should be fine — I\'ll confirm by EOD.',
      status: 'SENT' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: new Date(now.getTime() - 2.5 * 60 * 60 * 1000), // 2.5h ago
    },
    {
      id: 'seed-msg-5',
      direction: 'INBOUND' as const,
      channel: 'TELEGRAM' as const,
      content: 'Perfect. One more thing — please send me the invoice for last month\'s consulting work.',
      status: 'DELIVERED' as const,
      personId: 'seed-person-1',
      workspaceId: workspace.id,
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1h ago
    },
  ]

  for (const msg of messages) {
    await prisma.message.upsert({
      where: { id: msg.id },
      update: {},
      create: msg,
    })
  }

  console.log('Seed complete!')
  console.log(`  User: ${user.email}`)
  console.log(`  Workspace: ${workspace.name}`)
  console.log(`  Project: ${project.name}`)
  console.log(`  Tasks: ${tasks.length}`)
  console.log(`  Messages: ${messages.length}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
