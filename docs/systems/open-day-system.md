# OPEN DAY / CLOSE DAY — SYSTEM SPECIFICATION

Version: 1.0
Status: DESIGN — NOT YET IMPLEMENTED
Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 7, 8, 13.1, 13.2, 13.5, 14, 15.1, 16)
Etap: 1 — Rdzen Operacyjny Systemu (highest priority)

---

## 1. SYSTEM PURPOSE

### 1.1 Problem Statement

A founder-operator managing multiple parallel projects accumulates daily operational chaos: overdue tasks scatter across projects, follow-ups get lost between communication channels, calendar events lack project context, and there is no structured moment to assess what happened today or what must happen tomorrow.

Without a deliberate operational ritual, the operator starts each day reactive (responding to whatever appears first) instead of proactive (executing from a prioritized, contextualized plan).

### 1.2 What Open Day / Close Day Solves

Open Day eliminates the reactive start. It collects all operationally relevant data across Projects, Tasks, Events, Messages, and Notes, applies prioritization logic, and produces a structured briefing that tells the operator exactly what matters today, what is overdue, what is blocked, and what is coming tomorrow.

Close Day eliminates the unexamined end. It compares the day's plan against actual execution, identifies what was delivered, what was not, what carries over, what requires follow-up or escalation, and what became a new risk.

Together they form an operational ritual — not a checklist.

### 1.3 How It Fits Into Business Life OS

Open Day / Close Day is the first function in Etap 1 (Rdzen Operacyjny Systemu) because it:

- strengthens the AI-native nature of the product (AI generates the briefing),
- increases real operational capability (structured daily rhythm),
- supports the founder's daily cadence (open → work → close),
- connects Projects / Tasks / Events / Messages / Knowledge into a single operational view,
- transforms the application from a module collection into a real operating system.

Per section 15.1 of the reference document: "Nie moze byc zwykla checklista. To musi byc operacyjny rytual systemu."

### 1.4 Design Constraint

This system must be an operational ritual, not a static dashboard. The distinction:

- A checklist shows data. A ritual structures action.
- A checklist is passive. A ritual has a beginning, a process, and a conclusion.
- A checklist can be ignored. A ritual shapes the operator's daily cadence.

---

## 2. DATA INPUTS

All data inputs follow the project-first principle (reference section 7). Every item either belongs to a project or is explicitly marked as unassigned.

### 2.1 Tasks

Source: Task module (section 4.2)

Queries required:

| Query ID | Description | Filter |
|---|---|---|
| T-TODAY | Tasks due today | dueDate = today AND status != DONE |
| T-OVERDUE | Overdue tasks | dueDate < today AND status != DONE |
| T-TOMORROW | Tasks due tomorrow | dueDate = tomorrow AND status != DONE |
| T-BLOCKED | Blocked tasks | status = BLOCKED (any date) |
| T-NO-DATE | Tasks without due date | dueDate = null AND status != DONE AND priority IN (URGENT, HIGH) |
| T-COMPLETED-TODAY | Tasks completed today | completedAt = today |
| T-FAILED-TODAY | Tasks that were due today but not completed | dueDate = today AND status != DONE (evaluated at Close Day) |

Each task carries: id, title, projectId, projectName, priority, status, dueDate, assigneeId, assigneeName, source.

Each task's assignee resolves to a Person entity (section 8 of reference). The Open Day pipeline must resolve assigneeId to the Person record, not just carry a flat name string.

### 2.2 Projects

Source: Project module (section 4.1)

Queries required:

| Query ID | Description | Filter |
|---|---|---|
| P-ACTIVE | Active projects | status = ACTIVE |
| P-PRIORITY | Projects by priority | status = ACTIVE, ordered by priority DESC |
| P-DEADLINE-NEAR | Projects with approaching deadline | deadline within 7 days AND status = ACTIVE |
| P-STALLED | Stalled projects | status = ACTIVE AND no task activity in 7 days |
| P-TEAM | Project team members | Person records assigned to each active project |

Each project carries: id, name, status, phase, priority, deadline, taskCountTotal, taskCountDone, taskCountOverdue.

### 2.3 Events / Calendar

Source: Calendar module (section 4.4)

Queries required:

| Query ID | Description | Filter |
|---|---|---|
| E-TODAY | Events today | date = today |
| E-TOMORROW | Events tomorrow | date = tomorrow |

Each event carries: id, title, startTime, endTime, projectId, projectName, attendees[], location, isGoogleCalendar.

### 2.4 Messages / Follow-ups

Source: Messages/Inbox module (section 4.6)

Queries required:

| Query ID | Description | Filter |
|---|---|---|
| M-UNREAD | Unread messages | readAt = null |
| M-FOLLOWUP | Messages requiring follow-up | followUpRequired = true AND followUpCompletedAt = null |
| M-AWAITING | Messages awaiting response | awaitingResponse = true AND respondedAt = null |

Each message carries: id, personId, personName, channel (Telegram/WhatsApp), projectId, projectName, snippet, receivedAt.

Each message's person resolves to a Person entity. The pipeline must carry the Person's canonical data (preferred channel, projectIds, reliability context) when available.

### 2.5 Notes

Source: Notes/Knowledge module (section 4.5)

Queries required:

| Query ID | Description | Filter |
|---|---|---|
| N-RECENT | Recent notes with pending actions | createdAt within 48 hours AND hasActionItems = true |

Each note carries: id, title, projectId, projectName, createdAt, actionItemCount.

---

## 3. PROCESS LOGIC

### 3.1 Open Day — Step-by-Step

Open Day is triggered manually by the operator or automatically at a configured time (default: not automatic — operator must initiate the ritual).

#### Step 1: DATA COLLECTION

Execute all queries from section 2 in parallel:
- T-TODAY, T-OVERDUE, T-TOMORROW, T-BLOCKED, T-NO-DATE
- P-ACTIVE, P-PRIORITY, P-DEADLINE-NEAR, P-STALLED
- E-TODAY, E-TOMORROW
- M-UNREAD, M-FOLLOWUP, M-AWAITING
- N-RECENT

#### Step 2: PROJECT AGGREGATION

Group all collected items by projectId. For each active project, build a ProjectDayContext:

```
ProjectDayContext {
  projectId: string
  projectName: string
  projectPriority: URGENT | HIGH | MEDIUM | LOW
  projectPhase: string
  projectDeadline: date | null
  tasksToday: Task[]
  tasksOverdue: Task[]
  tasksTomorrow: Task[]
  tasksBlocked: Task[]
  eventsToday: Event[]
  eventsTomorrow: Event[]
  followUps: Message[]
  awaitingResponses: Message[]
  unreadMessages: Message[]
  recentNotes: Note[]
  projectTeam: Person[]       // people assigned to this project (M-1, M-3)
}
```

Items not assigned to any project are grouped under a virtual context: `_UNASSIGNED`.

#### Step 3: PRIORITIZATION

Priority is computed per project, then items within each project are sorted.

**Project-level priority** (deterministic computation):

Score = basePriority + overdueWeight + deadlineWeight + blockerWeight

Default weights (MUST be configurable, not hardcoded):
- basePriority: URGENT=40, HIGH=30, MEDIUM=20, LOW=10
- overdueWeight: count(tasksOverdue) * overdueMultiplier (default: 5, max: 25)
- deadlineWeight: configurable thresholds (default: 3d→15, 7d→8)
- blockerWeight: count(tasksBlocked) * blockerMultiplier (default: 8, max: 24)

These values are initial defaults subject to tuning during implementation.
They MUST be stored in DayRitualConfig, not hardcoded.

Projects are sorted by Score DESC. Ties broken by projectName ASC.

**Task-level priority within project** (deterministic):

Order: BLOCKED first → OVERDUE by oldest dueDate → TODAY by priority DESC → NO-DATE by priority DESC.

#### Step 4: CRITICAL ITEMS EXTRACTION

Extract a flat list of critical items across all projects. An item is critical if:
- Task is BLOCKED (any project)
- Task is overdue by more than 3 days
- Task is URGENT priority and due today
- Project deadline is within 3 days and project has incomplete URGENT tasks
- Follow-up message is older than 48 hours

This list is used by the AI summary (section 5) and by the Voice Briefing Agent hook (section 6).

#### Step 5: BRIEFING ASSEMBLY

Assemble the final OpenDayBriefing structure (see section 4.1 for exact format).

#### Step 6: AI SUMMARY GENERATION

Pass the assembled briefing data to the AI layer for narrative summary generation (see section 5 for AI role definition).

#### Step 7: PERSISTENCE

Store the OpenDayBriefing as an immutable record:

```
DayRecord {
  id: string (UUID)
  userId: string
  date: date
  type: OPEN_DAY | CLOSE_DAY
  data: OpenDayBriefing | CloseDayBriefing (JSON)
  aiSummary: string
  createdAt: datetime
}
```

This record serves as: audit trail, Close Day comparison baseline, historical analysis input.

---

### 3.2 Close Day — Step-by-Step

Close Day is triggered manually by the operator or automatically at a configured time (default: not automatic).

#### Step 1: LOAD OPEN DAY BASELINE

Retrieve the DayRecord of type OPEN_DAY for today's date. If no Open Day was performed, Close Day still executes but flags this in the output.

#### Step 2: DATA COLLECTION (CURRENT STATE)

Execute queries:
- T-COMPLETED-TODAY: all tasks completed today
- T-FAILED-TODAY: tasks that were due today and are still not done
- T-OVERDUE: current overdue (may have grown since morning)
- T-TOMORROW: tasks for tomorrow (refreshed)
- E-TOMORROW: events for tomorrow (refreshed)
- M-FOLLOWUP: follow-ups still pending

#### Step 3: COMPLETION ANALYSIS (deterministic)

Compare Open Day baseline against current state:

```
CompletionAnalysis {
  // Delivered
  tasksCompletedToday: Task[]          // T-COMPLETED-TODAY
  tasksCompletedCount: number
  
  // Not delivered
  tasksFailedToday: Task[]             // T-FAILED-TODAY
  tasksFailedCount: number
  
  // Metrics
  completionRate: number               // completed / (completed + failed) * 100
  
  // New since morning
  newTasksAddedToday: Task[]           // tasks created today not in Open Day baseline
  newOverdueCount: number              // overdue count now - overdue count at Open Day
}
```

#### Step 4: CARRY-OVER LOGIC (deterministic)

Tasks that carry over to tomorrow:

```
CarryOver {
  // Automatic carry-over: failed today → reschedule to tomorrow
  autoCarryOver: Task[]     // dueDate updated from today to tomorrow
  
  // Persistent overdue: was overdue at Open Day AND still overdue now
  persistentOverdue: Task[] // overdue for 2+ days
  
  // Escalation candidates: overdue for 5+ days OR blocked for 3+ days
  escalationCandidates: Task[]
}
```

Carry-over is computed, NOT automatically applied. The operator must confirm rescheduling during the Close Day ritual. The system proposes, the operator decides.

#### Step 5: RISK DETECTION (AI-assisted)

Identify new risks based on pattern analysis:

Risk triggers (deterministic flags):
- Project with completionRate < 30% today AND deadline within 7 days → DEADLINE_RISK
- Task blocked for 3+ consecutive days → PERSISTENT_BLOCKER
- Follow-up pending for 72+ hours → COMMUNICATION_RISK
- Project with 0 task completions in 5+ days → STALL_RISK
- Multiple URGENT tasks failed today → EXECUTION_RISK

Note: This risk taxonomy is the initial set. It is NOT exhaustive.
The implementation should support extensible risk types.
Additional risk types may be added based on operational experience.
The risk detection engine should be designed as a pluggable system
where new risk detectors can be added without modifying the pipeline.

AI role: generate a narrative explanation of each risk and suggest concrete next action (see section 5).

#### Step 6: DEBRIEFING ASSEMBLY

Assemble the final CloseDayBriefing structure (see section 4.2 for exact format).

#### Step 7: AI SUMMARY GENERATION

Pass the assembled data to AI for narrative debriefing generation.

#### Step 8: PERSISTENCE

Store as DayRecord with type CLOSE_DAY.

---

## 4. OUTPUT STRUCTURE

### 4.1 OpenDayBriefing — Exact Structure

```
OpenDayBriefing {
  metadata {
    date: string              // "2026-04-12"
    generatedAt: datetime
    userId: string
    dayOfWeek: string         // "Saturday"
  }

  summary {
    aiNarrative: string       // AI-generated 3-5 sentence summary
    totalTasksToday: number
    totalTasksOverdue: number
    totalEventsToday: number
    totalFollowUps: number
    totalUnreadMessages: number
    criticalItemCount: number
  }

  criticalItems [             // SECTION 1: shown first, always
    {
      type: BLOCKED_TASK | OVERDUE_CRITICAL | URGENT_TODAY | DEADLINE_RISK | STALE_FOLLOWUP
      title: string
      projectName: string
      projectId: string
      detail: string          // human-readable explanation
      entityType: TASK | PROJECT | MESSAGE
      entityId: string
      daysSince: number | null
    }
  ]

  todayByProject [            // SECTION 2: project-first view
    {
      projectId: string
      projectName: string
      projectPriority: string
      projectScore: number
      projectTeam: Person[]     // people assigned to this project
      
      tasks {
        overdue: Task[]       // sorted by dueDate ASC (oldest first)
        today: Task[]         // sorted by priority DESC
        blocked: Task[]
      }
      
      events: Event[]         // sorted by startTime ASC
      
      followUps: Message[]    // sorted by receivedAt ASC (oldest first)
      awaitingResponses: Message[]
    }
  ]

  tomorrowPreview {           // SECTION 3: look-ahead
    taskCount: number
    eventCount: number
    tasksByProject: [
      {
        projectName: string
        tasks: Task[]
      }
    ]
    events: Event[]
  }

  globalPriorities {          // SECTION 4: cross-project view
    projectsApproachingDeadline: Project[]
    stalledProjects: Project[]
    highPriorityUnassignedTasks: Task[]   // T-NO-DATE with HIGH/URGENT
  }
}
```

Default section order (recommended, may be configurable per operator in future): criticalItems → todayByProject → tomorrowPreview → globalPriorities. This order reflects operational priority: threats first, then today's work, then tomorrow's preparation, then strategic view.

### 4.2 CloseDayBriefing — Exact Structure

```
CloseDayBriefing {
  metadata {
    date: string
    generatedAt: datetime
    userId: string
    openDayRecordId: string | null   // null if no Open Day was performed
  }

  summary {
    aiNarrative: string       // AI-generated 3-5 sentence debriefing
    completionRate: number    // percentage
    tasksCompleted: number
    tasksFailed: number
    newTasksAdded: number
  }

  delivered [                 // SECTION 1: what was accomplished
    {
      projectName: string
      projectId: string
      tasks: Task[]           // completed today, sorted by completedAt ASC
    }
  ]

  notDelivered [              // SECTION 2: what was not accomplished
    {
      projectName: string
      projectId: string
      tasks: Task[]           // failed today
      reason: string | null   // AI-suggested reason if pattern detected
    }
  ]

  carryOver {                 // SECTION 3: what moves to tomorrow
    autoCarryOver: [
      {
        task: Task
        originalDueDate: date
        proposedNewDate: date   // tomorrow
        confirmed: boolean      // false until operator confirms
      }
    ]
    persistentOverdue: Task[]   // overdue 2+ days, requires attention
  }

  followUps {                 // SECTION 4: communication actions needed
    pending: Message[]        // follow-ups still not done
    newlyRequired: Message[]  // AI-identified new follow-ups from today's activity
  }

  escalations {               // SECTION 5: things that need escalation
    items: [
      {
        type: PERSISTENT_BLOCKER | DEADLINE_RISK | COMMUNICATION_RISK | STALL_RISK | EXECUTION_RISK
        title: string
        projectName: string
        detail: string
        suggestedAction: string  // AI-generated
        daysSince: number
      }
    ]
  }

  risks {                     // SECTION 6: new risks detected
    items: [
      {
        type: string
        description: string     // AI-generated
        projectName: string
        severity: HIGH | MEDIUM | LOW
      }
    ]
  }

  tomorrowOutlook {           // SECTION 7: what tomorrow looks like
    taskCount: number
    eventCount: number
    carryOverCount: number
    keyEvents: Event[]
    heaviestProject: string   // project with most tasks tomorrow
  }
}
```

Default section order (recommended, may be configurable per operator in future): delivered → notDelivered → carryOver → followUps → escalations → risks → tomorrowOutlook.

---

## 5. AI ROLE

### 5.1 What AI Generates (requires LLM reasoning)

| Component | AI Role | Input |
|---|---|---|
| Open Day summary narrative | Generate 3-5 sentence briefing in operator tone | Full OpenDayBriefing data |
| Close Day summary narrative | Generate 3-5 sentence debriefing | Full CloseDayBriefing data |
| Critical item detail text | Explain why item is critical in context | Item + project context |
| Risk descriptions | Explain detected risk in operational terms | Risk triggers + project data |
| Suggested actions for escalations | Propose concrete next step | Escalation item + project + people context |
| Failure reason analysis | Hypothesize why tasks were not completed | Failed tasks + day's activity pattern |
| New follow-up identification | Detect implicit follow-ups from day's events | Completed tasks + messages + events |

### 5.2 What Is Computed Deterministically (no LLM needed)

| Component | Logic |
|---|---|
| Project priority score | Formula: basePriority + overdueWeight + deadlineWeight + blockerWeight |
| Task sorting within project | Fixed order: BLOCKED → OVERDUE → TODAY → NO-DATE |
| Completion rate | completed / (completed + failed) * 100 |
| Carry-over candidates | dueDate logic: failed today → propose tomorrow |
| Escalation triggers | Threshold checks: days overdue > 5, days blocked > 3, etc. |
| Risk flags | Pattern matching: completionRate < 30% + deadline < 7 days, etc. |
| Tomorrow outlook counts | Simple aggregation queries |

### 5.3 What Requires Both

| Component | Deterministic Part | AI Part |
|---|---|---|
| Critical items | Selection by threshold rules | Detail text explaining significance |
| Escalations | Detection by trigger flags | Suggested action text |
| Risks | Flag detection | Severity assessment + description |

### 5.4 AI Prompt Design Principle

The AI receives structured data, not raw database output. All prioritization, grouping, and filtering is done deterministically before AI involvement. The AI's role is strictly narrative: it translates structured operational data into human-readable, actionable text.

The AI must never:
- Reorder items (order is determined by the system)
- Filter out items (all items from the deterministic pipeline appear)
- Invent data not present in the input

The AI must:
- Use operator-appropriate language (concise, direct, action-oriented)
- Reference project names and people by name
- Highlight the single most important thing in the first sentence

### 5.5 Operator Profile Integration

When the operator profile ("O mnie") is available (section 13.5 of reference),
the AI layer receives it as additional context for narrative generation.

Input: OperatorProfile {
  decisionStyle: string
  communicationPreferences: string
  workingStyle: string
  constraints: string
  personalInstructions: string
}

Effect on AI:
- Open Day narrative adapts tone to operator's communication preferences
- Suggested actions consider operator's decision style
- Risk framing considers operator's constraints
- Language follows operator's personal instruction layer

When not available: AI uses default operator tone (concise, direct, action-oriented).
This integration point must be present in the spec even if "O mnie" is implemented after Open Day.

---

## 6. FUTURE VOICE INTEGRATION HOOK

Per reference section 13.2, the Voice Briefing Agent will consume the Open Day / Close Day output.

### 6.1 Interface Contract

The OpenDayBriefing and CloseDayBriefing structures defined in section 4 are the sole data contract for the Voice Briefing Agent. The voice system will NOT query data independently — it reads the persisted DayRecord.

### 6.2 Voice Navigation Structure

The briefing sections are numbered to support voice commands:

Open Day sections:
1. Critical Items
2. Today By Project (sub-numbered by project index)
3. Tomorrow Preview
4. Global Priorities

Close Day sections:
1. Delivered
2. Not Delivered
3. Carry Over
4. Follow Ups
5. Escalations
6. Risks
7. Tomorrow Outlook

The Voice Briefing Agent will use projectTeam and Person availability data to answer delegation queries. This data is provided in the briefing structure but delegation logic is part of the Voice Agent spec, not this spec.

This numbering enables future voice commands like: "rozwi punkt 2" (expand section 2), "co jest dzis najpilniejsze" (maps to section 1 — Critical Items), "pokaz mi tylko rzeczy krytyczne" (filter to Critical Items only).

### 6.3 Text-to-Speech Readiness

The aiNarrative fields in both briefings must be written in a style suitable for spoken delivery:
- Short sentences (max 20 words)
- No markdown formatting
- No abbreviations except well-known ones (AI, CRM)
- Numbers written as words for small values ("three tasks") and digits for large ("42 tasks")

This constraint applies now (even before Voice Agent implementation) to ensure data compatibility.

---

## 7. RELATION TO PROJECT-FIRST

### 7.1 Core Principle

Per reference section 7: "projekt jest centrum widoku pracy" and "jezeli cos jest wazne operacyjnie, powinno byc mozliwe do osadzenia w projekcie."

Open Day / Close Day enforces project-first by design:

- The primary view (todayByProject) groups everything by project
- Tasks without a project appear in _UNASSIGNED — a visible signal of organizational debt
- Events, messages, and notes are shown within their project context
- The project priority score drives the display order

### 7.2 No Orphan Data

The system handles unassigned items explicitly:

- Unassigned tasks appear in a dedicated _UNASSIGNED group at the bottom of the project list
- Unassigned events appear in a separate section
- The AI narrative mentions unassigned item count as an organizational health signal
- Close Day tracks whether unassigned items from Open Day were assigned during the day

### 7.3 Cross-Project Visibility

The globalPriorities section provides cross-project awareness:
- Approaching deadlines across all projects
- Stalled projects that need attention
- High-priority tasks that lack project assignment

This ensures the operator sees both the per-project detail and the portfolio-level picture.

---

## 8. DATA MODEL REQUIREMENTS

### 8.1 New Entity: DayRecord

```
model DayRecord {
  id          String    @id @default(uuid())
  userId      String
  date        DateTime  @db.Date
  type        DayRecordType  // OPEN_DAY | CLOSE_DAY
  data        Json      // OpenDayBriefing | CloseDayBriefing
  aiSummary   String    @db.Text
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])

  @@unique([userId, date, type])
  @@index([userId, date])
}

enum DayRecordType {
  OPEN_DAY
  CLOSE_DAY
}
```

### 8.2 Required Existing Fields

The system assumes these fields exist on existing models (verify during implementation):

Task: id, title, projectId, priority, status, dueDate, completedAt, assigneeId, createdAt
Project: id, name, status, phase, priority, deadline
Event: id, title, startTime, endTime, projectId, attendees
Message: id, personId, channel, projectId, snippet, receivedAt, readAt, followUpRequired, followUpCompletedAt, awaitingResponse, respondedAt
Note: id, title, projectId, createdAt, hasActionItems
Person: id, name, channels, projectIds, skills, availability, reliability

IMPORTANT: All person references (assigneeId on Task, personId on Message)
resolve to the Person entity, NOT to User. Per reference section 8:
- Person = canonical identity
- User = auth record
A task assignee or message sender may be a Person without a User account.
The system must never assume every person has a login.

Fields that may not exist yet and will need to be added or derived:
- Task.status: needs BLOCKED value
- Message.followUpRequired: boolean flag
- Message.followUpCompletedAt: nullable datetime
- Message.awaitingResponse: boolean flag
- Message.respondedAt: nullable datetime
- Note.hasActionItems: boolean flag or computed property

---

## 9. API ENDPOINTS

### 9.1 Open Day

```
POST /api/day/open
Authorization: required (OWNER role only)
Body: none (uses current date, current user)
Response: {
  success: boolean
  dayRecord: DayRecord
  briefing: OpenDayBriefing
}
```

Behavior:
- If DayRecord(OPEN_DAY) already exists for today: return existing record (idempotent)
- If not: execute full Open Day pipeline, persist, return

### 9.2 Close Day

```
POST /api/day/close
Authorization: required (OWNER role only)
Body: none
Response: {
  success: boolean
  dayRecord: DayRecord
  briefing: CloseDayBriefing
}
```

Behavior:
- If DayRecord(CLOSE_DAY) already exists for today: return existing record
- If not: execute full Close Day pipeline, persist, return

### 9.3 Confirm Carry-Over

```
POST /api/day/carry-over/confirm
Authorization: required (OWNER role only)
Body: {
  taskIds: string[]          // tasks to carry over to tomorrow
  dismissedTaskIds: string[] // tasks to not carry over (operator decides)
}
Response: {
  success: boolean
  updatedTasks: Task[]
}
```

Behavior:
- For each taskId in taskIds: update dueDate to tomorrow
- For each dismissedTaskId: no date change (remains overdue)
- This endpoint is the operator's confirmation step — the system proposes, the operator decides

### 9.4 Get Day Record

```
GET /api/day/:date
Authorization: required
Query: ?type=OPEN_DAY|CLOSE_DAY (optional, returns both if omitted)
Response: {
  openDay: DayRecord | null
  closeDay: DayRecord | null
}
```

### 9.5 Day History

```
GET /api/day/history
Authorization: required
Query: ?from=date&to=date&limit=30
Response: {
  records: DayRecord[]
}
```

---

## 10. CONFIGURATION

```
DayRitualConfig {
  // Timing (informational — used by future auto-trigger)
  preferredOpenTime: string | null    // e.g. "09:00"
  preferredCloseTime: string | null   // e.g. "18:00"
  timezone: string                    // e.g. "Europe/Warsaw"

  // Thresholds — INITIAL DEFAULTS (tune during implementation)
  overdueEscalationDays: number       // initial: 5
  blockedEscalationDays: number       // initial: 3
  followUpStaleDays: number           // initial: 3 (72 hours)
  deadlineWarningDays: number         // initial: 7
  stalledProjectDays: number          // initial: 7
  criticalOverdueDays: number         // initial: 3
  lowCompletionRateThreshold: number  // initial: 30 (percent)

  // Priority scoring weights (affect project ordering)
  priorityWeights: {
    urgent: number      // default: 40
    high: number        // default: 30
    medium: number      // default: 20
    low: number         // default: 10
    overdueMultiplier: number   // default: 5
    overdueMax: number          // default: 25
    deadlineClose: number       // default: 15 (within 3 days)
    deadlineMedium: number      // default: 8 (within 7 days)
    blockerMultiplier: number   // default: 8
    blockerMax: number          // default: 24
  }

  // AI behavior
  aiLanguage: string                  // default: "pl" (Polish)
  aiSummaryGuidance: string           // default: "3-5 sentences, concise, action-oriented"
}
```

Stored per user. Defaults applied if not configured.

---

## 11. EDGE CASES

### 11.1 No Open Day Before Close Day

If the operator runs Close Day without having run Open Day:
- Close Day still executes
- openDayRecordId is null
- Completion analysis uses all tasks due today as baseline (instead of Open Day snapshot)
- AI narrative notes: "Dzis nie zostal wykonany Open Day — analiza opiera sie na danych biezacych."

### 11.2 Empty Day

If there are zero tasks, zero events, zero messages for today:
- Open Day still produces a valid briefing
- All sections are empty arrays
- AI narrative: "Dzis nie ma zaplanowanych zadan ani wydarzen. Mozesz uzyc tego czasu na [globalPriorities suggestion]."

### 11.3 Multiple Open Days

Prevented by @@unique([userId, date, type]). Second call returns existing record.

### 11.4 Midnight Boundary

Day boundary is determined by DayRitualConfig.timezone. If timezone is Europe/Warsaw, "today" means the calendar date in Warsaw, not UTC.

### 11.5 Weekend / Non-Working Days

No special handling. The operator decides whether to run Open/Close Day. The system treats every day the same.

---

## 12. IMPLEMENTATION SEQUENCE

This section defines the order in which this spec should be implemented. It does NOT define UI.

Phase A: Data Layer
1. Create DayRecord model (Prisma migration)
2. Verify/add missing fields on Task, Message, Note models
3. Create DayRitualConfig model

Phase B: Query Layer
1. Implement all queries from section 2 as reusable service functions
2. Unit test each query independently

Phase C: Open Day Pipeline
1. Implement data collection (Step 1)
2. Implement project aggregation (Step 2)
3. Implement prioritization scoring (Step 3)
4. Implement critical items extraction (Step 4)
5. Implement briefing assembly (Step 5)
6. Implement AI summary generation (Step 6)
7. Implement persistence (Step 7)
8. Integration test full pipeline

Phase D: Close Day Pipeline
1. Implement baseline loading (Step 1)
2. Implement completion analysis (Step 3)
3. Implement carry-over logic (Step 4)
4. Implement risk detection (Step 5)
5. Implement debriefing assembly (Step 6)
6. Implement AI summary generation (Step 7)
7. Implement persistence (Step 8)
8. Integration test full pipeline

Phase E: API Layer
1. Implement POST /api/day/open
2. Implement POST /api/day/close
3. Implement POST /api/day/carry-over/confirm
4. Implement GET /api/day/:date
5. Implement GET /api/day/history

Phase F: UI (separate spec — not part of this document)

---

## END OF SPECIFICATION
