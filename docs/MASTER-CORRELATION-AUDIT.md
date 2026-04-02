# MASTER CORRELATION AUDIT REPORT

**Date:** 2026-04-02
**Scope:** Real codebase vs ARCHITECTURE-RBAC.md, USER-FLOWS.md, IMPLEMENTATION-BLUEPRINT.md, OPERATIONAL-LAYER.md

---

## A. WHAT WORKS AND MUST NOT BREAK

### A1. Authentication & Session Flow
- **Auth.js JWT strategy** with 30-day sessions — working
- **Session callback** enriches JWT with `role` + `workspaceId` from DB on every request — working
- **Dev credential login** (email-only, no password) — working
- **Google OAuth** configured — working
- **Middleware** protects all routes except `/login`, `/verify`, `/api/auth`, `/api/health`, `/api/webhooks` — working
- **`createUser` event** auto-creates workspace + sets role OWNER for new signups — working (must be modified carefully for invite flow)

### A2. Workspace Isolation Pattern
- All **list queries** (`getTasksByWorkspace`, `getNotes`, `getPeople`, `getUpcomingEvents`, `getAllEvents`, `getProjects`) filter by `workspaceId` — working
- All **server actions** call `requireWorkspace()` as first guard — working
- `getProjectById(id, workspaceId)` and `deleteProject(id, workspaceId)` both enforce workspace — working
- `getProjectsAction` passes `session.workspaceId` — working

### A3. CRUD Flows (all working, browser-verified)
- **Tasks:** Create, update, delete, status change, assignment, comments
- **Projects:** Create, update, delete, status management
- **Notes:** Create, update, delete (quick + meeting types)
- **Events:** Create, update, delete, calendar view
- **People:** Create, update, delete, message history
- **Comments:** Create, delete (author-scoped delete)
- **Activity logging:** All mutations log to Activity table
- **Notifications:** Created on task assignment and task comments

### A4. UI Components (must not break)
- `MobileNav` — 5-tab bottom nav with FAB quick actions
- `Header` component with back navigation
- `(app)/layout.tsx` — session check + redirect to /login
- All page-level data fetching via server components
- `safeAction` wrapper pattern: `{ success, data }` or `{ success: false, error }`
- `revalidatePath()` cache invalidation after mutations

### A5. Data Model Relationships
- Task -> Project (cascade delete), Task -> Assignee, Task -> Creator
- Note -> Workspace (cascade), Note -> Project (optional), Note -> Author
- Event -> Workspace (cascade), Event -> Creator
- Person -> Workspace (cascade), Person -> Messages
- Comment -> Author, Comment -> Task|Note (cascade)
- File -> Workspace, File -> Task|Note
- Activity -> User, Notification -> User (cascade)

---

## B. ARCHITECTURE COMPATIBILITY CHECK

### B1. Schema Changes Required (from ARCHITECTURE-RBAC.md)

| Change | Current State | Compatible? | Risk |
|--------|--------------|-------------|------|
| Add `CLIENT` to `UserRole` enum | `OWNER, MEMBER` | YES — additive enum change | LOW — existing code only checks `OWNER` |
| Rename `MEMBER` to `TEAM` | Used in default role | MEDIUM — requires migration + code update | MEDIUM — `User.role @default(MEMBER)` must change |
| Add `ProjectMember` model | Does not exist | YES — new table | LOW |
| Add `Invitation` model | Does not exist | YES — new table | LOW |
| Add `EventAttendee` model | Does not exist | YES — new table | LOW |
| Add `Comment.internal` Boolean | Not on Comment model | YES — additive field | LOW — default false |
| Add `Person.userId` optional field | Not on Person model | YES — additive field | LOW — nullable |
| Modify `auth.ts createUser` event | Auto-creates workspace for ALL users | CRITICAL — must conditionally skip for invited users | HIGH |
| Add `/invite` to middleware public paths | Not in publicPaths array | YES — additive | LOW |

### B2. Action-Utils Changes Required

| Change | Current State | Compatible? |
|--------|--------------|-------------|
| Add `requireRole(...roles)` | Only `requireOwner()` exists | YES — new function alongside existing |
| Add `requireProjectAccess(projectId)` | Does not exist | YES — new function |
| Add `requireTaskAccess(taskId)` | Does not exist | YES — new function |
| Keep `requireWorkspace()` as base | Used everywhere | YES — unchanged |
| Keep `requireOwner()` | Used in workspace.actions.ts | YES — unchanged |

### B3. UI Architecture Compatibility

| Change | Current State | Compatible? |
|--------|--------------|-------------|
| New `(client)` route group | Only `(app)` and `(auth)` exist | YES — parallel route group |
| `ClientNav` component | Does not exist | YES — new component |
| Role-based redirect in `(app)/layout.tsx` | Only checks session existence | YES — add role check |
| Team management in Settings | Settings has Profile, Workspace, Integrations | YES — add new section |
| Owner dashboard sections | Home page has greeting, quick actions, tasks, activity | MEDIUM — restructure needed |

---

## C. REAL CONFLICTS BETWEEN DESIGN AND CODEBASE

### C1. CRITICAL: `getById` Functions Lack Workspace Check

**Affected files and functions:**
1. `task.queries.ts` → `getTaskById(id)` — NO workspace check
2. `note.service.ts` → `getNoteById(id)` — NO workspace check
3. `event.service.ts` → `getEventById(id)` — NO workspace check
4. `people.service.ts` → `getPersonById(id)` — NO workspace check

**Impact:** Any authenticated user with a valid entity ID can read/modify/delete entities from other workspaces. This is a cross-tenant data leak.

**Required fix (Phase 0):** Add `workspaceId` parameter to all `getById` functions and enforce it in the query WHERE clause.

### C2. CRITICAL: Notification Sent to Wrong User

**File:** `comment.actions.ts` line ~17
```typescript
await createNotification(session.user.id, { ... })
```
**Bug:** Notification goes to the commenter (session.user.id), not to the task assignee or creator.
**Required fix:** Send to `task.assigneeId` or `task.creatorId` (whoever is NOT the commenter).

### C3. CRITICAL: Task Assignment Notification to Wrong User

**File:** `task.actions.ts` line ~43
```typescript
await createNotification(session.user.id, { type: 'TASK_ASSIGNED', ... })
```
**Bug:** Notification goes to the assigner, not the assignee.
**Required fix:** Send to `validated.assigneeId`.

### C4. MEDIUM: `getTasksByProject` Has No Workspace Check

**File:** `task.queries.ts` → `getTasksByProject(projectId)`
**Issue:** Only filters by `projectId`. If a user knows a project ID from another workspace, they can list its tasks via `getTasksAction(projectId)`.
**Required fix:** Add workspace check via project relation, or validate project ownership in the action.

### C5. MEDIUM: `MEMBER` → `TEAM` Rename Complexity

**Current state:** `UserRole` enum has `OWNER, MEMBER`. Default role is `MEMBER`.
**Design says:** Rename to `TEAM`.
**Conflict:** Prisma enum renames require a multi-step migration (add new value, migrate data, remove old value). The `@default(MEMBER)` must change to `@default(TEAM)`.
**Decision:** Defer rename. Keep `MEMBER` internally, display as "Team" in UI. Add `CLIENT` as new enum value. This avoids a dangerous migration for zero functional benefit.

### C6. LOW: `auth.ts createUser` Event Must Be Conditional

**Current:** Every new user gets a workspace auto-created.
**Required:** Users accepting invitations must join existing workspace, not create new ones.
**Fix:** Check for pending invitation in `createUser` event. If invitation exists, join that workspace instead.

---

## D. PRE-IMPLEMENTATION FIXES (Phase 0 Scope)

### D1. Security Hardening — getById Functions

Each function must accept `workspaceId` and include it in the query:

1. **`task.queries.ts`** — `getTaskById(id, workspaceId)` → add `project: { workspaceId }` to where clause
2. **`note.service.ts`** — `getNoteById(id, workspaceId)` → add `workspaceId` to where clause
3. **`event.service.ts`** — `getEventById(id, workspaceId)` → add `workspaceId` to where clause
4. **`people.service.ts`** — `getPersonById(id, workspaceId)` → add `workspaceId` to where clause
5. **`task.queries.ts`** — `getTasksByProject(projectId, workspaceId)` → add project workspace check

### D2. Fix Notification Recipients

1. **`comment.actions.ts`** — Send to task assignee/creator, not commenter
2. **`task.actions.ts`** — Send assignment notification to assignee, not assigner

### D3. Update All Callers

Every action that calls a `getById` function must pass `session.workspaceId`:
- `task.actions.ts` — `updateTaskAction`, `deleteTaskAction`, `quickStatusAction`
- `note.actions.ts` — `getNoteAction`
- `event.actions.ts` — `updateEventAction`, `deleteEventAction`
- `people.actions.ts` — (no direct getById call in actions, but detail pages do)
- All detail page server components (`/tasks/[id]`, `/notes/[id]`, `/calendar/[id]`, `/people/[id]`)

---

## E. FINAL SAFE IMPLEMENTATION ORDER

### Phase 0: Security Hardening (THIS FIRST)
- Fix all `getById` workspace checks (4 service files + 1 query file)
- Fix notification recipients (2 action files)
- Update all callers (action files + page components)
- **Regression test:** All existing CRUD flows still work

### Phase 1: Schema Migration
- Add `CLIENT` to `UserRole` enum (keep `MEMBER`, do NOT rename)
- Add `ProjectMember`, `Invitation`, `EventAttendee` models
- Add `Comment.internal` Boolean field (default false)
- Add `Person.userId` optional field
- Run `prisma migrate dev`
- Backfill: All existing users get `ProjectMember` entries for their workspace projects
- **Regression test:** All existing CRUD flows still work, no schema errors

### Phase 2: Access Control Enforcement
- Add `requireRole()`, `requireProjectAccess()`, `requireTaskAccess()` to action-utils
- Update all 8 action files with role-based guards
- Add client-scoped task query (only assigned tasks)
- **Regression test:** Owner can still do everything, no permission errors for existing flows

### Phase 3: Invitation System
- New `invitation` module (service, actions, types)
- New `/invite/[token]` page (public)
- Add `/invite` to middleware public paths
- Modify `auth.ts createUser` event for conditional workspace creation
- Add Team Management section to Settings page
- **Regression test:** New user signup still works, existing users unaffected

### Phase 4: Client Portal
- New `(client)` route group with restricted layout
- `ClientNav` component (limited navigation)
- Client dashboard, task list, task detail pages
- Role-based redirect in `(app)/layout.tsx`
- Comment visibility filter (hide internal comments from clients)
- **Regression test:** Owner and Team flows unchanged

### Phase 5: Operational Layer
- Staleness computation functions (query-time, no stored fields)
- Owner dashboard upgrade with Overdue/Waiting/NeedsAttention sections
- Lazy notification dispatch on dashboard load
- Client nudge logic
- **Regression test:** Full system still works for all roles

---

## F. RISK REGISTER

| Risk | Severity | Mitigation |
|------|----------|------------|
| `MEMBER` → `TEAM` rename breaks existing users | HIGH | Decision: DO NOT rename. Keep `MEMBER` internally. |
| `createUser` event modification breaks new signups | HIGH | Add conditional logic, not replacement. Test both paths. |
| Workspace checks break existing page loads | MEDIUM | Pass workspaceId from session, not from URL. Null-safe. |
| Prisma migration fails on enum change | MEDIUM | Use `prisma migrate dev --create-only`, review SQL before applying. |
| Client portal redirect breaks owner access | MEDIUM | Check role BEFORE redirect. Default to (app) if role unknown. |
| Turbopack cache corruption after schema change | LOW | `rm -rf .next && npm run dev` after every migration. |
