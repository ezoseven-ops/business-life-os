# Phase 3 — Founder Control System V1: Build Plan

> The smallest system that still feels like magic.
> Buildable in 2-4 weeks. Usable daily. Extensible into full FOS.
> Date: 2026-04-03 | Status: BUILD-READY

---

## 1. V1 PRODUCT DEFINITION

### One sentence

Open the app → see exactly what matters → do it → move on.

### What V1 delivers

A founder with multiple ventures opens the app and in 10 seconds knows: what's on fire, what needs focus, what's dying. They process the critical items (5 minutes), then execute the highest-leverage work. At the end of the day, they can ask AI "what should I focus on tomorrow?" and get a real answer grounded in their actual system state.

### What makes it feel like magic

1. **The Focus Stack.** Not a task list. A ranked, scored, contextual answer to "what should I do RIGHT NOW?" that knows about ventures, priorities, deadlines, and blockers.

2. **Signals that tell the truth.** "Project X is dying. 0 tasks completed in 21 days." No dashboards. No charts. Just sentences that tell you what's wrong.

3. **AI that knows your system.** Ask "what should I focus on?" and the AI reads your actual ventures, projects, tasks, blockers, and deadlines — then gives a real answer, not generic advice.

4. **Capture bar everywhere.** Idea strikes → type it → AI classifies it → it's a task in the right project. 5 seconds.

---

## 2. WHAT IS REMOVED (from Phase 2)

### REMOVED entirely (not in V1)

| Feature | Why removed |
|---|---|
| AI Auditor mode | Needs 30+ days of data to be useful |
| AI Optimizer mode | Meta-level, needs usage patterns |
| AI personality system | Complexity. V1 AI is helpful and direct, not confrontational |
| System Loops (daily/weekly/strategic) | Needs background jobs + notifications. V1 is pull-based, not push-based |
| Morning briefing | Requires scheduled jobs. V1: user opens app → sees cockpit |
| EOD reflection | Same. Deferred. |
| Decision model | Full decision logging is v2. V1 focuses on execution. |
| Decision Quality Scoring | Needs Decision model |
| Founder Drift Detection | Needs attention allocation tracking over time |
| Execution Velocity tracking | Needs 2+ weeks of data to compute |
| Energy Budget | Task time estimation doesn't exist yet |
| Focus Override (forced) | Too aggressive for V1 |
| Kill Suggestion (formal) | Signal Engine flags dying projects. Formal kill flow is v2. |
| Phantom Task Detection | Signal Engine covers zombie tasks simply |
| Context Bomb (full) | Project detail page covers basics |
| Prompt performance tracking | Needs usage data |
| Prompt chaining | Future |
| Context snapshots on AI Sessions | Adds storage complexity. V1 stores prompt+output only. |
| SystemEvent (AI cost tracking) | V1 just works. Cost tracking is v2. |
| Telegram/WhatsApp capture | Integration complexity. V1 = app-only capture. |
| Email capture | Same. |
| Voice capture | Exists in v1 already. Keep but don't extend. |
| Share links | External sharing is v2. |
| Keyboard shortcuts | Nice-to-have. V1 is mobile-first. Add desktop shortcuts later. |
| Command palette (⌘K) | Same. Desktop v2. |
| Dark mode | V1 ships with current light theme. Dark mode v2. |
| Person reliability scoring | Needs completion data over time |
| Attention allocation % | Powerful but complex. V1: ventures have priority order, not percentages. |

### SIMPLIFIED (reduced scope)

| Feature | Phase 2 version | V1 version |
|---|---|---|
| Control Layer | North Star + Quarterly Focus + Attention % + DO NOT TOUCH | Venture priority order + Project P0-P3 + Quarterly focus (text field) |
| Focus Engine | Multi-dimensional with energy, leverage, drift | Priority × Venture order × Overdue + Blocker bonus |
| Signal Engine | 4 categories, ranked, acknowledged | 4 signal types, simple list, dismiss only |
| AI Operator | 4 modes with personality | 2 modes: Operator (cockpit) + Advisor (on-demand session) |
| Capture | Multi-source, auto-route, classification | Text input + paste. AI classification. Manual route. No auto-route. |
| UI Command Center | Bloomberg-level, keyboard-driven, dark | Clean cockpit, mobile-first, existing design language |

---

## 3. FINAL V1 ARCHITECTURE

```
┌──────────────────────────────────────┐
│         FOUNDER SURFACE              │
│  Cockpit / Tasks / AI / Capture      │
├──────────────────────────────────────┤
│         CONTROL LAYER (lite)         │
│  Venture priority + Project P0-P3    │
│  + Quarterly focus text              │
├──────────────────────────────────────┤
│         AI (2 modes)                 │
│  Operator (cockpit guidance)         │
│  Advisor (on-demand sessions)        │
├──────────┬───────────────────────────┤
│ FOCUS    │  SIGNAL ENGINE            │
│ ENGINE   │  (4 signal types)         │
├──────────┴───────────────────────────┤
│ EXECUTION │  CAPTURE                 │
│ ENGINE    │  (text + paste + inbox)  │
│ (v1 +     │                          │
│  extensions)                         │
├──────────────────────────────────────┤
│         DATA (Prisma + PostgreSQL)   │
└──────────────────────────────────────┘
```

**Layer count: 5** (down from 7 in Phase 2). Memory System merged into AI Sessions. System Loops removed entirely.

---

## 4. CORE FEATURES (exact list)

### 4.1 Venture Management (NEW)

- Create/edit/archive ventures
- Each venture has: name, description, stage, color, priority (1-N ordering)
- Venture switcher in header (filter cockpit + tasks + projects to one venture)
- "All ventures" default view
- Projects belong to a venture

### 4.2 Project Extensions (EXTEND existing)

- Add: `priority` field (P0/P1/P2/P3)
- Add: `ventureId` FK
- Add: `quarterlyFocus` boolean (is this in quarterly focus?)
- Add: `goals` text field (free-text, not array — simpler)
- Project health score (computed on query, same formula as Phase 1)

### 4.3 Task Extensions (EXTEND existing)

- Add: `ventureId` FK (denormalized)
- Add: `blockerId` FK (self-reference to blocking task)
- Add: `blockerNote` text (if blocked by external factor)
- Add: new statuses: BLOCKED
- Add: `sourceType` enum (MANUAL / CAPTURE / AI_EXTRACTED)
- Keep existing: title, description, status, priority, dueDate, assigneeId, creatorId, projectId

**Why only BLOCKED as new status (not PLANNED, IN_REVIEW):**
PLANNED and IN_REVIEW add UX complexity (more status options, more UI states). BLOCKED is the only new status that enables a critical feature (blocker chain detection). The others can wait.

### 4.4 Focus Engine (NEW)

Computes a Focus Stack — the ranked list of "what to do now."

**V1 Focus Score:**
```
FocusScore =
  PRIORITY_BASE                    // LOW=20, MED=40, HIGH=60, URGENT=80
  × VENTURE_WEIGHT                 // venture #1=1.0, #2=0.7, #3=0.5, #4+=0.3
  × PROJECT_ALIGNMENT              // quarterlyFocus=1.3, P0=1.2, P1=1.0, P2=0.8, P3=0.6
  + OVERDUE_BONUS                  // overdue URGENT=+40, HIGH=+25, others=+15
  + BLOCKER_BONUS                  // blocks 1 task=+15, blocks 2+=+30
  + DEADLINE_BONUS                 // due today=+20, due in 48h=+10
```

No energy alignment. No drift detection. No cached scores. Computed on cockpit load (fast enough with < 500 active tasks).

**Output:** Ranked list, top 7 shown on cockpit. Grouped by venture.

### 4.5 Signal Engine (NEW)

Four signal types, computed on cockpit load:

**FIRE: Critical Overdue**
```
Trigger: Task with URGENT priority, overdue > 24h, in P0/P1 project
Output: "Task X is 48h overdue. Priority: URGENT. Project: Y (P0)."
```

**FIRE: Blocked Chain**
```
Trigger: Task BLOCKED → blocks another task (chain length ≥ 2)
Output: "Task A blocked by Task B. Impact: 3 tasks frozen. Root: Task B (Anna, overdue 5d)."
Computation: Follow blockerId chain, count depth.
```

**RISK: Silent Project**
```
Trigger: Project with status ACTIVE, no task status changes in 14 days (P0/P1) or 21 days (P2/P3)
Output: "Project X has had no activity for 18 days. Health: 34."
```

**WASTE: Zombie Tasks**
```
Trigger: Task in TODO status for > 30 days, no due date
Output: "8 tasks have been TODO for > 30 days with no deadline. Consider killing them."
Count only, not individual list (link to filtered task view).
```

Signals shown as a list in cockpit. Each has: [View] [Dismiss]. Dismissed signals are hidden for 7 days.

### 4.6 AI Sessions (NEW — simplified)

**Two AI capabilities only:**

**Operator (cockpit):**
- Triggered by: tapping "AI Guidance" button on cockpit
- Context: all ventures (name, priority), all P0/P1 projects (name, health, task counts), top 10 focus stack items, active signals
- Output: 3-5 sentences of guidance. "Focus on X. Y is at risk. Consider Z."
- Model: Sonnet (fast, cheap)
- Stored as AISession with type=OPERATOR

**Advisor (on-demand):**
- Triggered by: user opens new AI Session, types prompt
- Context options: venture scope or project scope (user picks)
- Context assembled: selected venture/project + its tasks grouped by status + goals + recent 5 task titles
- Output: free-form response
- Model: Sonnet (default), user can select Opus for deep analysis
- Stored as AISession
- "Extract Tasks" button: sends output to extraction (reuse v1 extractTasks logic)

**AISession model (minimal):**
```
id, title, type (OPERATOR/ADVISOR), model, status (ACTIVE/ACCEPTED/REJECTED/ARCHIVED),
inputPrompt, inputContext (assembled context as text), output,
ventureId?, projectId?, authorId, createdAt, updatedAt
```

No iterations. No actions array. No context snapshots. No ratings. No prompt linking.
These are all v2 additions. V1 stores prompt + context + output. That's it.

### 4.7 Prompt Vault (NEW — minimal)

**V1 scope:**
- Create/edit/delete reusable prompts
- Fields: title, category, template (text with `{{variable}}` placeholders), variables (JSON)
- Start AI Session from prompt: variables are filled by user (no auto-injection in V1)
- No versioning. No performance tracking. Just storage.

**Why include in V1:** Without prompts, every AI session starts from scratch. Prompts make AI sessions 10x faster. This is a 2-day build for massive leverage.

### 4.8 Capture System (NEW — minimal)

- Persistent capture bar at bottom of every screen (replaces current FAB menu)
- Text input: type → submit → Capture record created
- Paste detection: paste > 200 chars → prompt: "Save as AI Session or Capture?"
- Capture Inbox page: list of unprocessed captures
- Each capture shows AI-suggested type (task/note/idea) + confidence
- Manual routing: [→ Task] [→ Note] [→ AI Session] [Dismiss]
- **No auto-routing.** Every capture requires user confirmation.

**AI Classification (simple):**
- On capture submit, call fast model (Haiku or GPT-4o-mini)
- Input: capture text + list of venture names + project names
- Output: { suggestedType, suggestedVentureId, suggestedProjectId, suggestedTitle, confidence }
- If confidence < 0.5, show no suggestion — user classifies manually

### 4.9 Cockpit (EVOLUTION of existing dashboard)

**Replace current dashboard with:**

```
COCKPIT:
  ┌─────────────────────────────────┐
  │ [All ventures ▾] greeting + date│
  ├─────────────────────────────────┤
  │ SIGNALS (if any)                │
  │ • 🔴 fires (overdue, blocked)   │
  │ • 🟡 risks (silent projects)    │
  │ • ⚪ waste (zombie count)        │
  ├─────────────────────────────────┤
  │ FOCUS (top 7 tasks)             │
  │ #1 Task name   30m  URGENT P0  │
  │ #2 Task name   2h   HIGH   P1  │
  │ ...                             │
  │ [AI Guidance] button            │
  ├─────────────────────────────────┤
  │ VENTURES (health overview)      │
  │ Marketplace  72▲  5 active      │
  │ SaaS Product 58▼  3 active      │
  ├─────────────────────────────────┤
  │ [───── Capture bar ─────]       │
  └─────────────────────────────────┘
```

---

## 5. USER FLOWS

### Flow 1: Founder Opens App (morning)

```
1. Open app → Cockpit loads (< 1s, server-rendered)
2. SIGNALS section shows:
   - 🔴 "Deploy hotfix overdue 48h. Blocks 3 tasks."
   - 🟡 "API project: no activity 14 days. Health: 34."
3. Tap fire signal → navigates to task detail → change status or assign
4. FOCUS section shows top 7 tasks ranked by Focus Score
5. Tap [AI Guidance] → AI reads system state → returns:
   "Focus on the hotfix first — it's blocking 3 tasks in your P0 project.
    After that, the marketplace spec is your highest-leverage deep work.
    API project needs attention — consider assigning someone or pausing it."
6. Start working on #1 task
```

### Flow 2: Quick Capture

```
1. Idea strikes while viewing tasks
2. Tap capture bar at bottom → type "Partner with Stripe for payments"
3. Submit → Capture created → AI classifies (background, < 2s):
   suggestedType: "task"
   suggestedVenture: "Marketplace"
   suggestedProject: "Payment Infrastructure"
   confidence: 0.88
4. Later, open Capture Inbox (badge shows "1")
5. See: "Partner with Stripe for payments"
   AI suggests: Task in Marketplace / Payment Infrastructure
   [✓ Create Task] [✎ Edit] [→ Note] [✗ Dismiss]
6. Tap "Create Task" → task created, linked to project, capture marked ROUTED
```

### Flow 3: AI Advisor Session

```
1. Viewing project "Mobile App v2" → tap "Ask AI" button
2. AI Session opens with project context pre-loaded:
   - Project name, goals, status
   - Task summary: "14 done, 4 in progress, 3 todo, 2 blocked"
   - Health: 62
3. User types: "What's the best launch strategy given we're 2 weeks behind?"
4. Select model: Sonnet (default)
5. AI generates response with strategy analysis
6. User reads → taps "Extract Tasks" → AI parses 3 actionable items
7. Review: [✓] "Reduce scope to core features" [✓] "Set soft launch date" [✗] "Hire contractor"
8. Confirmed tasks created in project
9. Session saved (status: ACCEPTED)
```

### Flow 4: Create Venture + Set Up Control

```
1. Go to Ventures page → tap "New Venture"
2. Fill: name "Marketplace", description, stage "Building", color blue
3. Venture created → venture detail page
4. Set quarterly focus: "Land 50 power sellers before scaling"
5. Create projects within venture:
   - "Seller Onboarding" (P0, quarterly focus ✓)
   - "Payment Infrastructure" (P1, quarterly focus ✓)
   - "Buyer Experience" (P2, quarterly focus ✗)
6. Drag ventures to set priority order: Marketplace #1, SaaS #2
7. Cockpit now weights Marketplace tasks higher in Focus Score
```

### Flow 5: Handle Blocked Task

```
1. Cockpit signal: 🔴 "Task A blocked by Task B. 3 tasks frozen."
2. Tap → see blocker chain visualization:
   Task A (BLOCKED) → Task B (TODO, Anna, overdue 5d) → Task C (yours)
3. Options:
   - Tap Task B → reassign or change status
   - Tap "Unblock" → removes blocker link, Task A returns to TODO
   - Tap Task B → mark as DONE → Task A auto-unblocks
```

---

## 6. DATABASE IMPACT (Prisma changes)

### 6.1 New Models

```prisma
// ─── VENTURE ───

model Venture {
  id            String       @id @default(cuid())
  name          String
  description   String?
  stage         VentureStage @default(BUILDING)
  color         String?      // hex color for UI
  sortOrder     Int          @default(0) // priority ordering (lower = higher priority)
  quarterlyFocus String?     // free text: "what matters this quarter"
  workspaceId   String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  workspace  Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projects   Project[]
  aiSessions AISession[]
  captures   Capture[]

  @@index([workspaceId])
  @@index([workspaceId, sortOrder])
}

enum VentureStage {
  IDEA
  BUILDING
  LAUNCHED
  SCALING
  PAUSED
}

// ─── AI SESSION ───

model AISession {
  id           String          @id @default(cuid())
  title        String
  type         AISessionType
  model        String          // "claude-sonnet", "claude-opus", etc.
  status       AISessionStatus @default(ACTIVE)
  inputPrompt  String
  inputContext  String?         // assembled context as text
  output       String?
  ventureId    String?
  projectId    String?
  promptId     String?         // if started from a saved prompt
  authorId     String
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  venture Venture? @relation(fields: [ventureId], references: [id])
  project Project? @relation(fields: [projectId], references: [id])
  prompt  Prompt?  @relation(fields: [promptId], references: [id])
  tasks   Task[]   @relation("TaskFromAI")

  @@index([ventureId])
  @@index([projectId])
  @@index([authorId])
  @@index([status])
}

enum AISessionType {
  OPERATOR
  ADVISOR
}

enum AISessionStatus {
  ACTIVE      // output received, not yet processed
  ACCEPTED
  REJECTED
  ARCHIVED
}

// ─── PROMPT VAULT ───

model Prompt {
  id         String         @id @default(cuid())
  title      String
  category   PromptCategory
  template   String         // text with {{variables}}
  variables  Json           @default("[]") // [{name, description, required}]
  ventureId  String?        // null = global
  authorId   String
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  venture    Venture?    @relation(fields: [ventureId], references: [id])
  aiSessions AISession[]

  @@index([authorId])
  @@index([category])
}

enum PromptCategory {
  STRATEGY
  DEVELOPMENT
  OPERATIONS
  MARKETING
  SALES
  ANALYSIS
  WRITING
  CUSTOM
}

// ─── CAPTURE ───

model Capture {
  id                  String        @id @default(cuid())
  content             String        // raw input text
  source              CaptureSource @default(TEXT)
  classifiedType      String?       // "task" | "note" | "ai_session" | "idea"
  classifiedConfidence Float?
  classifiedVentureId String?
  classifiedProjectId String?
  classifiedTitle     String?
  status              CaptureStatus @default(PENDING)
  routedToType        String?       // "task" | "note" | "ai_session"
  routedToId          String?
  userId              String
  createdAt           DateTime      @default(now())
  processedAt         DateTime?

  @@index([userId, status])
  @@index([status])
}

enum CaptureSource {
  TEXT
  PASTE
  VOICE
}

enum CaptureStatus {
  PENDING     // not yet classified
  CLASSIFIED  // AI classified, awaiting routing
  ROUTED      // user confirmed, entity created
  DISMISSED
}
```

### 6.2 Extended Models (changes to existing)

```prisma
// ─── PROJECT (extended) ───

model Project {
  // ... existing fields ...
  priority       ProjectPriority @default(P2)    // NEW
  ventureId      String                          // NEW (required after backfill)
  quarterlyFocus Boolean         @default(false) // NEW
  goals          String?                         // NEW (free text)

  venture    Venture    @relation(fields: [ventureId], references: [id], onDelete: Cascade)
  aiSessions AISession[]                         // NEW relation

  @@index([ventureId])               // NEW
  @@index([ventureId, status])       // NEW
}

enum ProjectPriority {
  P0  // critical
  P1  // high
  P2  // normal
  P3  // low
}

// ─── TASK (extended) ───

model Task {
  // ... existing fields ...
  ventureId    String                            // NEW (denormalized)
  blockerId    String?                           // NEW (self-reference)
  blockerNote  String?                           // NEW
  sourceType   TaskSource    @default(MANUAL)    // NEW
  aiSessionId  String?                           // NEW

  blocker      Task?      @relation("TaskBlocker", fields: [blockerId], references: [id])
  blockedTasks Task[]     @relation("TaskBlocker")
  aiSession    AISession? @relation("TaskFromAI", fields: [aiSessionId], references: [id])

  @@index([ventureId])            // NEW
  @@index([ventureId, status])    // NEW
  @@index([blockerId])            // NEW
}

// NEW enum value added to TaskStatus:
enum TaskStatus {
  TODO
  IN_PROGRESS
  WAITING
  BLOCKED       // NEW
  DONE
}

// NEW enum:
enum TaskSource {
  MANUAL
  CAPTURE
  AI_EXTRACTED
}
```

### 6.3 Relations Added to Existing Models

```prisma
// Workspace: add ventures relation
model Workspace {
  // ... existing ...
  ventures Venture[]  // NEW
}

// Venture needs Prompt relation:
model Venture {
  // ... as defined above ...
  prompts Prompt[]  // ADD
}
```

### 6.4 Migration Plan (exact sequence)

```
Migration 1: "add-venture-model"
  - CREATE TABLE Venture
  - CREATE ENUM VentureStage
  - ADD ventures relation to Workspace

Migration 2: "extend-project-for-ventures"
  - ADD ProjectPriority enum
  - ADD Project.priority (default P2)
  - ADD Project.ventureId (nullable first)
  - ADD Project.quarterlyFocus (default false)
  - ADD Project.goals (nullable)
  - ADD indexes

Migration 3: "backfill-venture-data" (run as script, not migration)
  - For each Workspace:
    - Create default Venture (name = workspace name, sortOrder = 0)
    - UPDATE all Projects in workspace: SET ventureId = default venture ID
  - ALTER Project.ventureId SET NOT NULL

Migration 4: "extend-task"
  - ADD TaskSource enum
  - ADD BLOCKED to TaskStatus enum
  - ADD Task.ventureId (nullable first)
  - ADD Task.blockerId (nullable, self-ref)
  - ADD Task.blockerNote (nullable)
  - ADD Task.sourceType (default MANUAL)
  - ADD Task.aiSessionId (nullable)
  - ADD indexes

Migration 5: "backfill-task-venture"
  - UPDATE Task SET ventureId = Project.ventureId (from join)
  - ALTER Task.ventureId SET NOT NULL

Migration 6: "add-ai-session-prompt-capture"
  - CREATE TABLE AISession + enums
  - CREATE TABLE Prompt + enums
  - CREATE TABLE Capture + enums
  - ADD relations
```

---

## 7. AI IMPLEMENTATION (simple + cheap)

### 7.1 Provider: Anthropic API (Claude)

No multi-provider. No MCP. No Codex. V1 uses Claude API directly.

```
Operator mode: claude-3-5-sonnet (fast, cheap)
Advisor mode: claude-3-5-sonnet (default), claude-opus-4 (user selects)
Classification: claude-3-5-haiku (fastest, cheapest)
Task extraction: claude-3-5-sonnet
```

### 7.2 Implementation: One Service File

```
src/modules/ai/
  ai-session.service.ts    // create, update, get sessions + AI calls
  ai-session.actions.ts    // server actions with auth
  ai-session.queries.ts    // read queries
  ai-session.types.ts      // Zod schemas
  context-builder.ts       // assembles context from system state
  classifier.ts            // capture classification
```

### 7.3 Context Builder (the key function)

```typescript
// Pseudocode — actual implementation in build phase

async function buildOperatorContext(workspaceId: string): Promise<string> {
  const ventures = await getVentures(workspaceId)  // name, stage, sortOrder
  const projects = await getProjects(workspaceId)   // name, priority, health, ventureId, quarterlyFocus
  const focusStack = await computeFocusStack(workspaceId, userId, 10)
  const signals = await computeSignals(workspaceId)

  return `
SYSTEM STATE:

VENTURES (by priority):
${ventures.map(v => `- ${v.name} (${v.stage}) — ${v.quarterlyFocus || 'no focus set'}`).join('\n')}

PROJECTS:
${projects.map(p => `- ${p.name} [${p.priority}] Health: ${p.health} ${p.quarterlyFocus ? '(Q FOCUS)' : ''}`).join('\n')}

TOP FOCUS ITEMS:
${focusStack.map((t, i) => `${i+1}. ${t.title} — ${t.priority} — ${t.project.name} — ${t.dueDate ? 'due ' + t.dueDate : 'no deadline'} ${t.blockedTasks?.length ? '(blocks ' + t.blockedTasks.length + ')' : ''}`).join('\n')}

SIGNALS:
${signals.map(s => `[${s.type}] ${s.message}`).join('\n')}
  `.trim()
}

async function buildAdvisorContext(ventureId?: string, projectId?: string): Promise<string> {
  // Narrower scope — venture or project level
  // Include: goals, task breakdown by status, recent activity
}
```

### 7.4 System Prompts

**Operator:**
```
You are the AI Operator for a founder's control system.
You have access to the founder's current system state: ventures, projects, tasks, and signals.
Your job: tell the founder what to focus on RIGHT NOW and why.

Rules:
- Be direct. No hedging. No "you might consider."
- Every recommendation must reference specific tasks or projects.
- Maximum 5 sentences.
- Prioritize: fires first, then highest-leverage work, then quick wins.
- If something should be killed or paused, say so.
```

**Advisor:**
```
You are a strategic advisor to a founder running multiple ventures.
You have access to the context of the venture/project the founder is asking about.
Your job: provide deep, thoughtful analysis grounded in their actual data.

Rules:
- Reference specific projects, tasks, and metrics from the context.
- Challenge assumptions when the data supports it.
- End with 2-3 concrete next steps.
- If you see problems the founder didn't ask about, flag them.
```

**Classifier:**
```
You classify raw text captures for a founder's operating system.
Given the text and available ventures/projects, determine:
1. What type of entity this should become: "task", "note", "ai_session", "idea"
2. Which venture it belongs to (if determinable)
3. Which project it belongs to (if determinable)
4. A clean title for the entity

Respond ONLY with JSON:
{"type":"task","ventureId":"id or null","projectId":"id or null","title":"clean title","confidence":0.85}

Rules:
- Action items with deadlines or verbs → "task"
- Strategic thoughts or ideas → "idea" or "note"
- Questions or analysis requests → "ai_session"
- When unsure, use "idea" with lower confidence
- Confidence: 0.0-1.0 (be honest, don't inflate)
```

### 7.5 Cost Estimate

```
Per day (active founder):
  Operator calls: ~2/day × ~500 tokens out = 1,000 tokens (Sonnet)
  Advisor sessions: ~3/day × ~1,500 tokens out = 4,500 tokens (Sonnet)
  Classifications: ~5/day × ~100 tokens out = 500 tokens (Haiku)
  Task extraction: ~1/day × ~500 tokens out = 500 tokens (Sonnet)

  Total: ~6,500 output tokens/day
  Cost: ~$0.10/day (at Sonnet pricing)

  With occasional Opus sessions: ~$0.30/day

  Monthly: ~$5-10
```

Negligible. No cost controls needed in V1.

---

## 8. UI STRUCTURE

### 8.1 Navigation (mobile-first)

**Replace current MobileNav with:**
```
Bottom nav (5 items):
[⌂ Home] [☐ Tasks] [+ Capture] [⚡ AI] [≡ More]

Home = Cockpit (focus + signals + ventures)
Tasks = Task list (existing, with venture filter)
+ = Capture bar (opens text input, not FAB menu)
AI = AI Session list + new session
More = Projects, People, Ventures, Prompts, Settings, etc.
```

**Capture bar behavior:**
- Tap "+" → keyboard opens with text input
- Type → submit → capture created
- Paste > 200 chars → "Save as AI Session?" prompt

### 8.2 Cockpit Page (replace current dashboard)

```
┌─────────────────────────────────┐
│ BLO    [All ventures ▾]   🔔 K │
├─────────────────────────────────┤
│ Good morning, Karol             │
│ 2 ventures • 5 active projects  │
├─────────────────────────────────┤
│ SIGNALS                         │
│ ┌─────────────────────────────┐ │
│ │ 🔴 Deploy hotfix overdue    │ │
│ │    48h. Blocks 3 tasks.     │ │
│ │    [View] [Dismiss]         │ │
│ ├─────────────────────────────┤ │
│ │ 🟡 API project silent 14d  │ │
│ │    Health: 34.              │ │
│ │    [View] [Dismiss]         │ │
│ ├─────────────────────────────┤ │
│ │ ⚪ 8 zombie tasks           │ │
│ │    [Clean up] [Dismiss]     │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ FOCUS                    [AI ⚡]│
│ ┌─────────────────────────────┐ │
│ │ 1│ Deploy v2.1 hotfix       │ │
│ │  │ Marketplace • URGENT     │ │
│ │  │ blocks 3 • overdue       │ │
│ ├─────────────────────────────┤ │
│ │ 2│ Write marketplace spec   │ │
│ │  │ Marketplace • HIGH • P0  │ │
│ ├─────────────────────────────┤ │
│ │ 3│ Review PR #42            │ │
│ │  │ SaaS • MEDIUM            │ │
│ ├─────────────────────────────┤ │
│ │    ... (up to 7)            │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ VENTURES                        │
│ ┌──────────────┬──────────────┐ │
│ │ Marketplace  │ SaaS Product │ │
│ │ 72 ▲ healthy │ 58 ▼ warning │ │
│ │ 5 projects   │ 3 projects   │ │
│ └──────────────┴──────────────┘ │
├─────────────────────────────────┤
│ [──── Type to capture... ────]  │
└─────────────────────────────────┘
```

### 8.3 New Pages Required

| Page | Route | Complexity |
|---|---|---|
| Cockpit (replace dashboard) | `/` | HIGH — new component, Focus + Signals |
| Venture list | `/ventures` | LOW — simple list |
| Venture detail | `/ventures/[id]` | MEDIUM — projects list + quarterly focus + health |
| AI Session list | `/ai` | LOW — list with type badges |
| AI Session detail | `/ai/[id]` | MEDIUM — prompt + output + extract tasks |
| New AI Session | `/ai/new` | MEDIUM — model selector + context picker + prompt |
| Prompt Vault | `/ai/prompts` | LOW — simple CRUD list |
| Prompt detail/edit | `/ai/prompts/[id]` | LOW — form |
| Capture Inbox | `/capture` | MEDIUM — classification display + routing |

### 8.4 Modified Pages

| Page | Change |
|---|---|
| Project list | Add venture filter, priority badges, health indicator |
| Project detail | Add priority selector, quarterly focus toggle, goals field, health score |
| Task list | Add venture filter, blocker indicator |
| Task detail | Add blocker selector (pick blocking task), blocker note, sourceType badge |
| Settings | Add venture management section |

---

## 9. BUILD PLAN (step-by-step for Claude Code)

### Step 0: Preparation (30 min)

```
FILES TO READ FIRST:
  - docs/PHASE-3-V1-BUILD-PLAN.md (this document)
  - prisma/schema.prisma (current schema)
  - src/lib/action-utils.ts (guard system)
  - src/modules/tasks/task.service.ts
  - src/modules/tasks/task.actions.ts
  - src/modules/tasks/task.queries.ts
  - src/modules/projects/project.service.ts
  - src/modules/projects/project.actions.ts
  - src/modules/operational/staleness.service.ts
  - src/app/(app)/page.tsx (current dashboard)
  - src/components/MobileNav.tsx

ADD TO CLAUDE.md:
  "Read docs/PHASE-3-V1-BUILD-PLAN.md for full V1 system design.
   Module pattern: service.ts (logic) → actions.ts (auth) → queries.ts (reads) → types.ts (schemas).
   Services own business logic. Actions own auth + validation only.
   Run npm run build after every step."
```

### Step 1: Venture Model + Migration (2-3 hours)

```
CREATE:
  prisma/schema.prisma — add Venture model, VentureStage enum, Workspace.ventures relation
  src/modules/ventures/venture.types.ts — Zod schemas
  src/modules/ventures/venture.service.ts — CRUD with workspace scoping
  src/modules/ventures/venture.actions.ts — server actions with guards
  src/modules/ventures/venture.queries.ts — getVentures, getVentureById

RUN:
  npx prisma migrate dev --name add-venture-model

VERIFY:
  npm run build ✓
```

### Step 2: Extend Project Model (2-3 hours)

```
MODIFY:
  prisma/schema.prisma — add ProjectPriority enum, ventureId, priority, quarterlyFocus, goals to Project
  src/modules/projects/project.types.ts — update Zod schemas
  src/modules/projects/project.service.ts — add ventureId to create, update
  src/modules/projects/project.actions.ts — update create/update actions
  src/modules/projects/project.queries.ts — add venture filtering

CREATE:
  scripts/backfill-project-ventures.ts — create default ventures + backfill

RUN:
  npx prisma migrate dev --name extend-project
  npx tsx scripts/backfill-project-ventures.ts
  npx prisma migrate dev --name make-project-ventureid-required

VERIFY:
  npm run build ✓
  Existing project pages still work ✓
```

### Step 3: Extend Task Model (2-3 hours)

```
MODIFY:
  prisma/schema.prisma — add BLOCKED status, TaskSource enum, ventureId, blockerId, blockerNote, sourceType, aiSessionId
  src/modules/tasks/task.types.ts — update Zod schemas (add BLOCKED status, new fields)
  src/modules/tasks/task.service.ts — add ventureId (from project), blocker logic
  src/modules/tasks/task.actions.ts — update create/update, add blocker handling
  src/modules/tasks/task.queries.ts — add venture filtering, blocker includes

CREATE:
  scripts/backfill-task-ventures.ts — set ventureId from project

RUN:
  npx prisma migrate dev --name extend-task
  npx tsx scripts/backfill-task-ventures.ts
  npx prisma migrate dev --name make-task-ventureid-required

VERIFY:
  npm run build ✓
  Existing task pages still work ✓
```

### Step 4: AI Session + Prompt + Capture Models (2 hours)

```
MODIFY:
  prisma/schema.prisma — add AISession, Prompt, Capture models + all enums + relations

RUN:
  npx prisma migrate dev --name add-ai-prompt-capture

VERIFY:
  npm run build ✓
```

### Step 5: Focus Engine + Signal Engine (3-4 hours)

```
CREATE:
  src/modules/operational/focus.service.ts
    - computeFocusStack(workspaceId, userId, limit): returns ranked tasks with scores
    - computeFocusScore(task, venture, project): returns number

  src/modules/operational/signals.service.ts
    - computeSignals(workspaceId): returns Signal[]
    - Signal type: { type: 'FIRE'|'RISK'|'WASTE', category: string, message: string, entityType, entityId, severity }
    - detectCriticalOverdue()
    - detectBlockedChains()
    - detectSilentProjects()
    - detectZombieTasks()

MODIFY:
  src/modules/operational/staleness.service.ts — integrate with signals (or replace)

  src/modules/projects/project.queries.ts — add computeProjectHealth()

VERIFY:
  npm run build ✓
```

### Step 6: AI Services (3-4 hours)

```
CREATE:
  src/modules/ai/ai-session.types.ts — Zod schemas
  src/modules/ai/ai-session.service.ts
    - createOperatorGuidance(workspaceId, userId): calls Claude, returns AISession
    - createAdvisorSession(input, context): calls Claude, returns AISession
    - extractTasksFromSession(sessionId): parses output into task suggestions
    - updateSessionStatus(id, status)

  src/modules/ai/ai-session.actions.ts — server actions
  src/modules/ai/ai-session.queries.ts — list, getById

  src/modules/ai/context-builder.ts
    - buildOperatorContext(workspaceId): string
    - buildAdvisorContext(ventureId?, projectId?): string

  src/modules/ai/classifier.ts
    - classifyCapture(text, ventures, projects): classification result

  src/modules/capture/capture.service.ts — create, route, dismiss
  src/modules/capture/capture.actions.ts
  src/modules/capture/capture.types.ts

  src/modules/prompts/prompt.service.ts — CRUD
  src/modules/prompts/prompt.actions.ts
  src/modules/prompts/prompt.queries.ts
  src/modules/prompts/prompt.types.ts

VERIFY:
  npm run build ✓
```

### Step 7: Venture UI (2-3 hours)

```
CREATE:
  src/app/(app)/ventures/page.tsx — venture list with sortable order
  src/app/(app)/ventures/[id]/page.tsx — venture detail (projects, focus, health)
  src/app/(app)/ventures/new/page.tsx — create venture form
  src/modules/ventures/components/VentureCard.tsx
  src/modules/ventures/components/VentureSwitcher.tsx

MODIFY:
  src/app/(app)/layout.tsx — add VentureSwitcher to header

VERIFY:
  npm run build ✓
  Can create ventures ✓
  Can switch venture context ✓
```

### Step 8: Cockpit (replace dashboard) (4-5 hours)

```
THIS IS THE MOST IMPORTANT UI STEP.

MODIFY:
  src/app/(app)/page.tsx — COMPLETE REWRITE to Cockpit layout:
    - Venture filter header
    - Signals section (from signals.service)
    - Focus Stack section (from focus.service)
    - AI Guidance button (calls operator)
    - Venture health overview
    - Capture bar at bottom

CREATE:
  src/modules/operational/components/SignalCard.tsx
  src/modules/operational/components/FocusItem.tsx
  src/modules/operational/components/VentureHealthBar.tsx

VERIFY:
  npm run build ✓
  Cockpit loads with real data ✓
  Signals display correctly ✓
  Focus Stack is ranked correctly ✓
```

### Step 9: AI Session UI (3-4 hours)

```
CREATE:
  src/app/(app)/ai/page.tsx — session list
  src/app/(app)/ai/[id]/page.tsx — session detail (prompt + output + extract button)
  src/app/(app)/ai/new/page.tsx — new session (context picker + model selector + prompt input)
  src/modules/ai/components/AISessionCard.tsx
  src/modules/ai/components/TaskExtractionPreview.tsx

VERIFY:
  npm run build ✓
  Can create AI session ✓
  Output renders correctly ✓
  Task extraction works ✓
```

### Step 10: Prompt Vault UI (2 hours)

```
CREATE:
  src/app/(app)/ai/prompts/page.tsx — prompt list by category
  src/app/(app)/ai/prompts/[id]/page.tsx — prompt detail/edit
  src/app/(app)/ai/prompts/new/page.tsx — create prompt
  src/modules/prompts/components/PromptCard.tsx

MODIFY:
  src/app/(app)/ai/new/page.tsx — add "Start from Prompt" picker

VERIFY:
  npm run build ✓
  Can create prompts ✓
  Can start AI session from prompt ✓
```

### Step 11: Capture System UI (2-3 hours)

```
CREATE:
  src/app/(app)/capture/page.tsx — capture inbox
  src/modules/capture/components/CaptureCard.tsx — classification display + routing buttons
  src/components/CaptureBar.tsx — persistent capture input

MODIFY:
  src/components/MobileNav.tsx — replace FAB with capture button
  src/app/(app)/layout.tsx — add CaptureBar

VERIFY:
  npm run build ✓
  Can capture text ✓
  Classification runs ✓
  Can route capture to task ✓
```

### Step 12: Project + Task UI Extensions (2-3 hours)

```
MODIFY:
  src/app/(app)/projects/page.tsx — add venture filter, priority badges, health bars
  src/app/(app)/projects/[id]/page.tsx — add priority selector, quarterly focus toggle, goals
  src/app/(app)/tasks/page.tsx — add venture filter, blocker indicators
  src/app/(app)/tasks/[id]/page.tsx — add blocker selector, blocker note
  src/modules/tasks/components/TaskCheckbox.tsx — handle BLOCKED status

VERIFY:
  npm run build ✓
  Project priority visible ✓
  Task blockers work ✓
  Filters work ✓
```

### Step 13: Navigation Overhaul (1-2 hours)

```
MODIFY:
  src/components/MobileNav.tsx — new 5-item nav: Home, Tasks, Capture, AI, More
  Create overflow "More" page or drawer with: Projects, People, Ventures, Prompts, Calendar, Settings

VERIFY:
  npm run build ✓
  All navigation paths work ✓
```

### Step 14: Seed Data Update (1 hour)

```
MODIFY:
  prisma/seed.ts — add:
    - 2 ventures (Marketplace, SaaS Product)
    - Assign existing projects to ventures
    - Set project priorities
    - Add some blocked tasks
    - Add sample AI sessions
    - Add sample prompts
    - Add sample captures

VERIFY:
  npx prisma migrate reset --force ✓
  Seed runs cleanly ✓
  Cockpit shows real data ✓
```

### Step 15: Integration Test (2 hours)

```
FULL MANUAL TEST:
  1. Login as OWNER → cockpit loads with signals + focus
  2. Create new venture → assign projects → set priorities
  3. Mark task as BLOCKED → blocker appears in signals
  4. Tap AI Guidance → get real AI response
  5. Create AI Session → extract tasks → verify
  6. Create prompt → start session from prompt
  7. Capture text → classification runs → route to task
  8. Login as TEAM → verify venture visibility
  9. Login as CLIENT → verify portal still works
  10. Build passes ✓
```

---

### BUILD SUMMARY

| Step | What | Hours |
|---|---|---|
| 0 | Preparation | 0.5 |
| 1 | Venture model + migration | 2.5 |
| 2 | Extend Project | 2.5 |
| 3 | Extend Task | 2.5 |
| 4 | AI/Prompt/Capture models | 2 |
| 5 | Focus Engine + Signal Engine | 3.5 |
| 6 | AI Services | 3.5 |
| 7 | Venture UI | 2.5 |
| 8 | Cockpit (most important) | 4.5 |
| 9 | AI Session UI | 3.5 |
| 10 | Prompt Vault UI | 2 |
| 11 | Capture System UI | 2.5 |
| 12 | Project + Task extensions | 2.5 |
| 13 | Navigation | 1.5 |
| 14 | Seed data | 1 |
| 15 | Integration test | 2 |
| **TOTAL** | | **~37 hours** |

At 4-6 productive hours/day with Claude Code: **~7-10 working days.**

---

### CRITICAL PATH

Steps that block everything else:
```
Step 1 (Venture) → Step 2 (Project) → Step 3 (Task) → Step 5 (Focus + Signals) → Step 8 (Cockpit)
```

Steps that can run in parallel after Step 4:
```
Step 5 (engines) ‖ Step 6 (AI services) ‖ Step 7 (venture UI)
Step 9 (AI UI) ‖ Step 10 (Prompts UI) ‖ Step 11 (Capture UI) — after Step 6
Step 12 (extensions) — after Step 5
Step 13 (nav) — anytime
```

**If time is short, cut Steps 10 + 11 (Prompts + Capture). They're high-value but the system works without them. The cockpit + AI sessions + signals are the core magic.**
