# Post-Implementation Audit Report

**Date:** April 2, 2026
**Status:** Recovery audit after over-aggressive implementation
**Scope:** All changes made during Phases 0–5 of multi-user RBAC implementation

---

## 1. FILE-BY-FILE CHANGE MAP

### Modified Files (23 files)

#### `prisma/schema.prisma` — Phase 1

**What changed:**
- Added `CLIENT` to `UserRole` enum (was: `OWNER`, `MEMBER`)
- Added `ProjectMember` model with `ProjectMemberRole` enum: `OWNER`, `MEMBER`, `CLIENT`
- Added `Invitation` model with `InvitationStatus` enum
- Added `EventAttendee` model with `EventAttendeeStatus` enum
- Added `Comment.internal` Boolean field (default false)
- Added `Person.userId` optional field with `@unique`
- Added relation fields on User, Workspace, Project, Event

**Existing flows affected:** Every Prisma query — requires `prisma generate` after migration. TypeScript errors on all new model references until then.

---

#### `src/lib/action-utils.ts` — Phase 2

**What changed:**
- Added import for `prisma` and `UserRole`
- Added `requireRole(...allowedRoles: UserRole[])` — calls `requireWorkspace()` then checks role inclusion
- Added `requireProjectAccess(projectId, workspaceId, userId, role?)` — OWNER/MEMBER bypass, CLIENT checks ProjectMember
- Added `requireTaskAccess(taskId, workspaceId, userId, role?)` — OWNER/MEMBER bypass, CLIENT checks assignee or ProjectMember

**Existing flows affected:** None directly — these are new exports. Existing `requireAuth()`, `requireWorkspace()`, `requireOwner()` untouched.

**Critical issue:** `requireProjectAccess()` and `requireTaskAccess()` are defined but **never called from any action file**. They are dead code.

---

#### `src/lib/auth.ts` — Phase 3

**What changed:**
- `createUser` event now queries `prisma.invitation.findFirst({ where: { email, status: 'PENDING' } })` before creating workspace
- If a pending invitation exists, skips workspace creation (user will accept invitation via `/invite/[token]`)

**Existing flows affected:** **ALL new user signups.** If deployed before Prisma migration, `prisma.invitation` table does not exist, and every new signup crashes with a Prisma error. This is a **hard blocker** — the app becomes unusable for new users.

---

#### `src/middleware.ts` — Phase 3

**What changed:** Added `/invite` to `publicPaths` array.

**Existing flows affected:** None — additive change. Existing routes unaffected.

---

#### `src/app/(app)/layout.tsx` — Phase 4

**What changed:** Added `if (session.user.role === 'CLIENT') redirect('/portal')`

**Existing flows affected:** Any user whose `role` value is `'CLIENT'` gets redirected away from the main app. Since `CLIENT` was just added to the enum, no existing users have this role. Safe unless a database inconsistency assigns CLIENT to an existing user.

**TypeScript issue:** Comparison `session.user.role === 'CLIENT'` may flag a type error because `CLIENT` isn't in the generated Prisma types until migration + generate.

---

#### `src/app/(app)/page.tsx` — Phase 5

**What changed:**
- Added imports for `getOwnerSignals`, `getStaleTasks`, `dispatchLazyNudges` from staleness.service
- Added `isOwner` flag and conditional parallel fetching
- Added fire-and-forget `dispatchLazyNudges()` call
- Added Owner Signals section (overdue/waiting/unassigned count cards)
- Added Stale Tasks section (critical/warning badges with links)

**Existing flows affected:** This is the **main dashboard page**. If `staleness.service.ts` has a runtime error, the entire home page breaks for all users. The `dispatchLazyNudges` call queries `prisma.notification` with `type: 'STALENESS_NUDGE'` — this type must exist in the Notification model's `type` field or it will fail.

---

#### `src/app/(app)/settings/page.tsx` — Phase 3

**What changed:**
- Added imports for `getWorkspaceMembers`, `getWorkspaceInvitations`, `TeamManagement`
- Added `isOwner` flag and conditional parallel fetching of members/invitations
- Added `<TeamManagement>` component render for owner

**Existing flows affected:** Settings page for all users. The `getWorkspaceInvitations` call queries `prisma.invitation` — crashes before migration. However, it's gated behind `isOwner` check, and current single-user owners won't trigger it until migration is run. **Medium risk.**

**TypeScript issue:** Implicit `any` type on invitations parameter.

---

#### `src/modules/tasks/task.queries.ts` — Phase 0

**What changed:**
- `getTasksByProject(projectId)` → `getTasksByProject(projectId, workspaceId)` — adds `project: { workspaceId }` filter
- `getTaskById(id)` → `getTaskById(id, workspaceId?)` — changed from `findUnique` to `findFirst`, adds optional workspace filter

**Existing flows affected:** Every caller of these two functions. All callers were updated to pass workspaceId. The `findUnique` → `findFirst` change is semantically different: `findUnique` requires a unique field, `findFirst` returns the first match. With `id` as primary key and workspace filter, this is functionally equivalent but changes the Prisma return type.

---

#### `src/modules/notes/note.service.ts` — Phase 0

**What changed:** `getNoteById(id)` → `getNoteById(id, workspaceId?)` — `findUnique` → `findFirst` with optional workspace filter.

**Existing flows affected:** All callers updated. Same `findUnique` → `findFirst` semantic change.

---

#### `src/modules/events/event.service.ts` — Phase 0

**What changed:** `getEventById(id)` → `getEventById(id, workspaceId?)` — `findUnique` → `findFirst` with optional workspace filter.

**Existing flows affected:** All callers updated. Same pattern.

---

#### `src/modules/people/people.service.ts` — Phase 0

**What changed:** `getPersonById(id)` → `getPersonById(id, workspaceId?)` — `findUnique` → `findFirst` with optional workspace filter.

**Existing flows affected:** All callers updated. Same pattern.

---

#### `src/modules/tasks/task.actions.ts` — Phase 0 + Phase 2

**What changed:**
- `createTaskAction`: `requireWorkspace()` → `requireRole('OWNER', 'MEMBER')`
- `getTasksAction`: now passes `session.workspaceId` to `getTasksByProject` (was missing before — **bug fix**)
- `updateTaskAction`: added workspace check on `getTaskById`, fixed notification to go to `validated.assigneeId` instead of `session.user.id` (**bug fix**)
- `deleteTaskAction`: `requireWorkspace()` → `requireRole('OWNER', 'MEMBER')`
- `quickStatusAction`: **unchanged guard** — still uses `requireWorkspace()`, still does NOT validate the task belongs to the workspace before updating

**Existing flows affected:** Create/delete tasks now blocked for CLIENT role. This is correct but means the CLIENT role guard is enforced even though no CLIENT users exist yet.

**Critical issue:** `quickStatusAction` calls `taskService.updateTask(id, { status })` with the raw `id` parameter. No workspace check. A user could update any task in any workspace.

---

#### `src/modules/notes/note.actions.ts` — Phase 2

**What changed:** All 5 functions changed from `requireWorkspace()` to `requireRole('OWNER', 'MEMBER')`.

**Existing flows affected:** Note operations now blocked for CLIENT role. Correct behavior.

---

#### `src/modules/events/event.actions.ts` — Phase 2

**What changed:** All 3 mutation functions changed from `requireWorkspace()` to `requireRole('OWNER', 'MEMBER')`.

**Critical issue:** `updateEventAction` and `deleteEventAction` call `eventService.updateEvent(id, ...)` and `eventService.deleteEvent(id)` **without any workspace check on the entity**. The role check prevents CLIENT access, but a MEMBER in workspace A could update/delete an event in workspace B.

---

#### `src/modules/people/people.actions.ts` — Phase 2

**What changed:** All 4 functions changed from `requireWorkspace()` to `requireRole('OWNER', 'MEMBER')`.

**Critical issue:** `updatePersonAction` and `deletePersonAction` call `updatePerson(id, ...)` and `deletePerson(id)` **without any workspace check on the entity**. Same cross-workspace mutation vulnerability as events.

---

#### `src/modules/projects/project.actions.ts` — Phase 2

**What changed:**
- `createProjectAction` and `updateProjectAction`: `requireWorkspace()` → `requireRole('OWNER', 'MEMBER')`
- `deleteProjectAction`: `requireWorkspace()` → `requireRole('OWNER')` (owner-only delete)
- Read actions (`getProjectsAction`, `getProjectAction`): unchanged, still `requireWorkspace()`

**Existing flows affected:** Project delete now owner-only. Correct behavior.

---

#### `src/modules/comments/comment.actions.ts` — Phase 0 + Phase 2

**What changed:**
- Added import for `getTaskById`
- `addCommentAction`: notification now goes to assignee or creator (not commenter) — **bug fix**
- Guard kept as `requireWorkspace()` (allows all roles including CLIENT to comment)

**Critical issue:** No CLIENT guard. Blueprint requires: "if CLIENT, verify task access via `requireTaskAccess(taskId)`, force `internal: false`". Neither check exists. A CLIENT user could theoretically comment on any task in the workspace, and could mark comments as internal (if the field were wired up — which it isn't, see comment.service below).

---

#### `src/modules/comments/comment.service.ts` — NOT UPDATED

**What did NOT change:** The Zod schema (`createCommentSchema`) does not include `internal` field. The `createComment` function does not pass `internal` to `prisma.comment.create`. This means:

1. No one can create internal comments through the action layer
2. The `Comment.internal` field added to the schema is unused
3. Client portal's `where: { internal: false }` filter is technically correct but filters nothing since all comments default to `internal: false`

---

#### `src/modules/communications/comms.actions.ts` — Phase 2

**What changed:** `messageToTaskAction` and `sendReplyAction` changed from `requireWorkspace()` to `requireRole('OWNER', 'MEMBER')`.

**Existing flows affected:** Messages now blocked for CLIENT role. Correct behavior.

---

#### `src/app/(app)/tasks/[id]/page.tsx` — Phase 0

**What changed:** `getTaskById(id)` → `getTaskById(id, session.user.workspaceId)`.

**Existing flows affected:** Task detail page now workspace-scoped. Correct.

---

#### `src/app/(app)/notes/[id]/page.tsx` — Phase 0

**What changed:** `getNoteById(id)` → `getNoteById(id, session.user.workspaceId!)`. Removed application-level workspace check.

**Existing flows affected:** Note detail page. The `!` assertion assumes `workspaceId` is non-null — safe because the layout already checks.

---

#### `src/app/(app)/calendar/[id]/page.tsx` — Phase 0

**What changed:** `getEventById(id)` → `getEventById(id, session.user.workspaceId!)`. Removed application-level workspace check.

**Existing flows affected:** Event detail page. Same pattern as notes.

---

#### `src/app/(app)/people/[id]/page.tsx` — Phase 0

**What changed:** `getPersonById(id)` → `getPersonById(id, session.user.workspaceId!)`.

**Existing flows affected:** Person detail page. Same pattern.

---

### New Files (16 files)

| File | Phase | Purpose |
|------|-------|---------|
| `src/modules/invitations/invitation.types.ts` | 3 | Zod schema for invitation input |
| `src/modules/invitations/invitation.service.ts` | 3 | CRUD for invitations + member management |
| `src/modules/invitations/invitation.actions.ts` | 3 | Server actions for invitation system |
| `src/app/invite/[token]/page.tsx` | 3 | Invitation accept page (server) |
| `src/app/invite/[token]/InviteAcceptClient.tsx` | 3 | Invitation accept button (client) |
| `src/app/(app)/settings/TeamManagement.tsx` | 3 | Team management UI component |
| `src/app/(client)/layout.tsx` | 4 | Client portal layout with auth check |
| `src/app/(client)/portal/page.tsx` | 4 | Client dashboard |
| `src/app/(client)/portal/tasks/page.tsx` | 4 | Client task list |
| `src/app/(client)/portal/tasks/[id]/page.tsx` | 4 | Client task detail |
| `src/app/(client)/portal/tasks/[id]/ClientTaskDetailClient.tsx` | 4 | Client comment form |
| `src/components/ClientNav.tsx` | 4 | Client bottom navigation (2 tabs) |
| `src/modules/operational/staleness.service.ts` | 5 | Staleness detection + owner signals |
| `scripts/migrate-multiuser.sh` | 1 | Migration shell script |
| `scripts/backfill-project-members.ts` | 1 | Backfill ProjectMember records |
| `docs/MASTER-CORRELATION-AUDIT.md` | Pre | Audit report before implementation |

---

## 2. ARCHITECTURE DEVIATIONS

### DEVIATION 1: MEMBER not renamed to TEAM

**RBAC Doc says (Section 1):**
> `TEAM // renamed from MEMBER`

**Implementation does:**
- `UserRole` enum still uses `OWNER`, `MEMBER`, `CLIENT`
- All code references use `'MEMBER'` not `'TEAM'`
- TeamManagement UI displays "Team" as label text but the enum value is `MEMBER`

**Impact:** Every reference to `'MEMBER'` in code must eventually change. The longer this persists, the more code uses the wrong name.

---

### DEVIATION 2: ProjectMemberRole uses wrong values

**RBAC Doc says (Section 3):**
> `enum ProjectMemberRole { LEAD, CONTRIBUTOR, VIEWER }`

**Implementation does:**
> `enum ProjectMemberRole { OWNER, MEMBER, CLIENT }`

**Impact:** The ProjectMemberRole enum mirrors UserRole instead of defining independent project-level roles. This collapses two separate role hierarchies into one, making it impossible to have an OWNER who is a CONTRIBUTOR on a specific project, or a MEMBER who is a VIEWER. The entire project-level access control design is architecturally different from the spec.

**Also affects:**
- `backfill-project-members.ts` maps `OWNER→'OWNER'`, `CLIENT→'CLIENT'`, else→`'MEMBER'` (should be `OWNER→'LEAD'`, `CLIENT→'VIEWER'`, else→`'CONTRIBUTOR'`)
- `invitation.service.ts` `acceptInvitation` creates ProjectMember with `role: 'CLIENT'` or `role: 'MEMBER'` (should be `'VIEWER'` or `'CONTRIBUTOR'`)

---

### DEVIATION 3: ClientNav has 2 tabs instead of 3

**USER-FLOWS Doc says (Section 1.4):**
> Client Bottom Navigation (3 items, no FAB): `[ My Tasks ] [ Updates ] [ Profile ]`

**Implementation does:**
- ClientNav has 2 tabs: `[ Dashboard ] [ Tasks ]`
- No "Updates" tab (chronological activity feed)
- No "Profile" tab (name, email, sign out)
- Tab labels are different: "Dashboard" instead of "My Tasks"

**Impact:** Missing entire screens. Client cannot see activity updates on their tasks. Client cannot sign out (no profile page).

---

### DEVIATION 4: requireRole uses flat role check instead of hierarchy

**RBAC Doc says (Section 4):**
```typescript
const hierarchy = { OWNER: 3, TEAM: 2, CLIENT: 1 }
if (hierarchy[session.user.role] < hierarchy[minimumRole]) {
  throw new Error('Insufficient permissions')
}
```

**Implementation does:**
```typescript
if (!role || !allowedRoles.includes(role)) {
  throw new Error(`Access denied. Required role: ${allowedRoles.join(' or ')}`)
}
```

**Impact:** The implementation uses an explicit allowlist instead of a hierarchy. This means every action must list all allowed roles (e.g., `requireRole('OWNER', 'MEMBER')`) instead of saying "minimum TEAM level." Functionally equivalent for now with 3 roles, but diverges from the design and is less maintainable.

---

### DEVIATION 5: comment.service not updated with `internal` field

**IMPLEMENTATION-BLUEPRINT says (Phase 2):**
> Update comment.service.ts: add `internal` field to Zod schema, wire through createComment

**Implementation does:** comment.service.ts is unchanged. The `internal` field exists in the Prisma schema but has no way to be set through the application layer. The `createCommentSchema` Zod schema has no `internal` property.

**Impact:** Internal comments feature is non-functional. All comments are visible to clients by default. OWNER/MEMBER cannot mark comments as internal.

---

### DEVIATION 6: addCommentAction missing CLIENT guards

**IMPLEMENTATION-BLUEPRINT says (Phase 2):**
> "if CLIENT, verify task access via requireTaskAccess(taskId), force internal: false"

**Implementation does:** `addCommentAction` uses `requireWorkspace()`. No CLIENT-specific checks. No call to `requireTaskAccess()`. A CLIENT user could comment on any task in the workspace.

---

### DEVIATION 7: updateTaskAction has no CLIENT restriction

**RBAC Doc says (Permission Matrix):**
> CLIENT: "edits status/comments on assigned tasks"

**Implementation does:** `updateTaskAction` uses `requireWorkspace()` — any authenticated workspace user (including CLIENT) can update any field on any task. No field-level restriction.

---

### DEVIATION 8: Client portal uses raw Prisma queries instead of module functions

**IMPLEMENTATION-BLUEPRINT says:** Use existing query modules (task.queries, etc.) with role-based filtering.

**Implementation does:** All 4 client portal pages (`portal/page.tsx`, `portal/tasks/page.tsx`, `portal/tasks/[id]/page.tsx`) call `prisma.*` directly. This bypasses:
- Existing query functions (no code reuse)
- Any future middleware or hooks on those queries
- Consistent include/select patterns

---

### DEVIATION 9: invitation.service projectIds handling is dead code

**RBAC Doc says (Section 5):**
> Invitation stores `projectIds` for CLIENT auto-assignment

**Implementation does:** `createInvitation` accepts `projectIds` parameter but the code block that handles it does an empty Prisma update (no-op):
```typescript
await prisma.invitation.update({
  where: { id: invitation.id },
  data: { /* empty */ },
})
```
The Invitation model does not have a `projectIds` field. The `acceptInvitation` function ignores projectIds entirely and adds CLIENT to all active projects.

---

### DEVIATION 10: Phase boundaries violated

**IMPLEMENTATION-BLUEPRINT says:**
> Each phase is independently deployable. Ship gates: Internal MVP (0-2), Client Access (3-4), Dashboard (5). "CRITICAL REGRESSION SUITE after every phase."

**Implementation does:** All 6 phases implemented in a single pass with no regression testing between phases. No browser testing after any phase. No TypeScript compilation check between phases.

---

## 3. HIGH-RISK REGRESSION POINTS (Top 10)

### 1. auth.ts createUser event — SEVERITY: CRITICAL

The `createUser` event now queries `prisma.invitation` before creating a workspace. If deployed before migration, this table does not exist. **Every new user signup will crash.** Existing users are unaffected. This is the single most dangerous change in the entire implementation.

**Affected flow:** New user registration (Google OAuth + Dev login)

---

### 2. quickStatusAction — no workspace check — SEVERITY: HIGH

`quickStatusAction(id, status)` calls `taskService.updateTask(id, { status })` without verifying the task belongs to the caller's workspace. The `requireWorkspace()` guard confirms the user is in *a* workspace, but the task ID is never validated against that workspace.

**Affected flow:** Task checkbox toggle on dashboard and task list — the most-used interaction in the app.

---

### 3. updateEvent/deleteEvent — cross-workspace mutation — SEVERITY: HIGH

`updateEventAction` and `deleteEventAction` call service functions with a raw `id` parameter. No workspace filter. A user in workspace A could modify/delete events in workspace B.

**Affected flow:** Calendar event editing and deletion.

---

### 4. updatePerson/deletePerson — cross-workspace mutation — SEVERITY: HIGH

Same pattern as events. `updatePersonAction` and `deletePersonAction` operate on raw IDs without workspace verification.

**Affected flow:** CRM person editing and deletion.

---

### 5. Home page (page.tsx) — new imports from staleness.service — SEVERITY: MEDIUM-HIGH

The home page now imports and calls `getOwnerSignals`, `getStaleTasks`, and `dispatchLazyNudges`. If any of these functions throw (e.g., because the Notification model doesn't have a `STALENESS_NUDGE` type, or any Prisma query fails), the **entire home page crashes for all users** — not just owners. The functions are conditionally called (`isOwner ? ...`), but any import-level error affects everyone.

**Affected flow:** Dashboard — the app's landing page.

---

### 6. Settings page — new imports from invitation.service — SEVERITY: MEDIUM

Settings page now imports `getWorkspaceMembers` and `getWorkspaceInvitations`. The `getWorkspaceInvitations` call queries `prisma.invitation`. Pre-migration, this crashes. However, it's gated behind `isOwner` and the current app is single-user, so the owner hitting settings pre-migration would crash the page.

**Affected flow:** Settings page for workspace owner.

---

### 7. comment.service unchanged — internal field not wired — SEVERITY: MEDIUM

The `Comment.internal` schema field exists but the service layer doesn't use it. All comments are `internal: false`. The client portal correctly filters for `internal: false`, but OWNER/TEAM have no way to create internal comments. This is a **feature gap**, not a crash risk, but it means the client privacy boundary is incomplete.

**Affected flow:** Comment creation for OWNER/TEAM.

---

### 8. findUnique → findFirst change in queries — SEVERITY: LOW-MEDIUM

Four service files changed `findUnique` to `findFirst`. While functionally equivalent when querying by primary key `id`, `findFirst` has different TypeScript return types and does not enforce uniqueness at the query level. If a future code change accidentally removes the `id` filter, `findFirst` would return an arbitrary row instead of throwing.

**Affected flow:** All entity detail pages (task, note, event, person).

---

### 9. Client portal accessing prisma directly — SEVERITY: LOW-MEDIUM

Client portal pages use raw Prisma queries. If the `projectMembers` relation or `internal` field on Comment doesn't exist (pre-migration), these pages crash. Since the entire `(client)` route group only activates for CLIENT users and no CLIENT users exist yet, this is low risk currently. But it becomes medium risk the moment the first CLIENT is invited.

**Affected flow:** All client portal pages (post-invitation).

---

### 10. (app)/layout.tsx CLIENT redirect — SEVERITY: LOW

The layout redirects `CLIENT` role to `/portal`. If a database issue somehow assigns `CLIENT` to an existing OWNER/MEMBER user, they lose access to the main app. Low likelihood but high impact if it occurs.

**Affected flow:** Main app access for any user.

---

## 4. MIGRATION SAFETY CHECK

### 4.1 Enum Changes

**UserRole: Added `CLIENT`**
- Prisma PostgreSQL behavior: `ALTER TYPE "UserRole" ADD VALUE 'CLIENT'`
- Safe: adding a new enum value does not affect existing rows
- Risk: None

**New enums: `ProjectMemberRole`, `InvitationStatus`, `EventAttendeeStatus`**
- Safe: creating new types with no existing data
- Risk: None

**NOT done: MEMBER → TEAM rename**
- If done later, requires: `ALTER TYPE "UserRole" RENAME VALUE 'MEMBER' TO 'TEAM'` (PostgreSQL 10+)
- All code references must be updated atomically
- Risk: High if not done in a single coordinated migration + code deploy

### 4.2 New Tables

**ProjectMember, Invitation, EventAttendee**
- Safe: new tables with no data
- Foreign keys reference existing tables (User, Project, Workspace, Event)
- Risk: None for creation. Risk emerges when code queries these tables before migration.

### 4.3 New Fields on Existing Tables

**Comment.internal (Boolean, default false)**
- Safe: adds column with default value; existing rows get `false`
- Risk: None

**Person.userId (String?, @unique)**
- Safe: nullable column, no data migration needed
- Unique constraint on nullable column: PostgreSQL allows multiple NULLs with unique constraint
- Risk: None

### 4.4 Backfill Script Safety

`scripts/backfill-project-members.ts`:
- Queries all workspaces with members and projects
- Creates ProjectMember for every user × project combination
- Uses try/catch to skip duplicates

**Issues:**
1. Role mapping uses wrong values (OWNER→'OWNER' instead of OWNER→'LEAD', etc.)
2. For large workspaces: N_users × N_projects individual INSERT calls (no batching)
3. No transaction wrapping — partial failures leave inconsistent state
4. The `as any` cast on `role` hides type mismatches

### 4.5 Auth Compatibility

**Pre-migration deployment:** auth.ts queries `prisma.invitation` in `createUser` event. This table doesn't exist. **New signups crash.**

**Post-migration deployment:** Safe. The invitation query returns null for users without invitations, and the existing workspace creation path executes normally.

**Migration order requirement:** Database migration MUST happen before code deployment. The `migrate-multiuser.sh` script handles this correctly (migrate → backfill → restart). But if the Next.js app is running during migration, there's a window where the old code sees new schema (generally safe with Prisma) vs. new code sees old schema (crashes on `prisma.invitation`).

### 4.6 Layout Redirect Safety

`(app)/layout.tsx` redirects CLIENT to `/portal`. `(client)/layout.tsx` redirects non-CLIENT to `/`.

**Redirect loop risk:** If a user has `role === 'CLIENT'` but no `workspaceId`, the (app) layout redirects to /portal, the (client) layout calls `auth()` and checks role, but the portal page checks `session?.user?.workspaceId` and returns null. No redirect loop, but the client sees a blank page.

**Mitigation needed:** The client layout should redirect to a "pending setup" page if the user has CLIENT role but no workspaceId.

---

## 5. EXECUTION RECOVERY PLAN

### Priority 1: Inspect and Verify (No Code Changes)

These checks determine if the current codebase is safe to run against the existing database:

1. **Verify auth.ts is safe** — Confirm that the current deployed code does NOT include the invitation query in `createUser`. If it does, new signups are broken. **Action:** Check deployed version vs. changed files. If the code is only local (not deployed), this is safe.

2. **Verify no CLIENT users exist** — If no user has `role: 'CLIENT'`, the (app) layout redirect and all CLIENT-specific code paths are dormant. **Action:** Query `SELECT * FROM "User" WHERE role = 'CLIENT'`.

3. **Verify pre-existing tests still pass** — Run existing test suite (if any) against the modified codebase without migration. **Action:** `npm test` or equivalent.

### Priority 2: Fix Critical Security Issues (Before Any Deployment)

These are bugs that must be fixed regardless of phase ordering:

1. **Fix quickStatusAction** — Add workspace check:
   ```typescript
   const existing = await taskQueries.getTaskById(id, session.workspaceId)
   if (!existing) throw new Error('Task not found')
   ```

2. **Fix updateEventAction/deleteEventAction** — Add workspace check via `getEventById(id, session.workspaceId)` before calling update/delete.

3. **Fix updatePersonAction/deletePersonAction** — Add workspace check via `getPersonById(id, session.workspaceId)` before calling update/delete.

4. **Fix addCommentAction** — Add task workspace check. If user role is CLIENT, call `requireTaskAccess(taskId, workspaceId, userId, role)`.

### Priority 3: Wire Missing Features (Before Client Portal Can Be Used)

1. **Update comment.service.ts** — Add `internal` field to Zod schema and `createComment` function.

2. **Add internal comment UI for OWNER/MEMBER** — Without this, the `Comment.internal` field serves no purpose.

3. **Add CLIENT guard to updateTaskAction** — Restrict CLIENT to status-only changes on assigned tasks.

### Priority 4: Fix Architecture Deviations (Before Full Rollout)

1. **Rename MEMBER → TEAM in UserRole** — Coordinate schema migration + code deploy. Global find-replace `'MEMBER'` → `'TEAM'` in all `.ts`/`.tsx` files.

2. **Fix ProjectMemberRole values** — Change `OWNER/MEMBER/CLIENT` → `LEAD/CONTRIBUTOR/VIEWER`. Update backfill script and invitation.service.

3. **Fix ClientNav** — Add third tab (Profile with sign out). Add Updates tab or defer explicitly.

4. **Fix invitation.service projectIds** — Either implement properly (store projectIds on Invitation, use them on accept) or remove the parameter to avoid confusion.

### Priority 5: Refactor for Consistency

1. **Client portal pages** — Replace raw Prisma queries with module query functions. Create `getTasksForClient()` and `getProjectsForClient()` in their respective query modules.

2. **requireRole hierarchy** — Consider switching to hierarchy-based check as specified in RBAC doc, or document the allowlist approach as an intentional deviation.

### Safe to Keep As-Is

These changes are correct and can be kept without modification:

- Phase 0 workspace-scoping changes (getById with workspaceId) — all correct
- Notification recipient fixes in task.actions and comment.actions — both are bug fixes
- New file structure: `(client)` route group, invitation module, staleness.service
- Schema additions: new models, new fields, new enums (though values need fixing)
- middleware.ts `/invite` public path
- requireRole/requireProjectAccess/requireTaskAccess function signatures (the functions themselves are correct; the issue is they aren't being called)

### Recommended Validation Order

1. Run TypeScript compiler (`npx tsc --noEmit`) — expect 28+ errors related to pre-migration types
2. Run Prisma migration in dev environment
3. Run `prisma generate`
4. Run TypeScript compiler again — should resolve to only pre-existing errors
5. Run dev server and test existing flows: login → dashboard → create task → edit task → complete task → delete task
6. Test settings page as owner
7. Test invitation flow end-to-end
8. Test client portal with a CLIENT user
9. Verify staleness signals on owner dashboard

---

## Summary

The implementation contains functional code for all 6 phases, but was executed without phase boundaries, regression testing, or browser verification. There are 4 cross-workspace security vulnerabilities (quickStatusAction, updateEvent, deleteEvent, updatePerson, deletePerson), 1 critical deployment risk (auth.ts invitation query), 10 architecture deviations from the design documents, and several unwired features (internal comments, CLIENT guards, project-specific invitation). The Phase 0 security hardening and notification bug fixes are correct and valuable. The new file structure is sound. The core issues are: missing workspace validation on mutations, wrong enum values, and incomplete CLIENT access control enforcement.
