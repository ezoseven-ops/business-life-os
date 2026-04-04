# Phase 1 — Architecture V2.5: AI-Orchestrated Execution System

> This document supersedes V2-ARCHITECTURE.md sections 1-6.
> V2-ARCHITECTURE.md remains valid for: Data Model details, UX patterns, MVP phasing.
> Date: 2026-04-03 | Status: SYSTEM DESIGN

---

## THE FUNDAMENTAL SHIFT

v2.0 treated AI as a module — one box among many (Tasks, Projects, People, AI).

v2.5 treats AI as the **operating layer** — the substrate that everything else runs on.

```
v2.0 (MODULE THINKING):
  [Tasks] [Projects] [People] [AI] [Decisions]
     ↓        ↓         ↓      ↓       ↓
  ──────── DATABASE ────────────────────────

v2.5 (SYSTEM THINKING):
  ┌─────────── USER SURFACE ───────────┐
  │  Cockpit / Tasks / AI / Capture    │
  ├────────────────────────────────────┤
  │      AI ORCHESTRATION LAYER        │  ← BRAIN
  │  (observes, suggests, generates)   │
  ├────────┬───────────┬───────────────┤
  │EXECUTION│  MEMORY   │   CAPTURE    │  ← ENGINES
  │ ENGINE  │  SYSTEM   │   ENGINE     │
  ├────────┴───────────┴───────────────┤
  │         DATA LAYER (Prisma)        │  ← STORAGE
  └────────────────────────────────────┘
```

The difference: in v2.0, a user creates a task. In v2.5, a user expresses intent — the AI Orchestration Layer turns that intent into structured action, enriches it, links it, and monitors it.

---

## 1. SYSTEM LAYERS

### Layer 0: DATA (PostgreSQL + Prisma)

Pure storage. Models, relations, indexes. No logic. No intelligence. Just the truth of the system state.

This is what v1 has. We keep it, extend it.

### Layer 1: EXECUTION ENGINE

The state machine for ALL work. Not "task CRUD" — a proper execution system that understands:
- What work exists
- What state each piece of work is in
- What's blocking what
- What needs attention
- What's moving, what's stuck

The Execution Engine owns: Tasks, Projects, Ventures. It enforces state transitions. It computes health. It detects staleness.

### Layer 2: MEMORY SYSTEM

The long-term intelligence layer. This is what makes the system compound over time. It stores:
- Decisions (why things were decided)
- AI Sessions (every AI interaction with full context)
- Prompts (reusable, versioned, performance-tracked)
- Context chains (decision → AI session → tasks → outcomes)

Memory is what separates a tool from an operating system. Without memory, every day starts from zero. With memory, the system gets smarter.

### Layer 3: AI ORCHESTRATION LAYER

The brain. Sits between the user and everything else. It:
- **Observes** the system state (what's stuck, what's slipping, what needs decision)
- **Classifies** raw input (capture → structured entity)
- **Generates** content (suggestions, analyses, task descriptions, decisions)
- **Recommends** next actions (what should the founder focus on right now?)
- **Enriches** every entity (AI suggests priority, due date, blockers, related decisions)

The AI layer READS from all other layers. It WRITES only through the Execution Engine and Memory System — never directly to the database.

### Layer 4: CAPTURE ENGINE

The input funnel. Accepts raw chaos from any source and transforms it into structured system entities. Works closely with the AI Orchestration Layer for classification.

### Layer 5: USER SURFACE

The UI. Minimal. What the founder sees and touches. Renders state from the Execution Engine, recommendations from the AI Layer, and context from the Memory System.

---

## 2. EXECUTION ENGINE (DEEP DESIGN)

### 2.1 What the Execution Engine IS

The Execution Engine is the system's **nervous system for work**. It manages the full lifecycle of every piece of work, from inception to completion, across all ventures.

It is NOT a task list with CRUD operations. It is a **state machine with observability**.

### 2.2 Entity Hierarchy

```
Venture (the business)
  └── Project (the initiative)
       └── Task (the atomic work unit)
            ├── blocker? → another Task
            ├── source → Capture | AISession | Message | Manual
            └── outcome → Decision? | Artifact?
```

Every task has a **provenance** (where it came from) and an **outcome** (what it produced). This creates a complete execution trail.

### 2.3 Task Lifecycle (State Machine)

```
                    ┌──────────┐
        ┌───────────│ CAPTURED │ (raw, from capture engine)
        │           └────┬─────┘
        │                │ classify
        │                ▼
        │           ┌──────────┐
        ├───────────│ PLANNED  │ (acknowledged, not yet actionable)
        │           └────┬─────┘
        │                │ activate
        │                ▼
        │           ┌──────────┐
   ┌────┼───────────│   TODO   │ (ready to work on)
   │    │           └────┬─────┘
   │    │                │ start
   │    │                ▼
   │    │           ┌──────────────┐
   │    ├───────────│ IN_PROGRESS  │ (actively being worked on)
   │    │           └──┬─────┬─────┘
   │    │              │     │
   │    │    blocked ──┘     └── waiting
   │    │              │              │
   │    │              ▼              ▼
   │    │       ┌──────────┐   ┌──────────┐
   │    ├───────│ BLOCKED  │   │ WAITING  │
   │    │       └────┬─────┘   └────┬─────┘
   │    │            │ unblock      │ response received
   │    │            └──────┬───────┘
   │    │                   │
   │    │                   ▼
   │    │           ┌──────────────┐
   │    └───────────│ IN_PROGRESS  │ (resumed)
   │                └──────┬───────┘
   │                       │ submit for review
   │                       ▼
   │                ┌──────────────┐
   │                │  IN_REVIEW   │ (awaiting approval/decision)
   │                └──────┬───────┘
   │                       │ approve / complete
   │                       ▼
   │                ┌──────────┐
   └────────────────│   DONE   │
                    └──────────┘

ANY STATE can transition to DONE (quick complete).
ANY STATE can transition to any other state (override).
State machine is advisory, not enforced in MVP.
```

### 2.4 Focus System

The Execution Engine computes a **Focus Score** for every task. This determines what appears in the cockpit's "Today's Focus" section.

```
Focus Score = base_priority_weight
  + (overdue? → +50)
  + (blocking_other_tasks? → +30)
  + (has_upcoming_deadline_within_48h? → +20)
  + (assigned_to_me? → +10)
  + (in_review_by_me? → +15)
  - (no_deadline? → -5)
  - (PLANNED_status? → -20)

Priority weights:
  CRITICAL = 100
  URGENT = 80
  HIGH = 60
  MEDIUM = 40
  LOW = 20
```

The cockpit shows the top N tasks by Focus Score. The founder doesn't choose what to focus on — the system tells them.

### 2.5 Blocker Chain Detection

When a task is BLOCKED, the engine traces the chain:

```
Task A (BLOCKED by Task B)
  └── Task B (BLOCKED by Task C)
       └── Task C (IN_PROGRESS, assigned to Anna)
```

The system surfaces: "Task A is blocked. Root cause: Task C (Anna, in progress). Unblocking C would unblock 2 tasks."

This is computed on-demand (like staleness in v1), not stored.

### 2.6 Project Health (computed)

```
Project Health Score (0-100):
  base = 100
  - (overdue_tasks * 8)
  - (blocked_tasks * 12)
  - (days_without_any_activity > 7 ? 15 : 0)
  - (days_without_any_activity > 14 ? 25 : 0)  // replaces above
  - (unassigned_high_priority_tasks * 5)
  - (tasks_with_no_due_date / total_tasks * 10)  // chaos penalty
  + (tasks_completed_this_week * 2)  // momentum bonus, cap +10
  clamped 0-100

Color:
  80-100 = green (healthy)
  50-79  = yellow (attention needed)
  0-49   = red (on fire)
```

### 2.7 Venture Health (aggregated)

```
Venture Health = weighted average of project health scores
  where weight = project priority (P0=4, P1=3, P2=2, P3=1)
```

A venture with one P0 project in red and three P3 projects in green is STILL unhealthy.

---

## 3. AI ORCHESTRATION LAYER (DEEP DESIGN)

### 3.1 Core Principle

The AI Orchestration Layer is NOT an API client that sends prompts and returns text. It is a **system agent** that:
1. Has read access to the entire system state
2. Produces structured outputs (not just text)
3. Never acts autonomously — always produces recommendations that the user approves
4. Learns from user decisions over time (through the Memory System)

### 3.2 AI Capabilities (what it can do)

| Capability | Trigger | Input | Output |
|---|---|---|---|
| **Classify** | Capture arrives | Raw text/voice | Entity type + suggested routing |
| **Enrich** | Entity created | Task/Project fields | Suggested: priority, due date, tags, related entities |
| **Analyze** | User requests | Project/venture context | Strategic analysis, health assessment, risk report |
| **Generate** | User requests (session) | Prompt + context | Text, code, strategy, recommendations |
| **Extract** | AI output exists | Session output text | Structured tasks, decisions, action items |
| **Observe** | Periodic / on-demand | Full system state | Signals: stuck items, slipping deadlines, patterns |
| **Recommend** | Cockpit loads | System state + history | "Do this next" prioritized list |
| **Review** | Second opinion requested | Primary AI output | Alternative analysis from different model |

### 3.3 AI Reads System State (Context Assembly)

When AI operates, it needs context. The system assembles context automatically based on the operation scope:

**Task-scoped context:**
```
task.title, task.description, task.status, task.priority
task.project.name, task.project.goals
task.blocker? (what's blocking this)
task.blockedTasks[] (what this blocks)
task.comments[] (recent 5)
task.aiSessions[] (related AI sessions, recent 3)
task.assignee.name
```

**Project-scoped context:**
```
project.name, project.description, project.goals, project.status
project.health_score
project.tasks[] (grouped by status with counts)
project.blocked_tasks[] (details)
project.overdue_tasks[] (details)
project.decisions[] (recent 5)
project.aiSessions[] (recent 5)
project.members[] (names + roles)
venture.name, venture.stage
```

**Venture-scoped context:**
```
venture.name, venture.stage, venture.description
venture.projects[] (name, status, health)
venture.metrics[] (recent values)
venture.decisions[] (recent 10)
venture.key_people[] (names + roles)
cross_venture_signals[] (blockers, stale items)
```

**Full system context (cockpit/observe):**
```
all_ventures[] (name, stage, health)
critical_tasks[] (overdue + blocking chains)
pending_decisions[] (PROPOSED status)
pending_ai_outputs[] (ACTIVE sessions)
stale_items[] (no activity > threshold)
capture_inbox_count
recent_activity[] (last 24h)
```

Context assembly is a **service**, not hardcoded. Each scope has a builder function that produces a structured object, which is then serialized into the AI prompt.

### 3.4 AI Produces Actions (Output Schema)

AI never returns raw text to the system internals. It returns **structured actions** that the system can execute:

```typescript
type AIAction =
  | { type: 'CREATE_TASK'; data: { title, projectId, priority?, dueDate?, assigneeId? } }
  | { type: 'UPDATE_TASK'; data: { taskId, status?, priority?, assigneeId? } }
  | { type: 'CREATE_DECISION'; data: { title, rationale, impact, projectId? } }
  | { type: 'SUGGEST_FOCUS'; data: { taskIds: string[], reasoning: string } }
  | { type: 'FLAG_RISK'; data: { entityType, entityId, risk: string, severity } }
  | { type: 'CLASSIFY_CAPTURE'; data: { captureId, entityType, confidence, suggestedRouting } }
  | { type: 'ENRICH_ENTITY'; data: { entityType, entityId, suggestions: Record<string, any> } }
  | { type: 'TEXT_RESPONSE'; data: { content: string, format: 'text' | 'markdown' } }
```

When AI generates output in a session, the output is BOTH stored as raw text (for the user to read) AND parsed into actions (for the system to execute on user approval).

### 3.5 Human-in-the-Loop (always)

```
AI generates actions
  → Actions shown to user as suggestions
    → User approves (one-tap) → Execution Engine executes
    → User modifies → Modified action executes
    → User rejects → Action discarded, feedback stored in Memory
```

The AI NEVER auto-executes. Even high-confidence classifications in the Capture Engine show as "AI suggests: Task in Project X" with a confirm button.

Exception: Pure enrichment (suggesting a priority for a new task) can be auto-applied because it's low-risk and immediately visible.

### 3.6 Multi-Model Strategy

```
┌──────────────────────────────────────────────┐
│           AI ORCHESTRATION LAYER              │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐ │
│  │ Claude   │  │ GPT-4o  │  │ Claude Haiku │ │
│  │ Opus     │  │ mini    │  │ (fast)       │ │
│  │          │  │         │  │              │ │
│  │ Strategy │  │ Extract │  │ Classify     │ │
│  │ Analysis │  │ Enrich  │  │ Route        │ │
│  │ Decide   │  │ Quick   │  │ Triage       │ │
│  └─────────┘  └─────────┘  └──────────────┘ │
│                                               │
│  Model selection is automatic per capability. │
│  User can override in AI Sessions.            │
└──────────────────────────────────────────────┘
```

**Model routing rules:**
- Classify / Route / Triage → fastest model (Haiku / GPT-4o-mini). Latency matters.
- Extract tasks / Enrich entities → mid-tier (Sonnet / GPT-4o). Accuracy matters.
- Strategy / Analysis / Complex generation → top-tier (Opus). Depth matters.
- Second opinion / Review → different provider than primary (Claude → Codex, or vice versa).

### 3.7 AI Triggers (when AI runs)

| Trigger | AI Capability | Model Tier | Latency Target |
|---|---|---|---|
| Capture submitted | Classify | Fast | < 2s |
| Task created (manual) | Enrich (suggest priority, due date) | Mid | < 3s |
| AI Session submitted | Generate | User-selected | < 30s |
| AI output "Extract tasks" clicked | Extract | Mid | < 5s |
| Cockpit loads | Observe (signals computation) | N/A (rule-based first, AI-enhanced later) | < 1s |
| User clicks "What should I focus on?" | Recommend | Top | < 10s |
| User clicks "Analyze this project" | Analyze | Top | < 15s |
| Task blocked for > 48h | Observe + Suggest unblock | Mid | Background |
| Decision review date reached | Analyze (is this still right?) | Top | Background |

**Background triggers** run asynchronously and produce notifications. They do NOT block the UI.

**Foreground triggers** run on user action and the user waits for the result.

---

## 4. MEMORY SYSTEM (DEEP DESIGN)

### 4.1 What Memory IS

Memory is the system's accumulated intelligence. It's the answer to: "What has this founder done, decided, learned, and produced — and how does that inform what happens next?"

Without Memory, the system is stateless. Every AI interaction starts from zero. Every decision is re-debated. Every lesson is re-learned.

With Memory, the system compounds:
- "Last time you analyzed this market, you concluded X. Has anything changed?"
- "You've used this prompt 12 times with an average rating of 4.2. Here's the version that performed best."
- "3 months ago you decided to use Stripe. Revenue is up 15% since then."

### 4.2 Memory Entities

#### AI Sessions (conversation memory)

Every interaction with AI is stored as an AISession. This is not a chat log — it's a structured record of:
- What was asked (prompt + context)
- What was returned (output)
- What was done with the output (accepted, rejected, tasks extracted, decision made)
- How good it was (rating)

Sessions are linked to ventures, projects, and prompts. They form a searchable knowledge base of AI interactions.

**Key design choice:** Sessions store the FULL context that was assembled (Section 3.3). This means the session is self-contained — you can understand it without loading external state. This is critical for review and learning.

#### Decisions (reasoning memory)

Every significant decision the founder makes is logged with:
- What was decided
- Why (rationale)
- What alternatives were considered
- What AI analysis informed it
- What tasks were created to execute it
- What the outcome was (tracked via task completion and metrics)

Decisions are the most valuable data in the system. They create institutional memory.

#### Prompts (operational memory)

Reusable prompts are not just templates — they're encoded operational knowledge. "How I analyze a new market" is a prompt. "How I write an investor update" is a prompt. "How I review a pull request" is a prompt.

The Prompt System tracks which prompts produce good results and which don't. Over time, the founder's prompt library becomes a refined operating manual for their AI-augmented workflow.

#### Context Chains (relational memory)

The most powerful form of memory is the CHAIN:

```
Capture ("Stripe looks better than Paddle for our use case")
  → AI Session (analysis of Stripe vs Paddle, with revenue data)
    → Decision ("Switch to Stripe", rationale: lower fees, better API)
      → Tasks ("Migrate payment integration", "Update billing page", "Notify users")
        → Activity (tasks completed over 2 weeks)
          → Metric (MRR change after migration)
```

This chain is not a separate data structure — it's the natural graph of FK relationships between entities. But the UI can RENDER it as a chain, giving the founder a complete picture from thought to outcome.

### 4.3 Memory Retrieval

When assembling AI context (Section 3.3), the Memory System provides:

**Relevant past decisions:**
"You're analyzing payment providers. Here are your past decisions about payments: [Decision: Switch to Stripe, 90 days ago, Impact: HIGH]"

**Relevant past AI sessions:**
"You asked about Stripe integration 2 months ago. Here's what Claude said then: [summary]"

**Prompt performance data:**
"You're using 'Market Analysis' prompt (v3). Average rating: 4.1/5 across 8 uses. Last time you modified it because the output was too long."

This retrieval is scope-based (venture, project, or tags) and recency-weighted (recent memories rank higher).

---

## 5. CAPTURE ENGINE (DEEP DESIGN)

### 5.1 Design Principle

The Capture Engine is a **chaos-to-structure converter**. Its job is to accept ANY input from ANY source in ANY format and transform it into a system entity that the Execution Engine can track.

The founder should never think "where does this go?" when capturing. They just throw it in. The system figures it out.

### 5.2 Input Sources

| Source | Input Format | Entry Point |
|---|---|---|
| Quick capture bar | Text | UI (persistent, every screen) |
| Voice capture | Audio → Transcription | UI (long-press FAB) |
| Paste from AI | Text (often structured) | UI (paste detection in capture bar) |
| Telegram bot | Text message | Webhook |
| Email forward | Email body + subject | Inbound email parser (future) |
| Share sheet | URL / Text / Image | iOS Share Extension (future) |
| API | JSON payload | REST endpoint (for external tools) |

### 5.3 Processing Pipeline

```
RAW INPUT
  │
  ▼
┌─────────────────────────────┐
│  1. NORMALIZE                │
│  - Extract text from all     │
│    formats                   │
│  - Transcribe audio          │
│  - Parse email structure     │
│  - Detect language           │
│  - Clean/trim                │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  2. CLASSIFY (AI)            │
│  Input: normalized text      │
│  Output:                     │
│    entityType: task | note   │
│      | decision | ai_input   │
│      | contact | event       │
│      | idea                  │
│    confidence: 0.0-1.0       │
│    suggestedVenture: ID?     │
│    suggestedProject: ID?     │
│    extractedFields: {        │
│      title?, dueDate?,       │
│      priority?, assignee?    │
│    }                         │
│  Model: fast (Haiku/4o-mini) │
│  Latency target: < 2s        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  3. ROUTE                    │
│                              │
│  IF confidence >= 0.85:      │
│    → Auto-create entity      │
│    → Show in cockpit as      │
│      "AI created: [entity]"  │
│    → User can undo (30s)     │
│                              │
│  IF confidence 0.5-0.84:     │
│    → Show in Capture Inbox   │
│    → Pre-filled suggestion   │
│    → User confirms/adjusts   │
│                              │
│  IF confidence < 0.5:        │
│    → Show in Capture Inbox   │
│    → No suggestion           │
│    → User classifies manually│
└─────────────────────────────┘
```

### 5.4 Classification Prompt (system prompt for AI classifier)

```
You are a capture classifier for a founder's operating system.
Given raw text input, determine:
1. What type of entity this should become
2. Which venture/project it belongs to (if determinable)
3. Any structured fields you can extract

Available ventures: {{ventures_list}}
Available projects: {{projects_by_venture}}
Recent context: {{recent_captures_and_tasks}}

Respond with JSON:
{
  "entityType": "task" | "note" | "decision" | "ai_input" | "contact" | "event" | "idea",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedVentureId": "id or null",
  "suggestedProjectId": "id or null",
  "extractedFields": {
    "title": "extracted or generated title",
    "dueDate": "ISO date if mentioned",
    "priority": "if inferable",
    "assignee": "name if mentioned"
  }
}

Rules:
- "Call X by Friday" → task, extract due date
- "Decided to go with Y because Z" → decision
- "What if we tried..." / "Analyze..." → ai_input (future AI session)
- Names + contact info → contact
- Meeting/call at specific time → event
- Everything else → idea (lowest friction)
- When unsure, prefer "idea" with lower confidence
```

### 5.5 Capture Inbox UX

```
┌──────────────────────────────────┐
│ CAPTURE INBOX (3 items)          │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ "Call Tom about Stripe"       │ │
│ │ AI suggests: Task in Mobile   │ │
│ │ App (confidence: 92%)         │ │
│ │                               │ │
│ │ [✓ Accept]  [✎ Edit]  [✗]    │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ "We should target enterprise  │ │
│ │  customers first"             │ │
│ │ AI suggests: Decision in      │ │
│ │ Marketplace (confidence: 68%) │ │
│ │                               │ │
│ │ [✓ Accept]  [✎ Edit]  [✗]    │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ "interesting pattern in user  │ │
│ │  retention data..."           │ │
│ │ AI suggests: Idea             │ │
│ │ (confidence: 45%)             │ │
│ │                               │ │
│ │ [→ Task] [→ Note] [→ AI] [✗] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

Low confidence items show explicit routing buttons instead of accept/reject.

---

## 6. PROMPT SYSTEM (DEEP DESIGN)

### 6.1 Beyond Storage

The Prompt System in v2.0 was a vault — store prompts, use them later. In v2.5, prompts are **executable units of operational knowledge**.

A prompt is not text. A prompt is:
- A template with variables
- A target model recommendation
- A context assembly specification (what system state to inject)
- An output parser definition (what actions to extract from the response)
- Performance history (ratings, use count, avg quality)

### 6.2 Prompt Structure

```
Prompt:
  id: cuid
  title: "Market Analysis for New Venture"
  category: STRATEGY
  template: |
    Analyze the market opportunity for {{venture.name}}.

    Current stage: {{venture.stage}}
    Description: {{venture.description}}

    Known competitors: {{user_input:competitors}}
    Target customer: {{user_input:target_customer}}

    Consider:
    1. Market size and growth
    2. Competitive landscape
    3. Our unique advantages
    4. Key risks
    5. Recommended next steps

    {{#if venture.decisions}}
    Previous strategic decisions:
    {{venture.decisions}}
    {{/if}}

  variables:
    - name: "competitors"
      type: "user_input"
      description: "List of known competitors"
      required: false
    - name: "target_customer"
      type: "user_input"
      description: "Who is the target customer"
      required: true

  contextSpec:
    scope: "venture"
    include: ["decisions", "metrics", "projects_summary"]

  outputSpec:
    actions:
      - type: "CREATE_DECISION"
        extract: "any recommended strategic decision"
      - type: "CREATE_TASK"
        extract: "any recommended next steps as tasks"

  targetModel: CLAUDE_OPUS
  version: 3
  avgRating: 4.2
  useCount: 8
```

### 6.3 Variable Types

| Type | Resolution | Example |
|---|---|---|
| `venture.*` | Auto-resolved from active venture | `{{venture.name}}` |
| `project.*` | Auto-resolved from selected project | `{{project.goals}}` |
| `task.*` | Auto-resolved from selected task | `{{task.description}}` |
| `system.*` | Auto-resolved from system state | `{{system.blocked_tasks}}` |
| `user_input:name` | User fills in at runtime | `{{user_input:competitors}}` |
| `memory.*` | Retrieved from Memory System | `{{memory.related_decisions}}` |

### 6.4 Prompt Chaining (future, but designed now)

A complex workflow can be expressed as a chain of prompts:

```
Chain: "Full Project Kickoff"
  1. "Market Analysis" prompt → produces analysis + decision candidates
  2. "Task Breakdown" prompt → takes analysis output → produces task list
  3. "Risk Assessment" prompt → takes task list → produces risk flags

Each step feeds into the next.
User can approve/modify between steps.
```

MVP: Single prompts only. Chaining is a v2.5+ feature. But the data model supports it (prompts can reference other prompts, sessions can reference parent sessions).

### 6.5 Prompt Performance

Every AI Session that was started from a Prompt gets rated by the user (1-5 stars). The system tracks:

```
Prompt performance:
  totalUses: 8
  avgRating: 4.2
  ratingDistribution: {5: 3, 4: 3, 3: 2, 2: 0, 1: 0}
  bestVersion: 3 (avg 4.5)
  worstVersion: 1 (avg 3.0)
  avgTokensGenerated: 1200
  avgResponseTime: 8.2s
  taskExtractionRate: 0.75 (75% of sessions produced tasks)
```

This data helps the founder refine their prompts systematically instead of by gut feel.

---

## 7. SYSTEM FLOWS

### Flow 1: AI → Tasks → Execution

```
USER opens AI Session
  │
  ├── Selects prompt from Vault (or writes free-form)
  │
  ├── AI Orchestration Layer assembles context:
  │   - Active venture state
  │   - Selected project state
  │   - Relevant past decisions (from Memory)
  │   - Relevant past AI sessions (from Memory)
  │
  ├── Prompt + context → Model (user-selected or auto)
  │
  ├── Response received → stored in AISession
  │
  ├── User reads output
  │
  ├── User clicks "Extract Tasks"
  │   │
  │   ├── AI parses output → structured task actions
  │   │
  │   ├── Tasks shown as suggestions:
  │   │   [✓] "Migrate payment integration" (HIGH, due: Apr 15)
  │   │   [✓] "Update billing page" (MEDIUM, no due date)
  │   │   [✗] "Consider enterprise pricing" (rejected by user)
  │   │
  │   ├── User approves/modifies → Execution Engine creates tasks
  │   │
  │   └── Tasks linked to: AISession, Project, Venture
  │
  ├── User clicks "Log Decision" (optional)
  │   │
  │   ├── Decision pre-filled from AI output
  │   ├── User confirms rationale
  │   ├── Decision linked to: AISession, Project, Tasks
  │   └── Review date set (optional)
  │
  └── Session status → ACCEPTED / REJECTED
      Session rated (1-5 stars)
      If started from Prompt → Prompt stats updated
```

### Flow 2: Capture → Classification → Routing

```
RAW INPUT arrives (text, voice, paste, telegram)
  │
  ├── Capture record created (status: PENDING)
  │
  ├── If voice: audio → Whisper transcription → text
  │
  ├── AI Classifier runs (fast model):
  │   Input: normalized text + venture/project list
  │   Output: entityType, confidence, routing suggestion
  │
  ├── Capture record updated (status: CLASSIFIED)
  │
  ├── IF confidence >= 0.85:
  │   │
  │   ├── Entity auto-created via Execution Engine
  │   ├── Capture status → ROUTED
  │   ├── Cockpit shows: "AI created task: Call Tom (undo?)"
  │   └── User can undo within 30 seconds
  │
  ├── IF confidence 0.5-0.84:
  │   │
  │   ├── Capture appears in Inbox with pre-filled suggestion
  │   ├── User taps "Accept" → entity created → status: ROUTED
  │   └── User taps "Edit" → modify type/fields → create → ROUTED
  │
  └── IF confidence < 0.5:
      │
      ├── Capture appears in Inbox with manual routing buttons
      ├── User selects: [Task] [Note] [Decision] [AI Session] [Dismiss]
      └── Entity created or dismissed → status: ROUTED / DISMISSED
```

### Flow 3: AI Session → Decision → Logging

```
AI Session produces output
  │
  ├── User reads and thinks
  │
  ├── User clicks "Log Decision"
  │
  ├── Decision form opens, pre-populated:
  │   title: (extracted from output or user writes)
  │   rationale: (AI can suggest based on session content)
  │   alternatives: (AI can suggest based on what was discussed)
  │   impact: LOW / MEDIUM / HIGH / CRITICAL
  │   category: STRATEGY / PRODUCT / TECHNICAL / etc.
  │   ventureId: (from session context)
  │   projectId: (from session context)
  │   reviewAt: (user sets, optional)
  │
  ├── User confirms → Decision created
  │   - Linked to AISession
  │   - Linked to Project/Venture
  │
  ├── User can "Create Tasks" from decision
  │   - Same extraction flow as Flow 1
  │   - Tasks linked to Decision + AISession + Project
  │
  └── Decision logged in Memory System
      - Searchable
      - Surfaced in future AI context
      - Review reminder set (if reviewAt specified)
```

### Flow 4: Task Blocked → AI Suggestion

```
Task marked as BLOCKED (by user or by system detecting no progress)
  │
  ├── Execution Engine records blocker:
  │   - blockerId (another task) OR blockerNote (free text)
  │
  ├── IF blocker is another task:
  │   │
  │   ├── System traces blocker chain
  │   ├── Notification to blocked task owner:
  │   │   "Task X is blocked by Task Y (assigned to Z)"
  │   └── Notification to blocker task owner:
  │       "Your task Y is blocking 2 other tasks"
  │
  ├── IF task blocked for > 48 hours:
  │   │
  │   ├── AI Orchestration Layer triggers (background):
  │   │   Context: blocked task + blocker + project state
  │   │   Prompt: "This task has been blocked for 48h. Suggest unblocking strategies."
  │   │
  │   ├── AI produces suggestions:
  │   │   - "Reassign blocker to someone available"
  │   │   - "Break blocker into smaller tasks, one of which can proceed"
  │   │   - "Descope: remove dependency and proceed differently"
  │   │
  │   └── Suggestions appear as notification:
  │       "AI suggestion for stuck task: [title]"
  │       User can: [Apply suggestion] [Dismiss] [Open AI Session for deeper analysis]
  │
  └── Cockpit surfaces in "Fires" section:
      "Task X blocked for 3 days. 2 tasks depend on it."
```

### Flow 5: Founder Morning Routine (end-to-end)

```
FOUNDER OPENS APP (08:00)
  │
  ▼
COCKPIT LOADS (< 1 second)
  │
  ├── Execution Engine computes:
  │   - Focus Score for all tasks → top 5 "Today's Focus"
  │   - Blocker chains → "Fires" section
  │   - Health scores → venture/project signals
  │
  ├── Memory System surfaces:
  │   - Decisions needing review
  │   - AI Sessions with unprocessed outputs
  │
  ├── Capture Engine reports:
  │   - "3 items in capture inbox"
  │
  ▼
COCKPIT RENDERS:
  ┌────────────────────────────────┐
  │ Good morning, Karol.           │
  │ 2 ventures • 8 active projects │
  │                                │
  │ 🔴 FIRES (1)                   │
  │ ├ Task X blocked 3 days        │
  │ │ (AI has a suggestion)        │
  │                                │
  │ ⚡ DECISIONS (2)                │
  │ ├ AI Session: Market analysis  │
  │ │ (output ready, needs review) │
  │ ├ Decision review: Stripe      │
  │ │ (90 days old, review now?)   │
  │                                │
  │ 📋 FOCUS (5 tasks)             │
  │ ├ 1. Deploy v2.1 (URGENT, due)│
  │ ├ 2. Review PR #42 (HIGH)     │
  │ ├ 3. Call investor (HIGH, tmrw)│
  │ ├ 4. Write blog post (MEDIUM) │
  │ ├ 5. Update roadmap (MEDIUM)  │
  │                                │
  │ 📬 CAPTURE INBOX (3)           │
  │                                │
  │ 📡 SIGNALS                     │
  │ ├ Project "API" no activity 12d│
  │ ├ Anna has 3 overdue tasks     │
  │                                │
  │ [────── Quick Capture ──────]  │
  └────────────────────────────────┘
  │
  ▼
FOUNDER PROCESSES (90 seconds):
  1. Tap fire → see AI suggestion → approve → task unblocked
  2. Tap AI Session → read output → accept → extract 3 tasks
  3. Tap Decision review → still valid → confirm → next review +90d
  4. Process 3 captures → 2 accepted as tasks, 1 dismissed
  5. Glance at focus → start task #1
  │
  ▼
FULL OPERATIONAL AWARENESS ACHIEVED
```

---

## 8. DATA MODEL UPGRADE (DELTA FROM V2.0)

### 8.1 AISession — Enhanced

```
ADDED fields (vs V2-ARCHITECTURE.md):
  contextSnapshot   Json      // FULL assembled context (frozen at time of session)
  contextScope      String    // "task:xxx" | "project:xxx" | "venture:xxx" | "system"
  parentSessionId   String?   // For chains: this session continues from another
  actions           Json[]    // Parsed structured actions from output
  actionsTaken      Json[]    // Which actions user actually executed
```

**Why contextSnapshot:** When reviewing a session 3 months later, you need to see WHAT the AI knew at that time. If context is assembled dynamically, it shows CURRENT state, not historical. Snapshot = frozen context.

**Why actions/actionsTaken:** Tracks what AI suggested vs what the user actually did. Over time, this shows: "AI suggests X, user usually does Y" — data for improving suggestions.

### 8.2 Task — Enhanced

```
ADDED fields (vs V2-ARCHITECTURE.md):
  focusScore        Int?      // Computed, cached for performance
  focusScoreAt      DateTime? // When was focusScore last computed
  completedAt       DateTime? // When was task marked DONE (not just updatedAt)
  aiEnrichment      Json?     // AI-suggested fields that were auto-applied
```

**Why focusScore cache:** Computing focus scores for all tasks on every cockpit load is expensive. Cache the score, invalidate on state change.

**Why completedAt:** `updatedAt` changes on any edit. `completedAt` tracks WHEN work was actually finished. Needed for velocity metrics.

### 8.3 Capture — Enhanced

```
CHANGED fields (vs V2-ARCHITECTURE.md):
  aiClassification  → SPLIT into:
    classifiedType      String?     // "task" | "note" | "decision" | etc.
    classifiedConfidence Float?     // 0.0-1.0
    classifiedRouting    Json?      // {ventureId, projectId, extractedFields}
    classifiedReason     String?    // AI's reasoning (for user to evaluate)
    classifiedModel      String?    // Which model classified this
    classifiedAt         DateTime?  // When classification ran

ADDED:
  undoneAt            DateTime?   // If auto-routed and user undid it
```

**Why split from Json:** Individual fields are queryable, indexable, and type-safe. A single Json blob is not.

### 8.4 Decision — Enhanced

```
ADDED fields:
  outcome           String?     // What actually happened after this decision
  outcomeRecordedAt DateTime?   // When outcome was noted
  supersededById    String?     // FK to the Decision that replaced this one
```

**Why outcome:** Closes the loop. A decision without tracked outcome is just an opinion.

### 8.5 Prompt — Enhanced

```
ADDED fields:
  contextSpec       Json        // What system state to auto-inject
  outputSpec        Json?       // What actions to try to extract from response
  chainParentId     String?     // For prompt chains (future)
  chainOrder        Int?        // Position in chain (future)
```

### 8.6 NEW: SystemEvent (AI trigger log)

```
model SystemEvent {
  id          String   @id @default(cuid())
  type        String   // "AI_CLASSIFY" | "AI_ENRICH" | "AI_OBSERVE" | "AI_SUGGEST"
  trigger     String   // "capture_submitted" | "task_blocked_48h" | "cockpit_load"
  entityType  String?  // What entity triggered this
  entityId    String?  // Which entity
  model       String   // Which AI model ran
  inputTokens Int      // Cost tracking
  outputTokens Int     // Cost tracking
  latencyMs   Int      // Performance tracking
  result      Json     // What AI returned
  accepted    Boolean? // Did user accept the suggestion?
  createdAt   DateTime @default(now())

  @@index([type])
  @@index([trigger])
  @@index([createdAt])
}
```

**Why this exists:** Observability for the AI layer. Without this, you can't answer: "How accurate is classification?" "What's the AI costing us?" "Are suggestions getting accepted?" This is the feedback loop that makes the AI better.

---

## 9. RISKS OF THIS ARCHITECTURE

### Risk 1: AI Latency Kills UX — CRITICAL

**The problem:** If every capture, every task creation, and every cockpit load waits for an AI call, the app feels slow. Founders won't tolerate > 1s lag on core interactions.

**Mitigation:**
- Classification is async. Capture is stored IMMEDIATELY (< 100ms). Classification runs in background. Capture Inbox updates when classification completes.
- Enrichment is optional. AI-suggested priority on task creation is a "nice to have" that can fail gracefully. Task creation never blocks on AI.
- Cockpit signals are RULE-BASED first (staleness, overdue, blocker chains). These are pure database queries, < 200ms. AI-powered recommendations ("what should I focus on?") are an explicit user action, not a page load.
- Focus Score is cached. Computed once, invalidated on state change. Not computed on every render.

**Rule: No AI call blocks the critical path of any core interaction.**

### Risk 2: Context Assembly Cost — HIGH

**The problem:** Assembling full system context for AI (Section 3.3) means reading lots of data: ventures, projects, tasks, decisions, sessions. For a founder with 5 ventures and 50 projects, this could be expensive.

**Mitigation:**
- Context scoping. A task-scoped AI call doesn't load all ventures. A venture-scoped call doesn't load other ventures.
- Aggressive field selection. Context assembly uses `select` to load only the fields needed, never full records.
- Parallel queries. All context queries run in `Promise.all()`.
- Context size limits. The assembly function caps at: 10 recent decisions, 5 recent AI sessions, 20 tasks per project (grouped by status). This is enough for AI without being overwhelming.
- Cache layer (future). Frequently accessed context (venture summary, project health) can be cached with 5-minute TTL.

### Risk 3: AI Cost Spirals — HIGH

**The problem:** Multiple AI calls per user interaction (classify capture + enrich task + generate suggestions) can get expensive. Opus calls for strategy analysis cost real money.

**Mitigation:**
- Model tier routing (Section 3.6). Most calls use the cheapest effective model.
- SystemEvent tracking (Section 8.6). Every AI call is logged with token counts. Build a cost dashboard early.
- Rate limits per user. Max 50 fast-tier calls/day, max 10 top-tier calls/day. Adjustable.
- Background AI is throttled. "Task blocked > 48h" suggestions run max once per task, not on every page load.
- User controls. Settings page: "Enable AI enrichment: ON/OFF", "Enable background AI suggestions: ON/OFF".

**Budget target for MVP:** < $5/day per active founder at normal usage.

### Risk 4: Memory System Bloat — MEDIUM

**The problem:** Storing full context snapshots in every AISession, plus all decision history, plus all captures... the database grows fast.

**Mitigation:**
- Context snapshots are JSON, not relations. They're stored once and never updated. PostgreSQL handles large JSON efficiently.
- Capture records are archived after routing (keep metadata, drop raw content after 90 days).
- AI Session iterations are capped at 10 per session. For longer conversations, start a new session.
- SystemEvents are TTL'd. Delete events older than 30 days (keep aggregated stats).

### Risk 5: Over-Designing the AI Layer for MVP — CRITICAL

**The problem:** This architecture describes a sophisticated AI orchestration system. Building all of it before shipping anything is a recipe for never shipping.

**Mitigation:** Strict MVP scope (see below).

---

## 10. MVP IMPLEMENTATION SCOPE (REALITY CHECK)

Given this v2.5 architecture, here's what actually gets built in each phase:

### MVP-0: Foundation (no AI)
- Venture model + migration + backfill
- Project extensions (ventureId, goals, priority)
- Task extensions (ventureId, new statuses, blockerId)
- Venture switching (cookie-based)
- Updated queries with venture filtering
- **AI layer: NOTHING YET**

### MVP-1: AI Sessions (basic)
- AISession model + CRUD
- Basic context assembly (project scope only)
- Claude API integration (Sonnet for generation)
- Session list + detail + new session UI
- Task extraction from session output (reuse v1 extraction logic)
- **NO auto-enrichment. NO background AI. NO multi-model.**

### MVP-2: Memory (basic)
- Prompt model + CRUD + variable injection (auto-resolve only)
- Decision model + CRUD + linking to sessions and tasks
- AI Session started from Prompt Vault
- **NO performance tracking. NO context chains rendering. NO prompt chaining.**

### MVP-3: Capture (basic)
- Capture model + quick text input (capture bar)
- AI classification (single model, Haiku)
- Capture Inbox with accept/reclassify/dismiss
- **NO voice capture. NO auto-routing. NO Telegram/email capture.**

### MVP-4: Cockpit Evolution
- Focus Score computation (cached)
- Fires section (blockers + overdue)
- Decisions Needed section
- Capture Inbox count
- Signals section (staleness, evolved from v1)
- **NO AI-powered recommendations. NO "what should I focus on?" button.**

### MVP-5: Polish
- Navigation overhaul (MobileNav + Sidebar)
- SystemEvent logging (for observability, not user-facing)
- Blocker chain detection (display only)
- **This is where the system starts feeling like a system.**

### Post-MVP (v2.5+):
- Multi-model (Codex second opinion)
- AI enrichment (auto-suggest priority)
- Background AI (blocked task suggestions)
- Voice capture + transcription pipeline
- Prompt performance tracking
- Context chain rendering
- AI-powered "what should I focus on?"
- Prompt chaining
- Cost dashboard
- MCP server (expose BLO to external AI)

---

## 11. KEY ARCHITECTURE INVARIANTS

These rules cannot be violated during implementation:

1. **AI never auto-executes.** Every AI action is a suggestion that requires user approval.
2. **AI never blocks the critical path.** Core CRUD operations (create task, change status, capture) complete in < 200ms regardless of AI availability.
3. **Everything links.** No orphan entities. Tasks → Projects → Ventures. Sessions → Projects. Decisions → Sessions. Captures → routed entities.
4. **Context is frozen in sessions.** AISession.contextSnapshot stores what AI knew at that time. Never dynamically reconstruct past context.
5. **Services own logic. Actions own auth.** New modules follow this from line 1. Existing modules migrate gradually.
6. **Venture is the scoping boundary.** All queries are venture-scoped (or cross-venture for cockpit). Never workspace-scoped without venture awareness.
7. **SystemEvents track every AI call.** Token usage, latency, acceptance rate. This is the feedback loop.

---

*Phase 1 complete. Architecture V2.5 designed. No code written.*
*Ready for Phase 2: Implementation Plan.*
