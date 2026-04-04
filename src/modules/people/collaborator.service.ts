import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import {
  type CollaboratorProfile,
  type UpdateCollaboratorInput,
  type AssigneeSuggestion,
  type CapturedCollaborator,
  EMPTY_PROFILE,
  collaboratorProfileSchema,
  capturedCollaboratorSchema,
} from './collaborator.types'

// ─────────────────────────────────────────────
// Collaborator Intelligence Service
//
// Manages collaborator profiles (skills, strengths, availability).
// Provides AI-powered assignee suggestions for tasks.
// Extracts profiles from natural language (voice capture).
// ─────────────────────────────────────────────

/**
 * Get the collaborator profile for a person.
 * Profile is stored as structured JSON in Person.notes field.
 * Falls back to empty profile if not set.
 */
export async function getCollaboratorProfile(personId: string): Promise<CollaboratorProfile> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { notes: true },
  })

  if (!person?.notes) return { ...EMPTY_PROFILE }

  try {
    // Try to parse JSON profile from notes
    const parsed = JSON.parse(person.notes)
    if (parsed._collaboratorProfile) {
      return collaboratorProfileSchema.parse(parsed._collaboratorProfile)
    }
  } catch {
    // Notes are plain text — no profile yet
  }

  return { ...EMPTY_PROFILE }
}

/**
 * Update a collaborator's profile.
 * Merges with existing profile — only updates provided fields.
 * Stored as JSON within Person.notes (preserves existing text notes).
 */
export async function updateCollaboratorProfile(
  input: UpdateCollaboratorInput,
  workspaceId: string,
): Promise<CollaboratorProfile> {
  const person = await prisma.person.findFirst({
    where: { id: input.personId, workspaceId },
    select: { id: true, notes: true },
  })
  if (!person) throw new Error('Person not found')

  // Get existing profile
  const existing = await getCollaboratorProfile(input.personId)

  // Merge updates
  const updated: CollaboratorProfile = {
    ...existing,
    ...(input.role !== undefined && { role: input.role }),
    ...(input.skills !== undefined && { skills: input.skills }),
    ...(input.strengths !== undefined && { strengths: input.strengths }),
    ...(input.availability !== undefined && { availability: input.availability }),
    ...(input.reliabilityScore !== undefined && { reliabilityScore: input.reliabilityScore }),
    ...(input.timezone !== undefined && { timezone: input.timezone }),
    ...(input.preferredChannel !== undefined && { preferredChannel: input.preferredChannel }),
    lastProfileUpdate: new Date().toISOString(),
  }

  // Store as JSON in notes, preserving any existing text
  let notesData: Record<string, any> = {}
  try {
    if (person.notes) notesData = JSON.parse(person.notes)
  } catch {
    // If existing notes are plain text, preserve them
    if (person.notes) notesData._plainNotes = person.notes
  }

  notesData._collaboratorProfile = updated

  await prisma.person.update({
    where: { id: input.personId },
    data: { notes: JSON.stringify(notesData) },
  })

  return updated
}

/**
 * Parse a natural language description into a collaborator profile.
 * e.g., "Tomek — backend dev, good with APIs, reliable"
 * → { name: "Tomek", role: "backend dev", skills: ["API design"], strengths: ["reliable"] }
 */
export async function parseCollaboratorFromText(
  text: string,
): Promise<CapturedCollaborator> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      {
        role: 'system',
        content: `You extract structured collaborator profiles from natural language.
Return a JSON object with:
- name: string (the person's name)
- role: string | null (their job role, e.g., "backend developer", "project manager")
- skills: string[] (technical/professional skills mentioned)
- strengths: string[] (personal strengths, traits, qualities)
- availability: "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "OCCASIONAL" | "UNKNOWN"

Be precise. Extract only what's explicitly stated.
If something isn't mentioned, use null or empty arrays.
Respond with ONLY the JSON object, no explanation.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  })

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('No response from AI')

  const cleaned = content.replace(/```json\n?|\n?```/g, '')
  const parsed = JSON.parse(cleaned)
  return capturedCollaboratorSchema.parse(parsed)
}

/**
 * Suggest the best assignee for a task based on collaborator profiles.
 * Considers: skills match, availability, reliability, current workload.
 */
export async function suggestAssignee(
  taskContext: {
    title: string
    description?: string | null
    projectId?: string
  },
  workspaceId: string,
): Promise<AssigneeSuggestion[]> {
  // Get all people in workspace with profiles
  const people = await prisma.person.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      notes: true,
      userId: true,
    },
  })

  // Get task counts per assignee for workload
  const taskCounts = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: {
      project: { workspaceId },
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
    _count: true,
  })

  const workloadMap = new Map<string, number>()
  for (const tc of taskCounts) {
    if (tc.assigneeId) workloadMap.set(tc.assigneeId, tc._count)
  }

  // Score each person
  const suggestions: AssigneeSuggestion[] = []

  for (const person of people) {
    const profile = await getCollaboratorProfile(person.id)
    const score = calculateAssigneeScore(taskContext, profile, person, workloadMap)

    if (score.score > 0) {
      suggestions.push({
        personId: person.id,
        personName: person.name,
        score: score.score,
        reasons: score.reasons,
      })
    }
  }

  // Sort by score descending, return top 3
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

/**
 * Score a person's fit for a task.
 */
function calculateAssigneeScore(
  task: { title: string; description?: string | null },
  profile: CollaboratorProfile,
  person: { id: string; name: string; userId: string | null },
  workloadMap: Map<string, number>,
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // Base score for having a profile
  if (profile.role) {
    score += 10
  }

  // Skills match — check if any skill keywords appear in task title/description
  const taskText = `${task.title} ${task.description || ''}`.toLowerCase()
  const matchedSkills = profile.skills.filter(skill =>
    taskText.includes(skill.toLowerCase()),
  )
  if (matchedSkills.length > 0) {
    score += matchedSkills.length * 15
    reasons.push(`Skills: ${matchedSkills.join(', ')}`)
  }

  // Role match — check if role keywords appear in task context
  if (profile.role) {
    const roleWords = profile.role.toLowerCase().split(/\s+/)
    const roleMatch = roleWords.some(w => taskText.includes(w))
    if (roleMatch) {
      score += 20
      reasons.push(`Role: ${profile.role}`)
    }
  }

  // Reliability bonus
  if (profile.reliabilityScore > 70) {
    score += 10
    reasons.push('High reliability')
  }

  // Availability bonus
  if (profile.availability === 'FULL_TIME') {
    score += 10
    reasons.push('Full-time available')
  } else if (profile.availability === 'PART_TIME') {
    score += 5
  }

  // Workload penalty — fewer current tasks is better
  const currentTasks = person.userId ? (workloadMap.get(person.userId) ?? 0) : 0
  if (currentTasks < 3) {
    score += 10
    reasons.push('Low current workload')
  } else if (currentTasks > 10) {
    score -= 10
    reasons.push('Heavy workload')
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}
