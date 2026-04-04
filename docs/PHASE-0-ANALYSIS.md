# Phase 0 — System Gap Analysis

> Business Life OS: v1 → v2 MVP Migration
> Date: 2026-04-03 | Status: ANALYSIS COMPLETE

---

## 1. CURRENT ARCHITECTURE ASSESSMENT

### 1.1 What Exists (v1 Inventory)

**Stack:** Next.js 16.2.1 / React 19 / Prisma 6.4 / PostgreSQL / Tailwind 4 / Auth.js (next-auth 5 beta)

**Database:** 20 models, 12 enums. Workspace-scoped. Single-tenant per user.

**Modules (13 total):**

| Module | Service Functions | Actions | Queries | Maturity |
|---|---|---|---|---|
| tasks | 3 (thin CRUD) | 6 | 6 | **Functional but thin** — service is 25 lines, all logic lives in actions |
| projects | 3 (thin CRUD) | 5 | 2 | **Same pattern** — thin service |
| notes | 5 | 5 | 0 | Solid |
| events | 6 | 3 | 0 | Solid |
| people | 6 | 4 | 0 | Solid |
| comments | 3 | 2 | 0 | Solid, has internal flag |
| communications | 6 + 2 adapters | 2 | 0 | Most complex module |
| notifications | 5 | 2 | 0 | Simple but complete |
| activity | 2 | 0 | 0 | Logging only |
| ai | 3 | 0 | 0 | **Task extraction + transcription only** |
| voice | 4 | 0 | 0 | Upload + transcription lifecycle |
| invitations | 8 | 7 | 0 | Complete RBAC onboarding |
| workspace | 2 | 2 | 0 | Minimal |
| operational (staleness) | 3 | 0 | 0 | Smart, on-demand computation |
| files | 3 | 0 | 0 | R2 upload/delete |
| integrations | 4 | 0 | 0 | Config management |
| calendar | 1 (placeholder) | 0 | 0 | **Not implemented** |

**Total:** ~80 service functions, ~38 server actions, ~8 query functions.

**Auth System:**
- Auth.js with database sessions (not JWT — the summary mentioned JWT but code shows `strategy: 'database'`)
- Google OAuth + Credentials (dev only)
- Session callback injects: id, role, workspaceId
- Guard hierarchy: `requireAuth()` → `requireWorkspace()` → `requireRole()` → `requireProjectAccess()` / `requireTaskAccess()`

**RBAC:**
- UserRole: OWNER / TEAM / CLIENT
- ProjectMemberRole: LEAD / CONTRIBUTOR / VIEWER
- CLIENT users redirected to `/portal` (separate route group)
- CLIENT can only: view assigned tasks, change task status, comment on assigned tasks

**UI Architecture:**
- Mobile-first bottom nav (5 items: Home, Inbox, FAB, Tasks, People)
- FAB opens overlay with 4 quick actions (Event, Task, Note, Voice)
- Server Components by default, Client Components for interactive elements
- No sidebar (mobile-only design in v1)
- No command palette
- No keyboard shortcuts
- No venture/context switching

### 1.2 Architecture Quality Assessment

**Strengths (reuse as-is):**
1. `safeAction()` wrapper pattern — clean, consistent error handling
2. Guard hierarchy — well-structured, composable
3. Activity logging — comprehensive, already tracks all mutations
4. Notification pipeline — works, simple
5. Communications adapters — good abstraction (Telegram/WhatsApp)
6. Staleness service — smart on-demand computation, no cron dependency
7. Module file organization — `service.ts` / `actions.ts` / `queries.ts` / `types.ts` pattern is correct
8. Comment system with `internal` flag — v2-ready
9. Prisma schema is clean with proper indexes

**Weaknesses (must address):**
1. **Service layer is too thin.** `task.service.ts` is 25 lines — just Prisma wrappers. All real logic (validation, auth, notifications, activity logging) lives in actions. This violates the architecture principle: services = logic, actions = auth + routing.
2. **No venture layer.** Everything is workspace-scoped. No multi-business support.
3. **AI module is primitive.** Only does transcription + task extraction. No session management, no prompt storage, no multi-model support.
4. **AiJob model is a dead-end.** It tracks extraction jobs but has no concept of AI sessions, iterations, or prompt management. Must be replaced, not extended.
5. **No capture system.** Input paths are: manual form, voice note (separate page), message-to-task. No universal inbox.
6. **Task statuses are insufficient.** Only TODO / IN_PROGRESS / WAITING / DONE. Missing: PLANNED, BLOCKED, IN_REVIEW.
7. **No task dependencies.** No blocker tracking.
8. **No decision tracking.** Zero institutional memory.
9. **Project model is minimal.** No goals, no priority, no timeline, no health computation.
10. **Desktop experience doesn't exist.** No sidebar, no command palette, no keyboard shortcuts. UI is phone-only.
11. **Person model lacks types and scoring.** Everyone is the same — no differentiation between team, client, advisor, investor.

---

## 2. GAP ANALYSIS: v1 → v2 MVP

### 2.1 New Models Required

| Model | Exists? | Action |
|---|---|---|
| Venture | NO | **Create from scratch** |
| VenturePerson | NO | **Create from scratch** |
| AISession | NO | **Create from scratch** (replaces AiJob conceptually) |
| Prompt | NO | **Create from scratch** |
| Decision | NO | **Create from scratch** |
| Capture | NO | **Create from scratch** |
| ShareLink | NO, deferred | Not in MVP |
| Metric | NO, deferred | Not in MVP |
| Artifact | NO, deferred | File model sufficient for MVP |

### 2.2 Models Requiring Extension

| Model | What Changes | Risk |
|---|---|---|
| **Project** | Add: ventureId, goals[], priority, startDate, targetDate | MEDIUM — FK addition, backfill needed |
| **Task** | Add: ventureId, blockerId, blockerNote, sourceType, estimatedMinutes, aiSessionId. New statuses: PLANNED, BLOCKED, IN_REVIEW | HIGH — status enum change affects ALL task queries and UI |
| **Person** | Add: type, tags[], avatarUrl, reliabilityScore, lastContactAt | LOW — additive fields only |
| **Activity** | Add EntityType values: AI_SESSION, DECISION, VENTURE, CAPTURE, PROMPT. Add ActivityAction values: ACCEPTED, REJECTED, CAPTURED | LOW — enum additions are backward-compatible |
| **Workspace** | Add: ventures relation | LOW — just a relation, no schema change needed |

### 2.3 New Modules Required

| Module | Files Needed | Complexity |
|---|---|---|
| `ventures/` | service, actions, queries, types | MEDIUM — new CRUD + context switching |
| `ai/` (rewrite) | ai-session.service, ai-session.actions, ai-session.queries, ai-session.types, mcp-bridge | HIGH — biggest new module |
| `prompts/` | service, actions, queries, types | MEDIUM — CRUD + variable engine |
| `decisions/` | service, actions, queries, types | LOW-MEDIUM — CRUD + linking |
| `capture/` | service, actions, types | MEDIUM — classification pipeline |

### 2.4 Existing Modules Requiring Changes

| Module | What Changes | Scope |
|---|---|---|
| `tasks/` | New statuses, ventureId, blocker system, sourceType tracking, service layer thickening | LARGE |
| `projects/` | ventureId, goals, priority, timeline, health computation, service layer thickening | LARGE |
| `people/` | Type enum, tags, reliability score, lastContactAt | SMALL |
| `operational/` | Cross-venture signals, project health, venture-aware staleness | MEDIUM |

### 2.5 New Routes Required

| Route | Type | Priority |
|---|---|---|
| `/ventures` | List page | MVP |
| `/ventures/[id]` | Detail page | MVP |
| `/ai` | AI Session list | MVP |
| `/ai/[id]` | AI Session detail | MVP |
| `/ai/new` | New AI Session | MVP |
| `/ai/prompts` | Prompt Vault | MVP |
| `/ai/prompts/[id]` | Prompt detail/edit | MVP |
| `/decisions` | Decision list | MVP |
| `/decisions/[id]` | Decision detail | MVP |
| `/capture` | Capture inbox | MVP |

### 2.6 UI Changes Required

| Component | Change | Impact |
|---|---|---|
| `MobileNav.tsx` | Replace 5-item nav with: Home, Tasks, +, AI, More | MEDIUM |
| `layout.tsx` (app) | Add VentureSwitcher, venture context | HIGH |
| NEW: `Sidebar.tsx` | Desktop sidebar navigation | MEDIUM |
| NEW: `VentureSwitcher.tsx` | Venture context component | HIGH |
| NEW: `CommandPalette.tsx` | Cmd+K search (deferred?) | LOW |
| Dashboard `page.tsx` | Evolve to cockpit with cross-venture aggregation | HIGH |

---

## 3. RISK AREAS

### Risk 1: TaskStatus Enum Change — HIGH
**Problem:** Adding PLANNED, BLOCKED, IN_REVIEW to TaskStatus enum affects every query that filters by status, every UI component that renders status badges, and every action that validates status transitions.

**Files affected:**
- `prisma/schema.prisma` (enum definition)
- `src/modules/tasks/task.types.ts` (Zod schemas)
- `src/modules/tasks/task.actions.ts` (quickStatusAction, updateTaskAction)
- `src/modules/tasks/task.queries.ts` (every query with status filters)
- `src/modules/tasks/components/TaskCheckbox.tsx` (status toggle)
- `src/modules/tasks/components/TasksPageClient.tsx` (status display)
- `src/modules/operational/staleness.service.ts` (staleness computation)
- `src/app/(app)/page.tsx` (dashboard task display)
- `src/app/(client)/portal/page.tsx` (client dashboard)
- `src/app/(client)/portal/tasks/page.tsx` (client tasks)

**Mitigation:** Add new enum values FIRST. Existing code won't break because it only matches known values. Then update components one by one.

### Risk 2: Venture Layer → Project FK — HIGH
**Problem:** Every Project must gain a `ventureId`. This is a required FK. Existing projects have no venture. Migration must create a default venture and backfill.

**Migration sequence:**
1. Create Venture table
2. Create a default Venture per Workspace (using workspace name)
3. Add `ventureId` to Project as optional
4. Backfill `ventureId` on all existing Projects
5. Make `ventureId` required
6. Add `ventureId` to Task (denormalized, backfill from Project)

**Mitigation:** Multi-step migration. Never make a field required before backfilling.

### Risk 3: AI Module Rewrite — MEDIUM
**Problem:** Current AI module does only task extraction via OpenAI. V2 needs full AI Session management with multi-model support. The `AiJob` model must be deprecated in favor of `AISession`.

**Approach:** Don't delete AiJob. Create AISession as a separate model. Migrate references gradually. AiJob can stay for legacy transcription jobs until fully replaced.

### Risk 4: Auth Session Shape — LOW
**Problem:** Session callback currently injects `id`, `role`, `workspaceId`. V2 needs to also carry the active `ventureId`. But this changes every `requireWorkspace()` call.

**Approach:** Don't put ventureId in the session. Use a separate mechanism:
- Cookie: `blo-active-venture=[ventureId]`
- Or server-side header/searchParam
- Read in a `getActiveVenture()` utility, not in auth

This avoids touching the auth system entirely.

### Risk 5: Service Layer Refactoring — MEDIUM
**Problem:** Task and Project services are thin wrappers. V2 requires substantial logic (blocker resolution, health computation, venture scoping). If we thicken services while keeping actions as-is, there's risk of duplicated logic.

**Approach:** Phase this. For new modules (AI, Decisions, Capture), start with thick services from day 1. For existing modules (Tasks, Projects), refactor as we add features.

---

## 4. WHAT CAN BE REUSED (no changes needed)

These modules work as-is and don't need modification for MVP:

| Module | Reason |
|---|---|
| `notifications/` | Already generic (type + title + body + link). New entity types just create new notifications. |
| `activity/` | Already generic (action + entityType + entityId). New entities just add new enum values. |
| `comments/` | Already supports internal flag. Works for tasks. Can be extended to AI sessions later. |
| `communications/` | Telegram/WhatsApp adapters are independent of venture layer. |
| `voice/` | Transcription pipeline is independent. AI session can reference voice notes. |
| `files/` | R2 upload/delete works. Artifact abstraction can wrap this later. |
| `invitations/` | Workspace-level invitations don't need venture awareness (a user joins a workspace, then accesses ventures). |
| `integrations/` | Config management is workspace-scoped. No change needed. |

**Auth system:** Reuse entirely. Don't touch `auth.ts`. Add venture context separately.

**Guard system:** Reuse `safeAction()`, `requireAuth()`, `requireWorkspace()`, `requireRole()`. Add `requireVenture()` as new guard. Don't modify existing guards.

**Prisma client:** Reuse as-is. Just add new models and extend existing ones.

---

## 5. WHAT MUST BE REFACTORED

### 5.1 Service Layer Thickening (Tasks)

**Current state:**
```typescript
// task.service.ts — 25 lines
export async function createTask(input, creatorId) {
  return prisma.task.create({ data: { ...input, creatorId } })
}
```

**Problem:** All business logic (workspace verification, notification creation, activity logging, CLIENT guards) lives in `task.actions.ts`. This means:
- Services are untestable in isolation
- Logic is duplicated when different entry points need the same behavior
- AI-created tasks would need to duplicate all the action logic

**Target state:**
```typescript
// task.service.ts — rich logic
export async function createTask(input, context: { creatorId, workspaceId, ventureId }) {
  // Validate project belongs to venture
  // Create task with venture denormalization
  // Log activity
  // Create notifications if assigned
  // Return task with relations
}
```

**Actions become thin:**
```typescript
// task.actions.ts — auth + routing only
export async function createTaskAction(input) {
  const session = await requireRole('OWNER', 'TEAM')
  const ventureId = await getActiveVenture(session)
  const validated = createTaskSchema.parse(input)
  return safeAction(() => taskService.createTask(validated, {
    creatorId: session.user.id,
    workspaceId: session.workspaceId,
    ventureId,
  }))
}
```

**Scope:** This is a REFACTOR, not a rewrite. Move logic from actions to services. Actions keep auth only.

### 5.2 Project Service Thickening (same pattern as Tasks)

**Same problem.** Project service is 33 lines. Move workspace verification and logic into service.

### 5.3 Dashboard → Cockpit Evolution

**Current:** Dashboard shows today's tasks, owner signals, stale tasks, activity, quick actions. All workspace-scoped.

**Required:** Cockpit aggregates across ventures. Shows fires, decisions needed, focus, signals.

**Approach:** Don't rewrite the dashboard. Evolve it:
1. Add venture filter (default: all)
2. Add "Decisions Needed" section (after AISession exists)
3. Evolve owner signals into cross-venture signals
4. Keep existing sections working throughout

### 5.4 Navigation Evolution

**Current:** Mobile bottom nav with 5 items (Home, Inbox, FAB, Tasks, People).

**Required:** 5 items but different: Home, Tasks, Capture FAB, AI, More (overflow menu).

**Approach:** The FAB behavior changes from "4 creation links" to "capture input". The nav items change. This is a controlled replacement, not a refactor.

---

## 6. IMPLEMENTATION ORDER (RECOMMENDED)

Based on dependency analysis, the correct build order is:

```
Step 1: Venture Model + Migration + Default Venture Backfill
  ↓ (no other module depends on venture yet)
Step 2: Project Extension (add ventureId) + Backfill
  ↓ (projects now venture-aware)
Step 3: Task Extension (add ventureId, new statuses, sourceType)
  ↓ (tasks now venture-aware, new statuses available)
Step 4: Venture UI (switcher, list page, detail page)
  ↓ (users can see and switch ventures)
Step 5: AISession Model + Service + Actions + Queries
  ↓ (AI workspace exists as data layer)
Step 6: AI Session UI (list, detail, new session)
  ↓ (users can create and view AI sessions)
Step 7: Prompt Model + Service + UI
  ↓ (prompts can feed AI sessions)
Step 8: Capture Model + Service + Basic UI
  ↓ (quick capture works)
Step 9: Decision Model + Service + UI
  ↓ (decisions can be logged)
Step 10: Cockpit Evolution (cross-venture, signals, decisions needed)
  ↓ (dashboard becomes the command center)
Step 11: Navigation Overhaul (new MobileNav, Sidebar)
  ↓ (UX matches new information architecture)
Step 12: Task Engine Enhancement (blockers, quick status UX)
  ↓ (execution engine is complete)
```

Each step is independently deployable. Each step ends with: build passes, existing features still work.

---

## 7. ARCHITECTURE DECISIONS (pre-implementation)

### Decision 1: Venture Context — Cookie, not Session
**Why:** Changing the auth session shape requires modifying `auth.ts`, all guard functions, and the session type. A cookie (`blo-active-venture`) is readable server-side, changeable client-side, and doesn't touch auth.

### Decision 2: New AISession Model, Don't Extend AiJob
**Why:** AiJob was designed for background processing (transcription, extraction). AISession is a user-facing entity with iterations, ratings, and links. Different purpose, different shape. Keep AiJob for backward compatibility, create AISession fresh.

### Decision 3: Denormalize ventureId on Task
**Why:** Cross-venture task queries ("show me all my urgent tasks across all ventures") would require joining Task → Project → Venture on every query. Denormalizing ventureId on Task avoids this join. The cost is maintaining consistency (set on create, update if project changes — rare).

### Decision 4: Add Enum Values, Don't Replace Enums
**Why:** PostgreSQL enum migration. Adding values (`ALTER TYPE ... ADD VALUE`) is safe and non-destructive. Renaming or removing values requires recreating the enum, which is destructive. Add PLANNED, BLOCKED, IN_REVIEW to TaskStatus. Don't rename existing values.

### Decision 5: Thick Services from Day 1 (new modules)
**Why:** Every new module (AI, Decisions, Capture, Ventures, Prompts) starts with the correct architecture: services own business logic, actions own auth + validation. Don't repeat v1's thin-service mistake.

### Decision 6: No MCP in MVP
**Why:** MCP integration (exposing BLO as an MCP server, connecting Codex as a client) is a v2.1 feature. For MVP, the AI Workspace calls Anthropic/OpenAI APIs directly. MCP can be layered on top later because the service layer is API-agnostic.

### Decision 7: Person Type Enum — Add, Don't Migrate
**Why:** Current Person model has no `type` field. Add `PersonType` enum with default `OTHER`. Existing records get `OTHER`. Users reclassify manually. No data migration needed.

---

## 8. QUESTIONS THAT NEED ANSWERING BEFORE IMPLEMENTATION

1. **AI Provider for AISession:** Use Anthropic (Claude) API directly, or keep OpenAI? Or both?
   - Recommendation: Both. Claude for strategy/analysis, GPT-4o for fast extraction. Model selector in UI.

2. **Active Venture persistence:** Cookie vs localStorage vs URL param?
   - Recommendation: HTTP-only cookie. Works with Server Components. No client JS needed.

3. **Task status transitions:** Should we enforce valid transitions (e.g., can't go from PLANNED to DONE directly)?
   - Recommendation: Not for MVP. Any status can transition to any status. Add state machine later if needed.

4. **Capture AI classification:** Use AI on every capture, or only on voice/paste?
   - Recommendation: Basic AI classification on all captures. Use a fast model (Claude Haiku or GPT-4o-mini). If classification confidence > 0.8, auto-route. Otherwise, user confirms.

5. **Decision model — required or optional?**
   - Recommendation: Optional. Decisions are a knowledge tool, not a gate. Users log decisions when they want to, not when forced to.

---

## 9. FILES THAT WILL NOT BE TOUCHED

For safety and scope control, these files/modules remain unchanged in the MVP migration:

```
src/lib/auth.ts                    — No auth changes
src/lib/prisma.ts                  — No client changes
src/modules/communications/        — Entire module unchanged
src/modules/voice/                 — Entire module unchanged
src/modules/files/                 — Entire module unchanged
src/modules/integrations/          — Entire module unchanged
src/modules/invitations/           — Entire module unchanged
src/modules/calendar/              — Placeholder, stays as-is
src/app/(auth)/                    — Login page (already has 3 dev buttons)
src/app/(client)/                  — Client portal unchanged
src/app/api/webhooks/              — Telegram/WhatsApp webhooks unchanged
```

---

*Phase 0 complete. Ready for Phase 1: Architecture Design.*
*No code was written. No files were changed.*
