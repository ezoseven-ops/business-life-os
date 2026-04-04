# PHASE A — PRE-BUILD AUDIT

> Full implementation audit of Business Life OS codebase before V1 Control System build.
> Date: 2026-04-03
> Scope: Schema, all modules, command center prototype, auth/RBAC, UI, design docs.

---

## 1. CODEBASE INVENTORY

**Scale:** ~7,900 lines of TypeScript across 90 files.

**Route groups:**
- `(app)` — OWNER/TEAM dashboard: Home, Tasks, Projects, Notes, Calendar, Inbox, Voice, People, Settings, Notifications
- `(auth)` — Login, Verify
- `(client)` — Client portal: Dashboard, Tasks, Profile
- `api/` — Auth handler, health check, Telegram/WhatsApp webhooks

**Modules (13):**
- tasks (service, actions, queries, types, 3 components)
- projects (service, actions, queries, types, 2 components)
- notes (service, actions, types, 1 component)
- events (service, actions, types, 1 component)
- comments (service, actions)
- people (service, actions, types, 2 components)
- notifications (service, actions)
- activity (service)
- ai (service, types, 1 prompt template)
- voice (service)
- communications (service, actions, types)
- integrations (service, types, 2 adapters — Telegram, WhatsApp)
- operational (staleness service)
- command-center (focus engine, signal engine, daily brief, project overview — NEW)

**Auth:** Auth.js with database sessions, Google OAuth + Credentials (dev). Session callback injects id, role, workspaceId.

**Guard chain:** requireAuth → requireWorkspace → requireOwner / requireRole → requireProjectAccess / requireTaskAccess.

---

## 2. WHAT IS CURRENTLY GOOD

### Solid foundations to preserve:

1. **Auth + RBAC system is production-grade.** Database sessions (not JWT), proper role hierarchy (OWNER/TEAM/CLIENT), project-level access control with ProjectMember records, task-level access for CLIENT users. Guard chain in action-utils.ts is clean and composable.

2. **Server action pattern is consistent.** Every mutation goes through `safeAction()` wrapper → Zod validation → service call → activity log → revalidate paths. This is a good pattern to keep.

3. **Client portal isolation is correct.** Layout redirects CLIENT → /portal. Separate route group with its own layout. CLIENT users see only assigned tasks and non-internal comments. This is well-isolated.

4. **Activity logging is comprehensive.** Every CRUD action logs to Activity table with userId, entityType, entityId, metadata. This is reusable for the Signal Engine (checking when things last changed).

5. **Staleness service has correct detection logic.** getStaleTasks() computes staleness at query time from updatedAt. No stored flags, no cron jobs. Pattern is sound and should be evolved into the Signal Engine.

6. **Notification system exists and works.** createNotification(), lazy nudge dispatch, unread count. Basic but functional.

7. **AI module is a real foundation.** Whisper transcription, GPT-4o-mini task extraction with structured JSON output, AiJob tracking with approval flow. This is directly extensible for the AI Operator.

8. **Voice service exists.** Upload to R2, create VoiceNote record, transcription flow with status tracking (UPLOADED → TRANSCRIBING → DONE → FAILED). Needs UI but the service layer is ready.

9. **Integration adapters are scaffolded.** Telegram adapter, WhatsApp adapter, webhook routes exist. Not fully wired but the architecture boundary is correct.

10. **Zod schemas on all inputs.** createTaskSchema, updateTaskSchema, createProjectSchema, etc. Proper validation at the action boundary.

---

## 3. WHAT IS CURRENTLY BAD

### Problems that must be fixed:

1. **Services are dangerously thin.** task.service.ts is 24 lines — just 3 Prisma wrappers (create, update, delete). All business logic lives in task.actions.ts (132 lines). This violates separation of concerns: actions should handle auth + validation only, services should own logic. Same pattern in project.service.ts (33 lines).

   **Impact:** When the Focus/Signal engines need to update a task (e.g., set lastActivityAt), they'd need to either call the action (which requires auth context they don't have) or duplicate the Prisma call. This is a debt that gets worse as complexity grows.

2. **`lastActivityAt` is never updated by production code.** The field was added to the schema and migration, but NO existing action or service writes to it. task.actions.ts calls `taskService.updateTask(id, validated)` — and validated comes from updateTaskSchema which doesn't include lastActivityAt. The Focus and Signal engines both depend on this field for stale detection. In production, lastActivityAt = createdAt forever.

   **Impact:** Focus Engine stale boost (+10) never fires. Signal Engine RISK signals (3+ day no-update) never fire correctly. WASTE signals (7+ day stagnation) never fire. The command center will look clean even when things are rotting.

3. **Focus Engine includes WAITING tasks.** Query has `status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] }`. WAITING means blocked on someone else. You can't "focus" on a task someone else is blocking. These should appear in Signals, not Focus.

4. **Signal Engine generates duplicate signals per task.** A task can be both overdue AND in WAITING status, generating a critical-overdue AND a critical-blocked signal. Same task, two cards in the UI. Confusing.

5. **Focus Engine includes unassigned tasks.** The `OR: [{ assigneeId: userId }, { assigneeId: null }]` means unassigned tasks compete with your assigned work. A P0 unassigned task scores higher than a P2 task you're actually working on. The owner might already know about the unassigned task — it shouldn't crowd out their personal focus.

6. **Dark theme bleeds into ALL (app) pages.** Layout.tsx sets `bg-[#0a0a0f]` globally. Every page under (app) — Tasks, Projects, People, Inbox, Calendar, Notes — renders on a near-black background but uses light-themed cards with white backgrounds, gray-200 borders, gray-900 text. The contrast is broken.

7. **MobileNav is light-themed.** White/90 background, gray-200 border, blue FAB. On the dark layout, it's a jarring white bar at the bottom.

8. **The .card CSS class assumes light mode.** globals.css defines `.card { background: white; border: 1px solid #e5e7eb; }`. On a dark background, white cards look correct but the overall effect is "dark background with light cards" — not a cohesive dark theme.

9. **Root layout also assumes light.** `<body style={{ backgroundColor: '#f9fafb' }}>` and `themeColor: '#f9fafb'` in viewport metadata. If the app is going dark, this must change too, or the flash of white on load will be visible.

10. **No role check on Command Center.** The old dashboard gated owner signals behind `isOwner`. The new command center shows ALL workspace signals and ALL projects to every OWNER/TEAM user. TEAM users see the full operational picture. This may be desired, but it's a behavior change that wasn't explicit.

---

## 4. WHAT IS DANGEROUS

### These will cause real problems if not addressed:

1. **Hand-written migration + Prisma shadow database conflict.** The migration file was written manually (Prisma CLI couldn't run in sandbox). When you run `prisma migrate dev`, Prisma may detect drift between its shadow database and the hand-written SQL. You may need `prisma migrate resolve --applied` to force it.

2. **Project types don't include new fields.** createProjectSchema and updateProjectSchema in project.types.ts don't include `ventureId` or `projectPriority`. If someone creates a project through the existing UI, these fields won't be set. The command center will show them as "no venture" and "P2" (defaults). The create/update forms need to be aware of ventures.

3. **Task types don't include lastActivityAt.** createTaskSchema and updateTaskSchema don't include `lastActivityAt`. Even if we add update logic to the service, the Zod schema will strip it from validated input. The service needs to set it explicitly outside the schema-validated data.

4. **No Venture CRUD exists.** There's a Venture model in the schema and a seed script, but no venture.service.ts, venture.actions.ts, venture.types.ts, or any UI for managing ventures. The command center references ventures in project rows but there's no way to create or edit them except through the seed.

5. **The old dashboard is fully replaced.** The previous page.tsx had: greeting, owner signals (overdue/waiting/unassigned counts), stale tasks, quick action buttons, today's focus tasks, completed today, activity feed. All of that is gone. Some features moved to the command center (focus, signals, projects), but others are lost: quick action grid, activity feed, completed-today section. The MobileNav FAB still provides quick actions, but visibility is reduced.

6. **Orphaned staleness service.** `src/modules/operational/staleness.service.ts` (getOwnerSignals, getStaleTasks, dispatchLazyNudges) is no longer called from anywhere. The command center has its own signal engine. Two overlapping systems detecting similar problems with different logic and different thresholds. Should be consolidated.

---

## 5. DESIGN DOC ALIGNMENT CHECK

### What the design docs prescribe vs. what exists:

| Requirement | Phase 3 Plan | Current State | Gap |
|---|---|---|---|
| Venture model | name, description, stage, color, priority order | name, priority (int), status | Missing: description, stage, color |
| Project extensions | ventureId, P0-P3, quarterlyFocus, goals | ventureId, P0-P3 | Missing: quarterlyFocus, goals |
| Task extensions | ventureId, blockerId, blockerNote, sourceType, BLOCKED status | lastActivityAt only | Missing: ventureId on task, blocker chain, BLOCKED status, sourceType |
| Focus Engine | Top 7 grouped by venture, score explanation, MUST/SHOULD categories | Top 3 flat list, raw score shown | Too simple, no venture grouping, no MUST/SHOULD |
| Signal Engine | 4 types with dismissal (7-day snooze) | 4 types but no dismissal mechanism | Missing signal dismissal |
| AI Operator | 3-5 sentence guidance from cockpit context | getDailyBrief() with template strings | Not AI — just string templates |
| Capture Engine | Text input → AI classify → route | Nothing | Not implemented |
| Voice-to-Execution | Record → transcribe → extract → draft objects | voice.service.ts + ai.service.ts exist | Service layer exists but no UI flow |
| Control Layer | Venture priority + P0-P3 + quarterly focus | Venture priority + P0-P3 only | Missing quarterly focus, attention allocation |
| Cockpit/Command Center | Dark, premium, FIRES → FOCUS → SIGNALS → PROJECTS | Dark, flat, Focus → Signals → Projects | Missing: visual hierarchy, premium feel |

### Key simplifications from Phase 3 that are acceptable for V1:

- No BLOCKED status (just TODO/IN_PROGRESS/WAITING/DONE) — acceptable
- No blockerId/blockerNote — acceptable for V1, needed for V2
- No Decision model — acceptable
- No Prompt Vault — acceptable
- No AI Auditor/Optimizer modes — acceptable
- No energy budget / time-of-day alignment — acceptable
- Only 2 AI modes (Operator + Advisor) — acceptable

### Key simplifications that are NOT acceptable even for V1:

- lastActivityAt must actually work (currently broken)
- Signal Engine must not duplicate signals
- Focus must not include WAITING tasks
- There must be SOME way to create/manage ventures (even if minimal)
- The theme must be coherent (not half-dark, half-light)

---

## 6. WHAT MUST BE FIXED IMMEDIATELY (PRE-BUILD)

Before any new features, these must be resolved:

### FIX 1: lastActivityAt updates
**Where:** task.service.ts (add explicit lastActivityAt = new Date() on create and update)
**Also:** comment.actions.ts (when commenting on a task, touch its lastActivityAt)
**Also:** quickStatusAction in task.actions.ts (status changes are activity)
**Risk:** Low — additive change, no schema modification

### FIX 2: Remove WAITING from Focus Engine
**Where:** focus.engine.ts line 56
**Change:** `status: { in: ['TODO', 'IN_PROGRESS'] }`
**Risk:** None

### FIX 3: Deduplicate signals
**Where:** signal.engine.ts
**Change:** Track seen task IDs, emit only the highest-severity signal per task
**Risk:** None

### FIX 4: Remove unassigned tasks from Focus
**Where:** focus.engine.ts line 57-59
**Change:** Only `{ assigneeId: userId }` — show unassigned tasks in Signals instead
**Risk:** Low — may reduce visible tasks on empty workspaces

### FIX 5: Scope dark theme to Command Center only
**Where:** (app)/layout.tsx
**Change:** Revert to neutral/light background. Let page.tsx own its own dark bg.
**Why:** All other pages (Tasks, Projects, People, etc.) are light-themed. Forcing dark on the layout breaks them all.
**Risk:** Low — one line revert

### FIX 6: Remove raw score from UI
**Where:** page.tsx line 93-95
**Change:** Remove the `{task.score}` span. Keep score in the data model for debugging.
**Risk:** None

---

## 7. ARCHITECTURE BOUNDARIES FOR FUTURE INTEGRATIONS

These systems don't need implementation now, but the architecture must not block them:

### Apple Calendar
- **Current state:** calendar.service.ts exists, Event model has startAt/endAt/allDay/location. EventAttendee model with status.
- **Integration boundary:** Event model is correct. Need: externalCalendarId on Event, a sync service that creates/updates Event records from Apple Calendar API, bi-directional sync flag.
- **What NOT to do:** Don't put calendar-specific fields on Task or Project. Keep calendar as a separate entity linked via events.

### Telegram
- **Current state:** telegram.adapter.ts exists, Message model supports TELEGRAM channel, Person has telegramId, webhook route exists.
- **Integration boundary:** Already correct. Message → Person → Task chain is ready. Need: bot initialization, webhook verification, bi-directional message sending.
- **What NOT to do:** Don't couple Telegram logic into task/project services. Keep it in the integration adapter.

### WhatsApp
- **Current state:** whatsapp.adapter.ts exists, Message model supports WHATSAPP channel, Person has whatsappId.
- **Integration boundary:** Same as Telegram. Message model is channel-agnostic.

### Voice-to-Execution
- **Current state:** voice.service.ts (upload, transcribe flow), ai.service.ts (transcribeAudio via Whisper, extractTasks via GPT-4o-mini).
- **Integration boundary:** The service chain is ready: record → upload to R2 → create VoiceNote → transcribe → extract tasks. What's missing: client-side recording UI, the "review extracted tasks before creation" flow, expanding AI extraction beyond just tasks (projects, decisions, follow-ups).
- **What NOT to do:** Don't make voice a separate module. It should flow through the Capture Engine: voice → transcription → capture → classify → route.

---

## 8. HONEST VISUAL/UX ASSESSMENT

### Current Command Center styling:
- Background: #0a0a0f (near-black)
- Cards: #12121a with border-white/5
- Text: white → zinc-100 → zinc-400 → zinc-600
- Accents: red (critical), orange (high), amber (risk), blue (medium), green (status dots)
- Font: SF Pro / system sans via globals.css

### What's wrong visually:

1. **No hierarchy separation between sections.** Focus, Signals, and Projects all use the same card style (bg-[#12121a], border-white/5, rounded-xl). They look identical. The most important section (Focus) should visually dominate. Signals should feel different from Projects.

2. **Section headers are too subtle.** `text-xs font-bold text-zinc-500 uppercase tracking-wider` — this is the same visual weight for "FOCUS" (your top priority) and "PROJECTS" (background context). Focus needs to scream.

3. **No breathing room between zones.** space-y-6 (24px) between Focus/Signals/Projects. These are conceptually different zones — they need more than 24px separation. A divider, a different background region, or significantly more spacing.

4. **Cards are too uniform.** Every card is the same height, same padding, same border. The #1 focus task should look different from the #3 task. Signal cards should look different from project rows.

5. **Priority is communicated through tiny dots.** 1.5px circles (w-1.5 h-1.5) for priority. Too small on mobile. Priority is the most important metadata on a task — it should be bigger and more communicative.

6. **The Daily Brief is just plain text.** Two lines of gray text under a greeting. This is the AI Operator's voice — it should feel distinct from the rest of the UI. A different background treatment, an icon, a border — something that signals "this is the system talking to you."

7. **MobileNav clash is severe.** White glass bar with blue accent FAB, sitting below a dark command center. Two completely different design languages on the same screen.

8. **No Quick Actions visible.** The old dashboard had a visible 4-button quick action grid (Task, Event, Note, Voice). Now they're hidden behind the FAB menu only. The founder's most common action (capture something fast) requires an extra tap.

### What premium actually means for this product:

- **Bloomberg terminal density** — lots of information, but organized into clear zones with distinct visual language per zone
- **Calm but powerful** — dark doesn't mean edgy. It means: low visual noise, high signal-to-noise ratio, restful on the eyes during long use
- **Typographic scale** — the greeting/brief should be typographically distinct from data. Data should be in a monospace or tabular font. Labels should be uppercase micro text.
- **Accent restraint** — red only for actual fires. No random color splashing. The signal color palette should be: red (fire), amber (risk), zinc (waste), and everything else is monochrome.
- **Motion subtlety** — skeleton loaders, smooth transitions when data loads, not just static HTML.

---

## 9. SAFE IMPLEMENTATION PATH

Based on everything above, here is the recommended build order:

### Phase 0: Fix Prototype (1-2 hours)
Fix the 6 immediate issues identified in Section 6. No new features. Just make what exists correct.

### Phase 1: Theme System + Layout (2-3 hours)
Create a proper dark theme in globals.css with CSS custom properties. Apply it to the Command Center only. Keep all other pages on the light theme. Fix MobileNav for dark contexts. This is a prerequisite for everything visual.

### Phase 2: Venture CRUD + Project/Task Extensions (3-4 hours)
Create venture service/actions/types. Add venture management UI (minimal — list + create + edit priority). Update project create/update to support ventureId and projectPriority. Update task service to properly manage lastActivityAt.

### Phase 3: Focus Engine V2 + Signal Engine V2 (2-3 hours)
Rewrite focus.engine.ts with corrected logic (no WAITING, no unassigned, proper scoring). Rewrite signal.engine.ts with deduplication and signal dismissal. Add unassigned-task detection as a new signal type.

### Phase 4: Command Center V2 (4-6 hours)
Rebuild the page.tsx with proper visual hierarchy. Three distinct zones: Focus (dominant), Signals (alert-style), Projects (compact data table). Daily Brief with distinct treatment. Proper venture context display.

### Phase 5: Capture Engine (3-4 hours)
Text input → AI classification → route to task/project/note/decision. Simple version: a single input that accepts text, uses AI to determine what it is, creates draft objects.

### Phase 6: AI Operator (2-3 hours)
Replace getDailyBrief() template strings with actual Claude API call. Context assembly: gather focus tasks, signals, project health, recent activity → feed to Claude → return 3-5 sentences of operational guidance.

### Phase 7: Voice-to-Execution UI (3-4 hours)
Client-side recording, upload, transcription polling, "review extracted tasks" flow. Integrate with Capture Engine.

**Total estimated: 20-28 hours across 7 phases.**

---

## 10. DECISION LOG

Decisions that must be made before implementation begins:

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Dark theme scope | A) All pages dark, B) Only Command Center dark, C) System-level toggle | B — Only Command Center dark. Other pages stay light. Least risk, most impact. |
| 2 | TEAM role visibility | A) Same as OWNER on Command Center, B) Personal focus only, no workspace signals | A — TEAM should see signals too. They need operational context. But document this. |
| 3 | Venture creation flow | A) Separate /ventures page, B) Modal from Command Center, C) Settings page section | A — Ventures are strategic objects. They deserve their own page. But keep it minimal. |
| 4 | AI provider for Operator | A) OpenAI (GPT-4o-mini, already integrated), B) Anthropic Claude API, C) Both with routing | A for V1 — already works. Claude API for V2 when we need strategy-grade reasoning. |
| 5 | Focus task count | A) Top 3, B) Top 5, C) Top 7 grouped by venture | A for V1 — 3 is the right cognitive load. 7 requires venture grouping UI which is Phase 2+. |
| 6 | Signal dismissal | A) No dismissal (always shown), B) 7-day snooze, C) Per-signal acknowledge | B — 7-day snooze. Requires a SignalDismissal table or a JSON field. Simple and effective. |
| 7 | Mobile nav on dark pages | A) Dark nav everywhere, B) Transparent nav on Command Center, C) Keep white nav | B — Transparent with blur on Command Center. White on all other pages. Context-aware. |

---

## CONCLUSION

The codebase is a solid V1 SaaS application with good auth, proper RBAC, consistent patterns, and working AI/voice foundations. The command center prototype was built too fast — it introduced 6 bugs/regressions and a visual design that's "dark" but not "premium."

The path forward is clear: fix the prototype, establish a proper theme system, add the missing Venture CRUD, then rebuild the Command Center with real visual hierarchy. The AI/voice/capture features have service-layer foundations already — they need UI and orchestration, not rewrites.

No big-bang rewrite needed. Controlled evolution from here.
