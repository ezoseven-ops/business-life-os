import { z } from 'zod'

// ─────────────────────────────────────────────
// Command Intent Types
//
// Commands are mutations triggered by voice/text input.
// Unlike captures (which create new artifacts), commands
// modify existing state: navigate, assign, update status, etc.
//
// Execution model: parse → preview → confirm → execute
// NO auto-execution. Every command requires user confirmation.
// ─────────────────────────────────────────────

export const commandIntentEnum = z.enum([
  'navigate',        // "go to project X", "open marketing project"
  'create_task',     // "create task X in project Y"
  'assign_task',     // "assign task X to Tomek"
  'complete_task',   // "mark task X as done"
  'create_project',  // "create a new project called X"
  'add_member',      // "add Tomek to project X"
  'create_event',    // "schedule meeting with X tomorrow at 3"
  'save_note',       // "save note in project X: ..."
  'update_task',     // "change priority to high", "add deadline tomorrow"
  'update_event',    // "move the meeting to Friday at 3"
  'update_project',  // "rename project to X", "pause project Y"
])

export type CommandIntent = z.infer<typeof commandIntentEnum>

// ─────────────────────────────────────────────
// Per-intent payload schemas
// ─────────────────────────────────────────────

const navigatePayloadSchema = z.object({
  intent: z.literal('navigate'),
  target: z.enum(['project', 'tasks', 'calendar', 'people', 'inbox', 'notes', 'settings', 'home']),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

const createTaskPayloadSchema = z.object({
  intent: z.literal('create_task'),
  title: z.string().min(1).max(200),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  assigneeName: z.string().nullable(),
  assigneeId: z.string().nullable(),
  dueDate: z.string().nullable(),
})

const assignTaskPayloadSchema = z.object({
  intent: z.literal('assign_task'),
  taskTitle: z.string(),
  taskId: z.string().nullable(),
  assigneeName: z.string(),
  assigneeId: z.string().nullable(),
})

const completeTaskPayloadSchema = z.object({
  intent: z.literal('complete_task'),
  taskTitle: z.string(),
  taskId: z.string().nullable(),
})

const createProjectPayloadSchema = z.object({
  intent: z.literal('create_project'),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
})

const addMemberPayloadSchema = z.object({
  intent: z.literal('add_member'),
  personName: z.string(),
  personId: z.string().nullable(),
  projectName: z.string(),
  projectId: z.string().nullable(),
  role: z.enum(['LEAD', 'CONTRIBUTOR', 'VIEWER']),
})

const createEventPayloadSchema = z.object({
  intent: z.literal('create_event'),
  title: z.string().min(1).max(200),
  startAt: z.string(), // ISO datetime
  endAt: z.string().nullable(),
  location: z.string().nullable(),
  attendeeNames: z.array(z.string()),
  projectId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
})

const saveNotePayloadSchema = z.object({
  intent: z.literal('save_note'),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
})

// ─────────────────────────────────────────────
// Update intents — modify existing entities
//
// These power follow-up commands:
// "change that to high priority"
// "add deadline tomorrow"
// "move the meeting to Friday at 3"
// "rename the project to X"
//
// All fields except the identifying fields are optional.
// Only provided fields are updated.
// ─────────────────────────────────────────────

const updateTaskPayloadSchema = z.object({
  intent: z.literal('update_task'),
  taskTitle: z.string(),
  taskId: z.string().nullable(),
  title: z.string().nullable().optional(),           // rename task
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'WAITING', 'DONE']).nullable().optional(),
  dueDate: z.string().nullable().optional(),          // YYYY-MM-DD or null to clear
  assigneeName: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),      // move to project
  projectId: z.string().nullable().optional(),
})

const updateEventPayloadSchema = z.object({
  intent: z.literal('update_event'),
  eventTitle: z.string(),
  eventId: z.string().nullable(),
  title: z.string().nullable().optional(),
  startAt: z.string().nullable().optional(),          // ISO datetime
  endAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
})

const updateProjectPayloadSchema = z.object({
  intent: z.literal('update_project'),
  projectName: z.string(),
  projectId: z.string().nullable(),
  name: z.string().nullable().optional(),             // rename
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DONE', 'ARCHIVED']).nullable().optional(),
  phase: z.enum(['PLANNING', 'EXECUTION', 'REVIEW', 'COMPLETE']).nullable().optional(),
})

// ─────────────────────────────────────────────
// Discriminated union: command parse result
// ─────────────────────────────────────────────

export const commandPayloadSchema = z.discriminatedUnion('intent', [
  navigatePayloadSchema,
  createTaskPayloadSchema,
  assignTaskPayloadSchema,
  completeTaskPayloadSchema,
  createProjectPayloadSchema,
  addMemberPayloadSchema,
  createEventPayloadSchema,
  saveNotePayloadSchema,
  updateTaskPayloadSchema,
  updateEventPayloadSchema,
  updateProjectPayloadSchema,
])

export type CommandPayload = z.infer<typeof commandPayloadSchema>

// ─────────────────────────────────────────────
// Command parse result (from AI)
// ─────────────────────────────────────────────

export const commandParseResultSchema = z.object({
  isCommand: z.literal(true),
  interpretation: z.string(), // human-readable "what I understood"
  command: commandPayloadSchema,
})

export type CommandParseResult = z.infer<typeof commandParseResultSchema>

// ─────────────────────────────────────────────
// Command execution result
// ─────────────────────────────────────────────

export type CommandResult =
  | { intent: 'navigate'; path: string }
  | { intent: 'create_task'; taskId: string; projectId: string }
  | { intent: 'assign_task'; taskId: string; assigneeId: string }
  | { intent: 'complete_task'; taskId: string }
  | { intent: 'create_project'; projectId: string }
  | { intent: 'add_member'; projectId: string; userId: string }
  | { intent: 'create_event'; eventId: string }
  | { intent: 'save_note'; noteId: string; projectId: string | null }
  | { intent: 'update_task'; taskId: string; updatedFields: string[] }
  | { intent: 'update_event'; eventId: string; updatedFields: string[] }
  | { intent: 'update_project'; projectId: string; updatedFields: string[] }

// ─────────────────────────────────────────────
// Multi-step command result (from AI)
//
// When the user says "create project X, add task Y,
// and schedule meeting Z", the AI returns multiple
// commands in sequence. Execution is sequential with
// stop-on-failure semantics.
// ─────────────────────────────────────────────

export const multiCommandParseResultSchema = z.object({
  isCommand: z.literal(true),
  isMultiStep: z.literal(true),
  interpretation: z.string(),
  commands: z.array(commandPayloadSchema).min(2).max(10),
})

export type MultiCommandParseResult = z.infer<typeof multiCommandParseResultSchema>

// ─────────────────────────────────────────────
// Multi-step execution tracking
// ─────────────────────────────────────────────

export type MultiStepStatus = 'pending' | 'executing' | 'success' | 'failed' | 'skipped'

export interface MultiStepEntry {
  command: CommandPayload
  interpretation: string
  status: MultiStepStatus
  result?: CommandResult
  error?: string
}

// ─────────────────────────────────────────────
// Combined parse result: capture OR command
//
// The AI first decides: is this a command or a capture?
// This enables a single voice entry point for both.
// ─────────────────────────────────────────────

export const inputClassificationSchema = z.discriminatedUnion('isCommand', [
  commandParseResultSchema,
  z.object({
    isCommand: z.literal(false),
    // Capture draft goes here — handled by existing capture.types.ts
  }),
])
