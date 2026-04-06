import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import { COMMAND_DETECTION_PROMPT } from './prompts/command.prompt'
import {
  commandParseResultSchema,
  multiCommandParseResultSchema,
  type CommandPayload,
  type CommandResult,
  type MultiStepEntry,
} from './command.types'
import { createNote } from '@/modules/notes/note.service'

// ─────────────────────────────────────────────
// Step 1: Classify input as command or capture
// ─────────────────────────────────────────────

export type ClassificationResult =
  | { isCommand: true; isMultiStep?: false; interpretation: string; command: CommandPayload }
  | { isCommand: true; isMultiStep: true; interpretation: string; commands: CommandPayload[] }
  | { isCommand: false }

export async function classifyInput(
  text: string,
  workspaceId: string,
): Promise<ClassificationResult> {
  // Gather context for the AI
  const [projects, members, recentTasks, people] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.user.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: {
        project: { workspaceId },
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
      select: { id: true, title: true, projectId: true },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.person.findMany({
      where: { workspaceId, userId: { not: null } },
      select: { id: true, name: true, userId: true },
      take: 50,
    }),
  ])

  // Merge User + linked Person records into a unified people list
  const memberMap = new Map(members.map((m) => [m.id, m.name ?? 'Unknown']))
  for (const p of people) {
    if (p.userId && !memberMap.has(p.userId)) {
      memberMap.set(p.userId, p.name)
    }
  }

  const context = {
    existingProjects: projects.map((p) => ({ id: p.id, name: p.name })),
    teamMembers: Array.from(memberMap, ([id, name]) => ({ id, name })),
    recentTasks: recentTasks.map((t) => ({ id: t.id, title: t.title, projectId: t.projectId })),
  }

  const userMessage = JSON.stringify({
    input: text,
    context,
    today: new Date().toISOString().split('T')[0],
  })

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: COMMAND_DETECTION_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 1500,
  })

  const content = result.choices[0]?.message?.content
  if (!content) return { isCommand: false }

  const parsed = JSON.parse(content)

  if (parsed.isCommand && parsed.isMultiStep && Array.isArray(parsed.commands)) {
    const validated = multiCommandParseResultSchema.parse(parsed)
    return {
      isCommand: true,
      isMultiStep: true,
      interpretation: validated.interpretation,
      commands: validated.commands,
    }
  }

  if (parsed.isCommand) {
    const validated = commandParseResultSchema.parse(parsed)
    return {
      isCommand: true,
      interpretation: validated.interpretation,
      command: validated.command,
    }
  }

  return { isCommand: false }
}

// ─────────────────────────────────────────────
// Step 2: Execute a confirmed command
//
// Every command handler verifies workspace ownership
// and returns a typed result. NO auto-execution —
// this function is only called after explicit user
// confirmation in the UI.
// ─────────────────────────────────────────────

export async function executeCommand(
  command: CommandPayload,
  workspaceId: string,
  userId: string,
): Promise<CommandResult> {
  switch (command.intent) {
    case 'navigate':
      return executeNavigate(command)
    case 'create_task':
      return executeCreateTask(command, workspaceId, userId)
    case 'assign_task':
      return executeAssignTask(command, workspaceId)
    case 'complete_task':
      return executeCompleteTask(command, workspaceId)
    case 'create_project':
      return executeCreateProject(command, workspaceId, userId)
    case 'add_member':
      return executeAddMember(command, workspaceId)
    case 'create_event':
      return executeCreateEvent(command, workspaceId, userId)
    case 'save_note':
      return executeSaveNote(command, workspaceId, userId)
    case 'update_task':
      return executeUpdateTask(command, workspaceId)
    case 'update_event':
      return executeUpdateEvent(command, workspaceId)
    case 'update_project':
      return executeUpdateProject(command, workspaceId)
  }
}

// ─── Navigate ───

function executeNavigate(
  command: Extract<CommandPayload, { intent: 'navigate' }>,
): CommandResult {
  const pathMap: Record<string, string> = {
    home: '/',
    tasks: '/tasks',
    calendar: '/calendar',
    people: '/people',
    inbox: '/inbox',
    notes: '/notes',
    settings: '/settings',
  }

  if (command.target === 'project' && command.projectId) {
    return { intent: 'navigate', path: `/projects/${command.projectId}`, entityName: command.projectName ?? undefined }
  }

  return { intent: 'navigate', path: pathMap[command.target] ?? '/', entityName: command.target }
}

// ─── Create Task ───

async function executeCreateTask(
  command: Extract<CommandPayload, { intent: 'create_task' }>,
  workspaceId: string,
  userId: string,
): Promise<CommandResult> {
  // Resolve project — if named but no ID, try fuzzy match
  let projectId = command.projectId
  if (!projectId && command.projectName) {
    const match = await prisma.project.findFirst({
      where: { workspaceId, name: { contains: command.projectName, mode: 'insensitive' } },
      select: { id: true },
    })
    projectId = match?.id ?? null
  }

  if (!projectId) {
    // Fall back to Inbox project
    const inbox = await getOrCreateInbox(workspaceId, userId)
    projectId = inbox
  }

  const task = await prisma.task.create({
    data: {
      title: command.title,
      priority: command.priority,
      status: 'TODO',
      projectId,
      creatorId: userId,
      assigneeId: command.assigneeId ?? undefined,
      dueDate: command.dueDate ? new Date(command.dueDate) : undefined,
      lastActivityAt: new Date(),
    },
  })

  // Fetch project name for rich result
  const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  return {
    intent: 'create_task',
    taskId: task.id,
    projectId,
    entityName: command.title,
    entityLink: `/tasks/${task.id}`,
    projectName: proj?.name ?? undefined,
  }
}

// ─── Assign Task ───

async function executeAssignTask(
  command: Extract<CommandPayload, { intent: 'assign_task' }>,
  workspaceId: string,
): Promise<CommandResult> {
  // Find the task by ID or fuzzy title match
  let taskId = command.taskId
  if (!taskId) {
    const match = await prisma.task.findFirst({
      where: {
        project: { workspaceId },
        title: { contains: command.taskTitle, mode: 'insensitive' },
        status: { not: 'DONE' },
      },
      select: { id: true },
    })
    if (!match) throw new Error(`Task not found: "${command.taskTitle}"`)
    taskId = match.id
  }

  // Find assignee
  let assigneeId = command.assigneeId
  if (!assigneeId) {
    const match = await prisma.user.findFirst({
      where: {
        name: { contains: command.assigneeName, mode: 'insensitive' },
        workspaceId,
      },
      select: { id: true },
    })
    if (!match) throw new Error(`Person not found: "${command.assigneeName}"`)
    assigneeId = match.id
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId,
      lastActivityAt: new Date(),
    },
  })

  // Fetch names for rich result
  const [taskData, assigneeData] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }),
    prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } }),
  ])
  return {
    intent: 'assign_task',
    taskId,
    assigneeId,
    entityName: taskData?.title ?? command.taskTitle,
    entityLink: `/tasks/${taskId}`,
    assigneeName: assigneeData?.name ?? command.assigneeName,
  }
}

// ─── Complete Task ───

async function executeCompleteTask(
  command: Extract<CommandPayload, { intent: 'complete_task' }>,
  workspaceId: string,
): Promise<CommandResult> {
  let taskId = command.taskId
  if (!taskId) {
    const match = await prisma.task.findFirst({
      where: {
        project: { workspaceId },
        title: { contains: command.taskTitle, mode: 'insensitive' },
        status: { not: 'DONE' },
      },
      select: { id: true },
    })
    if (!match) throw new Error(`Task not found: "${command.taskTitle}"`)
    taskId = match.id
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'DONE',
      lastActivityAt: new Date(),
    },
  })

  const taskData = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } })
  return {
    intent: 'complete_task',
    taskId,
    entityName: taskData?.title ?? command.taskTitle,
    entityLink: `/tasks/${taskId}`,
  }
}

// ─── Create Project ───

async function executeCreateProject(
  command: Extract<CommandPayload, { intent: 'create_project' }>,
  workspaceId: string,
  userId: string,
): Promise<CommandResult> {
  const project = await prisma.project.create({
    data: {
      name: command.name,
      description: command.description,
      status: 'ACTIVE',
      workspaceId,
      ownerId: userId,
    },
  })

  return {
    intent: 'create_project',
    projectId: project.id,
    entityName: command.name,
    entityLink: `/projects/${project.id}`,
  }
}

// ─── Add Member ───

async function executeAddMember(
  command: Extract<CommandPayload, { intent: 'add_member' }>,
  workspaceId: string,
): Promise<CommandResult> {
  // Find project
  let projectId = command.projectId
  if (!projectId) {
    const match = await prisma.project.findFirst({
      where: { workspaceId, name: { contains: command.projectName, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!match) throw new Error(`Project not found: "${command.projectName}"`)
    projectId = match.id
  }

  // Find user — check User table first, then Person table (linked contacts)
  let userId = command.personId
  if (!userId) {
    // 1. Try direct User lookup
    const userMatch = await prisma.user.findFirst({
      where: {
        name: { contains: command.personName, mode: 'insensitive' },
        workspaceId,
      },
      select: { id: true },
    })
    if (userMatch) {
      userId = userMatch.id
    } else {
      // 2. Fallback: Try Person table (contacts linked to workspace users)
      const personMatch = await prisma.person.findFirst({
        where: {
          name: { contains: command.personName, mode: 'insensitive' },
          workspaceId,
          userId: { not: null },
        },
        select: { userId: true },
      })
      if (personMatch?.userId) {
        userId = personMatch.userId
      }
    }
    if (!userId) throw new Error(`Person not found: "${command.personName}"`)
  }

  // Check if already a member
  const existing = await prisma.projectMember.findFirst({
    where: { projectId, userId },
  })

  if (!existing) {
    await prisma.projectMember.create({
      data: { projectId, userId, role: command.role },
    })
  }

  const projData = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  return {
    intent: 'add_member',
    projectId,
    userId,
    entityName: projData?.name ?? command.projectName,
    entityLink: `/projects/${projectId}`,
    personName: command.personName,
  }
}

// ─── Create Event ───

async function executeCreateEvent(
  command: Extract<CommandPayload, { intent: 'create_event' }>,
  workspaceId: string,
  userId: string,
): Promise<CommandResult> {
  // Resolve project if named
  let projectId = command.projectId ?? null
  if (!projectId && command.projectName) {
    const match = await prisma.project.findFirst({
      where: { workspaceId, name: { contains: command.projectName, mode: 'insensitive' } },
      select: { id: true },
    })
    projectId = match?.id ?? null
  }

  const event = await prisma.event.create({
    data: {
      title: command.title,
      startAt: new Date(command.startAt),
      endAt: command.endAt ? new Date(command.endAt) : new Date(new Date(command.startAt).getTime() + 60 * 60 * 1000),
      location: command.location,
      workspaceId,
      creatorId: userId,
      ...(projectId && { projectId }),
    },
  })

  return {
    intent: 'create_event',
    eventId: event.id,
    entityName: command.title,
    entityLink: `/calendar`,
  }
}

// ─── Save Note ───

async function executeSaveNote(
  command: Extract<CommandPayload, { intent: 'save_note' }>,
  workspaceId: string,
  userId: string,
): Promise<CommandResult> {
  let projectId: string | undefined
  if (command.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: command.projectId, workspaceId },
    })
    if (project) projectId = project.id
  }

  const note = await createNote(
    {
      title: command.title,
      content: command.content,
      type: 'QUICK',
      ...(projectId && { projectId }),
    },
    workspaceId,
    userId,
  )

  const projName = projectId
    ? (await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }))?.name
    : undefined
  return {
    intent: 'save_note',
    noteId: note.id,
    projectId: projectId ?? null,
    entityName: command.title,
    entityLink: `/notes`,
    projectName: projName ?? undefined,
  }
}

// ─── Update Task ───

async function executeUpdateTask(
  command: Extract<CommandPayload, { intent: 'update_task' }>,
  workspaceId: string,
): Promise<CommandResult> {
  // Find the task
  let taskId = command.taskId
  if (!taskId) {
    const match = await prisma.task.findFirst({
      where: {
        project: { workspaceId },
        title: { contains: command.taskTitle, mode: 'insensitive' },
        status: { not: 'DONE' },
      },
      select: { id: true },
    })
    if (!match) throw new Error(`Task not found: "${command.taskTitle}"`)
    taskId = match.id
  }

  // Build update data — only include fields that were explicitly provided
  const updateData: Record<string, any> = {}
  const updatedFields: string[] = []

  if (command.title !== undefined && command.title !== null) {
    updateData.title = command.title
    updatedFields.push('title')
  }

  if (command.priority !== undefined && command.priority !== null) {
    updateData.priority = command.priority
    updatedFields.push('priority')
  }

  if (command.status !== undefined && command.status !== null) {
    updateData.status = command.status
    updatedFields.push('status')
  }

  if (command.dueDate !== undefined) {
    // null clears the deadline, string sets it
    updateData.dueDate = command.dueDate ? new Date(command.dueDate) : null
    updatedFields.push('dueDate')
  }

  if (command.assigneeName || command.assigneeId) {
    let assigneeId = command.assigneeId
    if (!assigneeId && command.assigneeName) {
      const match = await prisma.user.findFirst({
        where: {
          name: { contains: command.assigneeName, mode: 'insensitive' },
          workspaceId,
        },
        select: { id: true },
      })
      if (match) assigneeId = match.id
    }
    if (assigneeId) {
      updateData.assigneeId = assigneeId
      updatedFields.push('assignee')
    }
  }

  if (command.projectName || command.projectId) {
    let projectId = command.projectId
    if (!projectId && command.projectName) {
      const match = await prisma.project.findFirst({
        where: { workspaceId, name: { contains: command.projectName, mode: 'insensitive' } },
        select: { id: true },
      })
      if (match) projectId = match.id
    }
    if (projectId) {
      updateData.projectId = projectId
      updatedFields.push('project')
    }
  }

  if (updatedFields.length === 0) {
    throw new Error('No fields to update')
  }

  updateData.lastActivityAt = new Date()

  await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  })

  const taskInfo = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } })
  return {
    intent: 'update_task',
    taskId,
    updatedFields,
    entityName: taskInfo?.title ?? command.taskTitle,
    entityLink: `/tasks/${taskId}`,
  }
}

// ─── Update Event ───

async function executeUpdateEvent(
  command: Extract<CommandPayload, { intent: 'update_event' }>,
  workspaceId: string,
): Promise<CommandResult> {
  let eventId = command.eventId
  if (!eventId) {
    const match = await prisma.event.findFirst({
      where: {
        workspaceId,
        title: { contains: command.eventTitle, mode: 'insensitive' },
        startAt: { gte: new Date() }, // only future events
      },
      select: { id: true },
      orderBy: { startAt: 'asc' },
    })
    if (!match) throw new Error(`Event not found: "${command.eventTitle}"`)
    eventId = match.id
  }

  const updateData: Record<string, any> = {}
  const updatedFields: string[] = []

  if (command.title !== undefined && command.title !== null) {
    updateData.title = command.title
    updatedFields.push('title')
  }

  if (command.startAt !== undefined && command.startAt !== null) {
    updateData.startAt = new Date(command.startAt)
    updatedFields.push('startAt')
    // If endAt not explicitly set, default to 1hr after new start
    if (!command.endAt) {
      updateData.endAt = new Date(new Date(command.startAt).getTime() + 60 * 60 * 1000)
    }
  }

  if (command.endAt !== undefined && command.endAt !== null) {
    updateData.endAt = new Date(command.endAt)
    updatedFields.push('endAt')
  }

  if (command.location !== undefined) {
    updateData.location = command.location
    updatedFields.push('location')
  }

  if (updatedFields.length === 0) {
    throw new Error('No fields to update')
  }

  await prisma.event.update({
    where: { id: eventId },
    data: updateData,
  })

  const eventInfo = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } })
  return {
    intent: 'update_event',
    eventId,
    updatedFields,
    entityName: eventInfo?.title ?? command.eventTitle,
    entityLink: `/calendar`,
  }
}

// ─── Update Project ───

async function executeUpdateProject(
  command: Extract<CommandPayload, { intent: 'update_project' }>,
  workspaceId: string,
): Promise<CommandResult> {
  let projectId = command.projectId
  if (!projectId) {
    const match = await prisma.project.findFirst({
      where: { workspaceId, name: { contains: command.projectName, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!match) throw new Error(`Project not found: "${command.projectName}"`)
    projectId = match.id
  }

  const updateData: Record<string, any> = {}
  const updatedFields: string[] = []

  if (command.name !== undefined && command.name !== null) {
    updateData.name = command.name
    updatedFields.push('name')
  }

  if (command.description !== undefined && command.description !== null) {
    updateData.description = command.description
    updatedFields.push('description')
  }

  if (command.status !== undefined && command.status !== null) {
    updateData.status = command.status
    updatedFields.push('status')
  }

  if (command.phase !== undefined && command.phase !== null) {
    updateData.phase = command.phase
    updatedFields.push('phase')
  }

  if (updatedFields.length === 0) {
    throw new Error('No fields to update')
  }

  await prisma.project.update({
    where: { id: projectId },
    data: updateData,
  })

  const projInfo = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  return {
    intent: 'update_project',
    projectId,
    updatedFields,
    entityName: projInfo?.name ?? command.projectName,
    entityLink: `/projects/${projectId}`,
  }
}

// ─── Multi-step execution ───

/**
 * Execute multiple commands sequentially with stop-on-failure.
 * Returns the full step array with status for each.
 */
export async function executeMultiStepCommands(
  steps: MultiStepEntry[],
  workspaceId: string,
  userId: string,
): Promise<MultiStepEntry[]> {
  const results = [...steps]
  let failed = false

  for (let i = 0; i < results.length; i++) {
    if (failed) {
      results[i] = { ...results[i], status: 'skipped' }
      continue
    }

    results[i] = { ...results[i], status: 'executing' }

    try {
      const result = await executeCommand(results[i].command, workspaceId, userId)
      results[i] = { ...results[i], status: 'success', result }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results[i] = { ...results[i], status: 'failed', error: message }
      failed = true
    }
  }

  return results
}

// ─── Helpers ───

async function getOrCreateInbox(workspaceId: string, userId: string): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name: 'Inbox', status: 'ACTIVE' },
    select: { id: true },
  })
  if (existing) return existing.id

  const inbox = await prisma.project.create({
    data: {
      name: 'Inbox',
      description: 'Auto-created project for quick captures',
      status: 'ACTIVE',
      workspaceId,
      ownerId: userId,
    },
  })
  return inbox.id
}
