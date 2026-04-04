import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import { CAPTURE_SYSTEM_PROMPT } from './prompts/capture.prompt'
import { createNote } from '@/modules/notes/note.service'
import {
  captureDraftSchema,
  type CaptureDraft,
  type CaptureConfirm,
  type CaptureResult,
} from './capture.types'

// ─────────────────────────────────────────────
// Step 1: Parse raw input → structured draft
// ─────────────────────────────────────────────

export async function parseCapture(
  text: string,
  workspaceId: string,
): Promise<CaptureDraft> {
  // Gather context: existing projects and team members
  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    // PRISMA_SCHEMA_FIELD: workspaceMembers relation exists in schema — run `prisma generate`
    prisma.user.findMany({
      where: {
        workspaceMembers: { some: { workspaceId } },
      } as any,
      select: { id: true, name: true },
    }),
  ])

  const context = {
    existingProjects: projects.map((p) => ({ id: p.id, name: p.name })),
    teamMembers: members.map((m) => ({ id: m.id, name: m.name ?? 'Unknown' })),
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
      { role: 'system', content: CAPTURE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  })

  const content = result.choices[0]?.message?.content
  if (!content) throw new Error('Empty AI response for capture')

  const parsed = captureDraftSchema.parse(JSON.parse(content))
  return parsed
}

// ─────────────────────────────────────────────
// Step 2: Execute confirmed draft → create entities
//
// Execution behavior per classification:
//   project     → CREATE project + tasks (full)
//   task_bundle → USE_EXISTING project + tasks (full)
//   follow_up   → CREATE single task, optionally linked to project (full)
//   decision    → Note with structured JSON content
//   session     → Note with structured JSON content
//   note        → Note with human-readable content (plain text)
//   message     → Note with structured message draft (future-ready for send)
// ─────────────────────────────────────────────

export async function executeCapture(
  draft: CaptureConfirm,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  switch (draft.classification) {
    case 'project':
      return executeProjectCapture(draft, workspaceId, userId)
    case 'task_bundle':
      return executeTaskBundleCapture(draft, workspaceId, userId)
    case 'follow_up':
      return executeFollowUpCapture(draft, workspaceId, userId)
    case 'decision':
      return executeDecisionCapture(draft, workspaceId, userId)
    case 'session':
      return executeSessionCapture(draft, workspaceId, userId)
    case 'note':
      return executeNoteCapture(draft, workspaceId, userId)
    case 'message':
      return executeMessageCapture(draft, workspaceId, userId)
    case 'collaborator':
      return executeCollaboratorCapture(draft, workspaceId)
  }
}

// ─── Project: create new project + tasks ───

async function executeProjectCapture(
  draft: Extract<CaptureConfirm, { classification: 'project' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const project = await prisma.project.create({
    data: {
      name: draft.project.name,
      description: draft.project.description,
      status: 'ACTIVE',
      workspaceId,
      ownerId: userId,
    },
  })

  const taskIds = await createTasks(draft.tasks, project.id, userId)

  return { classification: 'project', projectId: project.id, taskIds }
}

// ─── Task Bundle: add tasks to existing project ───

async function executeTaskBundleCapture(
  draft: Extract<CaptureConfirm, { classification: 'task_bundle' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  if (!draft.project.existingProjectId) {
    throw new Error('task_bundle requires existingProjectId')
  }

  // Verify project belongs to workspace
  const project = await prisma.project.findFirst({
    where: { id: draft.project.existingProjectId, workspaceId },
  })
  if (!project) throw new Error('Project not found in workspace')

  const taskIds = await createTasks(draft.tasks, project.id, userId)

  return { classification: 'task_bundle', projectId: project.id, taskIds }
}

// ─── Follow-Up: create single task ───

async function executeFollowUpCapture(
  draft: Extract<CaptureConfirm, { classification: 'follow_up' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const { followUp } = draft

  // If linked to a project, verify it exists
  let projectId: string | null = null
  if (followUp.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: followUp.projectId, workspaceId },
    })
    if (project) {
      projectId = project.id
    }
    // If project not found, create task without project link — don't fail
  }

  // If no project link, use the workspace's default/inbox project or create standalone
  // For V1: follow-ups without a project link need a project home.
  // We'll find or create an "Inbox" project for the workspace.
  if (!projectId) {
    projectId = await getOrCreateInboxProject(workspaceId, userId)
  }

  const task = await prisma.task.create({
    data: {
      title: followUp.title,
      priority: followUp.priority,
      status: 'TODO',
      projectId,
      creatorId: userId,
      assigneeId: followUp.targetPersonId ?? undefined,
      dueDate: followUp.dueDate ? new Date(followUp.dueDate) : undefined,
      // PRISMA_SCHEMA_FIELD
      lastActivityAt: new Date(),
    } as any,
  })

  return { classification: 'follow_up', taskId: task.id, projectId }
}

// ─── Decision: persist as Note ───

async function executeDecisionCapture(
  draft: Extract<CaptureConfirm, { classification: 'decision' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const { decision } = draft

  // Verify project if linked
  let projectId: string | undefined
  if (decision.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: decision.projectId, workspaceId },
    })
    if (project) projectId = project.id
  }

  const note = await createNote(
    {
      title: `Decision: ${decision.question}`,
      content: JSON.stringify({
        captureType: 'decision',
        question: decision.question,
        options: decision.options,
        context: decision.context,
        urgency: decision.urgency,
      }),
      type: 'QUICK',
      ...(projectId && { projectId }),
    },
    workspaceId,
    userId,
  )

  return { classification: 'decision', noteId: note.id, projectId: projectId ?? null }
}

// ─── Session: persist as Note ───

async function executeSessionCapture(
  draft: Extract<CaptureConfirm, { classification: 'session' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const { session } = draft

  // Verify project if linked
  let projectId: string | undefined
  if (session.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: session.projectId, workspaceId },
    })
    if (project) projectId = project.id
  }

  const note = await createNote(
    {
      title: `Session: ${session.topic}`,
      content: JSON.stringify({
        captureType: 'session',
        topic: session.topic,
        context: session.context,
        seedQuestions: session.seedQuestions,
      }),
      type: 'QUICK',
      ...(projectId && { projectId }),
    },
    workspaceId,
    userId,
  )

  return { classification: 'session', noteId: note.id, projectId: projectId ?? null }
}

// ─── Note: persist as human-readable Note ───

async function executeNoteCapture(
  draft: Extract<CaptureConfirm, { classification: 'note' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const { note: noteData } = draft

  let projectId: string | undefined
  if (noteData.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: noteData.projectId, workspaceId },
    })
    if (project) projectId = project.id
  }

  // Note content is stored as plain human-readable text — NOT JSON
  const note = await createNote(
    {
      title: noteData.title,
      content: noteData.content,
      type: 'QUICK',
      ...(projectId && { projectId }),
    },
    workspaceId,
    userId,
  )

  return { classification: 'note', noteId: note.id, projectId: projectId ?? null }
}

// ─── Message: persist structured draft as Note (future-ready for send) ───

async function executeMessageCapture(
  draft: Extract<CaptureConfirm, { classification: 'message' }>,
  workspaceId: string,
  userId: string,
): Promise<CaptureResult> {
  const { message } = draft

  let projectId: string | undefined
  if (message.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: message.projectId, workspaceId },
    })
    if (project) projectId = project.id
  }

  // Title is human-readable; content preserves full structured draft
  // so future send integration can parse recipient, channel, body, followUp
  const note = await createNote(
    {
      title: `Draft to ${message.recipientName}: ${message.subject}`,
      content: JSON.stringify({
        captureType: 'message',
        recipientName: message.recipientName,
        recipientId: message.recipientId,
        channel: message.channel,
        subject: message.subject,
        body: message.body,
        followUpAction: message.followUpAction,
      }),
      type: 'QUICK',
      ...(projectId && { projectId }),
    },
    workspaceId,
    userId,
  )

  return { classification: 'message', noteId: note.id, projectId: projectId ?? null }
}

// ─── Collaborator: create/update person with profile ───

async function executeCollaboratorCapture(
  draft: Extract<CaptureConfirm, { classification: 'collaborator' }>,
  workspaceId: string,
): Promise<CaptureResult> {
  const { collaborator } = draft

  // Find existing person by name (fuzzy match)
  let person = await prisma.person.findFirst({
    where: {
      workspaceId,
      name: { contains: collaborator.name, mode: 'insensitive' } as any,
    },
  })

  if (!person) {
    person = await prisma.person.create({
      data: {
        name: collaborator.name,
        workspaceId,
      },
    })
  }

  // Build profile JSON
  const profileData = {
    role: collaborator.role,
    skills: collaborator.skills,
    strengths: collaborator.strengths,
    availability: collaborator.availability,
    reliabilityScore: 50,
    timezone: null,
    preferredChannel: null,
    lastProfileUpdate: new Date().toISOString(),
  }

  // Preserve existing notes
  let notesData: Record<string, any> = {}
  try {
    if (person.notes) notesData = JSON.parse(person.notes)
  } catch {
    if (person.notes) notesData._plainNotes = person.notes
  }
  notesData._collaboratorProfile = profileData

  await prisma.person.update({
    where: { id: person.id },
    data: { notes: JSON.stringify(notesData) },
  })

  return { classification: 'collaborator', personId: person.id }
}

// ─── Helpers ───

async function createTasks(
  tasks: Array<{
    title: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    assigneeId: string | null
    dueDate: string | null
    order: number
  }>,
  projectId: string,
  userId: string,
): Promise<string[]> {
  const taskIds: string[] = []
  for (const task of tasks) {
    const created = await prisma.task.create({
      data: {
        title: task.title,
        priority: task.priority,
        status: 'TODO',
        projectId,
        creatorId: userId,
        assigneeId: task.assigneeId ?? undefined,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        // PRISMA_SCHEMA_FIELD
        lastActivityAt: new Date(),
      } as any,
    })
    taskIds.push(created.id)
  }
  return taskIds
}

async function getOrCreateInboxProject(
  workspaceId: string,
  userId: string,
): Promise<string> {
  // Look for existing Inbox project
  const existing = await prisma.project.findFirst({
    where: { workspaceId, name: 'Inbox', status: 'ACTIVE' },
    select: { id: true },
  })
  if (existing) return existing.id

  // Create one
  const inbox = await prisma.project.create({
    data: {
      name: 'Inbox',
      description: 'Auto-created project for follow-ups and quick captures',
      status: 'ACTIVE',
      workspaceId,
      ownerId: userId,
    },
  })
  return inbox.id
}
