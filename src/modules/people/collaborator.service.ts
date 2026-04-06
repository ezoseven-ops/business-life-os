import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import {
  type CollaboratorProfile,
  type UpdateCollaboratorInput,
  type AssigneeSuggestion,
  type CapturedCollaborator,
  EMPTY_PROFILE,
  capturedCollaboratorSchema,
} from './collaborator.types'

// ─────────────────────────────────────────────
// Collaborator Intelligence Service
//
// Manages collaborator profiles (skills, strengths, availability).
// Provides AI-powered assignee suggestions for tasks.
// Extracts profiles from natural language (voice capture).
//
// Profiles are stored in the CollaboratorProfile table (1:1 with Person).
// ─────────────────────────────────────────────

/**
 * Get the collaborator profile for a person.
 * Returns data from the CollaboratorProfile table.
 * Falls back to empty profile if not set.
 */
export async function getCollaboratorProfile(personId: string): Promise<CollaboratorProfile> {
  const profile = await prisma.collaboratorProfile.findUnique({
    where: { personId },
  })

  if (!profile) return { ...EMPTY_PROFILE }

  return {
    role: profile.role,
    skills: profile.skills,
    strengths: profile.strengths,
    availability: profile.availability,
    reliabilityScore: profile.reliabilityScore,
    timezone: profile.timezone,
    preferredChannel: profile.preferredChannel
      ? profile.preferredChannel.toLowerCase() as CollaboratorProfile['preferredChannel']
      : null,
    lastProfileUpdate: profile.lastProfileUpdate?.toISOString() ?? null,
  }
}

/**
 * Update a collaborator's profile.
 * Merges with existing profile — only updates provided fields.
 * Uses upsert on the CollaboratorProfile table.
 */
export async function updateCollaboratorProfile(
  input: UpdateCollaboratorInput,
  workspaceId: string,
): Promise<CollaboratorProfile> {
  const person = await prisma.person.findFirst({
    where: { id: input.personId, workspaceId },
    select: { id: true },
  })
  if (!person) throw new Error('Person not found')

  // Get existing profile for merge
  const existing = await getCollaboratorProfile(input.personId)

  // Merge updates
  const merged = {
    role: input.role !== undefined ? input.role : existing.role,
    skills: input.skills !== undefined ? input.skills : existing.skills,
    strengths: input.strengths !== undefined ? input.strengths : existing.strengths,
    availability: input.availability !== undefined ? input.availability : existing.availability,
    reliabilityScore: input.reliabilityScore !== undefined ? input.reliabilityScore : existing.reliabilityScore,
    timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
    preferredChannel: input.preferredChannel !== undefined ? input.preferredChannel : existing.preferredChannel,
  }

  // Map preferredChannel from lowercase to enum
  const channelMap: Record<string, 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | 'INTERNAL'> = {
    telegram: 'TELEGRAM',
    whatsapp: 'WHATSAPP',
    email: 'EMAIL',
    internal: 'INTERNAL',
  }

  const dbChannel = merged.preferredChannel
    ? channelMap[merged.preferredChannel] ?? null
    : null

  // Map availability to enum
  const dbAvailability = merged.availability ?? 'UNKNOWN'

  const now = new Date()

  await prisma.collaboratorProfile.upsert({
    where: { personId: input.personId },
    update: {
      role: merged.role,
      skills: merged.skills,
      strengths: merged.strengths,
      availability: dbAvailability as any, // Prisma enum
      reliabilityScore: merged.reliabilityScore,
      timezone: merged.timezone,
      preferredChannel: dbChannel as any, // Prisma enum
      lastProfileUpdate: now,
    },
    create: {
      personId: input.personId,
      role: merged.role,
      skills: merged.skills,
      strengths: merged.strengths,
      availability: dbAvailability as any,
      reliabilityScore: merged.reliabilityScore,
      timezone: merged.timezone,
      preferredChannel: dbChannel as any,
      lastProfileUpdate: now,
    },
  })

  return {
    ...merged,
    lastProfileUpdate: now.toISOString(),
  }
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
  // Get all people in workspace with their profiles
  const people = await prisma.person.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      userId: true,
      collaboratorProfile: true,
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
    const profile: CollaboratorProfile = person.collaboratorProfile
      ? {
          role: person.collaboratorProfile.role,
          skills: person.collaboratorProfile.skills,
          strengths: person.collaboratorProfile.strengths,
          availability: person.collaboratorProfile.availability,
          reliabilityScore: person.collaboratorProfile.reliabilityScore,
          timezone: person.collaboratorProfile.timezone,
          preferredChannel: person.collaboratorProfile.preferredChannel
            ? person.collaboratorProfile.preferredChannel.toLowerCase() as CollaboratorProfile['preferredChannel']
            : null,
          lastProfileUpdate: person.collaboratorProfile.lastProfileUpdate?.toISOString() ?? null,
        }
      : { ...EMPTY_PROFILE }

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
