import type { CommandResult } from '@/modules/command/command.types'

// ─────────────────────────────────────────────
// Agent Continuity Layer
//
// After every successful action, the system provides
// deterministic next actions so the user can continue
// operating without retyping.
//
// Rules are intent-based: each command result maps
// to 2–3 contextual follow-ups.
// ─────────────────────────────────────────────

export interface NextAction {
  /** Button label shown in the pill */
  label: string
  /** Natural language command to submit or pre-fill */
  command: string
  /** If true, submit immediately through agent. If false, pre-fill input and focus. */
  autoSubmit: boolean
}

/**
 * Compute deterministic next actions from a command result.
 * Returns 2–3 contextual follow-ups based on intent.
 */
export function getNextActions(result: CommandResult): NextAction[] {
  switch (result.intent) {
    case 'create_task':
      return [
        {
          label: 'Assign to someone',
          command: `assign task "${result.entityName}" to `,
          autoSubmit: false,
        },
        {
          label: 'Set deadline',
          command: `set deadline for "${result.entityName}" to `,
          autoSubmit: false,
        },
        {
          label: 'Add another task',
          command: result.projectName
            ? `create task in "${result.projectName}": `
            : 'create task ',
          autoSubmit: false,
        },
      ]

    case 'create_project':
      return [
        {
          label: 'Add first task',
          command: `create task in "${result.entityName}": `,
          autoSubmit: false,
        },
        {
          label: 'Add team member',
          command: `add member to "${result.entityName}" `,
          autoSubmit: false,
        },
      ]

    case 'create_event':
      return [
        {
          label: 'Add another event',
          command: 'schedule ',
          autoSubmit: false,
        },
        {
          label: 'Create related task',
          command: `create task for "${result.entityName}": `,
          autoSubmit: false,
        },
      ]

    case 'assign_task':
      return [
        {
          label: 'Set deadline',
          command: `set deadline for "${result.entityName}" to `,
          autoSubmit: false,
        },
        {
          label: 'Set priority high',
          command: `set priority of "${result.entityName}" to high`,
          autoSubmit: true,
        },
      ]

    case 'complete_task':
      return [
        {
          label: 'View project',
          command: `go to project`,
          autoSubmit: true,
        },
        {
          label: 'Next task',
          command: 'show my tasks',
          autoSubmit: true,
        },
      ]

    case 'add_member':
      return [
        {
          label: 'Add another member',
          command: `add member to "${result.entityName}" `,
          autoSubmit: false,
        },
        {
          label: 'Add task for them',
          command: `create task in "${result.entityName}": `,
          autoSubmit: false,
        },
      ]

    case 'save_note':
      return [
        {
          label: 'Add another note',
          command: result.projectName
            ? `save note in "${result.projectName}": `
            : 'save note: ',
          autoSubmit: false,
        },
        {
          label: 'Create related task',
          command: 'create task ',
          autoSubmit: false,
        },
      ]

    case 'update_task':
      return [
        {
          label: 'Update more',
          command: `update "${result.entityName}" `,
          autoSubmit: false,
        },
        {
          label: 'Mark as done',
          command: `complete task "${result.entityName}"`,
          autoSubmit: true,
        },
      ]

    case 'update_event':
      return [
        {
          label: 'Update more',
          command: `update event "${result.entityName}" `,
          autoSubmit: false,
        },
      ]

    case 'update_project':
      return [
        {
          label: 'Add task',
          command: `create task in "${result.entityName}": `,
          autoSubmit: false,
        },
        {
          label: 'View project',
          command: `go to "${result.entityName}"`,
          autoSubmit: true,
        },
      ]

    case 'navigate':
      // No follow-ups for navigation
      return []

    default:
      return []
  }
}
