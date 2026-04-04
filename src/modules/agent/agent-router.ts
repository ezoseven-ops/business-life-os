import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/sentry'
import { AGENT_ROUTING_PROMPT } from './prompts/agent.prompt'
import { buildContextSummary, resolveReference } from './agent-context'
import type {
  AgentSession,
  AgentRoutingResult,
  AgentInputType,
  AgentSuggestion,
} from './agent.types'
import type { CommandPayload } from '@/modules/command/command.types'

// ─────────────────────────────────────────────
// Agent Router — HARDENED
//
// BLOCK 3: Rich workspace context (project stats,
//   task details, person roles, project membership)
// BLOCK 4: Confidence calibration (deterministic
//   post-processing, ambiguity detection, forced
//   clarification for risky operations)
// ─────────────────────────────────────────────

const log = createLogger('AgentRouter')

/** BLOCK 3: Rich workspace context */
interface WorkspaceContext {
  existingProjects: Array<{
    id: string
    name: string
    status: string
    phase: string
    taskTotal: number
    taskDone: number
    taskOverdue: number
    memberNames: string[]
  }>
  teamMembers: Array<{
    id: string
    name: string
    role: string | null
  }>
  recentTasks: Array<{
    id: string
    title: string
    projectId: string
    projectName: string
    status: string
    priority: string
    assigneeName: string | null
    dueDate: string | null
  }>
  people: Array<{
    id: string
    name: string
    role: string | null
  }>
}

/**
 * Route user input through the agent intelligence layer.
 */
export async function routeAgentInput(
  text: string,
  session: AgentSession,
  workspaceId: string,
): Promise<AgentRoutingResult> {
  log.info('Routing agent input', {
    sessionId: session.sessionId,
    inputLength: text.length,
    hasCurrentProject: !!session.currentProject,
    hasCurrentEntity: !!session.currentEntity,
    actionHistoryLength: session.actionHistory.length,
  })

  // Step 1: Rich workspace context
  const workspaceContext = await gatherWorkspaceContext(workspaceId)

  // Step 2: Session context summary
  const sessionContextSummary = buildContextSummary(session)

  // Step 3: Pre-resolution
  const preResolved = attemptPreResolution(text, session)

  // Step 4: AI classification
  const aiResult = await classifyWithAI(text, sessionContextSummary, workspaceContext, preResolved)

  // Step 5: Post-process, validate, calibrate confidence
  const validated = postProcessResult(aiResult, session, workspaceContext, text)

  log.info('Routing complete', {
    sessionId: session.sessionId,
    inputType: validated.inputType,
    confidence: validated.confidence,
    hasClarification: !!validated.clarificationNeeded,
    suggestionCount: validated.suggestions?.length ?? 0,
  })

  return validated
}

// ─── BLOCK 3: Rich workspace context ───

async function gatherWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
  const now = new Date()

  const [projects, members, recentTasks, people, projectMembers] = await Promise.all([
    // PRISMA_SCHEMA_FIELD: phase + _count not in stale generated client
    (prisma.project.findMany as any)({
      where: { workspaceId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: {
        id: true,
        name: true,
        status: true,
        phase: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.user.findMany({
      where: {
        // PRISMA_SCHEMA_FIELD
        workspaceMembers: { some: { workspaceId } },
      } as any,
      select: { id: true, name: true, role: true },
    }),
    prisma.task.findMany({
      where: {
        project: { workspaceId },
        status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] },
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.person.findMany({
      where: { workspaceId },
      select: { id: true, name: true, notes: true },
      take: 30,
    }),
    prisma.projectMember.findMany({
      where: { project: { workspaceId, status: { in: ['ACTIVE', 'PAUSED'] } } },
      select: {
        projectId: true,
        user: { select: { name: true } },
      },
    }),
  ])

  // Count done + overdue tasks per project
  const projectTaskStats = await Promise.all(
    projects.map(async (p: any) => {
      const [doneCount, overdueCount] = await Promise.all([
        prisma.task.count({
          where: { projectId: p.id, status: 'DONE' },
        }),
        prisma.task.count({
          where: { projectId: p.id, status: { not: 'DONE' }, dueDate: { lt: now } },
        }),
      ])
      return { projectId: p.id, doneCount, overdueCount }
    }),
  )

  // Build project membership map
  const membersByProject = new Map<string, string[]>()
  for (const pm of projectMembers) {
    const list = membersByProject.get(pm.projectId) ?? []
    if (pm.user.name) list.push(pm.user.name)
    membersByProject.set(pm.projectId, list)
  }

  const statsMap = new Map(projectTaskStats.map((s) => [s.projectId, s]))

  // Parse person roles from collaborator profiles
  const peopleWithRoles = people.map((p) => {
    let role: string | null = null
    try {
      if (p.notes) {
        const parsed = JSON.parse(p.notes)
        if (parsed._collaboratorProfile?.role) {
          role = parsed._collaboratorProfile.role
        }
      }
    } catch {}
    return { id: p.id, name: p.name, role }
  })

  return {
    existingProjects: projects.map((p: any) => {
      const stats = statsMap.get(p.id)
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        phase: p.phase ?? null,
        taskTotal: p._count?.tasks ?? 0,
        taskDone: stats?.doneCount ?? 0,
        taskOverdue: stats?.overdueCount ?? 0,
        memberNames: membersByProject.get(p.id) ?? [],
      }
    }),
    teamMembers: members.map((m) => ({
      id: m.id,
      name: m.name ?? 'Unknown',
      role: m.role,
    })),
    recentTasks: recentTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: t.project.name,
      status: t.status,
      priority: t.priority,
      assigneeName: t.assignee?.name ?? null,
      dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    })),
    people: peopleWithRoles,
  }
}

// ─── Pre-resolution ───

interface PreResolution {
  resolvedEntity?: { type: string | null; id: string; name: string }
  resolvedProject?: { id: string; name: string }
  hint?: string
}

function attemptPreResolution(text: string, session: AgentSession): PreResolution {
  const lower = text.toLowerCase()
  const result: PreResolution = {}

  const referencePatterns = [
    'this', 'that', 'it', 'the same',
    'this task', 'the task',
    'this project', 'the project',
    'him', 'her', 'them',
    'the meeting', 'the event',
  ]

  for (const pattern of referencePatterns) {
    if (lower.includes(pattern)) {
      const resolved = resolveReference(session, pattern)
      if (resolved) {
        result.resolvedEntity = resolved
        result.hint = `Reference "${pattern}" resolved to ${resolved.type} "${resolved.name}" (ID: ${resolved.id})`
        break
      }
    }
  }

  if (session.currentProject) {
    result.resolvedProject = session.currentProject
  }

  return result
}

// ─── AI classification ───

async function classifyWithAI(
  text: string,
  sessionContext: string,
  workspace: WorkspaceContext,
  preResolved: PreResolution,
): Promise<RawAIResult> {
  // BLOCK 3: Send rich context but keep token-efficient
  // Only send what the AI needs: names, IDs, stats — not full descriptions
  const userMessage = JSON.stringify({
    input: text,
    sessionContext,
    workspace: {
      existingProjects: workspace.existingProjects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        phase: p.phase,
        tasks: `${p.taskDone}/${p.taskTotal} done${p.taskOverdue > 0 ? `, ${p.taskOverdue} overdue` : ''}`,
        members: p.memberNames.length > 0 ? p.memberNames : undefined,
      })),
      teamMembers: workspace.teamMembers.map((m) => ({
        id: m.id,
        name: m.name,
      })),
      recentTasks: workspace.recentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: t.projectName,
        status: t.status,
        priority: t.priority,
        assignee: t.assigneeName,
        due: t.dueDate,
      })),
      people: workspace.people.map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.role ? { role: p.role } : {}),
      })),
    },
    preResolved: preResolved.hint ?? null,
    today: new Date().toISOString().split('T')[0],
  })

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: AGENT_ROUTING_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  })

  const content = result.choices[0]?.message?.content
  if (!content) {
    log.error('Empty AI response in agent router')
    captureError(new Error('Empty AI response in agent router'), { module: 'agent', action: 'classifyWithAI' })
    return {
      inputType: 'question',
      interpretation: 'I could not process that input. Could you rephrase?',
      confidence: 0,
    }
  }

  try {
    return JSON.parse(content) as RawAIResult
  } catch (err) {
    log.error('Failed to parse AI response', { content, error: String(err) })
    captureError(err, { module: 'agent', action: 'parseAIResponse' })
    return {
      inputType: 'question',
      interpretation: 'I had trouble understanding that. Could you try again?',
      confidence: 0,
    }
  }
}

interface RawAIResult {
  inputType: string
  interpretation: string
  confidence: number
  command?: Record<string, unknown>
  commands?: Array<Record<string, unknown>>
  captureText?: string
  followUpAction?: {
    targetEntityType?: string
    targetEntityId?: string
    targetEntityName?: string
    modification?: string
    resolvedCommand?: Record<string, unknown>
  }
  answer?: string
  resolvedValue?: string
  resolvedCommand?: Record<string, unknown>
  correctionTarget?: {
    originalAction?: string
    correction?: string
    resolvedCommand?: Record<string, unknown>
  }
  clarificationNeeded?: {
    question: string
    options: string[]
  }
  suggestions?: Array<{
    type: string
    message: string
    actionHint?: Record<string, unknown>
  }>
}

// ─── Post-processing + BLOCK 4: Confidence Calibration ───

function postProcessResult(
  raw: RawAIResult,
  session: AgentSession,
  workspace: WorkspaceContext,
  originalInput: string,
): AgentRoutingResult {
  const validTypes: AgentInputType[] = [
    'command', 'multi_step', 'capture', 'follow_up',
    'clarification_response', 'question', 'correction',
  ]
  const inputType: AgentInputType = validTypes.includes(raw.inputType as AgentInputType)
    ? (raw.inputType as AgentInputType)
    : 'question'

  let confidence = Math.max(0, Math.min(1, raw.confidence ?? 0.5))

  const result: AgentRoutingResult = {
    inputType,
    interpretation: raw.interpretation || 'Processing...',
    confidence,
  }

  // Type-specific fields
  switch (inputType) {
    case 'command':
      if (raw.command) result.command = raw.command as CommandPayload
      break
    case 'multi_step':
      if (raw.commands && Array.isArray(raw.commands)) result.commands = raw.commands as CommandPayload[]
      break
    case 'capture':
      result.captureText = raw.captureText || raw.interpretation
      break
    case 'follow_up':
      if (raw.followUpAction) {
        const lastAction = session.actionHistory[0] ?? null
        if (lastAction) {
          result.followUpAction = {
            targetAction: lastAction,
            modification: raw.followUpAction.modification ?? '',
            resolvedCommand: raw.followUpAction.resolvedCommand as CommandPayload | undefined,
          }
        }
        if (raw.followUpAction.resolvedCommand) {
          result.command = raw.followUpAction.resolvedCommand as CommandPayload
        }
      }
      break
    case 'question':
      result.answer = raw.answer ?? raw.interpretation
      break
    case 'clarification_response':
      if (raw.resolvedCommand) result.command = raw.resolvedCommand as CommandPayload
      break
    case 'correction':
      if (raw.correctionTarget?.resolvedCommand) {
        result.command = raw.correctionTarget.resolvedCommand as CommandPayload
      }
      break
  }

  // Clarification from AI
  if (raw.clarificationNeeded?.question) {
    result.clarificationNeeded = {
      question: raw.clarificationNeeded.question,
      options: Array.isArray(raw.clarificationNeeded.options) ? raw.clarificationNeeded.options : [],
    }
  }

  // ════════════════════════════════════════════
  // BLOCK 4: DETERMINISTIC CONFIDENCE CALIBRATION
  // These heuristics override the AI's confidence
  // based on objective facts from the workspace data.
  // ════════════════════════════════════════════

  if (result.command) {
    const cmd = result.command as CommandPayload
    const penalty = calibrateConfidence(cmd, workspace, session, originalInput)
    result.confidence = Math.max(0, result.confidence - penalty.totalPenalty)

    // If penalty forced clarification, inject it
    if (penalty.forceClarification && !result.clarificationNeeded) {
      result.clarificationNeeded = penalty.forceClarification
    }
  }

  // Global: force clarification for low confidence
  if (result.confidence < 0.6 && !result.clarificationNeeded) {
    result.clarificationNeeded = {
      question: raw.interpretation || 'Could you clarify what you mean?',
      options: [],
    }
  }

  // Safety: cap confidence for destructive/state-changing actions
  const destructiveIntents = ['complete_task', 'update_task', 'update_event', 'update_project']
  if (result.command && destructiveIntents.includes((result.command as CommandPayload).intent)) {
    result.confidence = Math.min(result.confidence, 0.85)
  }

  // Suggestions
  if (raw.suggestions && Array.isArray(raw.suggestions)) {
    result.suggestions = raw.suggestions
      .filter((s) => s.type && s.message)
      .slice(0, 2)
      .map((s) => ({
        type: s.type as AgentSuggestion['type'],
        message: s.message,
        actionHint: s.actionHint as CommandPayload | undefined,
      }))
  }
  if (!result.suggestions || result.suggestions.length === 0) {
    result.suggestions = generateSuggestions(result, session)
  }

  result.confidence = Math.round(result.confidence * 100) / 100
  return result
}

// ─── BLOCK 4: Confidence calibration engine ───

interface CalibrationResult {
  totalPenalty: number
  forceClarification?: { question: string; options: string[] }
}

function calibrateConfidence(
  command: CommandPayload,
  workspace: WorkspaceContext,
  session: AgentSession,
  originalInput: string,
): CalibrationResult {
  let totalPenalty = 0
  let forceClarification: { question: string; options: string[] } | undefined

  // ── 1. Person name ambiguity ──
  const personFields = extractPersonNames(command)
  for (const personName of personFields) {
    if (!personName) continue
    const matches = findNameMatches(personName, [
      ...workspace.teamMembers.map((m) => m.name),
      ...workspace.people.map((p) => p.name),
    ])
    if (matches.length > 1) {
      totalPenalty += 0.3
      forceClarification = {
        question: `Multiple people match "${personName}". Which one?`,
        options: matches.slice(0, 4),
      }
    } else if (matches.length === 0) {
      totalPenalty += 0.15 // Unknown person — still risky
    }
  }

  // ── 2. Project name ambiguity ──
  const projectName = extractProjectName(command)
  if (projectName) {
    const matches = findNameMatches(
      projectName,
      workspace.existingProjects.map((p) => p.name),
    )
    if (matches.length > 1) {
      totalPenalty += 0.3
      forceClarification = {
        question: `Multiple projects match "${projectName}". Which one?`,
        options: matches.slice(0, 4),
      }
    }
  }

  // ── 3. Task name ambiguity ──
  const taskTitle = extractTaskTitle(command)
  if (taskTitle) {
    const matches = workspace.recentTasks.filter((t) =>
      t.title.toLowerCase().includes(taskTitle.toLowerCase())
      || taskTitle.toLowerCase().includes(t.title.toLowerCase()),
    )
    if (matches.length > 1) {
      totalPenalty += 0.25
      // Include project names for disambiguation
      forceClarification = {
        question: `Multiple tasks match "${taskTitle}". Which one?`,
        options: matches.slice(0, 4).map((t) => `${t.title} (${t.projectName})`),
      }
    }
  }

  // ── 4. Reference resolution weakness ──
  // If the command uses a null ID for a name-based entity, that means
  // the AI couldn't resolve it. Penalize.
  if (hasUnresolvedNameReference(command)) {
    totalPenalty += 0.1
  }

  // ── 5. Empty session context penalty ──
  // Follow-ups and corrections with no history are unreliable
  if (session.actionHistory.length === 0) {
    const lower = originalInput.toLowerCase()
    const hasReferenceWords = ['it', 'this', 'that', 'the same', 'him', 'her'].some((w) =>
      lower.includes(w),
    )
    if (hasReferenceWords) {
      totalPenalty += 0.2
    }
  }

  // ── 6. Update intent without ID — requires fuzzy match ──
  const updateIntents = ['update_task', 'update_event', 'update_project']
  if (updateIntents.includes(command.intent)) {
    const hasId = ('taskId' in command && command.taskId)
      || ('eventId' in command && command.eventId)
      || ('projectId' in command && command.projectId)
    if (!hasId) {
      totalPenalty += 0.1 // Fuzzy match is inherently less reliable
    }
  }

  return { totalPenalty, forceClarification }
}

// ─── Calibration helpers ───

function extractPersonNames(command: CommandPayload): (string | null)[] {
  const names: (string | null)[] = []
  if ('assigneeName' in command) names.push((command as any).assigneeName)
  if ('personName' in command) names.push((command as any).personName)
  return names.filter(Boolean)
}

function extractProjectName(command: CommandPayload): string | null {
  if ('projectName' in command) return (command as any).projectName
  return null
}

function extractTaskTitle(command: CommandPayload): string | null {
  if ('taskTitle' in command) return (command as any).taskTitle
  return null
}

function findNameMatches(query: string, candidates: string[]): string[] {
  const lower = query.toLowerCase()
  return candidates.filter((c) =>
    c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
  )
}

function hasUnresolvedNameReference(command: CommandPayload): boolean {
  // Check if the command references an entity by name but has no resolved ID
  const cmd = command as any
  if (cmd.assigneeName && !cmd.assigneeId) return true
  if (cmd.personName && !cmd.personId) return true
  if (cmd.projectName && !cmd.projectId && cmd.intent !== 'create_project') return true
  if (cmd.taskTitle && !cmd.taskId && !['create_task'].includes(cmd.intent)) return true
  if (cmd.eventTitle && !cmd.eventId && !['create_event'].includes(cmd.intent)) return true
  return false
}

// ─── Suggestion generation ───

function generateSuggestions(
  result: AgentRoutingResult,
  session: AgentSession,
): AgentSuggestion[] {
  const suggestions: AgentSuggestion[] = []
  if (result.inputType !== 'command' && result.inputType !== 'follow_up') return suggestions

  const command = result.command as CommandPayload | undefined
  if (!command) return suggestions

  switch (command.intent) {
    case 'create_task': {
      const cmd = command as Extract<CommandPayload, { intent: 'create_task' }>
      if (!cmd.dueDate) suggestions.push({ type: 'missing_deadline', message: 'This task has no deadline. Want to set one?' })
      if (!cmd.assigneeName && !cmd.assigneeId) suggestions.push({ type: 'suggest_assignee', message: 'No one assigned to this task yet. Want to assign someone?' })
      break
    }
    case 'create_project':
      suggestions.push({ type: 'follow_up_needed', message: 'Project created. Want to add tasks or team members?' })
      break
    case 'create_event': {
      const cmd = command as Extract<CommandPayload, { intent: 'create_event' }>
      if (cmd.attendeeNames.length === 0) suggestions.push({ type: 'suggest_assignee', message: 'No attendees on this event. Want to add someone?' })
      break
    }
  }

  return suggestions.slice(0, 2)
}
