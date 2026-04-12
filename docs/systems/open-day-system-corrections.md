# OPEN DAY / CLOSE DAY — GAP AUDIT & CORRECTIONS

Audit Date: 2026-04-11
Audited File: docs/systems/open-day-system.md (836 lines, 3810 words, commit a96ee8f)
Source of Truth: docs/BUSINESS_LIFE_OS_REFERENCE.md (650 lines, 2171 words, commit f5c2cfb)
Auditor: Claude (automated gap-audit against canonical reference)

---

## VERDICT: NEEDS CORRECTION BEFORE IMPLEMENTATION

The spec is structurally sound and covers ~80% of the reference requirements correctly. However, it contains 4 missing elements, 2 misalignments, and 6 cases of premature hardening that must be addressed before implementation begins.

---

## 1. GAP LIST

### 1.1 MISSING

#### M-1: Person entity not treated as first-class relationship

**Reference grounding:** Section 8 (Person vs User), Section 16 (protective rule: "nie porządkuje relacji między Project / Person / User / Task / Event / Message")

**Problem:** The spec uses flat data (assigneeId/assigneeName on Task, personId/personName on Message) but never references the canonical Person entity from the reference. People appear only as denormalized fields, not as the structured Person model defined in sections 4.3 and 8. The spec does not distinguish between Person and User.

**Impact:** If implemented as-is, the system will treat people as strings rather than as the canonical identity model. This violates the reference's data architecture.

**Correction:**
- In section 2.1 (Tasks), add: "Each task's assignee resolves to a Person entity (section 8 of reference). The Open Day pipeline must resolve assigneeId to the Person record, not just carry a flat name string."
- In section 2.4 (Messages), add: "Each message's person resolves to a Person entity. The pipeline must carry the Person's canonical data (preferred channel, projectIds, reliability context) when available."
- In section 4.1 (OpenDayBriefing), within todayByProject, add a new field: `projectTeam: Person[]` — the people assigned to this project, enabling the operator to see who is working on what.
- In section 8.2 (Required Existing Fields), add Person model fields: id, name, channels, projectIds, skills, availability, reliability.

---

#### M-2: "O mnie" / operator profile not referenced as AI context input

**Reference grounding:** Section 13.5 (Zakładka "O mnie"), Section 14 (Etap 1 item 3: "Zakładka O mnie + AI operator profile")

**Problem:** The spec's AI role (section 5) defines what AI generates and its constraints, but never mentions the operator profile as a context input. Section 13.5 of the reference explicitly states this narrative becomes "personal instruction layer dla AI" and is used by the agent "do lepszego działania operacyjnego." Since both Open Day and "O mnie" are Etap 1, the spec must at least define the integration hook.

**Impact:** If implemented without this, the AI narratives will be generic and will not adapt to the operator's decision style, communication preferences, or working constraints.

**Correction:**
- In section 5.4 (AI Prompt Design Principle), add a new subsection 5.5:

```
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
```

---

#### M-3: No delegation context in briefing data

**Reference grounding:** Section 13.2 (Voice Briefing Agent: user should be able to say "co mogę delegować")

**Problem:** The reference explicitly states the Voice Briefing Agent must support the command "co mogę delegować" (what can I delegate). For this to work, the briefing data must include delegation-relevant information: who is available, who has capacity, who has relevant skills. The current spec has no mechanism for this.

**Impact:** The Voice Briefing Agent will not be able to answer delegation questions because the underlying data structure doesn't provide the necessary context.

**Correction:**
- In section 2.2 (Projects), add a query:

```
| P-TEAM | Project team members | Person records assigned to each active project |
```

- In the ProjectDayContext (section 3.1, Step 2), add:

```
  teamMembers: Person[]      // people assigned to this project
```

- In section 6.2 (Voice Navigation Structure), add a note: "The Voice Briefing Agent will use projectTeam and Person availability data to answer delegation queries. This data is provided in the briefing structure but delegation logic is part of the Voice Agent spec, not this spec."

---

#### M-4: Unread messages not surfaced in summary

**Reference grounding:** Section 4.6 (Messages / Inbox), Section 13.1 (Open Day: follow-upy)

**Problem:** The spec defines query M-UNREAD (unread messages) in section 2.4 and includes unreadMessages in the ProjectDayContext (section 3.1), but the OpenDayBriefing.summary (section 4.1) does not include a totalUnreadMessages count. The unread messages are collected but never surfaced in the summary statistics.

**Impact:** The AI narrative and operator cannot quickly see the unread message load without scanning each project.

**Correction:**
- In section 4.1, OpenDayBriefing.summary, add:

```
    totalUnreadMessages: number
```

---

### 1.2 MISALIGNED

#### A-1: Spec header references incomplete set of sections

**Location:** Line 5 of open-day-system.md

**Problem:** The spec header says "Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 13.1, 14, 15.1)" but the spec actually needs to align with sections 13.1, 13.2, 13.5, 14, 15.1, and 16. Sections 13.2 (Voice Agent), 13.5 (O mnie), and 16 (protective rule) are all directly relevant.

**Correction:**
- Change line 5 from:
  `Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 13.1, 14, 15.1)`
  to:
  `Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 7, 8, 13.1, 13.2, 13.5, 14, 15.1, 16)`

---

#### A-2: Person vs User distinction not enforced

**Reference grounding:** Section 8 (Person vs User: "Person = kanoniczna tożsamość człowieka w systemie, User = rekord autoryzacji i dostępu")

**Problem:** The spec uses "assigneeId" and "personId" without clarifying whether these refer to Person or User. In the reference, a task assignee could be a Person without a User account (section 9.3: "System nie może zakładać, że każda osoba ma konto"). The spec does not account for this.

**Correction:**
- In section 8.2, add a clarification:

```
IMPORTANT: All person references (assigneeId on Task, personId on Message)
resolve to the Person entity, NOT to User. Per reference section 8:
- Person = canonical identity
- User = auth record
A task assignee or message sender may be a Person without a User account.
The system must never assume every person has a login.
```

---

### 1.3 OVERBUILT / PREMATURE

#### P-1: Priority scoring formula with hardcoded weights

**Location:** Section 3.1, Step 3

**Problem:** The spec defines exact numeric weights: basePriority (URGENT=40, HIGH=30, MEDIUM=20, LOW=10), overdueWeight (count*5, max 25), deadlineWeight (3d→15, 7d→8), blockerWeight (count*8, max 24). The reference document does not specify any scoring formula. It says "priorytety globalne i projektowe" — it mandates priority display, not a specific algorithm.

**Risk:** Locking in these exact numbers in the spec means they become treated as requirements during implementation. The actual weights should be determined through testing with real operational data.

**Correction:**
- Keep the formula structure (it's a valid design) but change the numbers to explicitly labeled defaults:

```
Score = basePriority + overdueWeight + deadlineWeight + blockerWeight

Default weights (MUST be configurable, not hardcoded):
- basePriority: URGENT=40, HIGH=30, MEDIUM=20, LOW=10
- overdueWeight: count(tasksOverdue) * overdueMultiplier (default: 5, max: 25)
- deadlineWeight: configurable thresholds (default: 3d→15, 7d→8)
- blockerWeight: count(tasksBlocked) * blockerMultiplier (default: 8, max: 24)

These values are initial defaults subject to tuning during implementation.
They MUST be stored in DayRitualConfig, not hardcoded.
```

- Add to DayRitualConfig (section 10):

```
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
```

---

#### P-2: Risk taxonomy prematurely hardened

**Location:** Section 3.2, Step 5

**Problem:** The spec defines exactly 5 risk types (DEADLINE_RISK, PERSISTENT_BLOCKER, COMMUNICATION_RISK, STALL_RISK, EXECUTION_RISK) with exact threshold triggers. The reference says only "co stało się nowym ryzykiem" — it does not define risk categories or thresholds.

**Risk:** A fixed taxonomy constrains risk detection to only these 5 patterns. Real operational risk may manifest differently.

**Correction:**
- Keep the 5 risk types as initial implementation candidates but add:

```
Note: This risk taxonomy is the initial set. It is NOT exhaustive.
The implementation should support extensible risk types.
Additional risk types may be added based on operational experience.
The risk detection engine should be designed as a pluggable system
where new risk detectors can be added without modifying the pipeline.
```

---

#### P-3: Section order declared as "fixed"

**Location:** Section 4.1 and 4.2

**Problem:** The spec says "Section order is fixed" for both OpenDayBriefing and CloseDayBriefing. The reference does not mandate any specific section order. The order is a reasonable default, but calling it "fixed" prevents the operator from customizing their briefing view order.

**Correction:**
- Change "Section order is fixed" to:

```
Default section order (recommended, may be configurable per operator in future):
```

This preserves the designed order as the default while not prematurely closing the door on customization.

---

#### P-4: aiTone enum prematurely specified

**Location:** Section 10 (DayRitualConfig)

**Problem:** The spec defines `aiTone: OPERATOR | CASUAL` as a configuration option. The reference does not define AI tone modes. This is an invention not grounded in the reference.

**Correction:**
- Remove the `aiTone` field from DayRitualConfig. The AI tone should be derived from the operator profile ("O mnie" section 13.5) when available, or default to operator tone (concise, direct, action-oriented) per section 5.4 of the spec.
- If an explicit tone setting is desired, it should be defined in the "O mnie" specification, not in the DayRitualConfig.

---

#### P-5: aiMaxSummaryLength arbitrarily specified

**Location:** Section 10 (DayRitualConfig)

**Problem:** `aiMaxSummaryLength: 500 (characters)` is an arbitrary number not grounded in the reference. The reference says nothing about summary length.

**Correction:**
- Change to a soft guidance rather than hard limit:

```
  aiSummaryGuidance: string   // default: "3-5 sentences, concise, action-oriented"
```

The AI prompt should guide length through instruction, not character truncation. Hard character limits produce abrupt cutoffs.

---

#### P-6: Exact threshold values locked into spec

**Location:** Section 10 (DayRitualConfig default values)

**Problem:** Values like overdueEscalationDays=5, blockedEscalationDays=3, followUpStaleDays=3 are presented as spec-level decisions. These are tuning parameters that should be determined during implementation with real data.

**Correction:**
- Mark all threshold values explicitly as "initial defaults, subject to tuning":

```
  // Thresholds — INITIAL DEFAULTS (tune during implementation)
  overdueEscalationDays: number       // initial: 5
  blockedEscalationDays: number       // initial: 3
  followUpStaleDays: number           // initial: 3
  deadlineWarningDays: number         // initial: 7
  stalledProjectDays: number          // initial: 7
  criticalOverdueDays: number         // initial: 3
  lowCompletionRateThreshold: number  // initial: 30
```

---

### 1.4 GOOD / ALIGNED

#### G-1: Project-first grouping — FULLY ALIGNED
Section 7 of the spec directly enforces reference section 7. todayByProject is the main view. Unassigned items have explicit handling. Cross-project visibility via globalPriorities.

#### G-2: Ritual nature (not checklist) — FULLY ALIGNED
Section 1.3 and 1.4 explicitly address reference section 15.1. The design constraint is clearly stated and enforced throughout.

#### G-3: AI role boundaries — FULLY ALIGNED
Section 5 correctly separates deterministic computation from AI narrative generation. AI cannot reorder, filter, or invent data. This aligns with the reference's AI-native principle (AI is execution layer, not chaos layer).

#### G-4: Voice integration hook — WELL ALIGNED
Section 6 correctly defines the data contract for the Voice Briefing Agent. DayRecord is the sole data source. Section numbering enables voice navigation. TTS readiness constraints are forward-looking.

#### G-5: DayRecord persistence model — FULLY ALIGNED
@@unique([userId, date, type]) constraint prevents duplicates. Immutable records serve as audit trail and Close Day baseline. This is well-designed.

#### G-6: Carry-over requires operator confirmation — FULLY ALIGNED
Section 3.2 Step 4 and API endpoint 9.3 correctly implement "system proposes, operator decides." This respects the operator's decision authority.

#### G-7: Open Day and Close Day content completeness — FULLY ALIGNED
All items from reference section 13.1 are present:
- Open Day: today's priorities ✓, tomorrow preview ✓, overdue ✓, blockers ✓, follow-ups ✓, calendar events ✓, global and project priorities ✓
- Close Day: delivered ✓, not delivered ✓, carry-over ✓, follow-ups ✓, escalations ✓, risks ✓

#### G-8: Edge cases — WELL DESIGNED
No Open Day before Close Day, empty day handling, idempotent endpoints, midnight boundary per timezone. These are not from the reference but are necessary operational correctness.

#### G-9: Implementation sequence — LOGICALLY SOUND
Phases A→E follow correct dependency order: data layer → queries → Open Day → Close Day → API. UI is correctly deferred to separate spec.

#### G-10: API design — CLEAN
Idempotent POST endpoints, OWNER role restriction, carry-over confirmation as separate endpoint. Clean separation of concerns.

---

## 2. SUMMARY OF CORRECTIONS REQUIRED

| ID | Type | Severity | Section Affected |
|---|---|---|---|
| M-1 | Missing | HIGH | 2.1, 2.4, 3.1, 4.1, 8.2 |
| M-2 | Missing | HIGH | 5 (new 5.5) |
| M-3 | Missing | MEDIUM | 2.2, 3.1, 6.2 |
| M-4 | Missing | LOW | 4.1 |
| A-1 | Misaligned | LOW | Header (line 5) |
| A-2 | Misaligned | MEDIUM | 8.2 |
| P-1 | Premature | MEDIUM | 3.1, 10 |
| P-2 | Premature | LOW | 3.2 |
| P-3 | Premature | LOW | 4.1, 4.2 |
| P-4 | Premature | LOW | 10 |
| P-5 | Premature | LOW | 10 |
| P-6 | Premature | LOW | 10 |

**HIGH severity items (M-1, M-2)** must be corrected before implementation.
**MEDIUM severity items (M-3, A-2, P-1)** should be corrected before implementation.
**LOW severity items** can be corrected during implementation but should not be forgotten.

---

## 3. PROTECTIVE RULE CHECK (Section 16)

The spec is evaluated against each clause of the protective rule:

| Clause | Status | Notes |
|---|---|---|
| Wzmacnia project-first logic | ✅ PASS | todayByProject, project scoring, _UNASSIGNED handling |
| Porządkuje relacji Project/Person/User/Task/Event/Message | ⚠️ PARTIAL | Task/Event/Message relations OK. Person entity missing (M-1). User vs Person distinction missing (A-2). |
| Wzmacnia AI-native execution | ✅ PASS | AI generates narratives, deterministic pipeline feeds AI, AI cannot override system decisions |
| Nie psuje spójności i clarity | ✅ PASS | Clean architecture, well-separated concerns, no contradictions |

**Result: 3/4 PASS, 1/4 PARTIAL — corrections M-1 and A-2 required for full compliance.**

---

## END OF AUDIT
