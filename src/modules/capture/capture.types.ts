import { z } from 'zod'

// ─────────────────────────────────────────────
// Classification type
// ─────────────────────────────────────────────

export const classificationEnum = z.enum([
  'project',
  'task_bundle',
  'follow_up',
  'decision',
  'session',
  'note',
  'message',
  'collaborator',
])

export type Classification = z.infer<typeof classificationEnum>

// ─────────────────────────────────────────────
// Shared sub-schemas
// ─────────────────────────────────────────────

export const captureDraftTaskSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigneeName: z.string().nullable(),
  assigneeId: z.string().nullable(),
  dueDate: z.string().nullable(), // YYYY-MM-DD
  order: z.number(),
})

export const captureDraftProjectSchema = z.object({
  action: z.enum(['CREATE', 'USE_EXISTING']),
  existingProjectId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
})

// ─────────────────────────────────────────────
// Per-type payload schemas
// ─────────────────────────────────────────────

const followUpPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  targetPerson: z.string().nullable(),
  targetPersonId: z.string().nullable(),
  dueDate: z.string().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

const decisionPayloadSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(4),
  context: z.string(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

const sessionPayloadSchema = z.object({
  topic: z.string().min(1).max(200),
  context: z.string(),
  seedQuestions: z.array(z.string()).min(1).max(5),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

export const notePayloadSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

export const messagePayloadSchema = z.object({
  recipientName: z.string().min(1),
  recipientId: z.string().nullable(),
  channel: z.enum(['internal', 'telegram', 'whatsapp', 'email', 'unknown']),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  followUpAction: z.string().nullable(),
})

export const collaboratorPayloadSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable(),
  skills: z.array(z.string()),
  strengths: z.array(z.string()),
  availability: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'OCCASIONAL', 'UNKNOWN']),
})

export type CollaboratorPayload = z.infer<typeof collaboratorPayloadSchema>

// ─────────────────────────────────────────────
// Discriminated union: 8 capture draft shapes
// ─────────────────────────────────────────────

const projectDraftSchema = z.object({
  classification: z.literal('project'),
  interpretation: z.string(),
  project: captureDraftProjectSchema,
  tasks: z.array(captureDraftTaskSchema),
})

const taskBundleDraftSchema = z.object({
  classification: z.literal('task_bundle'),
  interpretation: z.string(),
  project: captureDraftProjectSchema,
  tasks: z.array(captureDraftTaskSchema),
})

const followUpDraftSchema = z.object({
  classification: z.literal('follow_up'),
  interpretation: z.string(),
  followUp: followUpPayloadSchema,
})

const decisionDraftSchema = z.object({
  classification: z.literal('decision'),
  interpretation: z.string(),
  decision: decisionPayloadSchema,
})

const sessionDraftSchema = z.object({
  classification: z.literal('session'),
  interpretation: z.string(),
  session: sessionPayloadSchema,
})

const noteDraftSchema = z.object({
  classification: z.literal('note'),
  interpretation: z.string(),
  note: notePayloadSchema,
})

const messageDraftSchema = z.object({
  classification: z.literal('message'),
  interpretation: z.string(),
  message: messagePayloadSchema,
})

const collaboratorDraftSchema = z.object({
  classification: z.literal('collaborator'),
  interpretation: z.string(),
  collaborator: collaboratorPayloadSchema,
})

export const captureDraftSchema = z.discriminatedUnion('classification', [
  projectDraftSchema,
  taskBundleDraftSchema,
  followUpDraftSchema,
  decisionDraftSchema,
  sessionDraftSchema,
  noteDraftSchema,
  messageDraftSchema,
  collaboratorDraftSchema,
])

export type CaptureDraft = z.infer<typeof captureDraftSchema>
export type CaptureDraftTask = z.infer<typeof captureDraftTaskSchema>
export type CaptureDraftProject = z.infer<typeof captureDraftProjectSchema>
export type FollowUpPayload = z.infer<typeof followUpPayloadSchema>
export type DecisionPayload = z.infer<typeof decisionPayloadSchema>
export type SessionPayload = z.infer<typeof sessionPayloadSchema>
export type NotePayload = z.infer<typeof notePayloadSchema>
export type MessagePayload = z.infer<typeof messagePayloadSchema>

// ─────────────────────────────────────────────
// Action input schemas (what the user confirms)
// ─────────────────────────────────────────────

export const captureInputSchema = z.object({
  text: z.string().min(1).max(5000),
})

export const captureConfirmProjectSchema = z.object({
  classification: z.literal('project'),
  project: captureDraftProjectSchema,
  tasks: z.array(captureDraftTaskSchema),
})

export const captureConfirmTaskBundleSchema = z.object({
  classification: z.literal('task_bundle'),
  project: captureDraftProjectSchema,
  tasks: z.array(captureDraftTaskSchema),
})

export const captureConfirmFollowUpSchema = z.object({
  classification: z.literal('follow_up'),
  followUp: followUpPayloadSchema,
})

export const captureConfirmDecisionSchema = z.object({
  classification: z.literal('decision'),
  decision: decisionPayloadSchema,
})

export const captureConfirmSessionSchema = z.object({
  classification: z.literal('session'),
  session: sessionPayloadSchema,
})

export const captureConfirmNoteSchema = z.object({
  classification: z.literal('note'),
  note: notePayloadSchema,
})

export const captureConfirmMessageSchema = z.object({
  classification: z.literal('message'),
  message: messagePayloadSchema,
})

export const captureConfirmCollaboratorSchema = z.object({
  classification: z.literal('collaborator'),
  collaborator: collaboratorPayloadSchema,
})

export const captureConfirmSchema = z.discriminatedUnion('classification', [
  captureConfirmProjectSchema,
  captureConfirmTaskBundleSchema,
  captureConfirmFollowUpSchema,
  captureConfirmDecisionSchema,
  captureConfirmSessionSchema,
  captureConfirmNoteSchema,
  captureConfirmMessageSchema,
  captureConfirmCollaboratorSchema,
])

export type CaptureConfirm = z.infer<typeof captureConfirmSchema>
export type CaptureInput = z.infer<typeof captureInputSchema>

// ─────────────────────────────────────────────
// Execution result — varies by classification
// ─────────────────────────────────────────────

export type CaptureResult =
  | { classification: 'project'; projectId: string; taskIds: string[] }
  | { classification: 'task_bundle'; projectId: string; taskIds: string[] }
  | { classification: 'follow_up'; taskId: string; projectId: string | null }
  | { classification: 'decision'; noteId: string; projectId: string | null }
  | { classification: 'session'; noteId: string; projectId: string | null }
  | { classification: 'note'; noteId: string; projectId: string | null }
  | { classification: 'message'; noteId: string; projectId: string | null }
  | { classification: 'collaborator'; personId: string }
