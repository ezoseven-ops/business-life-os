import { z } from 'zod'

export const taskSuggestionSchema = z.object({
  title: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
  projectSuggestion: z.string().optional(),
})

export const taskExtractionOutputSchema = z.object({
  tasks: z.array(taskSuggestionSchema),
})

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>
export type TaskExtractionOutput = z.infer<typeof taskExtractionOutputSchema>
