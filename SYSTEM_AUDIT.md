# BUSINESS LIFE OS — FULL SYSTEM AUDIT
**Date:** 2026-04-01
**Auditor:** Senior System Auditor (Claude)
**Stack:** Next.js 16.2.1 + Prisma 6.19.2 + PostgreSQL 16

---

## FLOW 1: ADD PERSON (CLIENT)

### STATUS: BROKEN

### PROOF:
- `src/app/(app)/people/page.tsx` renders a link: `<Link href="/people?new=1">Add</Link>`
- `src/modules/people/people.actions.ts` — `createPersonAction()` fully implemented
- `src/modules/people/people.service.ts` — `createPerson()` fully implemented
- `src/modules/people/people.types.ts` — `createPersonSchema` fully defined (name required, email/phone/telegram/whatsapp/company/notes optional)

### BUGS:
1. **No form component exists.** The `/people?new=1` query param is never read. The page is a server component that does not accept `searchParams`.
2. **No client component exists.** `src/modules/people/components/` directory is empty. No `AddPersonForm` or `PeoplePageClient` component.
3. **`createPersonAction` is never imported or called anywhere in the codebase.**
4. **`updatePersonAction` is never imported or called anywhere.**
5. **`deletePersonAction` is never imported or called anywhere.**

### ROOT CAUSE:
Backend (action + service + schema) was implemented but the UI layer was never built. The tasks module has the working pattern (`TasksPageClient` + `AddTaskInline`) that should have been replicated for people.

### IMPACT: P1
Users cannot add clients/contacts through the UI. The entire CRM entry point is dead.

### FIX:
1. Create `PeoplePageClient.tsx` (toggle form visibility, detect `?new=1`)
2. Create `AddPersonForm.tsx` (form calling `createPersonAction`)
3. Update `people/page.tsx` to accept `searchParams` and render client component

---

## FLOW 2: PEOPLE LIST → PERSON DETAIL

### STATUS: PARTIAL

### PROOF:
- `src/app/(app)/people/page.tsx` renders `<Link href={/people/${person.id}}>` for each person — WORKS
- `src/app/(app)/people/[id]/page.tsx` exists, calls `getPersonById(id)` — WORKS
- Person detail page renders name, company, email, phone, telegram, whatsapp, notes, recent messages

### BUGS:
1. **No edit functionality.** Person detail page is read-only. No form to update person fields. `updatePersonAction` exists but is never called.
2. **No delete functionality.** No button to delete a person. `deletePersonAction` exists but is never called.
3. **No workspace filter on `getPersonById()`** — uses only `findUnique({ where: { id } })`. Security vulnerability: any user could fetch any person by ID if they know it.

### ROOT CAUSE:
Detail page built for display only. Edit/delete UI never implemented.

### IMPACT: P2 (display works, edit/delete missing)

### FIX:
1. Add edit form to person detail page
2. Add delete button with confirmation
3. Add `workspaceId` filter to `getPersonById()` — change to `findFirst({ where: { id, workspaceId } })`

---

## FLOW 3: INBOX → THREAD

### STATUS: WORKING

### PROOF:
- `src/app/(app)/inbox/page.tsx` calls `getConversations(workspaceId)` — returns people with latest messages
- Renders `<Link href={/inbox/${person.id}}>` for each conversation
- `src/app/(app)/inbox/[personId]/page.tsx` calls `getThread(personId, workspaceId)` — returns full message history
- Thread page renders all messages with timestamps, direction indicators (inbound/outbound), Reply + Create Task buttons
- `ThreadActions.tsx` client component handles reply and task creation modes
- Browser verification: Inbox shows "John Client" conversation, thread opens with all 5 messages visible

### BUGS:
1. **`getMessageById()` has no workspace filter** — `findUnique({ where: { id } })`. Used in `messageToTaskAction` — could link a task to a message from another workspace.
2. **Empty inbox shows "Add people" link to `/people`**, but Add Person form doesn't exist (see Flow 1).

### ROOT CAUSE:
Core read flow works. Security gap in message lookup.

### IMPACT: P2 (core flow works, security gap exists)

### FIX:
Add workspaceId to `getMessageById()`.

---

## FLOW 4: THREAD → CREATE TASK

### STATUS: BROKEN (runtime)

### PROOF:
- `ThreadActions.tsx` renders "Create Task" mode with title, project dropdown, description, and submit button
- Calls `messageToTaskAction({ messageId, projectId, title, description })`
- `comms.actions.ts` line 36: `await prisma.task.update({ where: { id: task.id }, data: { sourceMessageId: input.messageId } })`
- **Runtime error:** `Unknown argument sourceMessageId` — Prisma client in the running dev server does NOT have `sourceMessageId` in its type cache

### BUGS:
1. **Prisma client mismatch.** The generated client on disk (node_modules/.prisma/client/index.d.ts) DOES contain `sourceMessageId`. But the running Node.js process has the OLD client cached in memory. Dev server must be restarted after `prisma generate`.
2. **The task creation creates the task first, then updates it in a separate call.** If the update fails (as it does now), the task is created WITHOUT `sourceMessageId` — orphaned task with no source link.
3. **No transaction wrapping.** The create + update should be atomic.

### ROOT CAUSE:
`prisma generate` was run but the dev server was not restarted. Node.js caches `node_modules` imports in memory and does not hot-reload them. This is a deployment/restart issue, not a code bug — BUT the two-step create-then-update pattern IS a code bug.

### IMPACT: P0
The core message-to-task conversion is completely broken at runtime. This is the primary operational flow of the system.

### FIX:
1. **Immediate:** Restart the dev server (`kill + npm run dev`)
2. **Code fix:** Merge the create + update into a single `prisma.task.create()` with `sourceMessageId` in the initial data, or wrap in a transaction

---

## FLOW 5: TASK → SOURCE MESSAGE RELATION

### STATUS: BROKEN (dependent on Flow 4)

### PROOF:
- Schema: `Task.sourceMessageId String?` with `sourceMessage Message? @relation(...)` — CORRECT
- `task.queries.ts` `getTaskById()` includes `sourceMessage: { select: { id, content, channel, createdAt, person: { id, name } } }` — CORRECT
- `tasks/[id]/page.tsx` reads `task.sourceMessageId`, `task.sourceMessage?.person?.name`, `task.sourceMessage?.person?.id` — CORRECT
- `TaskDetailClient.tsx` renders "CREATED FROM CONVERSATION" card when `sourceMessageId` is truthy with link to `/inbox/{sourcePersonId}` — CORRECT

### BUGS:
1. **Cannot be tested** because Flow 4 is broken. No task with `sourceMessageId` can be created through the UI right now.
2. **Code is clean** — no `as any` casts, no raw SQL. All native Prisma includes.

### ROOT CAUSE:
Blocked by Flow 4 runtime failure.

### IMPACT: P0 (blocked)

### FIX:
Fix Flow 4 first (restart dev server), then this will work.

---

## FLOW 6: TASK → ASSIGNEE

### STATUS: WORKING

### PROOF:
- `tasks/[id]/page.tsx` fetches workspace users: `prisma.user.findMany({ where: { workspaceId }, select: { id, name } })`
- Passes `users` array to `TaskDetailClient`
- `TaskDetailClient.tsx` renders assignee dropdown with user options
- Calls `updateTaskAction(taskId, { assigneeId: value })` on change
- `task.actions.ts` `updateTaskAction` handles assigneeId changes, creates `TASK_ASSIGNED` notification
- Schema: `Task.assigneeId` references `User` model (NOT Person) — correct

### BUGS:
1. **No workspace filter on `updateTask()` service.** Uses `prisma.task.update({ where: { id } })` — could update any task by ID.
2. **No workspace filter on `getTaskById()` query.** Uses `findUnique({ where: { id } })` — could read any task.

### ROOT CAUSE:
Service layer trusts action layer to provide valid IDs. No defense-in-depth.

### IMPACT: P2 (works correctly in single-workspace scenario, security gap in multi-workspace)

### FIX:
Add workspaceId to task update/read queries.

---

## FLOW 7: TASK → STATUS / COMMENT

### STATUS: WORKING

### PROOF:
- `TaskDetailClient.tsx` renders status buttons (TODO, IN_PROGRESS, WAITING, DONE) and priority buttons
- Calls `updateTaskAction(taskId, { status })` or `updateField('priority', value)`
- Comment form: textarea + submit calls `addCommentAction({ content, taskId })`
- `comment.actions.ts` creates comment, logs activity, creates notification, revalidates paths
- `TaskCheckbox.tsx` on tasks list calls `quickStatusAction(taskId, newStatus)` — toggles TODO/DONE

### BUGS:
1. **`deleteCommentAction` exists but no UI to delete comments.** No delete button rendered.
2. **Comment revalidation only covers `/tasks` and `/tasks/{id}`** — if viewing from project detail, stale data shown.

### ROOT CAUSE:
Delete UI not built. Revalidation paths incomplete.

### IMPACT: P2

### FIX:
Add delete button to comments. Add project path revalidation.

---

## FLOW 8: NOTES CREATION + ACCESS

### STATUS: BROKEN

### PROOF:
- `src/app/(app)/notes/new/page.tsx` — client component, creates notes via `createNoteAction()` — WORKS
- `src/app/(app)/notes/page.tsx` — lists notes — WORKS for display
- **NO `/notes/[id]/page.tsx` exists** — there is no detail/edit page for notes
- Notes list items are NOT clickable — rendered as plain `<div>`, no `<Link>` wrapper
- `getNoteAction()`, `updateNoteAction()`, `deleteNoteAction()` all exist in `note.actions.ts` but are NEVER CALLED
- `getNoteById()`, `updateNote()`, `deleteNote()` exist in `note.service.ts` but are NEVER CALLED

### BUGS:
1. **Notes are write-only.** User can create a note but cannot view its full content, edit it, or delete it.
2. **No detail route.** `/notes/[id]/page.tsx` does not exist.
3. **Notes list has no click targets.** Items are `<div>` not `<Link>`.
4. **5 dead action/service functions** exist that are never reachable from any UI.

### ROOT CAUSE:
Only the create flow was implemented. The entire read/update/delete UI was never built.

### IMPACT: P1
Notes are a core feature. Users create notes that then become inaccessible for editing or detailed viewing.

### FIX:
1. Create `notes/[id]/page.tsx` with view/edit/delete functionality
2. Wrap note cards in `<Link href={/notes/${note.id}}>` on the list page
3. Wire up `updateNoteAction` and `deleteNoteAction` in the detail page

---

## FLOW 9: NAVIGATION CONSISTENCY

### STATUS: PARTIAL

### PROOF:
- Bottom nav (MobileNav.tsx): Home, Inbox, FAB (+), Tasks, People — 4 main routes + FAB menu
- FAB menu: New Task (`/tasks?new=1`), Quick Note (`/notes/new`), Voice Note (`/voice`)
- Header component: per-page with backHref prop

### BUGS:
1. **Settings page (`/settings`) has NO navigation link.** Only reachable by typing URL directly.
2. **Calendar page (`/calendar`) has NO navigation link.** Only reachable by typing URL directly.
3. **Notes list (`/notes`) has NO navigation link.** FAB goes to `/notes/new` but the list page is orphaned. After creating a note, user is redirected to `/notes` which is then a dead end with no way back except browser back.
4. **Projects page (`/projects`) is only reachable from home page quick actions** — not in bottom nav.
5. **Notifications page (`/notifications`) only reachable from home page bell icon** — not in bottom nav.

### ROOT CAUSE:
Bottom nav has only 4 items. Several important pages were built but never added to any navigation structure. No hamburger menu or "more" option exists.

### IMPACT: P1
Users cannot discover or access 3 existing pages (Settings, Calendar, Notes list) through normal navigation.

### FIX:
1. Add a "More" menu or expand navigation to include Settings, Notes, Projects
2. Or add Settings icon to header globally
3. Add Notes to bottom nav or FAB menu

---

## FLOW 10: DATA REVALIDATION

### STATUS: PARTIAL

### PROOF:
All write actions call `revalidatePath()`:
- `createTaskAction` → `/tasks`, `/`, `/projects/{id}` ✓
- `updateTaskAction` → `/tasks`, `/`, `/projects/{id}` ✓
- `createProjectAction` → `/projects` ✓
- `createNoteAction` → `/notes` ✓
- `createPersonAction` → `/people` ✓
- `messageToTaskAction` → `/tasks`, `/`, `/projects/{id}`, `/inbox` ✓
- `addCommentAction` → `/tasks`, `/tasks/{id}`, `/` ✓

### BUGS:
1. **Turbopack dev server has known cache issues.** `revalidatePath()` doesn't always force immediate re-render. Users may see stale data until hard refresh (Cmd+Shift+R).
2. **`addCommentAction` doesn't revalidate project path.** If viewing task from project detail, comment won't appear.
3. **No revalidation on person detail** after person update (action exists but is never called — see Flow 2).

### ROOT CAUSE:
Turbopack HMR + Next.js server cache interaction. Not all cross-page dependencies are covered by revalidation.

### IMPACT: P2

### FIX:
Add missing revalidation paths. For Turbopack issue — this is a known dev-mode limitation, not a production concern.

---

## GLOBAL SYSTEM CHECKS

### RAW SQL IN CODEBASE
- **Only 1 instance:** `src/app/api/health/route.ts` — `prisma.$queryRaw\`SELECT 1\`` for health check. Acceptable.
- **Zero raw SQL in any P0/P1 flow.** ✓

### TYPE CASTS (`as any`)
- 4 instances, all in integration adapters handling external payloads:
  - `telegram.adapter.ts:21` — `rawPayload as any` (external webhook)
  - `whatsapp.adapter.ts:21` — `rawPayload as any` (external webhook)
  - `comms.service.ts:26` — `rawPayload as any` (storing untyped payload)
  - `ai.service.ts:62` — `parsed as any` (OpenAI output)
- **Zero `as any` in core application flows.** ✓

### DEAD FEATURES (exist but unreachable)
1. `/calendar` page — placeholder, no nav link
2. `/settings` page — implemented, no nav link
3. `/voice` page — placeholder, reachable only from FAB
4. `deletePersonAction` — never called
5. `updatePersonAction` — never called
6. `deleteProjectAction` — never called
7. `getNoteAction` — never called
8. `updateNoteAction` — never called
9. `deleteNoteAction` — never called
10. `markNotificationReadAction` — never called (no mark-as-read UI)
11. `markAllNotificationsReadAction` — never called

### UNUSED SERVICE FUNCTIONS
- `people.service.updatePerson()` — no UI calls it
- `people.service.deletePerson()` — no UI calls it
- `note.service.getNoteById()` — no detail page
- `note.service.updateNote()` — no edit UI
- `note.service.deleteNote()` — no delete UI

### SECURITY: WORKSPACE ISOLATION GAPS
These service functions have NO workspace filter on mutations/reads by ID:
- `task.service.updateTask(id, input)` — no workspaceId
- `task.service.deleteTask(id)` — no workspaceId
- `task.queries.getTaskById(id)` — no workspaceId
- `note.service.updateNote(id, input)` — no workspaceId
- `note.service.deleteNote(id)` — no workspaceId
- `note.service.getNoteById(id)` — no workspaceId
- `people.service.updatePerson(id, input)` — no workspaceId
- `people.service.deletePerson(id)` — no workspaceId
- `people.service.getPersonById(id)` — no workspaceId
- `file.service.removeFile(id)` — no workspaceId
- `comms.service.getMessageById(id)` — no workspaceId
- `ai.service.approveAiJob(jobId)` — no workspaceId

### ERROR HANDLING
- All actions use `safeAction()` wrapper — catches errors, returns generic "Something went wrong"
- No error details surfaced to client (intentional for security, bad for debugging)
- Server-side `console.error('[Action Error]', error)` logs full error objects

### MISSING ERROR BOUNDARIES
- No React Error Boundary in layout or any page
- If a server component throws, user gets Next.js default error page

### PRISMA MIGRATIONS
- `prisma/migrations/` directory is EMPTY
- Database schema was likely applied via `prisma db push` (not migration-based)
- No migration history = no rollback capability

### WEBHOOK ROUTES
- `/api/webhooks/telegram/route.ts` — implemented, validates signatures, saves messages
- `/api/webhooks/whatsapp/route.ts` — implemented, validates signatures, saves messages
- Both require environment variables and external service configuration
- No UI to configure integrations (Settings page is minimal)

---

## SYSTEM HEALTH SUMMARY

### Working: ~45%
- Home dashboard with today's tasks and activity feed
- Task list with checkboxes (quick status toggle)
- Task detail with status/priority/assignee/comment
- Inline task creation from tasks page
- Project list and project detail
- Inline project creation
- Inbox conversation list
- Thread view with all messages
- Reply to conversation (send message)
- Note creation (write-only)
- Notifications display
- Authentication flow
- Health check API

### Partial: ~30%
- People list (display only, no add/edit/delete)
- Notes system (create works, no view/edit/delete)
- Navigation (4/7 pages reachable)
- Task → Source Message (code correct, runtime broken)
- Notifications (display only, no mark-as-read)
- Activity feed (display only, items not clickable)
- Workspace security (isolation gaps)

### Broken: ~25%
- Add Person flow (no UI)
- Message → Task conversion (Prisma client stale at runtime)
- Notes detail/edit/delete (no pages exist)
- Settings navigation (unreachable)
- Calendar (placeholder)
- Voice (placeholder)

---

## CRITICAL BLOCKERS (TOP 5)

### 1. PRISMA CLIENT RUNTIME MISMATCH (P0)
The dev server must be restarted after `prisma generate`. The generated client on disk has `sourceMessageId` but the running process does not. This blocks the entire message-to-task flow.
**Fix:** Restart dev server. Time: 30 seconds.

### 2. ADD PERSON FLOW HAS NO UI (P1)
Backend is 100% ready. Zero frontend. Users cannot add clients.
**Fix:** Create `PeoplePageClient.tsx` + `AddPersonForm.tsx`, update page to accept searchParams. Time: 1-2 hours.

### 3. NOTES SYSTEM IS WRITE-ONLY (P1)
Notes can be created but never viewed in detail, edited, or deleted. 5 backend functions exist unused.
**Fix:** Create `notes/[id]/page.tsx`, add Link wrappers to note cards. Time: 2-3 hours.

### 4. NAVIGATION GAPS — 3 PAGES UNREACHABLE (P1)
Settings, Calendar, and Notes list have no navigation entry points.
**Fix:** Add Settings link to header or nav. Add Notes to nav. Time: 30 minutes.

### 5. MESSAGE-TO-TASK IS NOT ATOMIC (P1)
Task is created first, then `sourceMessageId` is set in a separate update. If the update fails, orphaned task remains. Should be a single create or wrapped in a transaction.
**Fix:** Include `sourceMessageId` in the initial `prisma.task.create()` data. Time: 15 minutes.

---

## EXECUTION PLAN (STRICT ORDER)

### Phase 1: Unblock (30 minutes)
1. **Restart dev server** — fixes Prisma client runtime mismatch (Blocker #1)
2. **Merge task create + sourceMessageId into single Prisma create** — fixes atomicity (Blocker #5)
3. **Verify message-to-task flow works end-to-end** after restart

### Phase 2: Core Missing UI (3-4 hours)
4. **Build Add Person form** — follow AddTaskInline pattern (Blocker #2)
5. **Build Notes detail page** (`notes/[id]/page.tsx`) with view/edit/delete (Blocker #3)
6. **Add Link wrappers** to note cards on notes list page

### Phase 3: Navigation (30 minutes)
7. **Add Settings link** to header or expanded nav (Blocker #4)
8. **Add Notes link** to bottom nav or FAB menu
9. **Add Projects link** to bottom nav

### Phase 4: Polish (2-3 hours)
10. **Add Person edit/delete** UI on person detail page
11. **Add notification mark-as-read** buttons
12. **Make activity feed items clickable** (link to entities)
13. **Add delete button** to comments

### Phase 5: Security Hardening (2-3 hours)
14. **Add workspaceId filters** to ALL service functions that operate by ID
15. **Add React Error Boundary** to app layout
16. **Consider Prisma migrations** instead of `db push`

### DO NOT DO (waste of time right now):
- Calendar integration (Phase 5 feature)
- Voice recording (Phase 4 feature)
- Integration configuration UI
- Webhook setup UI
- AI job approval UI
