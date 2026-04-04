# Phase 2 — Founder Operating System (FOS)

> This document supersedes Phase 1 as the system vision.
> Phase 1 (v2.5) remains valid for: data model, service patterns, MVP implementation scoping.
> This is the COMPLETE SYSTEM DESIGN — the target state.
> Date: 2026-04-03 | Status: SYSTEM DESIGN (NO CODE)

---

## 1. SYSTEM OVERVIEW — WHAT THIS BECOMES

### The Old Mental Model (kill it)

```
App → User opens it → User does things → User closes it
```

This is how every SaaS works. Passive. The user drives. The system reacts.

### The New Mental Model

```
System observes → System surfaces truth → Founder decides → System executes
           ↑                                                    │
           └──────────── feedback loop ─────────────────────────┘
```

The Founder Operating System is not an app you open. It's a **running intelligence** that:
- Knows the state of every venture, project, task, and person at all times
- Computes what matters RIGHT NOW — not what's in the task list
- Tells the founder what's true, even when the truth is uncomfortable
- Executes decisions at the speed of one tap
- Learns from every action, every decision, every outcome

The founder's job is reduced to three things:
1. **Decide** (approve / reject / redirect)
2. **Direct** (set strategy, assign priority)
3. **Create** (think, analyze, build — with AI)

Everything else — tracking, routing, prioritizing, detecting, reminding — is the system's job.

### System Identity

The system has a personality. It's not a passive tool. It's a:

**Chief of Staff** — surfaces what matters, hides what doesn't, never wastes the founder's time.

**Strategic Advisor** — challenges decisions, proposes alternatives, remembers what was decided and why.

**Execution Commander** — knows what's blocked, what's slipping, who's underperforming, what should be killed.

**Tone:** Direct. Intelligent. Slightly confrontational. Never sycophantic. Says "this project should be killed" when the data supports it. Says "you're drifting from your quarterly focus" when you are.

```
NOT: "Here are your tasks for today! 😊"
YES: "3 critical items. 2 are blocking other work. 1 project is dead — consider killing it."
```

---

## 2. ARCHITECTURE V3 — LAYERED SYSTEM

```
┌──────────────────────────────────────────────────┐
│              FOUNDER SURFACE                      │
│   Command Center / Session View / Capture Bar     │
│   (what the founder sees and touches)             │
├──────────────────────────────────────────────────┤
│              CONTROL LAYER (NEW)                  │  ← STRATEGY
│   North Stars / Quarterly Focus / Kill Signals    │
│   (defines WHAT matters)                          │
├──────────────────────────────────────────────────┤
│              AI OPERATOR                          │  ← BRAIN
│   Advisor / Operator / Auditor / Optimizer        │
│   (thinks, challenges, generates, detects)        │
├──────────┬───────────┬───────────────────────────┤
│ FOCUS    │  SIGNAL   │   SYSTEM LOOPS            │  ← ENGINES
│ ENGINE   │  ENGINE   │   Daily/Weekly/Strategic   │
├──────────┴───────────┴───────────────────────────┤
│ EXECUTION │  MEMORY   │   CAPTURE                │  ← CORE
│ ENGINE    │  SYSTEM   │   ENGINE                  │
├───────────┴───────────┴──────────────────────────┤
│              DATA LAYER (Prisma + PostgreSQL)      │  ← STORAGE
└──────────────────────────────────────────────────┘
```

**What changed from v2.5:**

v2.5 had 5 layers (Surface → AI Orchestration → Execution/Memory/Capture → Data).

v3 adds:
- **Control Layer** — sits ABOVE the AI. Defines the strategic constraints that ALL other layers respect. AI doesn't decide what matters — the founder does, through the Control Layer.
- **Focus Engine** — split out from Execution Engine. This is its own system now, not just a score.
- **Signal Engine** — split out from Execution/Staleness. Unified signal detection across all dimensions.
- **System Loops** — temporal intelligence. The system behaves differently at 8am vs 6pm vs Sunday.
- **AI Operator** — upgraded from "AI Orchestration" to an operator with distinct modes and a personality.

---

## 3. CONTROL LAYER

### 3.1 What the Control Layer IS

The Control Layer is the **founder's strategic declaration**. It answers: "What matters? What am I focused on? What am I ignoring on purpose?"

Without this layer, the system treats everything equally. Every task is as important as every other. Every venture gets equal attention. This is the mistake that kills founders — treating all work as equal.

The Control Layer forces the founder to declare:
- Per venture: what's the north star metric? What's the strategic direction?
- Per project: is this P0 (critical) or P3 (nice-to-have)?
- Per day: what MUST happen today? What is optional? What is waste?

Everything downstream — Focus Engine, Signal Engine, AI Operator — reads from the Control Layer to make decisions.

### 3.2 Venture Control

Every venture has a **Venture Control Block**:

```
Venture: Marketplace
  ┌──────────────────────────────────────┐
  │ NORTH STAR METRIC                    │
  │ "Monthly Gross Transaction Volume"   │
  │ Current: $42K  Target: $100K         │
  │ Trend: ▲ +12% MoM                   │
  ├──────────────────────────────────────┤
  │ STRATEGIC DIRECTION                  │
  │ "Land 50 power sellers before        │
  │  opening to buyers at scale"         │
  ├──────────────────────────────────────┤
  │ QUARTERLY FOCUS (Q2 2026)            │
  │ 1. Seller onboarding UX             │
  │ 2. Payment infrastructure           │
  │ 3. [DO NOT TOUCH] Marketing         │
  ├──────────────────────────────────────┤
  │ VENTURE STAGE: BUILDING              │
  │ ATTENTION ALLOCATION: 60%            │
  └──────────────────────────────────────┘
```

**Attention Allocation** is a new concept. The founder declares: "I'm spending 60% of my execution capacity on this venture, 30% on Venture B, 10% on Venture C." This is not tracked by time — it's a declaration of intent. The system uses it to weight signals and focus.

**"DO NOT TOUCH" directives.** The founder can mark areas as explicitly off-limits for a quarter. If a task or AI session targets a DO NOT TOUCH area, the system flags: "This is outside your quarterly focus. Proceed anyway?"

### 3.3 Project Control

Every project gets a **strategic score** computed from:

```
Strategic Relevance = f(
  project.priority,                    // P0-P3 (founder-set)
  venture.attentionAllocation,         // how much does this venture matter
  alignment_to_quarterly_focus,        // does this project serve the quarterly goals?
  project.health,                      // is this project even healthy?
  blocking_impact                      // if this dies, what else dies?
)
```

Projects with HIGH strategic relevance + LOW health = **red alert**. The system screams.
Projects with LOW strategic relevance + HIGH effort = **kill candidate**. The system whispers: "Consider killing this."

**Kill / Continue / Scale signals:**

```
KILL signal triggers:
  - Project health < 30 for > 14 days
  - No tasks completed in 21 days
  - Strategic relevance dropped (quarterly focus changed, project didn't)
  - Founder marked as "questioning" (explicit)

CONTINUE signal (default):
  - Health > 50
  - Active progress
  - Aligned with quarterly focus

SCALE signal triggers:
  - All P0 tasks done
  - Health > 80 consistently
  - North star metric responding positively
  - Blocking impact is high (other things depend on this)
```

### 3.4 Daily Control

Every day has a **Daily Control Block** — assembled automatically, adjusted by the founder:

```
TODAY — Friday, Apr 3
  ┌──────────────────────────────────────┐
  │ MUST DO (non-negotiable)             │
  │ ├── Deploy v2.1 hotfix (blocks 3)   │
  │ ├── Investor call 14:00 (scheduled) │
  │ └── Review PR #42 (in-review 2d)    │
  ├──────────────────────────────────────┤
  │ SHOULD DO (high leverage)            │
  │ ├── Write marketplace spec (P0)     │
  │ └── Call Tom re: partnership         │
  ├──────────────────────────────────────┤
  │ OPTIONAL (if time remains)           │
  │ ├── Blog post draft                  │
  │ └── Update roadmap                   │
  ├──────────────────────────────────────┤
  │ WASTE DETECTED                       │
  │ ├── "Fix homepage animation" — this  │
  │ │   is a P3 task in a non-focus     │
  │ │   project. Defer or kill.         │
  │ └── "Research CRM tools" — you made │
  │     a CRM decision 45 days ago.     │
  │     This is redundant.              │
  └──────────────────────────────────────┘
```

**How MUST/SHOULD/OPTIONAL is computed:**

MUST DO:
- Tasks with URGENT/CRITICAL priority overdue or due today
- Tasks blocking 2+ other tasks
- Tasks in IN_REVIEW for > 2 days (someone is waiting)
- Calendar events (non-negotiable time commitments)

SHOULD DO:
- Tasks in P0/P1 projects with HIGH priority
- Tasks aligned with quarterly focus
- Tasks assigned to you with upcoming deadlines (48h)

OPTIONAL:
- Everything else that's TODO/IN_PROGRESS assigned to you

WASTE DETECTED:
- Tasks in P3 projects that aren't in quarterly focus
- Tasks that duplicate or contradict a recent Decision
- Tasks with LOW priority that have been TODO for > 14 days (if it's not important enough to do in 2 weeks, it's not important)
- Tasks in projects flagged as KILL candidates

---

## 4. AI OPERATOR MODEL

### 4.1 The Shift: Assistant → Operator

An assistant waits to be asked. An operator observes, intervenes, and runs operations proactively.

```
ASSISTANT:                          OPERATOR:
User: "What should I do today?"     System: "3 critical items today.
AI: "Here are your tasks..."        You're focusing on task X but task Y
                                    has 3x the blocking impact. Switch."

User: "Analyze this project"        System: "Project Z has been declining
AI: "Here's my analysis..."         for 3 weeks. Health: 28. No tasks
                                    completed since Mar 15. Kill it or
                                    assign it. Your call."

User: "Create a task"               System: "You just created a task in
AI: "Task created."                 a DO NOT TOUCH area. This conflicts
                                    with your Q2 focus. Proceed?"
```

### 4.2 AI Modes

The AI Operator has 4 distinct modes. Each mode has a different system prompt, different context assembly, and different output format.

#### MODE 1: ADVISOR (strategic thinking)

```
Trigger: User explicitly asks for strategic analysis
Context: Venture control block + decisions + metrics + AI session history
Personality: Thoughtful, challenging, Socratic
Output: Analysis + counter-arguments + recommendations
Model: Top-tier (Opus)

Example outputs:
"Your north star is GTV but all your P0 tasks are about UX.
 UX improvements drive retention, not acquisition.
 Are you solving the right problem?"

"You decided to focus on sellers first. That was 60 days ago.
 Since then: 12 sellers onboarded, GTV +8%. This is working
 but slower than expected. Consider: what's the bottleneck?
 My analysis suggests onboarding friction, not product gaps."
```

#### MODE 2: OPERATOR (execution guidance)

```
Trigger: Morning briefing / cockpit load / "what's next?"
Context: Daily control block + focus engine output + execution state
Personality: Direct, decisive, no-nonsense
Output: Prioritized actions + time estimates + dependency warnings
Model: Mid-tier (Sonnet)

Example outputs:
"Right now: Deploy v2.1. It's blocking 3 tasks and it's been
 in-review for 2 days. Estimated time: 30 min.
 After that: Write marketplace spec. This is the highest-leverage
 thing you can do today. Deep work. Block 2 hours."

"You've been on task X for 90 minutes but it was estimated at 30.
 Check-in: is this still worth your time? If blocked, mark it and move on."
```

#### MODE 3: AUDITOR (what's wrong)

```
Trigger: Weekly review / manual trigger / system detects anomaly
Context: Full system state across all ventures
Personality: Ruthless, data-driven, uncomfortable truths
Output: Problems ranked by severity + evidence + recommended action
Model: Top-tier (Opus)

Example outputs:
"AUDIT FINDINGS — Week 14:

 1. CRITICAL: Marketplace project health dropped from 72→34 in 2 weeks.
    Root cause: 4 tasks blocked by 'API Design' (assigned to Anna,
    overdue 8 days). Anna's reliability score: 52%. Pattern: this is
    the 3rd time Anna has had blocked tasks > 7 days.
    Recommendation: Reassign or have a direct conversation.

 2. WARNING: You created 12 tasks this week but completed 4.
    Your task creation rate is 3x your completion rate.
    This is a classic founder trap: generating work faster than
    executing it. Consider: stop creating tasks for 48 hours.

 3. WASTE: 8 tasks across 3 ventures have been TODO for > 30 days.
    If they were important, they'd be done. Kill them."
```

#### MODE 4: OPTIMIZER (how to improve the system)

```
Trigger: Monthly / manual trigger
Context: System usage patterns + loop completion rates + AI session quality
Personality: Systems thinker, meta-level
Output: System improvements + workflow suggestions + configuration recommendations
Model: Top-tier (Opus)

Example outputs:
"SYSTEM OPTIMIZATION — March:

 1. You complete 82% of MUST DO items but only 31% of SHOULD DO.
    Your daily planning is too aggressive. Reduce SHOULD DO to 2 items max.

 2. Your best AI sessions (rated 5/5) all use the 'Strategic Analysis'
    prompt with venture context. Your lowest-rated sessions are free-form
    with no context. Recommendation: always start from a prompt.

 3. You haven't logged a Decision in 18 days. You've made at least
    3 significant strategic changes (based on task patterns).
    Your institutional memory is decaying. Log decisions.

 4. Venture C has had 0% attention for 3 weeks despite a 20% allocation.
    Either reallocate or acknowledge this venture is paused."
```

### 4.3 AI Operator Personality Guidelines

```
PERSONALITY CONSTANTS:

1. DIRECT. Never hedge when data supports a conclusion.
   NO: "It might be worth considering whether..."
   YES: "This project is dying. 28 health score, no completions in 21 days."

2. DATA-DRIVEN. Every claim is backed by a metric or pattern.
   NO: "Things seem a bit slow."
   YES: "Task completion velocity dropped 40% week-over-week."

3. CONFRONTATIONAL WHEN NECESSARY. The system doesn't protect the founder's ego.
   NO: "You've been doing great! Here are some suggestions..."
   YES: "You're avoiding the hard tasks. The 3 most impactful items
         have been untouched for 5 days while you completed 8 low-priority tasks."

4. NEVER SYCOPHANTIC. No emojis. No cheerleading. No "great job!"
   Exception: Genuine milestone achievements ("GTV hit $100K. North star achieved.")

5. CONCISE. Every word earns its place.
   Maximum response in Operator mode: 200 words.
   Maximum in Advisor mode: 500 words.
   Auditor: 300 words per finding.

6. ACTIONABLE. Every statement ends with what to do about it.
   NO: "Project health is declining."
   YES: "Project health: 34. Cause: 4 blocked tasks. Unblock 'API Design' first."
```

---

## 5. FOCUS ENGINE V2

### 5.1 Why V1 Focus Score Was Insufficient

V2.5 Focus Score was:
```
priority_weight + overdue_bonus + blocking_bonus + deadline_proximity
```

This is a **task-level** score. It doesn't understand:
- Which venture the founder should be in right now
- Whether the task aligns with quarterly focus
- Whether the task is deep work or shallow work
- Whether the founder has already spent too much time on this venture today
- Whether the task has compounding leverage (doing it enables many things)

### 5.2 Focus Engine V2 — Multi-Dimensional Scoring

The Focus Engine produces a **Focus Stack** — not a flat list, but a prioritized structure:

```
FOCUS STACK (RIGHT NOW):
  ┌─────────────────────────────────────────────────┐
  │ VENTURE: Marketplace (60% allocation)            │
  │                                                  │
  │ #1 Deploy v2.1 hotfix                           │
  │    Score: 94  |  Deep work  |  30min est        │
  │    WHY: Blocks 3 tasks, overdue, P0 project     │
  │                                                  │
  │ #2 Write marketplace spec                        │
  │    Score: 87  |  Deep work  |  2hr est          │
  │    WHY: P0, quarterly focus, high leverage       │
  ├─────────────────────────────────────────────────┤
  │ VENTURE: SaaS Product (30% allocation)           │
  │                                                  │
  │ #3 Review PR #42                                 │
  │    Score: 78  |  Shallow  |  15min est          │
  │    WHY: IN_REVIEW 2 days, blocking Anna         │
  ├─────────────────────────────────────────────────┤
  │ CROSS-VENTURE                                    │
  │                                                  │
  │ #4 Investor call prep                            │
  │    Score: 72  |  Shallow  |  20min est          │
  │    WHY: Calendar event in 3 hours               │
  └─────────────────────────────────────────────────┘
```

### 5.3 Focus Score V2 — Computation

```
FocusScore = (
  BASE_PRIORITY                          // 20-100 from task priority
  × VENTURE_WEIGHT                       // from attention allocation (0.1-1.0)
  × STRATEGIC_ALIGNMENT                  // quarterly focus alignment (0.5-1.5)
  + URGENCY_BONUS                        // time-based bonuses
  + LEVERAGE_BONUS                       // impact multiplier
  - WASTE_PENALTY                        // detected waste reduction
)

BASE_PRIORITY:
  CRITICAL = 100
  URGENT   = 80
  HIGH     = 60
  MEDIUM   = 40
  LOW      = 20

VENTURE_WEIGHT:
  attentionAllocation / 100
  (60% allocation → 0.6 weight)
  (minimum: 0.1 — even deprioritized ventures don't go to zero)

STRATEGIC_ALIGNMENT:
  Task in quarterly focus area → 1.5x
  Task in active project, not focus → 1.0x
  Task in DO NOT TOUCH area → 0.5x
  Task in KILL candidate project → 0.3x

URGENCY_BONUS:
  Overdue CRITICAL/URGENT → +40
  Overdue HIGH → +25
  Due today → +20
  Due within 48h → +10
  IN_REVIEW > 2 days → +15
  No deadline → +0

LEVERAGE_BONUS:
  Blocks 3+ other tasks → +30
  Blocks 1-2 other tasks → +15
  Is a Decision blocker (someone waiting for your call) → +25
  Enables a SCALE signal project → +20
  Quick win (estimated < 30 min, removes a blocker) → +10

WASTE_PENALTY:
  In P3 project outside quarterly focus → -20
  TODO for > 14 days with no deadline → -15
  Duplicates a recent Decision → -30
  In KILL candidate project → -25
```

### 5.4 Energy Alignment

Not all work is equal cognitively. Deep work (writing, strategy, complex code) requires different energy than shallow work (reviews, calls, quick approvals).

The Focus Engine tags each task as:

```
DEEP WORK:
  - Writing (specs, strategy docs, analysis)
  - Complex problem-solving
  - AI sessions (strategy/analysis)
  - Creating something new

SHALLOW WORK:
  - Reviews (PR reviews, document reviews)
  - Communications (calls, messages)
  - Approvals and status changes
  - Quick admin tasks

DECISION WORK:
  - Approve/reject AI outputs
  - Project evaluation
  - Kill/continue decisions
  - People decisions
```

The Focus Stack groups tasks by energy type. The system can say:
"You have a 2-hour deep work block before your 2pm call. Here's what to do with it: [deep work task]."
"You have 15 minutes between calls. Quick wins: [shallow tasks]."

### 5.5 Focus Override

Sometimes the system knows better than the founder. Focus Override is a strong signal:

```
FOCUS OVERRIDE TRIGGER:
  A task with FocusScore > 90 has been untouched for > 24 hours
  while the founder has been completing tasks with FocusScore < 50.

SYSTEM RESPONSE:
  "FOCUS OVERRIDE: Task 'Deploy v2.1' (score: 94) has been ignored
   for 26 hours. You've completed 4 lower-priority tasks since then.
   This task is blocking 3 others. Prioritize it NOW or tell me why."

USER OPTIONS:
  [Do it now] → Task moves to #1 in Focus Stack
  [Defer with reason] → User explains, system respects for 24h
  [Reassign] → Assign to someone else
  [Kill] → Remove the task entirely
```

---

## 6. SIGNAL ENGINE

### 6.1 What the Signal Engine IS

The Signal Engine is the **system's nervous system**. It continuously monitors the state of everything and produces ranked, categorized signals that tell the founder what's actually happening across their operation.

Signals are not notifications. Notifications are events ("John commented on task X"). Signals are intelligence ("Project X is dying and nobody is doing anything about it").

### 6.2 Signal Categories

#### FIRES (immediate action required)

```
FIRE signals (red, top of cockpit):

1. CASCADING_BLOCK
   "Task A → blocked by Task B → blocked by Task C (unassigned).
    Impact: 4 tasks frozen. Root cause: Task C needs an owner."
   Severity: CRITICAL
   Trigger: blocker chain with ≥ 3 tasks

2. CRITICAL_OVERDUE
   "Task 'Deploy hotfix' is 48h overdue. Priority: CRITICAL.
    Project: Marketplace (P0). This is in your quarterly focus."
   Severity: CRITICAL
   Trigger: CRITICAL/URGENT task overdue > 24h in P0/P1 project

3. DECISION_STALL
   "AI output 'Payment Strategy Analysis' has been waiting for
    your decision for 72 hours. 2 tasks are blocked pending this decision."
   Severity: HIGH
   Trigger: AI Session in ACTIVE status > 48h with linked pending actions

4. VELOCITY_COLLAPSE
   "Venture 'Marketplace' completed 0 tasks this week (was 8/week avg).
    Something is wrong."
   Severity: HIGH
   Trigger: weekly completion rate < 20% of 4-week average
```

#### RISKS (attention needed soon)

```
RISK signals (amber):

1. SLIPPING_DEADLINE
   "Project 'Mobile App v2' target date is in 12 days.
    32% of tasks are still TODO. At current velocity, ETA is +21 days."
   Trigger: projected completion > target date by > 50%

2. SILENT_PROJECT
   "Project 'API Redesign' has had no activity for 14 days.
    Health: 41. Last action: Mar 20."
   Trigger: no activity > threshold (7 days for P0/P1, 14 days for P2/P3)

3. PERSON_PATTERN
   "Anna has 5 overdue tasks across 2 projects.
    Reliability score: 48% (was 72% last month). Trending down."
   Trigger: person reliability drop > 20 points in 30 days

4. DECISION_DRIFT
   "You decided to focus on sellers first (45 days ago).
    But 60% of this week's tasks are buyer-focused.
    You're drifting from your strategic direction."
   Trigger: task patterns contradict declared quarterly focus

5. ATTENTION_MISMATCH
   "Venture 'SaaS Product' is allocated 30% attention but received
    65% of your task completions this week. Marketplace (60% allocated)
    received only 20%."
   Trigger: actual attention deviates > 25% from declared allocation
```

#### WASTE (eliminate or defer)

```
WASTE signals (gray):

1. ZOMBIE_TASKS
   "8 tasks have been TODO for > 30 days with no deadline.
    They are dead. Kill them or schedule them."
   Trigger: TODO status > 30 days, no due date, no blocker

2. MISALIGNED_EFFORT
   "You spent 6 hours this week on 'Homepage redesign' (P3, not in focus).
    Same week: 0 hours on 'Payment infrastructure' (P0, quarterly focus)."
   Trigger: time spent on non-focus items > time on focus items

3. DUPLICATE_WORK
   "Task 'Research payment providers' conflicts with Decision made 45 days ago:
    'Use Stripe for all payment processing.' This task is redundant."
   Trigger: task semantically overlaps with a finalized Decision

4. OVER_CREATION
   "You created 15 tasks this week, completed 4. Your backlog grew by 11.
    You're generating work faster than executing it."
   Trigger: creation/completion ratio > 3:1 for > 2 consecutive weeks
```

#### OPPORTUNITIES (high leverage moves available)

```
OPPORTUNITY signals (green):

1. QUICK_WINS
   "3 tasks can be completed in < 30 min and would unblock other work:
    - Review PR #42 (15 min, unblocks Anna)
    - Approve design mockup (10 min, unblocks designer)
    - Send contract to Tom (5 min, unblocks partnership deal)"
   Trigger: estimated < 30 min + blocks something + shallow work

2. MOMENTUM_WINDOW
   "Venture 'Marketplace' completed 12 tasks this week (best in 30 days).
    This is a momentum window. Double down. Consider canceling non-essential
    meetings tomorrow to sustain this."
   Trigger: completion velocity > 150% of 4-week average

3. DECISION_COMPOUND
   "You have 3 pending AI analyses that could inform each other:
    - Market sizing
    - Competitor analysis
    - Pricing strategy
    Consider a combined strategy session."
   Trigger: multiple pending AI sessions in same venture/project scope

4. SCALE_READY
   "Project 'Seller Onboarding' hit all milestones. Health: 92.
    Revenue correlation: GTV +24% since launch. This is working.
    Consider scaling: add resources, expand scope."
   Trigger: project health > 85 for 2+ weeks + positive metric correlation
```

### 6.3 Signal Ranking

All signals are scored and ranked:

```
Signal Priority = Severity × Recency × Impact

Severity:
  CRITICAL = 100
  HIGH = 75
  MEDIUM = 50
  LOW = 25

Recency:
  New (< 1h) = 1.5x
  Recent (< 24h) = 1.0x
  Aging (> 24h) = 0.8x
  Old (> 72h, still unresolved) = 1.2x (escalation)

Impact:
  Affects P0 venture = 1.5x
  Blocks multiple entities = 1.3x
  Affects quarterly focus = 1.2x
  Isolated impact = 1.0x
```

The cockpit shows signals in this ranked order. Top signal is always the most important thing the founder should know.

### 6.4 Signal Acknowledgment

Signals don't disappear until resolved or acknowledged:

```
ACKNOWLEDGE OPTIONS:
  [Resolve] → Signal condition fixed, signal removed
  [Defer 24h] → Signal hidden for 24h, returns if still relevant
  [Dismiss] → Signal permanently dismissed (logged in history)
  [Act] → Opens the relevant entity/action
```

Dismissed signals are tracked. If the founder dismisses the same type of signal repeatedly, the Optimizer mode notes: "You've dismissed 5 'zombie task' signals this month. Consider a bulk cleanup."

---

## 7. SYSTEM LOOPS

### 7.1 Why Loops Matter

A static system shows state. A looping system drives behavior. Loops create rhythm — they turn the system from a dashboard into an operating cadence.

### 7.2 DAILY LOOP

```
┌─────────── MORNING BRIEFING (08:00) ───────────┐
│                                                  │
│  AI OPERATOR (Operator mode) generates:          │
│                                                  │
│  1. YESTERDAY RECAP                              │
│     - Completed: 5 tasks                         │
│     - Missed: 2 MUST DO items → carried forward  │
│     - Decisions made: 1                          │
│     - Captures processed: 4                      │
│                                                  │
│  2. TODAY'S CONTROL BLOCK                        │
│     - MUST DO (3 items)                          │
│     - SHOULD DO (2 items)                        │
│     - WASTE DETECTED (1 item)                    │
│                                                  │
│  3. SIGNALS OVERNIGHT                            │
│     - 1 new FIRE (task blocked cascade)          │
│     - 1 RISK (project going silent)              │
│     - 2 OPPORTUNITIES (quick wins)               │
│                                                  │
│  4. AI INSIGHT                                   │
│     "You've been neglecting Marketplace for 3    │
│      days. Your declared allocation is 60%.      │
│      Today's SHOULD DO is weighted toward it."   │
│                                                  │
│  DELIVERY: Push notification + cockpit + email   │
│  (user configures preferred channel)             │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────── EXECUTION PHASE (all day) ───────────┐
│                                                  │
│  Focus Stack guides work order.                  │
│  Each task completion triggers:                  │
│    - Focus Stack recomputation                   │
│    - "What's next" suggestion                    │
│    - Blocker chain check (did this unblock?)     │
│                                                  │
│  Mid-day check-in (optional, 13:00):             │
│    "You've completed 2/3 MUST DOs. On track.     │
│     Remaining: 'Write spec' (2hr deep work).     │
│     You have a clear block from 14:00-16:00."    │
│                                                  │
└──────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────── END OF DAY REFLECTION (18:00) ────────┐
│                                                   │
│  AI OPERATOR generates:                           │
│                                                   │
│  1. COMPLETION REPORT                             │
│     - MUST DO: 3/3 ✓                             │
│     - SHOULD DO: 1/2                             │
│     - Unplanned work: 2 tasks (were they worth?) │
│                                                   │
│  2. TOMORROW PREVIEW                              │
│     - Preliminary MUST DO for tomorrow            │
│     - Deadlines approaching                       │
│     - Meetings scheduled                          │
│                                                   │
│  3. PATTERN NOTE                                  │
│     "You completed 5 shallow tasks and 0 deep     │
│      work today. This is the 3rd day this week.   │
│      Your quarterly goals require deep work.      │
│      Tomorrow: block 2 hours for the spec."       │
│                                                   │
│  DELIVERY: Push notification or quiet summary     │
│  (user configures — some founders prefer no EOD)  │
└───────────────────────────────────────────────────┘
```

### 7.3 WEEKLY LOOP

```
┌─────────── WEEKLY REVIEW (Sunday or Monday) ─────┐
│                                                    │
│  AI OPERATOR (Auditor mode) generates:             │
│                                                    │
│  1. EXECUTION SCORECARD                            │
│     - Tasks created: 18 | Completed: 11 | Ratio: 0.6│
│     - MUST DO completion rate: 78%                 │
│     - Avg focus score of completed tasks: 67       │
│     - Avg focus score of ignored tasks: 43         │
│     - Verdict: "Good task selection. Executing     │
│       high-value work. Backlog growing slowly."    │
│                                                    │
│  2. VENTURE HEALTH DASHBOARD                       │
│     Marketplace: 72 (+5) ▲  On track              │
│     SaaS Product: 58 (-12) ▼  Declining            │
│     Side Project: 34 (-8) ▼  Consider killing      │
│                                                    │
│  3. PEOPLE ACCOUNTABILITY                          │
│     Anna: 6 completed, 2 overdue. Score: 75%      │
│     Tom: 3 completed, 0 overdue. Score: 100%      │
│     Client: No tasks completed. Unresponsive?      │
│                                                    │
│  4. DECISION LOG REVIEW                            │
│     - 2 decisions made this week                   │
│     - 1 decision pending review (from 90 days ago) │
│     - AI detected: 3 implicit decisions not logged │
│                                                    │
│  5. REPRIORITIZATION SUGGESTIONS                   │
│     "Move 'API Redesign' from P1 → P2.            │
│      Reason: not blocking anything, not in         │
│      quarterly focus, team bandwidth is full."     │
│                                                    │
│  6. NEXT WEEK OUTLOOK                              │
│     "3 deadlines approaching. 1 investor meeting.  │
│      Recommended: heavy Marketplace focus Mon-Wed, │
│      SaaS Product Thu-Fri."                        │
│                                                    │
│  USER ACTIONS AFTER WEEKLY:                        │
│  - Reprioritize projects (drag-and-drop P0-P3)    │
│  - Kill zombie tasks (bulk select)                 │
│  - Adjust venture attention allocation             │
│  - Process pending decisions                       │
└────────────────────────────────────────────────────┘
```

### 7.4 STRATEGIC LOOP

```
┌─────────── STRATEGIC REVIEW (Monthly) ───────────┐
│                                                    │
│  AI OPERATOR (Advisor mode) generates:             │
│                                                    │
│  1. VENTURE TRAJECTORY                             │
│     For each venture:                              │
│     - North star metric trend (30/60/90 day)       │
│     - Correlation: effort → metric movement        │
│     - "Marketplace: high effort, moderate metric   │
│       response. ROI on effort is declining.        │
│       Possible cause: product-market fit plateau." │
│                                                    │
│  2. STRATEGIC DIRECTION CHECK                      │
│     - "Your declared direction: 'Land 50 sellers'  │
│       Current: 28 sellers. Pace: 4/week.           │
│       At this pace: 50 sellers in 5.5 weeks.       │
│       Verdict: On track but tight."                │
│                                                    │
│  3. QUARTERLY FOCUS ALIGNMENT                      │
│     - Focus area 1: 72% of effort aligned ✓       │
│     - Focus area 2: 45% of effort aligned ⚠       │
│     - Focus area 3 (DO NOT TOUCH): 12% violation  │
│                                                    │
│  4. DECISION QUALITY REVIEW                        │
│     All decisions made this quarter:               │
│     - Decided: 12                                  │
│     - With outcome tracked: 8                      │
│     - Positive outcome: 6 (75%)                    │
│     - Reversed: 1                                  │
│     - "Your decision quality is strong in product  │
│       (83% positive) but weak in people (50%).     │
│       Consider: spend more time on people          │
│       decisions."                                  │
│                                                    │
│  5. SYSTEM USAGE PATTERNS                          │
│     - Daily loop completion rate: 68%              │
│     - Weekly review completion rate: 75%           │
│     - AI session average rating: 4.1               │
│     - "You skip the EOD reflection 60% of days.   │
│       Founders who complete it have 23% higher     │
│       MUST DO completion rates (from your data)."  │
│                                                    │
│  6. NEXT QUARTER PROMPT                            │
│     "It's time to set Q3 priorities.               │
│      Based on your trajectory and venture health:  │
│      - Marketplace should remain 60% attention     │
│      - SaaS Product needs a decision: invest or    │
│        put in maintenance mode                     │
│      - Side Project: data suggests killing it.     │
│        No metric movement in 8 weeks."             │
│                                                    │
│  USER ACTIONS AFTER STRATEGIC:                     │
│  - Set next quarter focus areas                    │
│  - Update north star metrics/targets               │
│  - Adjust venture attention allocation             │
│  - Kill or revive ventures                         │
│  - Review and set Decision review dates            │
└────────────────────────────────────────────────────┘
```

---

## 8. INPUT / INTEGRATION SYSTEM

### 8.1 The Chaos Problem

A founder's reality:
- Idea at 6am in the shower → needs to be captured
- Telegram message from partner at 9am → contains 3 action items
- Claude chat at 11am → produced a strategy analysis → needs to be stored
- WhatsApp voice message at 2pm → "call me about the contract"
- Email at 4pm → investor follow-up with attached term sheet
- Voice note while driving at 6pm → "we should pivot the pricing model"

All of this is SIGNAL. None of it is structured. Today, it lives in 6 different apps and the founder's brain. Tomorrow, it lives in the Capture Engine.

### 8.2 Integration Architecture

```
┌─────────────────────────────────────────────────┐
│                CAPTURE ENGINE                    │
│                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│  │ Quick     │ │ Voice     │ │ Paste from    │ │
│  │ Capture   │ │ Capture   │ │ AI (Claude/   │ │
│  │ (text)    │ │ (mic)     │ │ ChatGPT)      │ │
│  └─────┬─────┘ └─────┬─────┘ └───────┬───────┘ │
│        │              │               │          │
│  ┌─────┴─────┐ ┌─────┴─────┐ ┌──────┴────────┐ │
│  │ Telegram  │ │ WhatsApp  │ │ Email         │ │
│  │ Bot       │ │ Bot       │ │ Forward       │ │
│  │ @blo_bot  │ │ +1-xxx    │ │ c@blo.app     │ │
│  └─────┬─────┘ └─────┬─────┘ └──────┬────────┘ │
│        │              │               │          │
│        ▼              ▼               ▼          │
│  ┌──────────────────────────────────────────┐   │
│  │            NORMALIZE + CLASSIFY           │   │
│  │         (AI Orchestration Layer)          │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                            │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │            CAPTURE INBOX                  │   │
│  │         or AUTO-ROUTE (high confidence)   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 8.3 Telegram Bot Behavior

The founder texts the BLO Telegram bot like a human:

```
Founder: "Call Tom about Stripe contract by Friday"
Bot: "✓ Captured. I classified this as a Task (confidence: 94%).
     → Project: Marketplace (Payment Infrastructure)
     → Due: Friday Apr 4
     → Assigned: You
     [Confirm] [Edit] [Dismiss]"

Founder: "We should do enterprise pricing for the marketplace.
         Higher margin, fewer customers to support."
Bot: "✓ Captured. This looks like a Decision or AI input.
     → Venture: Marketplace
     → Type: Strategic direction
     [Log as Decision] [Start AI Session] [Save as Note] [Dismiss]"

Founder: *sends voice message*
Bot: "✓ Transcribing... Done.
     'Remember to follow up with the investor about the term sheet
      and schedule a call with the legal team about clause 4.2.'

     I found 2 action items:
     1. Task: Follow up with investor about term sheet
     2. Task: Schedule call with legal team re: clause 4.2
     [Accept both] [Edit] [Dismiss]"
```

### 8.4 AI Output Capture

When the founder pastes output from an external Claude or ChatGPT session:

```
Detection: paste event in capture bar with > 200 characters
           AND contains patterns like bullet points, analysis structure,
           or code blocks

System: "This looks like an AI output.
        → Store as AI Session?
        → Link to: [Venture picker] [Project picker]
        → Extract tasks from content?
        [Save as AI Session] [Save as Note] [Just Capture]"
```

### 8.5 Email Integration

Forward any email to `capture@[workspace].businesslifeos.app`:

```
System parses:
  - Subject line → title
  - Body → content
  - Attachments → artifacts (stored in R2)
  - From/To → person matching

Classification:
  - Invoice/receipt → artifact (auto-linked to venture if recognizable)
  - Action request → task
  - FYI/update → note
  - Contract/document → artifact + decision prompt
```

---

## 9. UX: COMMAND CENTER

### 9.1 Design Philosophy

This is not an app. It's a **command center**. The UX should feel like:
- The calm precision of a Bloomberg Terminal (information density, zero decoration)
- The clarity of Stripe Dashboard (every number matters, nothing is filler)
- The speed of Superhuman (keyboard-first, instant response, zero loading states)
- The power of a military COP (common operating picture — see everything at once)

```
DESIGN PRINCIPLES:
  1. INFORMATION DENSITY > whitespace
  2. MONOCHROME + accent color (no rainbow UI)
  3. TEXT > icons (words are faster to parse than symbols)
  4. KEYBOARD FIRST (every action has a shortcut)
  5. ZERO LOADING STATES (optimistic updates, streaming)
  6. ONE GLANCE = FULL PICTURE (no scrolling for critical info)
```

### 9.2 Color System

```
BASE: Dark background (#0A0A0B) — the default. Eyes don't tire.
TEXT: Off-white (#E8E8ED) — primary text
SECONDARY: Medium gray (#6B6B76) — labels, metadata
SURFACE: Slightly lighter (#141417) — cards, panels
BORDER: Subtle (#1E1E24) — separation without distraction

ACCENT (venture-specific):
  Venture 1: Blue (#3B82F6)
  Venture 2: Emerald (#10B981)
  Venture 3: Amber (#F59E0B)
  (User-configurable per venture)

SIGNAL COLORS:
  Fire: Red (#EF4444)
  Risk: Amber (#F59E0B)
  Opportunity: Green (#22C55E)
  Waste: Gray (#6B7280)
  AI: Purple (#8B5CF6)

LIGHT MODE: Available but not default.
  Founders working at night (most of them) need dark mode.
```

### 9.3 Command Center Layout — Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐  BUSINESS LIFE OS   [Marketplace ▾]  ⌘K  [■ ■ ▪]  K.N │
│ │ LOGO │                      venture switcher  search  avatar   │
├──┼──────┼────────────────────────────────────────────────────────┤
│  │      │                                                        │
│  │ CMD  │  ┌─── FOCUS STACK ──────────────────────────────────┐  │
│  │      │  │                                                   │  │
│  │ ▸ ⌂  │  │  #1  Deploy v2.1 hotfix          30m   ● CRIT   │  │
│  │ ▸ ☐  │  │      Marketplace / Mobile App     blocks 3       │  │
│  │ ▸ ◈  │  │                                                   │  │
│  │ ▸ ⚡ │  │  #2  Write marketplace spec        2h    ● HIGH   │  │
│  │ ▸ ✦  │  │      Marketplace / Core            Q2 focus      │  │
│  │ ▸ ◎  │  │                                                   │  │
│  │ ▸ ⊕  │  │  #3  Review PR #42                 15m   ● MED   │  │
│  │      │  │      SaaS / Frontend                blocks Anna  │  │
│  │ ───  │  │                                                   │  │
│  │ V1 ● │  └───────────────────────────────────────────────────┘  │
│  │ V2 ● │                                                        │
│  │ V3 ● │  ┌─── SIGNALS ────────────┐ ┌─── AI OPERATOR ───────┐ │
│  │      │  │                         │ │                        │ │
│  │      │  │  🔴 Cascading block     │ │  "Marketplace got 20%  │ │
│  │      │  │  Task C unassigned.     │ │   of your attention    │ │
│  │      │  │  Impact: 4 tasks.       │ │   this week. Declared: │ │
│  │      │  │  [Assign] [View chain]  │ │   60%. You're drifting.│ │
│  │      │  │                         │ │   Refocus today."      │ │
│  │      │  │  🟡 SaaS Product silent │ │                        │ │
│  │      │  │  14 days. Health: 41.   │ │  [Run Advisor session] │ │
│  │      │  │  [View] [Defer]         │ │  [Show daily plan]     │ │
│  │      │  │                         │ │                        │ │
│  │      │  │  🟢 3 quick wins avail  │ │                        │ │
│  │      │  │  ~45 min total.         │ │                        │ │
│  │      │  │  [View] [Do first one]  │ │                        │ │
│  │      │  │                         │ │                        │ │
│  │      │  └─────────────────────────┘ └────────────────────────┘ │
│  │      │                                                        │
│  │      │  ┌─── VENTURES ──────────────────────────────────────┐ │
│  │      │  │  Marketplace    72 ▲  │ SaaS Product  58 ▼       │ │
│  │      │  │  ████████░░     +5   │ ██████░░░░    -12        │ │
│  │      │  │  GTV: $42K → $100K   │ MRR: $8K → $20K          │ │
│  │      │  │                       │                           │ │
│  │      │  │  Side Project   34 ▼  │                           │ │
│  │      │  │  ███░░░░░░░     -8   │  SYSTEM SUGGESTS:         │ │
│  │      │  │  [KILL CANDIDATE]     │  "Kill Side Project?"     │ │
│  │      │  └───────────────────────────────────────────────────┘ │
│  │      │                                                        │
│  ├──────┤  ┌─── CAPTURE ─────────────────────────────────────────┤
│  │      │  │  Type to capture... (or ⌘J for voice)     3 inbox  │
│  └──────┘  └────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────┘

SIDEBAR (CMD):
  ⌂  = Command Center (home)
  ☐  = Tasks (full list)
  ◈  = Projects
  ⚡ = AI Sessions
  ✦  = Decisions
  ◎  = People
  ⊕  = Capture Inbox
  --- separator ---
  V1, V2, V3 = Ventures (with health dot color)
```

### 9.4 Command Center Layout — Mobile (iPhone)

```
┌─────────────────────────────────┐
│  BLO  [Marketplace ▾]    K     │
├─────────────────────────────────┤
│                                  │
│  FOCUS                           │
│  ┌───────────────────────────┐  │
│  │ #1 Deploy v2.1 hotfix     │  │
│  │    30m • CRIT • blocks 3  │  │
│  │    [Start] ──────────────→│  │
│  ├───────────────────────────┤  │
│  │ #2 Write marketplace spec │  │
│  │    2h • HIGH • Q2 focus   │  │
│  ├───────────────────────────┤  │
│  │ #3 Review PR #42          │  │
│  │    15m • MED • blocks Ann │  │
│  └───────────────────────────┘  │
│                                  │
│  SIGNALS (2 fires, 1 opp)       │
│  ┌───────────────────────────┐  │
│  │ 🔴 4 tasks frozen.        │  │
│  │    Root: Task C unassigned│  │
│  │    [Assign] [View]        │  │
│  ├───────────────────────────┤  │
│  │ 🟢 3 quick wins, 45 min  │  │
│  │    [Start first]          │  │
│  └───────────────────────────┘  │
│                                  │
│  AI                              │
│  ┌───────────────────────────┐  │
│  │ "You're drifting from     │  │
│  │  Marketplace. Refocus."   │  │
│  └───────────────────────────┘  │
│                                  │
│  VENTURES                        │
│  Marketplace 72▲ SaaS 58▼ Side 34▼│
│                                  │
├─────────────────────────────────┤
│ [⌂] [☐] [+capture] [⚡] [≡]   │
└─────────────────────────────────┘
```

### 9.5 Keyboard System (Desktop)

```
GLOBAL:
  ⌘K          → Command palette (search everything)
  ⌘J          → Voice capture
  ⌘Enter      → Quick text capture
  ⌘1-5        → Switch to venture 1-5
  ⌘⇧1-5      → Quick navigate: 1=Home 2=Tasks 3=Projects 4=AI 5=Decisions

NAVIGATION:
  j/k         → Move up/down in any list
  Enter       → Open selected item
  Escape      → Back / close
  h           → Go home (command center)
  g then t    → Go to tasks
  g then p    → Go to projects
  g then a    → Go to AI sessions
  g then d    → Go to decisions
  g then c    → Go to capture inbox

TASK ACTIONS:
  1-7         → Set status (1=PLANNED 2=TODO 3=IN_PROGRESS 4=BLOCKED 5=WAITING 6=IN_REVIEW 7=DONE)
  p then 1-5  → Set priority (1=LOW ... 5=CRITICAL)
  a           → Assign
  d           → Set due date
  x           → Quick complete (DONE)
  Space       → Toggle expand/collapse

AI:
  n           → New AI session
  ⌘⇧A        → Ask AI about current item
  Tab         → Accept AI suggestion
  ⇧Tab        → Reject AI suggestion
```

---

## 10. POWER FEATURES

### 10.1 Kill Suggestion

When the Signal Engine detects a dying project, the system doesn't just flag it — it presents a **Kill Case**:

```
┌─────────────────────────────────────────┐
│  KILL SUGGESTION                         │
│                                          │
│  Project: Side Project (API Tools)       │
│  Health: 34 (was 67 eight weeks ago)     │
│  Trajectory: ▼▼▼ declining consistently  │
│                                          │
│  EVIDENCE:                               │
│  • 0 tasks completed in 21 days          │
│  • 4 tasks overdue, 2 unassigned         │
│  • No contribution to north star metric  │
│  • 0% attention last 3 weeks             │
│  • Not in quarterly focus                │
│                                          │
│  COST OF KEEPING ALIVE:                  │
│  • 4 overdue tasks creating guilt/noise  │
│  • Clutters signal engine                │
│  • Diverts attention from focus areas    │
│                                          │
│  [Kill Project] [Pause 30 days] [Revive] │
└─────────────────────────────────────────┘
```

Kill = archive project, cancel all tasks, log decision with rationale.
Pause = set status to PAUSED, hide from signals for 30 days, auto-resurface.
Revive = dismiss suggestion, system checks again in 14 days.

### 10.2 Execution Velocity Tracking

The system tracks completion velocity per venture, per project, per person:

```
VELOCITY DASHBOARD:
  ┌────────────────────────────────────────┐
  │  MARKETPLACE                           │
  │  ▁▂▃▅▇▆▇█▇▅                          │
  │  Tasks/week: 8 avg (trend: stable)     │
  │  Peak: Week 12 (12 tasks)              │
  │  Trough: Week 9 (3 tasks — what broke?)│
  │                                        │
  │  COMPLETION RATE:                      │
  │  MUST DO: 82%  SHOULD: 45%  OPT: 12%  │
  │                                        │
  │  VELOCITY DIAGNOSIS:                   │
  │  "Steady execution on critical items.  │
  │   Low SHOULD DO rate suggests your     │
  │   daily plan is overloaded. Reduce."   │
  └────────────────────────────────────────┘
```

### 10.3 Decision Quality Scoring

Decisions are tracked from inception to outcome:

```
DECISION QUALITY (Q1 2026):
  Decisions made: 18
  Outcomes tracked: 14 (78%)
  Positive outcomes: 11 (79%)
  Reversed: 2

  BY CATEGORY:
  Product: 83% positive (10/12)
  People:  50% positive (2/4)
  Finance: 100% positive (2/2)

  AI INSIGHT:
  "Your product instincts are strong. Your people decisions are
   a coin flip. Consider: spend more time on people decisions.
   Use Advisor mode to stress-test before deciding."
```

### 10.4 Founder Drift Detection

The system continuously compares declared intent vs actual behavior:

```
DRIFT DETECTION — Week 14:

  DECLARED: Marketplace gets 60% attention
  ACTUAL:   Marketplace got 23% of task completions

  DECLARED: Q2 Focus includes "Payment Infrastructure"
  ACTUAL:   0 tasks completed in Payment Infrastructure this week

  DECLARED: "DO NOT TOUCH" — Marketing
  ACTUAL:   3 marketing tasks created this week

  SEVERITY: HIGH DRIFT

  AI SAYS: "You declared Marketplace as your primary focus but
   you're executing like SaaS Product is primary. Either:
   1. Update your declarations to match reality, or
   2. Redirect your execution to match your declarations.
   Which is it?"

  [Update declarations] [Redirect execution] [I know, give me a week]
```

### 10.5 Context Bomb

When the founder opens any entity, the system can generate a **Context Bomb** — a complete summary of everything the system knows about that entity, assembled in one view:

```
CONTEXT BOMB: Project "Mobile App v2"
  ┌────────────────────────────────────────────┐
  │ HEALTH: 62 (yellow)                        │
  │ STRATEGIC RELEVANCE: HIGH (P1, Q2 focus)   │
  │ VENTURE: Marketplace (60% allocation)      │
  │                                            │
  │ TASKS: 24 total                            │
  │   DONE: 14 | IN_PROGRESS: 4 | TODO: 3     │
  │   BLOCKED: 2 | WAITING: 1                 │
  │                                            │
  │ BLOCKERS:                                  │
  │   "API Design" → blocks "Frontend" +       │
  │   "Testing". Assigned: Anna. Overdue 5d.   │
  │                                            │
  │ RECENT DECISIONS:                          │
  │   "Use Stripe" (45d ago, positive outcome) │
  │   "Launch soft beta first" (30d ago)       │
  │                                            │
  │ AI SESSIONS (3 recent):                    │
  │   "Payment Strategy" — accepted, 3 tasks   │
  │   "Competitor Analysis" — archived          │
  │   "Launch Checklist" — pending review      │
  │                                            │
  │ PEOPLE:                                    │
  │   Anna (dev) — reliability: 52% ⚠         │
  │   Tom (design) — reliability: 88% ✓       │
  │   You — 4 active tasks in this project     │
  │                                            │
  │ TIMELINE:                                  │
  │   Started: Feb 1 | Target: Apr 30          │
  │   At current velocity: May 21 (+21 days)   │
  │                                            │
  │ AI ASSESSMENT:                             │
  │   "This project is at risk due to the API  │
  │    Design blocker. Anna's reliability is    │
  │    trending down. Unblock or reassign.     │
  │    Timeline will slip without intervention."│
  └────────────────────────────────────────────┘
```

### 10.6 Phantom Task Detection

The system identifies tasks that exist but will never be done:

```
PHANTOM TASKS (12 detected):

These tasks have been in the system > 30 days without progress.
At your current completion rate, they will never be reached.

They are generating noise in your signal engine and inflating
your backlog. Each one is a micro-guilt source.

  "Research alternative hosting" — 45 days, LOW priority
  "Write documentation for API" — 38 days, MEDIUM priority
  "Add dark mode toggle" — 34 days, LOW priority
  ... (9 more)

  [Kill all 12] [Review individually] [Defer 30 days]
```

### 10.7 Energy Budget

The system tracks the founder's estimated capacity and warns when overloaded:

```
TODAY'S ENERGY BUDGET:
  Available hours: ~8h (typical day)
  Calendar commitments: 2h (investor call, team standup)
  Remaining: ~6h

  MUST DO tasks: estimated 3.5h
  SHOULD DO tasks: estimated 4h
  TOTAL DEMAND: 7.5h

  ⚠ OVERLOADED by ~1.5 hours.
  Recommendation: drop 1 SHOULD DO item.
  Suggested drop: "Blog post draft" (lowest focus score, no deadline)

  [Accept suggestion] [I'll manage] [Reschedule items]
```

---

## 11. RISKS

### Risk 1: System Becomes Annoying — CRITICAL

**Problem:** A system that constantly tells you "you're drifting" and "kill this project" and "you're overloaded" will be turned off. The line between useful confrontation and nagging is thin.

**Mitigation:**
- Signal fatigue controls. Max 3 FIRE signals at once. Max 5 total signals. Overflow goes to a "View all" page.
- Acknowledgment memory. If the founder dismisses a signal, the system doesn't re-raise it for at least 24h (FIRE) or 7d (RISK/WASTE).
- Tone calibration. The system is direct but not aggressive. It says "consider killing" not "you must kill." It says "you're drifting" not "you failed."
- User controls. Every signal category can be toggled. Every loop can be disabled. The founder stays in control.
- Progressive intensity. First mention is neutral. If ignored for 7 days, tone becomes more direct. If ignored for 14 days, it escalates once more. After that, it stops and logs a "founder ignored X signal 3 times."

### Risk 2: Computation Complexity — HIGH

**Problem:** Focus Score V2, Signal Engine, velocity tracking, drift detection — all computed in real-time across all ventures. This could be expensive.

**Mitigation:**
- Cache everything. Focus scores are cached per task, invalidated on state change. Signals are computed once per cockpit load, cached for 5 minutes.
- Background pre-computation. Weekly and strategic loop computations run asynchronously (background job or on-demand with caching). They don't block page loads.
- Incremental computation. When a task status changes, only recompute affected focus scores (same project), not all tasks.
- No real-time computation for velocity/drift. These are computed on weekly loop trigger only.

### Risk 3: Too Much for Solo Founder — HIGH

**Problem:** This system is designed for a high-performance operator. A founder in the early chaos phase (pre-product-market-fit, solo, wearing all hats) might find the structure oppressive.

**Mitigation:**
- Progressive onboarding. Start with: 1 venture, simple cockpit, no loops. As usage grows, the system suggests: "You have enough data to enable weekly reviews. Turn on?"
- Minimal viable system. The system works with ZERO control layer configuration. Focus Score falls back to simple priority. Signals fall back to basic staleness. Loops are optional.
- Complexity budget. The system never shows more than it needs to. If there's 1 venture and 2 projects, the cockpit is simple. Complexity scales with actual complexity.

### Risk 4: Data Quality Dependency — HIGH

**Problem:** The entire intelligence layer depends on data quality. If the founder doesn't update task statuses, doesn't log decisions, doesn't rate AI sessions — the system has nothing to work with.

**Mitigation:**
- Make the RIGHT actions the EASIEST actions. Status change = one swipe. Decision logging = one tap from AI session. Task completion = one keyboard press.
- Gentle nudges (not nagging). "You have 3 tasks marked IN_PROGRESS. Are they all actually being worked on? Quick update?" — shown once per week, not daily.
- AI fills gaps where possible. If a task has been IN_PROGRESS for 14 days with no activity, the system infers it's probably BLOCKED or abandoned, and flags it as a signal rather than waiting for manual update.
- Degrade gracefully. Missing data = less intelligence, not system failure. If no decisions are logged, decision quality scoring simply doesn't appear.

### Risk 5: AI Cost in Loops — MEDIUM

**Problem:** Morning briefing, mid-day check-in, EOD reflection, weekly review, monthly strategic — each potentially calls AI. For an active founder, this could be 10+ AI calls per day.

**Mitigation:**
- Morning briefing is MOSTLY rule-based. Signal computation, focus stack, daily control — these are database computations. The "AI insight" is ONE short AI call (mid-tier model, < 100 tokens output).
- Mid-day and EOD are optional. Off by default. Founder enables if useful.
- Weekly and strategic reviews are ONE AI call each, but top-tier. Budget: ~$0.50 per weekly review, ~$1 per strategic review. Acceptable.
- All loops cache their output. If the founder opens the morning briefing 3 times, AI runs once.

---

*Phase 2 complete. Founder Operating System designed. No code written.*

*Document hierarchy:*
*1. PHASE-2-FOUNDER-OPERATING-SYSTEM.md — this document (system vision + all layers)*
*2. PHASE-1-ARCHITECTURE-V2.5.md — data model, service patterns, AI orchestration details*
*3. PHASE-0-ANALYSIS.md — v1 codebase analysis, gaps, reusable components*
*4. V2-ARCHITECTURE.md — Prisma schema details, UX patterns, MVP phasing*

*Ready for Phase 3: Implementation Plan.*
