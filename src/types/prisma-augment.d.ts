/**
 * Prisma Schema Extensions
 *
 * The generated Prisma client must match the schema. Run `prisma generate`
 * before building. The build script does this automatically:
 *
 *   npm run build → prisma generate && next build
 *
 * Fields/models added in recent migrations (not yet in generated client):
 *   - Task.lastActivityAt
 *   - Project.projectPriority, Project.ventureId, Project.phase, Project._count
 *   - Venture model
 *   - AgentSession model
 *   - CalendarSyncMap model (syncStatus, retryCount fields)
 *   - User workspace membership filter (workspaceMembers relation)
 *   - Integration type: GOOGLE_CALENDAR
 *
 * Code that references these fields uses `as any` casts annotated with
 * PRISMA_SCHEMA_FIELD. These become type-safe after `prisma generate`.
 *
 * Categories of `as any` in codebase:
 *   1. PRISMA_SCHEMA_FIELD — resolves after prisma generate (safe)
 *   2. CommandResult union narrowing — architectural, stays as-is
 *   3. Test mocks — legitimate test pattern
 */

export {}
