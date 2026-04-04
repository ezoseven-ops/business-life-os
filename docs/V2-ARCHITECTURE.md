# Business Life OS v2 — Architecture Document

> Founder Command Center + AI Workspace + Execution System
> Version: 2.0-draft | Author: System Architect | Date: 2026-04-03

---

## 1. SYSTEM OVERVIEW

### What This Is

Business Life OS v2 is a **founder operating system** — the single surface from which one person (or a small team) runs multiple companies, controls execution, stores institutional knowledge, and operates with AI as a co-pilot embedded at every layer.

It is not a task manager. It is not a CRM. It is not a Notion clone.

It is a **control system** built on three pillars:

```
SIGNAL          →    DECISION    →    EXECUTION
(see everything)     (decide fast)     (move fast)
```

### Design Philosophy

**Minimal surface, maximum power.** Every screen answers one question. Every interaction takes one tap. Every AI suggestion is actionable, not decorative.

**Everything connected, nothing siloed.** A task links to a project links to a person links to an AI session links to a decision. Context flows. Nothing is orphaned.

**AI is the operating system, not a feature.** Claude and Codex are not bolted on — they are the substrate. Every entity can be created by AI, reviewed by AI, and acted upon through AI. The user's job is to decide and direct, not to operate.

**Mobile-first, desktop powerful.** The iPhone is the cockpit. The desktop is mission control. Both are first-class.

### What Changed From v1

| v1 | v2 |
|---|---|
| Task manager with CRM bolted on | Founder command center with execution engine |
| AI does transcription + task extraction | AI is embedded in every workflow — creation, review, suggestion, decision |
| Notes are flat text | Notes become knowledge — linked, searchable, AI-indexed |
| Dashboard shows today's tasks | Cockpit shows signals across all ventures |
| Single workspace = single business | Multi-venture architecture — one OS, many companies |
| No decision history | Decision log with full context chain |
| No prompt management | Prompt vault with versioning and performance tracking |
| File storage | Artifact system — everything linked, nothing orphaned |
| Communication = Telegram/WhatsApp messages | Communication = external-facing layer with shareable links |

### Architecture Spine

```
┌─────────────────────────────────────────────────────┐
│                  FOUNDER COCKPIT                     │
│         (signal aggregation + decision surface)      │
├──────────┬──────────┬──────────┬────────────────────┤
│ VENTURES │ PROJECTS │ PEOPLE   │ AI WORKSPACE       │
│          │ & TASKS  │ & COMMS  │ Sessions / Vault   │
├──────────┴──────────┴──────────┴────────────────────┤
│              KNOWLEDGE LAYER                         │
│   Notes / Decisions / Artifacts / Activity           │
├─────────────────────────────────────────────────────┤
│              CAPTURE SYSTEM                          │
│   Text / Voice / Paste / AI-classified               │
├─────────────────────────────────────────────────────┤
│              INTEGRATION BACKBONE (MCP)              │
│   Claude / Codex / Telegram / Calendar / APIs        │
├─────────────────────────────────────────────────────┤
│              DATA LAYER (Prisma + PostgreSQL)         │
└─────────────────────────────────────────────────────┘
```

---

## 2. CORE MODULES (DETAILED)

### 2.1 VENTURE LAYER (new — replaces single workspace)

**The Problem:** v1 assumes one workspace = one business. Founders run multiple ventures simultaneously. Context-switching between them is the #1 cognitive tax.

**The Solution:** A Venture is a top-level container that groups projects, people, finances, and AI context. One user can own multiple Ventures. Switching between them is instant — one tap, zero page reloads.

**Venture contains:**
- Name, description, stage (idea / building / launched / scaling / exiting)
- Projects scoped to this venture
- People involved (team, clients, partners, advisors)
- Revenue tracking (simple: MRR, ARR, or manual input — not full accounting)
- Risk signals (auto-computed: overdue tasks, stale projects, unresponsive people)
- Decision log scoped to this venture
- AI sessions scoped to this venture
- Key metrics (custom per venture — user defines what matters)

**Critical UX:** The venture switcher lives in the top-left of every screen. It's always visible. Switching is instant — no page navigation, just a context shift. The cockpit aggregates across all ventures by default but can filter to one.

**Relation to v1 Workspace:** The existing `Workspace` model becomes the root tenant. Ventures live inside a workspace. For solo founders, there's one workspace with multiple ventures. For teams, the workspace is the org and ventures are the business units.

```
Workspace (org-level)
  └── Venture (business-level)
       ├── Projects
       ├── People (scoped)
       ├── AI Sessions
       ├── Decisions
       └── Metrics
```

### 2.2 PROJECT CONTROL LAYER

**Evolution from v1:** Projects in v1 are containers for tasks. In v2, a Project is a **living execution context** — it knows its goals, its people, its decisions, its AI history, and its health.

**Project contains:**

| Field | Purpose |
|---|---|
| Name + description | What this is |
| Venture link | Which business this belongs to |
| Goals (text list) | What success looks like — reviewed monthly |
| Status (active / paused / done / archived) | Current state |
| Priority (P0 / P1 / P2 / P3) | Relative importance across all ventures |
| Timeline (startDate, targetDate) | When this should ship |
| People (ProjectMembers with roles) | Who's involved and what they do |
| Decision log | Decisions made within this project |
| Linked AI sessions | Every AI conversation that touched this project |
| Linked artifacts | Specs, designs, contracts, outputs |
| Health score (computed) | Auto-calculated from: overdue tasks, stale items, blocked items, velocity |

**Health Score Computation:**
```
healthScore = 100
  - (overdueTaskCount * 10)
  - (blockedTaskCount * 15)
  - (daysWithoutActivity > 7 ? 20 : 0)
  - (unassignedHighPriorityCount * 5)
clamped to 0-100
```

This runs on query time (not stored). Displayed as a color: green (80+), yellow (50-79), red (<50).

**Project Templates:** Founders repeat project types (MVP launch, marketing campaign, partnership deal). v2 supports project templates — predefined task lists, goals, and timeline patterns. AI can suggest which template fits based on project description.

### 2.3 TASK & EXECUTION ENGINE

**Evolution from v1:** Tasks in v1 are standard issue-tracker items. In v2, tasks are **execution atoms** — the smallest unit of work that moves a project forward. The engine is optimized for speed, not features.

**Task statuses (expanded):**
```
PLANNED → TODO → IN_PROGRESS → BLOCKED → WAITING → IN_REVIEW → DONE
```

New statuses:
- `PLANNED` — acknowledged but not yet actionable (backlog equivalent)
- `BLOCKED` — explicitly blocked with a reason and blocker link
- `IN_REVIEW` — work done, awaiting approval/decision
- `WAITING` — (kept from v1) waiting on external input

**Task fields:**

| Field | Type | Notes |
|---|---|---|
| title | string | Max 120 chars, imperative voice |
| description | text | Markdown support, AI-expandable |
| status | enum | 7 statuses above |
| priority | enum | LOW / MEDIUM / HIGH / URGENT / CRITICAL |
| dueDate | datetime | Optional but nudged by AI |
| estimatedMinutes | int? | Optional — for time-boxing |
| projectId | FK | Required — every task lives in a project |
| ventureId | FK | Denormalized for cross-venture queries |
| assigneeId | FK | Who owns this |
| creatorId | FK | Who created this |
| blockerId | FK? | If blocked, what's blocking (another task) |
| blockerNote | string? | If blocked by external factor |
| sourceType | enum | MANUAL / AI_EXTRACTED / VOICE / CAPTURE / MESSAGE |
| sourceId | string? | Link to originating entity |
| aiSessionId | FK? | If created from an AI session |

**Quick Status Change (critical UX):**
The #1 interaction in the app is changing task status. This must be achievable in one gesture:
- Mobile: swipe right on task → status picker appears as bottom sheet (5 options max visible)
- Desktop: click status badge → inline dropdown
- Keyboard: arrow keys to navigate, enter to select
- No page navigation required. Ever.

**Task Creation Sources:**
Tasks can be born from anywhere:
1. **Manual** — quick-add input at top of any task list
2. **AI extraction** — from notes, voice, messages, AI sessions
3. **Voice** — "Add task: call investor by Friday" → structured task
4. **Capture inbox** — unstructured input classified by AI
5. **Message** — from Telegram/WhatsApp, one-tap "make task"
6. **Template** — from project template
7. **Duplication** — clone existing task

**Recurring Tasks:**
Simple recurrence: daily / weekly / biweekly / monthly / custom cron. On completion, the next instance is auto-created. No complex RRULE — keep it founder-simple.

**Task Dependencies:**
Lightweight — a task can have one `blockerId` (the task blocking it). When the blocker is completed, the blocked task auto-moves to TODO and the assignee gets a notification. No Gantt charts. No critical path. Just "this is blocked by that."

### 2.4 PEOPLE & RELATIONSHIPS

**Evolution from v1:** v1 People are contacts. v2 People are **nodes in a relationship graph** — every person has a context trail showing what they're working on, how reliable they are, and when you last interacted.

**Person fields (expanded):**

| Field | Purpose |
|---|---|
| name, email, phone | Identity |
| avatarUrl | Visual recognition |
| company | Org affiliation |
| type | TEAM / CLIENT / PARTNER / ADVISOR / INVESTOR / VENDOR / OTHER |
| ventures[] | Which ventures they're connected to |
| reliabilityScore | 0-100, computed from on-time delivery rate |
| lastContactAt | Auto-updated from messages, comments, meetings |
| notes | Free-text relationship notes |
| tags[] | User-defined labels |
| linkedUserId | If they have an app account |

**Reliability Score:**
```
Tasks assigned to this person in last 90 days:
  completedOnTime / totalCompleted * 100
  (minimum 5 tasks to display score, otherwise "not enough data")
```

This is not punitive — it's signal. A founder needs to know: "Can I rely on this person to deliver?"

**Relationship Timeline:**
Every Person has an auto-generated timeline showing:
- Tasks assigned to/completed by them
- Comments they've made
- Messages exchanged
- Meetings attended
- Decisions they were involved in

This is not a separate feature — it's a query across existing data, rendered chronologically.

**People Across Ventures:**
A Person can be linked to multiple ventures. Their context changes per venture. Anna might be a developer on Venture A and a consultant on Venture B. The system tracks this.

### 2.5 AI WORKSPACE (the biggest upgrade)

**Why this exists:** Founders interact with AI dozens of times per day. Those interactions produce valuable outputs — strategies, code, analysis, decisions. But today, they evaporate. They live in Claude.ai chat history, in Codex terminal logs, in Screenshots. There's no system of record.

**The AI Workspace is that system of record.**

**AI Session model:**

| Field | Type | Purpose |
|---|---|---|
| id | cuid | Unique identifier |
| title | string | Auto-generated or user-set |
| model | enum | CLAUDE_SONNET / CLAUDE_OPUS / CODEX / GPT4 / CUSTOM |
| provider | enum | ANTHROPIC / OPENAI / LOCAL |
| ventureId | FK? | Scoped to a venture |
| projectId | FK? | Scoped to a project |
| status | enum | DRAFT / ACTIVE / ACCEPTED / REJECTED / ARCHIVED |
| promptId | FK? | If started from a saved prompt |
| inputPrompt | text | What was sent to the AI |
| inputContext | text? | Additional context provided |
| output | text | What the AI returned |
| outputFormat | enum | TEXT / MARKDOWN / CODE / JSON / STRUCTURED |
| iterations | json[] | Array of {prompt, output, timestamp} for multi-turn |
| decision | text? | What was decided based on this output |
| decisionId | FK? | Link to formal Decision if one was created |
| linkedTasks[] | FK[] | Tasks created from or related to this session |
| linkedArtifacts[] | FK[] | Files/docs produced |
| tags[] | string[] | User-defined classification |
| rating | int? | 1-5 quality rating by user |
| createdAt | datetime | When started |
| updatedAt | datetime | Last activity |

**Key Interactions:**

1. **New AI Session from scratch:**
   User types a prompt → selects model → gets output → can iterate, accept, reject, or create tasks/decisions from it.

2. **New AI Session from Prompt Vault:**
   User picks a saved prompt → variables are pre-filled with current context (venture, project, person) → output is generated → stored.

3. **AI Session from context:**
   User is viewing a project → taps "Ask AI" → session is pre-scoped to that project with relevant context auto-injected (goals, tasks, recent decisions, health score).

4. **Multi-model review:**
   Inspired by the Claude + Codex dual-AI workflow from the guide. User generates output with Claude → taps "Get second opinion" → same prompt is sent to Codex → both outputs are shown side-by-side → user picks or merges.

5. **Session → Task extraction:**
   AI output contains actionable items → user taps "Extract tasks" → AI parses output → tasks are created and linked to the session.

6. **Session → Decision:**
   AI output leads to a decision → user taps "Log decision" → Decision entity is created with the AI session as context.

**MCP Integration (inspired by the guide):**

The AI Workspace connects to external AI providers via MCP. This means:
- Claude is the primary brain (via Anthropic API or MCP)
- Codex is the reviewer/second opinion (via codex-mcp-server)
- Context7 provides up-to-date documentation when needed
- Future models plug in via the same MCP backbone

The system doesn't hardcode AI providers. It speaks MCP. New models = new MCP connection = zero code changes to the workspace.

```
AI Workspace
  ├── MCP: Claude (primary generation)
  ├── MCP: Codex (review + second opinion)
  ├── MCP: Context7 (documentation lookup)
  ├── MCP: Perplexity (research, future)
  └── MCP: Local LLM (offline, future)
```

### 2.6 PROMPT VAULT

**Why this exists:** A founder sends the same types of prompts repeatedly — investor update drafts, code review requests, strategy analyses, email templates. Without a vault, they rewrite from scratch every time. The Prompt Vault is the founder's `CLAUDE.md` — but for their entire operation.

**Prompt model:**

| Field | Type | Purpose |
|---|---|---|
| id | cuid | Unique identifier |
| title | string | Human-readable name |
| category | enum | STRATEGY / DEVELOPMENT / OPERATIONS / MARKETING / SALES / LEGAL / FINANCE / HR / CUSTOM |
| description | string? | What this prompt is for |
| template | text | The prompt text with `{{variables}}` |
| variables[] | json | Defined variables with names, types, descriptions |
| version | int | Auto-incremented on edit |
| previousVersions[] | json | Full version history |
| targetModel | enum? | Recommended model (optional) |
| performanceNotes | text? | User notes on how well this works |
| avgRating | float? | Average rating across sessions that used this prompt |
| useCount | int | How many times used |
| ventureId | FK? | Scoped to venture or global (null) |
| tags[] | string[] | User-defined labels |
| isPublic | boolean | Shareable with team |

**Variable Injection:**
When a user starts an AI Session from a prompt, variables are auto-filled where possible:
- `{{venture.name}}` → current venture name
- `{{project.name}}` → current project name
- `{{project.goals}}` → project goals
- `{{project.health}}` → health score summary
- `{{person.name}}` → selected person
- `{{today}}` → current date
- `{{tasks.blocked}}` → list of currently blocked tasks

Custom variables prompt the user for input.

**Prompt Performance Tracking:**
Every time a prompt is used, the resulting AI Session can be rated (1-5). Over time, the vault shows which prompts consistently produce good results and which need iteration. This is operational intelligence — the founder's prompts improve systematically, not by gut feel.

### 2.7 ARTIFACT / FILE SYSTEM

**Design principle:** Business Life OS is NOT a file storage system. It will never compete with Google Drive or Dropbox. Instead, it maintains an **artifact registry** — a lightweight abstraction that tracks what files exist, where they live, and what they connect to.

**Artifact model:**

| Field | Type | Purpose |
|---|---|---|
| id | cuid | Internal reference |
| name | string | Display name |
| type | enum | DOCUMENT / SPEC / DESIGN / CONTRACT / REPORT / CODE / AI_OUTPUT / OTHER |
| storageType | enum | R2 / GOOGLE_DRIVE / NOTION / EXTERNAL_URL / LOCAL |
| url | string | Where the file actually lives |
| mimeType | string? | File type |
| size | int? | File size in bytes |
| ventureId | FK? | Scoped to venture |
| projectId | FK? | Linked to project |
| taskId | FK? | Linked to task |
| aiSessionId | FK? | Produced by AI session |
| decisionId | FK? | Evidence for a decision |
| uploadedById | FK | Who added this |
| description | text? | What this artifact is |
| tags[] | string[] | Classification |

**Key Design Decisions:**

1. **Storage is external.** The app stores metadata and URLs. Actual files live in R2 (for uploads), Google Drive (for docs), or wherever. This keeps the app lean.

2. **Everything links.** An artifact can link to a project, task, AI session, and decision simultaneously. When you view any entity, its linked artifacts appear in a sidebar panel.

3. **AI outputs are artifacts.** When an AI Session produces a document, spec, or code file, it's automatically registered as an artifact linked to that session.

### 2.8 DECISION LOG

**Why this is critical:** Founders make dozens of decisions daily. Six months later, nobody remembers WHY something was decided. The Decision Log creates institutional memory that compounds over time.

**Decision model:**

| Field | Type | Purpose |
|---|---|---|
| id | cuid | Identifier |
| title | string | "Decided to use Stripe over Paddle" |
| description | text | Full context of the decision |
| rationale | text | WHY this was decided |
| alternatives | text? | What other options were considered |
| impact | enum | LOW / MEDIUM / HIGH / CRITICAL |
| category | enum | STRATEGY / PRODUCT / TECHNICAL / FINANCIAL / PEOPLE / OPERATIONS |
| status | enum | PROPOSED / DECIDED / REVERSED / SUPERSEDED |
| ventureId | FK | Which venture |
| projectId | FK? | Which project (optional) |
| madeById | FK | Who made the decision |
| participants[] | FK[] | Who was involved |
| aiSessionId | FK? | AI session that informed this |
| linkedTasks[] | FK[] | Tasks created to execute this decision |
| linkedArtifacts[] | FK[] | Supporting documents |
| decidedAt | datetime | When decided |
| reviewAt | datetime? | When to review this decision |

**Decision → Execution Chain:**
```
AI Session (analysis)
  → Decision (logged with rationale)
    → Tasks (created to execute)
      → Artifacts (produced during execution)
        → Activity (tracked automatically)
```

This chain is the operational backbone. It answers: "Why are we doing this?" at every level.

**Decision Review Reminders:**
High-impact decisions get a `reviewAt` date. The system surfaces them in the cockpit: "You decided X three months ago. Is it still the right call?" This prevents strategic drift.

### 2.9 COMMUNICATION LAYER

**Design constraint:** External partners should NOT need to install an app. Communication flows outward through familiar channels.

**Architecture:**

```
Internal (app users)          External (partners, clients)
┌──────────────────┐          ┌──────────────────┐
│ Comments on tasks │  ←────→ │ Email notification│
│ @mentions        │          │ with reply link   │
│ Internal notes   │          │                   │
├──────────────────┤          ├──────────────────┤
│ Shareable links  │  ────→   │ Browser view      │
│ (read-only or    │          │ (no login needed) │
│  comment-able)   │          │                   │
├──────────────────┤          ├──────────────────┤
│ Telegram bot     │  ←────→  │ Telegram chat     │
│ WhatsApp bot     │  ←────→  │ WhatsApp chat     │
└──────────────────┘          └──────────────────┘
```

**Shareable Links (new):**
Any entity (task, project status, artifact) can generate a shareable link:
- `/share/[token]` — public read-only view
- `/share/[token]?comment=true` — allows comments (captured as external comments)
- Token-based, expirable, revocable
- No login required for viewer
- Mobile-optimized landing page

**External Comment Capture:**
When an external partner comments via shareable link or replies to an email notification, their comment appears in the app tied to:
- The entity they commented on
- Their Person record (auto-matched by email or created)
- Flagged as `external: true` for internal visibility

**Channel Integration (preserved from v1, expanded):**
- Telegram: bidirectional via Grammy bot (existing)
- WhatsApp: bidirectional via Business API (existing)
- Email: outbound notifications + inbound reply parsing (new)
- Future: Slack, Discord via MCP

### 2.10 FOUNDER COCKPIT (Dashboard)

**Design intent:** The cockpit answers ONE question: "What needs my attention right now?" in under 10 seconds. It is NOT a dashboard with charts. It is a **signal aggregator**.

**Layout (mobile-first):**

```
┌─────────────────────────────────┐
│  Good morning, Karol.           │
│  3 ventures • 12 active projects│
│  [venture filter: All ▼]        │
├─────────────────────────────────┤
│  🔴 FIRES (0-3 items max)       │
│  Critical blockers, overdue     │
│  urgent tasks, failing health   │
├─────────────────────────────────┤
│  ⚡ DECISIONS NEEDED (AI queue)  │
│  AI outputs awaiting your call  │
│  Tasks in IN_REVIEW status      │
├─────────────────────────────────┤
│  📋 TODAY'S FOCUS (5 items max)  │
│  Your tasks for today, sorted   │
│  by priority then due time      │
├─────────────────────────────────┤
│  📡 SIGNALS                      │
│  Stale projects, slipping       │
│  deadlines, unresponsive people │
├─────────────────────────────────┤
│  🕐 RECENT (activity stream)    │
│  Last 10 actions across all     │
│  ventures — filterable          │
├─────────────────────────────────┤
│  [Quick capture bar — always    │
│   visible, sticky bottom]       │
└─────────────────────────────────┘
```

**Fires Section:**
Shows only items that are actively burning:
- Tasks with URGENT/CRITICAL priority that are overdue
- Projects with health score < 30
- Blocked tasks blocking other blocked tasks (cascading blocks)
- Maximum 3 items. If more exist, shows count + "View all fires"

**Decisions Needed:**
- AI Sessions with status ACTIVE (output ready, no decision made)
- Tasks in IN_REVIEW status assigned to you
- Decisions with status PROPOSED
- This is the founder's "inbox zero" — process these, then move on

**Signals Section (the intelligent layer):**
Auto-computed, not manually curated:
- "Project X has had no activity for 14 days" (stale detection, evolved from v1)
- "3 tasks assigned to Anna are overdue" (people reliability signal)
- "Venture Y revenue declined 20% MoM" (if revenue tracking is enabled)
- "You made a decision to review: Switch to Stripe (decided 90 days ago)"
- "5 AI sessions have unprocessed outputs"

**Cross-Venture Aggregation:**
The cockpit works across all ventures by default. The venture filter narrows to one. This is the key UX innovation — the founder sees their entire operation in one view, then drills down.

### 2.11 CAPTURE SYSTEM

**Why this exists:** The highest-leverage moment in a founder's day is when an idea strikes. If capturing it takes more than 5 seconds, it's lost. The capture system is a universal inbox that accepts anything and AI-classifies it later.

**Capture Input Types:**

1. **Quick text** — type into the persistent capture bar. Press enter. Done.
2. **Voice** — tap mic, speak, release. Audio is transcribed, then AI-classified.
3. **Paste from AI** — paste Claude/Codex output → AI detects structure → auto-classifies as AI Session.
4. **Share sheet (mobile)** — share a URL, screenshot, or text from any app → captured.
5. **Telegram bot** — send a message to the BLO bot → captured.
6. **Email** — forward to capture@[workspace].businesslifeos.com → captured.

**Capture Processing Pipeline:**

```
Raw Input
  → Transcription (if voice)
  → AI Classification:
      type: task | note | decision | ai_session | contact | event | idea
      confidence: 0.0 - 1.0
      suggestedVenture: based on content
      suggestedProject: based on content
  → If confidence > 0.8: auto-route to correct module
  → If confidence < 0.8: appears in Capture Inbox for manual routing
  → User confirms or reclassifies with one tap
```

**Capture Inbox:**
A dedicated inbox showing unprocessed captures. Each item shows:
- Content preview
- AI-suggested type and destination
- One-tap accept (routes automatically)
- One-tap reclassify (pick different type/destination)
- Swipe to dismiss

**Goal:** Capture inbox should be at zero by end of day. The cockpit shows the count.

---

## 3. DATA MODEL

### 3.1 Entity Relationship Overview

```
Workspace (1)
  ├── Venture (many)
  │    ├── Project (many)
  │    │    ├── Task (many)
  │    │    ├── ProjectMember (many)
  │    │    ├── Decision (many)
  │    │    └── Artifact (many)
  │    ├── AISession (many)
  │    ├── Prompt (many)
  │    ├── Person (many-to-many via VenturePerson)
  │    └── Metric (many)
  │
  ├── User (many)
  │    ├── Account (auth)
  │    ├── Task (assigned)
  │    ├── Comment (authored)
  │    ├── AISession (authored)
  │    └── Notification (received)
  │
  ├── Person (many) — contacts across all ventures
  ├── Capture (many) — inbox items
  ├── Activity (many) — audit trail
  └── Integration (many) — MCP + channel configs
```

### 3.2 Prisma Schema (v2 Delta)

Below is the **new and changed** models for v2. Unchanged v1 models (Account, Session, VerificationToken, VoiceNote, Comment, EventAttendee, Integration, Notification, Message) are retained as-is.

```prisma
// ═══════════════════════════════════════════
//  NEW: VENTURE
// ═══════════════════════════════════════════

model Venture {
  id          String       @id @default(cuid())
  name        String
  description String?
  stage       VentureStage @default(BUILDING)
  color       String?      // hex color for UI differentiation
  icon        String?      // emoji or icon identifier
  workspaceId String
  ownerId     String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projects    Project[]
  aiSessions  AISession[]
  prompts     Prompt[]
  decisions   Decision[]
  artifacts   Artifact[]
  captures    Capture[]
  metrics     Metric[]
  people      VenturePerson[]

  @@index([workspaceId])
  @@index([ownerId])
}

enum VentureStage {
  IDEA
  BUILDING
  LAUNCHED
  SCALING
  EXITING
  PAUSED
}

model VenturePerson {
  id        String @id @default(cuid())
  ventureId String
  personId  String
  role      String? // free-text: "CTO", "Investor", "Designer"
  createdAt DateTime @default(now())

  venture Venture @relation(fields: [ventureId], references: [id], onDelete: Cascade)
  person  Person  @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@unique([ventureId, personId])
  @@index([personId])
}

// ═══════════════════════════════════════════
//  CHANGED: PROJECT (add venture link, goals, priority, timeline, health)
// ═══════════════════════════════════════════

model Project {
  id          String          @id @default(cuid())
  name        String
  description String?
  status      ProjectStatus   @default(ACTIVE)
  priority    ProjectPriority @default(P2)
  goals       String[]        // array of goal strings
  startDate   DateTime?
  targetDate  DateTime?
  ventureId   String
  workspaceId String
  ownerId     String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  venture        Venture         @relation(fields: [ventureId], references: [id], onDelete: Cascade)
  workspace      Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks          Task[]
  notes          Note[]
  decisions      Decision[]
  artifacts      Artifact[]
  aiSessions     AISession[]
  projectMembers ProjectMember[]

  @@index([ventureId])
  @@index([workspaceId])
  @@index([ventureId, status])
}

enum ProjectPriority {
  P0  // critical — everything stops for this
  P1  // high — active focus
  P2  // normal — steady progress
  P3  // low — when time permits
}

// ═══════════════════════════════════════════
//  CHANGED: TASK (add venture, blocker, source, review status, recurring)
// ═══════════════════════════════════════════

model Task {
  id               String        @id @default(cuid())
  title            String
  description      String?
  status           TaskStatus    @default(TODO)
  priority         TaskPriority  @default(MEDIUM)
  dueDate          DateTime?
  estimatedMinutes Int?
  sourceType       TaskSource    @default(MANUAL)
  sourceId         String?
  blockerId        String?       // FK to another Task
  blockerNote      String?
  isRecurring      Boolean       @default(false)
  recurrenceRule   String?       // cron expression or DAILY/WEEKLY/MONTHLY
  calendarEventId  String?
  sourceMessageId  String?
  projectId        String
  ventureId        String        // denormalized for cross-venture queries
  assigneeId       String?
  creatorId        String
  aiSessionId      String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  project       Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee      User?      @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator       User       @relation("TaskCreator", fields: [creatorId], references: [id])
  blocker       Task?      @relation("TaskBlocker", fields: [blockerId], references: [id])
  blockedTasks  Task[]     @relation("TaskBlocker")
  sourceMessage Message?   @relation(fields: [sourceMessageId], references: [id])
  aiSession     AISession? @relation(fields: [aiSessionId], references: [id])
  comments      Comment[]
  files         File[]
  artifacts     Artifact[] @relation("TaskArtifacts")
  decisions     Decision[] @relation("DecisionTasks")

  @@index([projectId])
  @@index([ventureId])
  @@index([assigneeId])
  @@index([status])
  @@index([projectId, status])
  @@index([ventureId, status])
  @@index([dueDate])
  @@index([blockerId])
}

enum TaskStatus {
  PLANNED
  TODO
  IN_PROGRESS
  BLOCKED
  WAITING
  IN_REVIEW
  DONE
}

enum TaskSource {
  MANUAL
  AI_EXTRACTED
  VOICE
  CAPTURE
  MESSAGE
  TEMPLATE
  RECURRING
}

// ═══════════════════════════════════════════
//  NEW: AI SESSION
// ═══════════════════════════════════════════

model AISession {
  id            String          @id @default(cuid())
  title         String
  model         AIModel
  provider      AIProvider
  status        AISessionStatus @default(DRAFT)
  inputPrompt   String          // what was sent
  inputContext   String?         // additional context
  output        String?         // what came back
  outputFormat  OutputFormat    @default(TEXT)
  iterations    Json[]          // multi-turn: [{prompt, output, timestamp}]
  decision      String?         // what was decided based on this
  rating        Int?            // 1-5 quality rating
  tags          String[]
  promptId      String?         // if started from a saved prompt
  ventureId     String?
  projectId     String?
  decisionId    String?
  authorId      String
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  prompt        Prompt?   @relation(fields: [promptId], references: [id])
  venture       Venture?  @relation(fields: [ventureId], references: [id])
  project       Project?  @relation(fields: [projectId], references: [id])
  linkedDecision Decision? @relation("AIDecision", fields: [decisionId], references: [id])
  tasks         Task[]
  artifacts     Artifact[] @relation("AIArtifacts")

  @@index([ventureId])
  @@index([projectId])
  @@index([authorId])
  @@index([status])
  @@index([promptId])
}

enum AIModel {
  CLAUDE_HAIKU
  CLAUDE_SONNET
  CLAUDE_OPUS
  GPT4
  GPT4O
  CODEX
  O1
  O3
  CUSTOM
}

enum AIProvider {
  ANTHROPIC
  OPENAI
  LOCAL
  CUSTOM
}

enum AISessionStatus {
  DRAFT       // prompt written, not sent
  ACTIVE      // output received, awaiting decision
  ACCEPTED    // user accepted the output
  REJECTED    // user rejected the output
  ARCHIVED    // no longer relevant
}

enum OutputFormat {
  TEXT
  MARKDOWN
  CODE
  JSON
  STRUCTURED
}

// ═══════════════════════════════════════════
//  NEW: PROMPT VAULT
// ═══════════════════════════════════════════

model Prompt {
  id               String         @id @default(cuid())
  title            String
  description      String?
  category         PromptCategory
  template         String         // prompt text with {{variables}}
  variables        Json           // [{name, type, description, defaultValue}]
  version          Int            @default(1)
  previousVersions Json[]         // [{version, template, updatedAt}]
  targetModel      AIModel?
  performanceNotes String?
  avgRating        Float?
  useCount         Int            @default(0)
  tags             String[]
  isPublic         Boolean        @default(false)
  ventureId        String?        // null = global across all ventures
  authorId         String
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  venture    Venture?    @relation(fields: [ventureId], references: [id])
  aiSessions AISession[]

  @@index([ventureId])
  @@index([category])
  @@index([authorId])
}

enum PromptCategory {
  STRATEGY
  DEVELOPMENT
  OPERATIONS
  MARKETING
  SALES
  LEGAL
  FINANCE
  HR
  ANALYSIS
  WRITING
  CUSTOM
}

// ═══════════════════════════════════════════
//  NEW: DECISION LOG
// ═══════════════════════════════════════════

model Decision {
  id           String           @id @default(cuid())
  title        String
  description  String           // full context
  rationale    String           // WHY
  alternatives String?          // what else was considered
  impact       DecisionImpact
  category     DecisionCategory
  status       DecisionStatus   @default(DECIDED)
  reviewAt     DateTime?        // when to review this decision
  ventureId    String
  projectId    String?
  madeById     String
  aiSessionId  String?          // AI session that informed this (reverse link)
  decidedAt    DateTime         @default(now())
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  venture      Venture    @relation(fields: [ventureId], references: [id], onDelete: Cascade)
  project      Project?   @relation(fields: [projectId], references: [id])
  aiSession    AISession? @relation("AIDecision")
  linkedTasks  Task[]     @relation("DecisionTasks")
  artifacts    Artifact[] @relation("DecisionArtifacts")

  @@index([ventureId])
  @@index([projectId])
  @@index([madeById])
  @@index([status])
  @@index([reviewAt])
}

enum DecisionImpact {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum DecisionCategory {
  STRATEGY
  PRODUCT
  TECHNICAL
  FINANCIAL
  PEOPLE
  OPERATIONS
  LEGAL
  MARKETING
}

enum DecisionStatus {
  PROPOSED
  DECIDED
  REVERSED
  SUPERSEDED
}

// ═══════════════════════════════════════════
//  NEW: ARTIFACT (replaces File for linkability)
// ═══════════════════════════════════════════

model Artifact {
  id           String        @id @default(cuid())
  name         String
  description  String?
  type         ArtifactType
  storageType  StorageType
  url          String
  mimeType     String?
  size         Int?
  tags         String[]
  ventureId    String?
  projectId    String?
  aiSessionId  String?
  uploadedById String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  venture   Venture?   @relation(fields: [ventureId], references: [id])
  project   Project?   @relation(fields: [projectId], references: [id])
  aiSession AISession? @relation("AIArtifacts", fields: [aiSessionId], references: [id])
  tasks     Task[]     @relation("TaskArtifacts")
  decisions Decision[] @relation("DecisionArtifacts")

  @@index([ventureId])
  @@index([projectId])
  @@index([aiSessionId])
  @@index([type])
}

enum ArtifactType {
  DOCUMENT
  SPEC
  DESIGN
  CONTRACT
  REPORT
  CODE
  AI_OUTPUT
  IMAGE
  VIDEO
  OTHER
}

enum StorageType {
  R2
  GOOGLE_DRIVE
  NOTION
  EXTERNAL_URL
  LOCAL
}

// ═══════════════════════════════════════════
//  NEW: CAPTURE SYSTEM
// ═══════════════════════════════════════════

model Capture {
  id             String        @id @default(cuid())
  rawContent     String        // original input
  sourceChannel  CaptureSource
  transcription  String?       // if voice
  aiClassification Json?       // {type, confidence, suggestedVenture, suggestedProject}
  status         CaptureStatus @default(PENDING)
  routedToType   String?       // entity type it was converted to
  routedToId     String?       // entity ID it was converted to
  ventureId      String?       // auto-suggested or manually set
  userId         String
  createdAt      DateTime      @default(now())
  processedAt    DateTime?

  venture Venture? @relation(fields: [ventureId], references: [id])

  @@index([userId, status])
  @@index([status])
  @@index([createdAt])
}

enum CaptureSource {
  QUICK_TEXT
  VOICE
  PASTE
  SHARE_SHEET
  TELEGRAM
  EMAIL
  API
}

enum CaptureStatus {
  PENDING       // not yet processed by AI
  CLASSIFIED    // AI classified, awaiting user routing
  ROUTED        // user confirmed, entity created
  DISMISSED     // user dismissed
}

// ═══════════════════════════════════════════
//  NEW: METRICS (per-venture KPIs)
// ═══════════════════════════════════════════

model Metric {
  id        String     @id @default(cuid())
  name      String     // "MRR", "Active Users", "Runway (months)"
  value     Float
  unit      String?    // "$", "users", "months"
  period    DateTime   // which month/week this metric is for
  ventureId String
  createdAt DateTime   @default(now())

  venture Venture @relation(fields: [ventureId], references: [id], onDelete: Cascade)

  @@unique([ventureId, name, period])
  @@index([ventureId])
  @@index([ventureId, name])
}

// ═══════════════════════════════════════════
//  NEW: SHARE LINK
// ═══════════════════════════════════════════

model ShareLink {
  id          String         @id @default(cuid())
  token       String         @unique @default(cuid())
  entityType  EntityType
  entityId    String
  permissions SharePermission @default(READ)
  expiresAt   DateTime?
  isActive    Boolean        @default(true)
  createdById String
  createdAt   DateTime       @default(now())
  viewCount   Int            @default(0)

  @@index([token])
  @@index([entityType, entityId])
}

enum SharePermission {
  READ
  COMMENT
}

// ═══════════════════════════════════════════
//  CHANGED: PERSON (add type, tags, reliability, venture links)
// ═══════════════════════════════════════════

model Person {
  id               String       @id @default(cuid())
  name             String
  email            String?
  phone            String?
  avatarUrl        String?
  telegramId       String?
  whatsappId       String?
  company          String?
  type             PersonType   @default(OTHER)
  notes            String?
  tags             String[]
  reliabilityScore Float?       // computed, cached
  lastContactAt    DateTime?    // auto-updated
  userId           String?      @unique
  workspaceId      String
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  user      User?           @relation("PersonUser", fields: [userId], references: [id])
  workspace Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  messages  Message[]
  ventures  VenturePerson[]

  @@index([workspaceId])
  @@index([type])
  @@index([telegramId])
  @@index([whatsappId])
}

enum PersonType {
  TEAM
  CLIENT
  PARTNER
  ADVISOR
  INVESTOR
  VENDOR
  OTHER
}

// ═══════════════════════════════════════════
//  CHANGED: ACTIVITY (add venture scope)
// ═══════════════════════════════════════════

// Add to EntityType enum:
// AI_SESSION, DECISION, ARTIFACT, CAPTURE, VENTURE, PROMPT

// Add to ActivityAction enum:
// ACCEPTED, REJECTED, ARCHIVED, SHARED, CAPTURED, CLASSIFIED
```

### 3.3 Migration Strategy from v1

The migration from v1 to v2 is **additive, not destructive**. No existing tables are dropped. The approach:

1. **Phase 1: Add Venture layer**
   - Create Venture table
   - Create a default Venture per Workspace ("Main Business")
   - Migrate all Projects to point to this default Venture
   - Add `ventureId` to Task (backfill from Project)

2. **Phase 2: Add AI Workspace tables**
   - Create AISession, Prompt, Decision, Artifact, Capture tables
   - Migrate existing AiJob data to AISession format
   - Migrate existing File records to Artifact records

3. **Phase 3: Extend existing models**
   - Add new fields to Task (blockerId, sourceType, estimatedMinutes, etc.)
   - Add new fields to Person (type, tags, reliabilityScore, etc.)
   - Add new fields to Project (goals, priority, startDate, targetDate)
   - Add new TaskStatus values (PLANNED, BLOCKED, IN_REVIEW)

4. **Phase 4: Add sharing + capture**
   - Create ShareLink table
   - Create Capture table
   - Create Metric table

Each phase is a separate Prisma migration. Each can be deployed independently. No big-bang migration.

---

## 4. USER FLOWS

### 4.1 Morning Routine (the killer flow)

```
1. Open app (iPhone)
2. Cockpit loads instantly (< 1s, server-rendered)
3. See: 1 fire (overdue critical task), 2 decisions needed, 5 focus items
4. Tap fire → task detail → change status to IN_PROGRESS → back (2 taps)
5. Tap first decision → AI Session output → read → tap "Accept" → creates task → back
6. Tap second decision → read → tap "Reject" → add note why → back
7. Scan focus items → swipe-complete the one done yesterday
8. Total time: 90 seconds
9. Full operational awareness achieved
```

### 4.2 AI Session Flow (Claude + Codex dual-brain)

```
1. Viewing Project "Mobile App v2"
2. Tap "Ask AI" button
3. AI Session opens, pre-filled with project context:
   - Project name, goals, health score
   - Current blockers
   - Recent decisions
4. User types: "What should be our launch strategy given we're 2 weeks behind?"
5. Select model: Claude Opus (strategy)
6. Output arrives → rendered in markdown
7. User taps "Second Opinion" → same prompt sent to Codex
8. Both outputs shown in tabs: [Claude] [Codex]
9. User reads both, taps "Accept" on Claude's output
10. Taps "Extract Tasks" → AI parses 4 actionable items
11. Review extracted tasks → confirm → 4 tasks created in project
12. Taps "Log Decision" → "Decided to do soft launch with beta users first"
13. Session saved. Linked to project. Tasks linked. Decision linked.
14. Everything is connected. Nothing is lost.
```

### 4.3 Capture Flow (voice)

```
1. Idea strikes while driving
2. Long-press capture button (or "Hey Siri, note to BLO")
3. Speak: "We should partner with Stripe for the payment integration
   on the marketplace project. Call Tom about it this week."
4. Release
5. Audio uploaded → transcribed → AI classifies:
   - Task: "Call Tom about Stripe partnership" (confidence: 0.9)
   - Decision candidate: "Partner with Stripe for payments" (confidence: 0.7)
   - Suggested venture: Marketplace (confidence: 0.85)
6. Next time user opens app, Capture Inbox shows:
   - "Call Tom about Stripe partnership" → [Accept as Task] [Reclassify]
   - "Stripe partnership decision" → [Accept as Decision] [Dismiss]
7. One tap each. Done. Both entities exist, linked to correct venture.
```

### 4.4 External Partner Flow (no app install)

```
1. Founder creates task "Review contract draft" assigned to Partner (Person)
2. System sends email/Telegram message to Partner with shareable link
3. Partner clicks link → sees task in clean, branded web view
4. Partner reads attached contract (artifact)
5. Partner adds comment: "Clause 3.2 needs revision"
6. Comment appears in app, linked to task, flagged as external
7. Founder sees comment in cockpit → acts on it
8. No app install. No login. No friction.
```

### 4.5 Decision Review Flow

```
1. Cockpit signals: "Review decision: Switch to Stripe (90 days ago)"
2. Founder taps → sees full decision context:
   - What: Switched from Paddle to Stripe
   - Why: Better API, lower fees for our volume
   - AI Session that informed it
   - Tasks that were created
   - Current state of those tasks
3. Founder evaluates: "Still the right call. Revenue increased 15%."
4. Taps "Confirm" → reviewAt pushed to +90 days
5. Or taps "Reverse" → new decision created, superseding the old one
```

---

## 5. UX STRUCTURE

### 5.1 Navigation Architecture

**Mobile (iPhone — primary):**

```
Bottom Nav Bar (5 items):
┌────┬────┬────┬────┬────┐
│ 🏠 │ 📋 │ ⚡ │ 🤖 │ 👤 │
│Home│Tasks│ + │ AI │More│
└────┴────┴────┴────┴────┘

Home    = Founder Cockpit
Tasks   = Task list (filterable by venture/project/status)
+       = Quick capture FAB (text, voice, paste)
AI      = AI Workspace (sessions list + new session)
More    = Ventures, Projects, People, Decisions, Settings
```

**The FAB (center button)** is the capture system entry point. Tap = text input. Long-press = voice. It's always accessible from any screen.

**Desktop (wide screen):**

```
┌──────────┬────────────────────────────────────────┐
│ SIDEBAR  │            MAIN CONTENT                 │
│          │                                          │
│ 🏠 Home   │  [content area — full width]             │
│ 📋 Tasks  │                                          │
│ 📁 Projects│                                         │
│ 🤖 AI      │                                         │
│ 📝 Decisions│                                        │
│ 👥 People  │                                          │
│ 📎 Artifacts│                                        │
│ 📬 Inbox   │                                          │
│ ⚙️ Settings│                                         │
│          │                                          │
│ ──────── │                                          │
│ VENTURES │                                          │
│ ▸ Venture A│                                        │
│ ▸ Venture B│                                        │
│ ▸ Venture C│                                        │
├──────────┤                                          │
│[Capture] │                                          │
└──────────┴────────────────────────────────────────┘
```

The sidebar is collapsible. On narrow screens it becomes a hamburger. The venture list at the bottom is always visible — one-click context switch.

### 5.2 Layout System

**Principle: Content in a tube.**

All content renders within a max-width container (640px on mobile, 960px on desktop for content, full-width for tables). This keeps reading comfortable and interactions thumb-friendly.

**Page types:**

| Type | Layout | Examples |
|---|---|---|
| **List** | Scrollable list with sticky filter bar | Tasks, Projects, AI Sessions, People |
| **Detail** | Header + scrollable content + fixed action bar | Task detail, AI Session, Decision |
| **Cockpit** | Stacked cards, no scroll-to-action needed | Home dashboard |
| **Form** | Focused input with clear save/cancel | New Task, New AI Session |
| **Split** | List on left, detail on right (desktop only) | Inbox, AI Session with side panel |

### 5.3 Interaction Patterns

**One-tap status change:**
Every status badge is tappable. Tapping opens a bottom sheet (mobile) or dropdown (desktop) with all valid next statuses. No modals. No page navigation.

**Swipe gestures (mobile):**
- Swipe right on task → mark as done
- Swipe left on task → open action menu (assign, reschedule, block)
- Swipe right on capture → accept AI classification
- Swipe left on capture → dismiss

**Pull to refresh:**
All list views support pull-to-refresh. Server data refreshes silently (React Server Components revalidation).

**Keyboard shortcuts (desktop):**
Inspired by Superhuman:
- `c` — new capture
- `t` — new task
- `a` — new AI session
- `j/k` — navigate list items
- `enter` — open selected
- `e` — edit
- `1-7` — change status (mapped to TaskStatus enum order)
- `/` — search
- `g h` — go home
- `g t` — go tasks
- `g a` — go AI

**Command palette (desktop):**
`Cmd+K` opens a search-everything palette. Type anything:
- Task titles
- Project names
- Person names
- Decisions
- Prompts
- "Create task", "New AI session" (actions)
- "Venture: Marketplace" (context switch)

### 5.4 Visual Language

**Typography:**
- Headings: Inter (or system font) — bold, clean
- Body: Inter — regular, 15px mobile / 14px desktop
- Monospace: JetBrains Mono (for code blocks in AI output)

**Colors:**
- Surface: pure white (#FFFFFF) light / deep gray (#1A1A1A) dark
- Primary: deep blue (#2563EB) — actions, links
- Accents per venture: user-assigned colors for instant visual differentiation
- Status colors: red (fire), amber (warning), green (good), blue (info)
- Priority colors: gray (low), blue (medium), orange (high), red (urgent), purple (critical)

**Spacing:**
8px grid. Every padding, margin, and gap is a multiple of 8. This creates visual rhythm without conscious effort.

**Cards:**
Rounded corners (12px). Subtle shadow in light mode. Subtle border in dark mode. No heavy gradients. No glossy effects. Clean, flat, information-dense.

**Animations:**
Minimal. Status changes animate with a 150ms fade. Page transitions use 200ms slide. Nothing bounces. Nothing zooms. Speed over spectacle.

---

## 6. ARCHITECTURE

### 6.1 Frontend Architecture

```
Next.js 16+ App Router
├── app/
│   ├── (app)/                    # Authenticated routes (OWNER, TEAM)
│   │   ├── layout.tsx            # Shell: sidebar + nav + venture context
│   │   ├── page.tsx              # Cockpit
│   │   ├── tasks/
│   │   ├── projects/
│   │   ├── ai/                   # AI Workspace
│   │   │   ├── page.tsx          # Session list
│   │   │   ├── [id]/page.tsx     # Session detail
│   │   │   ├── new/page.tsx      # New session (with prompt vault picker)
│   │   │   └── prompts/          # Prompt Vault
│   │   ├── decisions/
│   │   │   ├── page.tsx          # Decision list
│   │   │   └── [id]/page.tsx     # Decision detail
│   │   ├── ventures/
│   │   │   ├── page.tsx          # Venture list
│   │   │   └── [id]/page.tsx     # Venture detail (projects + metrics)
│   │   ├── people/
│   │   ├── artifacts/
│   │   ├── capture/              # Capture inbox
│   │   ├── calendar/
│   │   ├── inbox/                # Communications
│   │   ├── notifications/
│   │   └── settings/
│   ├── (auth)/
│   ├── (client)/                 # Client portal (preserved from v1)
│   ├── (share)/                  # Shareable link views (no auth required)
│   │   └── share/[token]/page.tsx
│   └── api/
│       ├── auth/
│       ├── webhooks/
│       ├── capture/              # Capture endpoints (email, telegram, API)
│       └── ai/                   # AI proxy endpoints
│
├── components/
│   ├── layout/
│   │   ├── Shell.tsx             # Main app shell
│   │   ├── Sidebar.tsx           # Desktop sidebar
│   │   ├── MobileNav.tsx         # Mobile bottom nav
│   │   ├── VentureSwitcher.tsx   # Venture context switcher
│   │   └── CommandPalette.tsx    # Cmd+K search
│   ├── ui/                       # Design system primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomSheet.tsx       # Mobile action sheets
│   │   ├── StatusPicker.tsx      # Universal status changer
│   │   └── ...
│   └── shared/
│       ├── EntityTimeline.tsx    # Reusable activity/comment timeline
│       ├── QuickCapture.tsx      # Capture input (text + voice)
│       ├── AISessionCard.tsx     # AI session preview card
│       └── ...
│
├── modules/                      # Feature modules (unchanged pattern from v1)
│   ├── ai/                       # AI Workspace logic
│   │   ├── ai-session.service.ts
│   │   ├── ai-session.actions.ts
│   │   ├── prompt.service.ts
│   │   ├── prompt.actions.ts
│   │   └── mcp-bridge.ts        # MCP integration layer
│   ├── decisions/
│   ├── ventures/
│   ├── capture/
│   ├── artifacts/
│   ├── share/
│   ├── metrics/
│   ├── tasks/                    # Evolved from v1
│   ├── projects/                 # Evolved from v1
│   ├── people/                   # Evolved from v1
│   ├── ...                       # Other v1 modules preserved
│   └── operational/
│       ├── staleness.service.ts  # Evolved: cross-venture signals
│       ├── health.service.ts     # NEW: project health computation
│       └── signals.service.ts    # NEW: cockpit signal aggregation
│
└── lib/
    ├── auth.ts
    ├── prisma.ts
    ├── action-utils.ts           # Guard hierarchy (evolved)
    ├── mcp.ts                    # MCP client utilities
    ├── venture-context.ts        # Venture context management
    └── utils.ts
```

**Key Frontend Patterns:**

1. **Server Components by default.** All list pages and detail pages are server components. Client components only for interactive elements (status pickers, forms, search).

2. **Venture Context.** A React context (or server-side cookie/header) tracks the currently selected venture. All queries are automatically scoped. Switching ventures doesn't cause a full page reload — it revalidates the server components with the new ventureId.

3. **Optimistic Updates.** Status changes, task completion, and capture routing use optimistic updates. The UI responds instantly; the server catches up. If the server rejects, the UI rolls back with a toast.

4. **Streaming.** The cockpit uses React Suspense with streaming. The greeting and fires section render first (fast), then signals and activity stream in.

### 6.2 Backend Structure

**Module Boundaries (critical for future AI gates):**

Each module is self-contained with a clear interface:

```
module/
  ├── [name].service.ts    # Pure business logic (no HTTP, no auth)
  ├── [name].actions.ts    # Server Actions (auth + validation + service calls)
  ├── [name].queries.ts    # Read-only data fetching (server components)
  ├── [name].types.ts      # Zod schemas + TypeScript types
  └── components/          # Module-specific UI components
```

**Service layer rules:**
- Services receive validated data + context (workspaceId, ventureId, userId)
- Services never call `auth()` or `requireRole()` — that's the action layer's job
- Services never throw HTTP errors — they return `{ success, data }` or throw domain errors
- Services are testable in isolation

**Action layer rules:**
- Actions always start with a guard: `requireAuth()` → `requireRole()` → validate input → call service
- Actions use the `safeAction()` wrapper for consistent error handling
- Actions are the security boundary — the ONLY place where auth decisions happen

**This separation is critical for the AI integration.** When an AI agent creates a task, it goes through the same service layer as a human — but the action layer can apply different auth rules (API key instead of session).

### 6.3 Integration Layer (MCP Backbone)

**MCP is the integration standard.** Inspired by the Claude Code + Codex guide, all external AI and tool integrations use MCP.

```
Business Life OS
  │
  ├── MCP Server (our app exposes tools to AI agents)
  │   ├── createTask(title, projectId, ...)
  │   ├── updateTaskStatus(taskId, status)
  │   ├── createDecision(title, rationale, ...)
  │   ├── getProjectHealth(projectId)
  │   ├── getCockpitSignals()
  │   └── capture(text, source)
  │
  ├── MCP Client (our app consumes external AI tools)
  │   ├── Claude API (primary generation)
  │   ├── Codex MCP (code review, second opinion)
  │   ├── Context7 (documentation)
  │   └── Perplexity (research, future)
  │
  └── Webhook Integrations (non-MCP)
      ├── Telegram Bot
      ├── WhatsApp Business
      ├── Email (inbound parsing)
      └── Calendar (Apple/Google, future)
```

**Why MCP matters for this app:**

1. **AI can operate the app.** A Claude Code session can call `createTask()` via MCP. A scheduled AI agent can call `getCockpitSignals()` and generate a daily briefing. The app becomes AI-operable.

2. **External tools plug in without code changes.** Want to add Notion as an artifact source? Add an MCP connection. Want Linear for task import? MCP. The integration layer is a protocol, not a pile of custom adapters.

3. **The founder's Claude Code workflow connects to their BLO data.** The guide describes Claude Code + Codex as the dev workflow. With BLO exposing an MCP server, the founder can type in Claude Code: "What are my blocked tasks across all ventures?" and get a real answer from their actual data.

### 6.4 Database Design Principles

**PostgreSQL 16 + Prisma 6.x** (unchanged stack from v1)

**Indexing strategy:**
- Every foreign key is indexed
- Composite indexes for common query patterns: `[ventureId, status]`, `[projectId, status]`, `[userId, read]`
- Partial indexes for hot queries: `WHERE status != 'DONE'` on tasks (most queries exclude completed tasks)

**Denormalization decisions:**
- `ventureId` on Task (derived from Project) — avoids joins for cross-venture task queries
- `reliabilityScore` on Person — cached computation, updated asynchronously
- `lastContactAt` on Person — updated by a trigger/hook on message/comment creation
- `useCount` and `avgRating` on Prompt — updated on AI Session creation/rating

**JSON fields:**
- `iterations` on AISession (multi-turn conversations)
- `variables` on Prompt (flexible variable definitions)
- `previousVersions` on Prompt (version history)
- `aiClassification` on Capture (AI classification results)
- These are read-heavy, rarely queried by content. JSON is appropriate.

**Soft deletes:**
Not implemented globally. Decisions are never deleted (status: SUPERSEDED). Tasks can be DONE or ARCHIVED. Projects can be ARCHIVED. This preserves the audit trail.

---

## 7. MVP SCOPE (what to build FIRST)

### Phase 0: Foundation (Week 1-2)
**Goal:** Venture layer + migration from v1 schema

- [ ] Create Venture model + migration
- [ ] Create default Venture per existing Workspace
- [ ] Backfill ventureId on Projects and Tasks
- [ ] Add VentureSwitcher component to layout
- [ ] Update all queries to support venture filtering
- [ ] Update cockpit to aggregate across ventures

**Deliverable:** Existing v1 app works exactly as before, but inside a Venture context. Users can create additional ventures.

### Phase 1: AI Workspace (Week 3-5)
**Goal:** The single biggest value-add. Store, manage, and leverage AI interactions.

- [ ] Create AISession model + CRUD
- [ ] Build AI Session list page (`/ai`)
- [ ] Build New AI Session page with context injection
- [ ] Integrate Claude API for generation
- [ ] Build task extraction from AI output
- [ ] Create Prompt model + CRUD
- [ ] Build Prompt Vault page (`/ai/prompts`)
- [ ] Variable injection engine
- [ ] MCP bridge setup (Codex as second model)

**Deliverable:** User can have AI conversations within the app, save outputs, extract tasks, and reuse prompts. Codex provides second opinions.

### Phase 2: Decision Log (Week 5-6)
**Goal:** Institutional memory. Every decision tracked with full context chain.

- [ ] Create Decision model + CRUD
- [ ] Build Decision list and detail pages
- [ ] Link decisions to AI Sessions, Projects, Tasks
- [ ] Decision review reminders in cockpit
- [ ] "Log Decision" action from AI Session

**Deliverable:** Decisions are first-class entities linked to everything that informed them.

### Phase 3: Evolved Cockpit (Week 6-7)
**Goal:** Transform dashboard from task list to signal aggregator.

- [ ] Fires section (critical overdue + cascading blocks)
- [ ] Decisions Needed section (pending AI outputs + IN_REVIEW tasks)
- [ ] Signals section (staleness, slipping deadlines, unresponsive people)
- [ ] Cross-venture aggregation with venture filter
- [ ] Project health score computation

**Deliverable:** Opening the app instantly answers "What needs my attention?"

### Phase 4: Capture System (Week 7-8)
**Goal:** Zero-friction input from any context.

- [ ] Quick capture bar (persistent, every screen)
- [ ] Voice capture with transcription
- [ ] AI classification pipeline
- [ ] Capture Inbox page
- [ ] One-tap routing

**Deliverable:** Ideas, tasks, and decisions can be captured in 5 seconds from anywhere.

### Phase 5: Enhanced Task Engine (Week 8-9)
**Goal:** Tasks evolve from simple items to execution atoms.

- [ ] New statuses: PLANNED, BLOCKED, IN_REVIEW
- [ ] Blocker/dependency system (lightweight)
- [ ] Swipe gestures for status change
- [ ] Recurring tasks
- [ ] Task source tracking

**Deliverable:** Task management is faster, smarter, and tracks provenance.

### Phase 6: Sharing + External (Week 9-10)
**Goal:** External partners can participate without an app.

- [ ] ShareLink model + token generation
- [ ] Public share pages (read + comment)
- [ ] External comment capture
- [ ] Email notifications with reply parsing

**Deliverable:** Founders can share tasks and get feedback without forcing partner onboarding.

### NOT in MVP:
- Artifact system (v2.1 — File model works for now)
- Metric tracking (v2.1)
- Keyboard shortcuts / Command palette (v2.1)
- Person reliability scoring (v2.1)
- Project templates (v2.2)
- Calendar integration (v2.2)
- Mobile share sheet capture (v2.2)
- Telegram/WhatsApp capture (v2.2)

---

## 8. FUTURE EXPANSION

### 8.1 AI Suggestions Engine (v2.1)

The system has enough data to start suggesting actions:

**"Next action" suggestions:**
Based on project health, task status distribution, and recent activity, AI generates suggestions:
- "Project X has 3 blocked tasks. Consider unblocking 'API design' first — it's blocking 2 others."
- "You haven't updated Venture Y metrics in 45 days. Revenue tracking is stale."
- "Anna has 4 overdue tasks. Consider redistributing or checking in."

These appear in the cockpit Signals section. One-tap to act on them.

**Auto-task extraction from conversations:**
When a message comes in via Telegram/WhatsApp, AI scans it for actionable items and suggests tasks. The user confirms with one tap. This is the v1 task extraction pipeline extended to real-time messages.

**Daily AI Briefing:**
A scheduled AI job (via MCP) runs every morning:
1. Reads all venture data
2. Generates a 2-minute briefing: what's burning, what's slipping, what needs decision
3. Delivers via push notification, email, or Telegram
4. Links to relevant entities in the app

This is the founder's "AI chief of staff."

### 8.2 Deal/Opportunity Tracking (v2.1)

For ventures in sales-heavy mode, extend with a lightweight pipeline:

```
Opportunity
  ├── name, value, probability
  ├── stage: LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON/LOST
  ├── linkedPerson (the buyer/partner)
  ├── linkedVenture
  ├── linkedProject (if won, the project it creates)
  ├── linkedDecisions
  └── expectedCloseDate
```

Not a full CRM. Just enough to track "what deals are in flight and what's their status?" Visible in the cockpit as a signal: "3 deals worth $150K closing this month."

### 8.3 Revenue Intelligence (v2.1)

The Metric model supports custom KPIs per venture. With enough data points:
- MRR/ARR trend visualization (simple sparkline, not a dashboard)
- Revenue per project (if tracked)
- Runway calculation (if burn rate is entered)
- "Revenue declined 15% MoM" as a cockpit signal

### 8.4 Risk Signals (v2.2)

Computed from multiple data sources:

| Signal | Computation |
|---|---|
| "What is slipping?" | Projects where >30% of tasks are overdue |
| "Who is unreliable?" | People with reliability score < 50 |
| "What decision needs revisiting?" | Decisions past reviewAt date |
| "Where is money stuck?" | Deals past expectedCloseDate |
| "What's abandoned?" | Projects with no activity in 30 days |
| "Cascading failure" | Blocked tasks that block other blocked tasks |

These surface in the cockpit as a "Risk" section — only when risks exist. No noise when everything is healthy.

### 8.5 MCP Server for External AI Agents (v2.2)

The app exposes its own MCP server so the founder's AI workflows (Claude Code, Claude Desktop, scheduled tasks) can read and write BLO data:

```
Tools exposed via MCP:
  - blo.getCockpitSignals()
  - blo.getVentures()
  - blo.getTasks(ventureId?, projectId?, status?)
  - blo.createTask(title, projectId, ...)
  - blo.updateTask(taskId, updates)
  - blo.getDecisions(ventureId?)
  - blo.createDecision(title, rationale, ...)
  - blo.capture(text, source)
  - blo.getProjectHealth(projectId)
  - blo.search(query)
```

This means the founder can be in Claude Code, writing code for one venture, and ask: "What are my blocked tasks in the Marketplace venture?" and get real data from BLO. Or: "Create a task in the Mobile App project to fix the login bug I just found." The boundaries between the AI coding workflow and the operating system dissolve.

### 8.6 Offline-First PWA (v2.3)

The app is already a PWA (v1). v2.3 adds:
- Service Worker with offline data cache
- Offline capture (stored locally, synced on reconnect)
- Offline task status changes (queued, synced)
- Conflict resolution for concurrent edits

This matters for founders who travel. The app must work on a plane.

### 8.7 Team Scaling (v3.0)

When the founder grows beyond solo operation:
- Team dashboards (each team member sees their own cockpit)
- Delegation workflows (founder assigns ventures to operators)
- Permission escalation (team members request access to ventures)
- Shared prompt vaults (team-wide prompt libraries)
- Cross-venture reporting for boards/investors

---

## 9. DEVELOPMENT WORKFLOW (inspired by the guide)

### How to Build v2

Following the Plan-Build-Test cycle from the Claude Code + Codex guide:

**Setup:**
```bash
cd ~/Documents/Projects/business-life-os
claude
/init  # Update CLAUDE.md with v2 architecture context
```

Add to `CLAUDE.md`:
```markdown
## V2 Architecture
- Read docs/V2-ARCHITECTURE.md for full system design
- New modules: ai/, decisions/, ventures/, capture/, artifacts/, share/, metrics/
- Module pattern: service.ts (logic) → actions.ts (auth + validation) → queries.ts (reads) → types.ts (schemas)
- Every new table needs a Prisma migration
- Run `npm run build` after every change
- Test with OWNER, TEAM, CLIENT roles using dev login buttons
```

**Per-feature workflow:**
```
1. PLAN MODE (Shift+Tab twice)
   > "Read V2-ARCHITECTURE.md section 2.5 (AI Workspace).
      Plan the implementation of the AISession model and CRUD.
      What files need to change? What's the migration strategy?
      What could break?"

2. REVIEW
   > "Use codex to audit this plan for issues"

3. BUILD (Normal mode)
   > "Commit checkpoint. Then implement step 1: Prisma schema changes."
   > "Run migrate dev. Fix any errors."
   > "Implement step 2: ai-session.service.ts"
   > "Run build. Fix errors."
   ...

4. TEST
   > "Run the app. Test AI Session creation as OWNER."
   > "Use the review tool to check all changes"

5. COMMIT
   > "Commit with message: feat(ai): add AI Session model and CRUD"
```

**Branch strategy for v2:**
```
main (v1, stable)
  └── v2/foundation (Phase 0)
       └── v2/ai-workspace (Phase 1)
            └── v2/decision-log (Phase 2)
                 └── ... (each phase is a branch)
```

Each phase merges into main when stable. No big-bang v2 launch. Incremental delivery.

---

*This document is the source of truth for Business Life OS v2. All implementation decisions should reference it. Update it as the system evolves.*
