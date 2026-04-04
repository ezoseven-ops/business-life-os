import { z } from 'zod'

// ─────────────────────────────────────────────
// Collaborator Intelligence Types
//
// Extends the Person model with structured intelligence:
// - Role, skills, strengths, availability
// - Reliability scoring
// - AI-driven profile building from voice capture
// - Smart assignee suggestions
// ─────────────────────────────────────────────

/** Collaborator profile stored as JSON in Person.notes (extended) */
export const collaboratorProfileSchema = z.object({
  role: z.string().nullable(),           // "backend dev", "project manager"
  skills: z.array(z.string()),           // ["TypeScript", "API design", "React"]
  strengths: z.array(z.string()),        // ["reliable", "fast learner", "good communicator"]
  availability: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'OCCASIONAL', 'UNKNOWN']).default('UNKNOWN'),
  reliabilityScore: z.number().min(0).max(100).default(50), // 0-100
  timezone: z.string().nullable(),       // "Europe/Warsaw"
  preferredChannel: z.enum(['telegram', 'whatsapp', 'email', 'internal']).nullable(),
  lastProfileUpdate: z.string().nullable(), // ISO date
})

export type CollaboratorProfile = z.infer<typeof collaboratorProfileSchema>

/** Default empty profile */
export const EMPTY_PROFILE: CollaboratorProfile = {
  role: null,
  skills: [],
  strengths: [],
  availability: 'UNKNOWN',
  reliabilityScore: 50,
  timezone: null,
  preferredChannel: null,
  lastProfileUpdate: null,
}

/** Input for updating a collaborator profile */
export const updateCollaboratorSchema = z.object({
  personId: z.string(),
  role: z.string().max(200).nullable().optional(),
  skills: z.array(z.string().max(100)).max(20).optional(),
  strengths: z.array(z.string().max(200)).max(10).optional(),
  availability: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'OCCASIONAL', 'UNKNOWN']).optional(),
  reliabilityScore: z.number().min(0).max(100).optional(),
  timezone: z.string().max(50).nullable().optional(),
  preferredChannel: z.enum(['telegram', 'whatsapp', 'email', 'internal']).nullable().optional(),
})

export type UpdateCollaboratorInput = z.infer<typeof updateCollaboratorSchema>

/** AI-parsed profile from voice capture */
export const capturedCollaboratorSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable(),
  skills: z.array(z.string()),
  strengths: z.array(z.string()),
  availability: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'OCCASIONAL', 'UNKNOWN']),
})

export type CapturedCollaborator = z.infer<typeof capturedCollaboratorSchema>

/** Suggestion for task assignment */
export interface AssigneeSuggestion {
  personId: string
  personName: string
  score: number     // 0-100, higher is better match
  reasons: string[] // Why this person is suggested
}
