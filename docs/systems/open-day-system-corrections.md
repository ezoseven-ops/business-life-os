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

**Reference grounding:** Section 8 (Person vs User), Section 16 (protective rule: "nie porzadkuje relacji miedzy Project / Person / User / Task / Event / Message")

**Problem:** The spec uses flat data (assigneeId/assigneeName on Task, personId/personName on Message) but never references the canonical Person entity from the reference. People appear only as denormalized fields, not as the structured Person model defined in sections 4.3 and 8. The spec does not distinguish between Person and User.

**Impact:** If implemented as-is, the system will treat people as strings rather than as the canonical identity model. This violates the reference's data architecture.

**Correction:**
- In section 2.1 (Tasks), add: "Each task's assignee resolves to a Person entity (section 8 of reference). The Open Day pipeline must resolve assigneeId to the Person record, not just carry a flat name string."
- In section 2.4 (Messages), add: "Each message's person resolves to a Person entity. The pipeline must carry the Person's canonical data (preferred channel, projectIds, reliability context) when available."
- In section 4.1 (OpenDayBriefing), within todayByProject, add a new field: projectTeam: Person[] — the people assigned to this project, enabling the operator to see who is working on what.
- In section 8.2 (Required Existing Fields), add Person model fields: id, name, channels, projectIds, skills, availability, reliability.

---

#### M-2: "O mnie" / operator profile not referenced as AI context input

**Reference grounding:** Section 13.5 (Zakladka "O mnie"), Section 14 (Etap 1 item 3: "Zakladka O mnie + AI operator profile")

**Problem:** The spec's AI role (section 5) defines what AI generates and its constraints, but never mentions the operator profile as a context input. Section 13.5 of the reference explicitly states this narrative becomes "personal instruction layer dla AI" and is used by the agent "do lepszego dzialania operacyjnego." Since both Open Day and "O mnie" are Etap 1, the spec must at least define the integration hook.

**Impact:** If implemented without this, the AI narratives will be generic and will not adapt to the operator's decision style, communication preferences, or working constraints.

**Correction:**
- In section 5.4 (AI Prompt Design Principle), add a new subsection 5.5:

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

#### M-3: No delegation context in briefing data

**Reference grounding:** Section 13.2 (Voice Briefing Agent: user should be able to say "co moge delegowac")

**Problem:** The reference explicitly states the Voice Briefing Agent must support the command "co moge delegowac" (what can I delegate). For this to work, the briefing data must include delegation-relevant information: who is available, who has capacity, who has relevant skills. The current spec has no mechanism for this.

**Impact:** The Voice Briefing Agent will not be able to answer delegation questions because the underlying data structure doesn't provide the necessary context.

**Correction:**
- In section 2.2 (Projects), add a query: P-TEAM — Project team members — Person records assigned to each active project
- In the ProjectDayContext (section 3.1, Step 2), add: teamMembers: Person[] — people assigned to this project
- In section 6.2 (Voice Navigation Structure), add a note: "The Voice Briefing Agent will use projectTeam and Person availability data to answer delegation queries. This data is provided in the briefing structure but delegation logic is part of the Voice Agent spec, not this spec."

---

#### M-4: Unread messages not surfaced in summary

**Reference grounding:** Section 4.6 (Messages / Inbox), Section 13.1 (Open Day: follow-upy)

**Problem:** The spec defines query M-UNREAD (unread messages) in section 2.4 and includes unreadMessages in the ProjectDayContext (section 3.1), but the OpenDayBriefing.summary (section 4.1) does not include a totalUnreadMessages count. The unread messages are collected but never surfaced in the summary statistics.

**Impact:** The AI narrative and operator cannot quickly see the unread message load without scanning each project.

**Correction:**
- In section 4.1, OpenDayBriefing.summary, add: totalUnreadMessages: number

---

### 1.2 MISALIGNED

#### A-1: Spec header references incomplete set of sections

**Location:** Line 5 of open-day-system.md

**Problem:** The spec header says "Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 13.1, 14, 15.1)" but the spec actually needs to align with sections 13.1, 13.2, 13.5, 14, 15.1, and 16. Sections 13.2 (Voice Agent), 13.5 (O mnie), and 16 (protective rule) are all directly relevant.

**Correction:**
- Change line 5 from: Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 13.1, 14, 15.1)
  to: Reference: docs/BUSINESS_LIFE_OS_REFERENCE.md (sections 7, 8, 13.1, 13.2, 13.5, 14, 15.1, 16)

---

#### A-2: Person vs User distinction not enforced

**Reference grounding:** Section 8 (Person vs User: "Person = kanoniczna tozsamosc czlowieka w systemie, User = rekord autoryzacji i dostepu")

**Problem:** The spec uses "assigneeId" and "personId" without clarifying whether these refer to Person or User. In the reference, a task assignee could be a Person without a User account (section 9.3: "System nie moze zakladac, ze kazda osoba ma konto"). The spec does not account for this.

**Correction:**
- In section 8.2, add a clarification:
IMPORTANT: All person references (assigneeId on Task, personId on Message) resolve to the Person entity, NOT to User. Per reference section 8: Person = canonical identity, User = auth record. A task assignee or message sender may be a Person without a User account. The system must never assume every person has a login.

---

### 1.3 OVERBUILT / PREMATURE

#### P-1: Priority scoring formula with hardcoded weights

**Location:** Section 3.1, Step 3

**Problem:** The spec defines exact numeric weights: basePriority (URGENT=40, HIGH=30, MEDIUM=20, LOW=10), overdueWeight (count*5, max 25), deadlineWeight (3d->15, 7d->8), blockerWeight (count*8, max 24). The reference document does not specify any scoring formula. It says "priorytety globalne i projektowe" — it mandates priority display, not a specific algorithm.

**Risk:** Locking in these exact numbers in the spec means they become treated as requirements during implementation. The actual weights should be determined through testing with real operational data.

**Correction:**
- Keep the formula structure (it's a valid design) but change the numbers to explicitly labeled defaults that MUST be configurable via DayRitualConfig, not hardcoded.
- Add priority weight configuration to DayRitualConfig (section 10).

---

#### P-2: Risk taxonomy prematurely hardened

**Location:** Section 3.2, Step 5

**Problem:** The spec defines exactly 5 risk types (DEADLINE_RISK, PERSISTENT_BLOCKER, COMMUNICATION_RISK, STALL_RISK, EXECUTION_RISK) with exact threshold triggers. The reference says only "co stalo sie nowym ryzykiem" — it does not define risk categories or thresholds.

**Correction:**
- Keep the 5 risk types as initial implementation candidates but add note: "This risk taxonomy is the initial set. It is NOT exhaustive. The implementation should support extensible risk types."

---

#### P-3: Section order declared as "fixed"

**Location:** Section 4.1 and 4.2

**Problem:** The spec says "Section order is fixed" for both briefings. The reference does not mandate any specific section order.

**Correction:**
- Change "Section order is fixed" to: "Default section order (recommended, may be configurable per operator in future):"

---

#### P-4: aiTone enum prematurely specified

**Location:** Section 10 (DayRitualConfig)

**Problem:** The spec defines aiTone: OPERATOR | CASUAL. The reference does not define AI tone modes. This is an invention not grounded in the reference.

**Correction:**
- Remove aiTone from DayRitualConfig. AI tone should be derived from operator profile ("O mnie") when available, or default to operator tone per section 5.4.

---

#### P-5: aiMaxSummaryLength arbitrarily specified

**Location:** Section 10 (DayRitualConfig)

**Problem:** aiMaxSummaryLength: 500 (characters) is an arbitrary number not grounded in the reference.

**Correction:**
- Replace with soft guidance: aiSummaryGuidance: string — default: "3-5 sentences, concise, action-oriented". Use AI instruction, not character truncation.

---

#### P-6: Exact threshold values locked into spec

**Location:** Section 10 (DayRitualConfig default values)

**Problem:** Values like overdueEscalationDays=5, blockedEscalationDays=3 are presented as spec-level decisions. These are tuning parameters.

**Correction:**
- Mark all threshold values explicitly as "initial defaults, subject to tuning during implementation."

---

### 1.4 GOOD / ALIGNED

G-1: Project-first grouping — FULLY ALIGNED (reference section 7)
G-2: Ritual nature (not checklist) — FULLY ALIGNED (reference section 15.1)
G-3: AI role boundaries — FULLY ALIGNED (AI is narrative, not decision-maker)
G-4: Voice integration hook — WELL ALIGNED (reference section 13.2)
G-5: DayRecord persistence model — FULLY ALIGNED (@@unique constraint, immutable records)
G-6: Carry-over requires operator confirmation — FULLY ALIGNED (system proposes, operator decides)
G-7: Open Day and Close Day content completeness — FULLY ALIGNED (all items from 13.1 present)
G-8: Edge cases — WELL DESIGNED (no Open Day before Close Day, empty day, idempotent, timezone)
G-9: Implementation sequence — LOGICALLY SOUND (A->E correct dependency order)
G-10: API design — CLEAN (idempotent, OWNER only, carry-over as separate endpoint)

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

HIGH severity items (M-1, M-2) must be corrected before implementation.
MEDIUM severity items (M-3, A-2, P-1) should be corrected before implementation.
LOW severity items can be corrected during implementation but should not be forgotten.

---

## 3. PROTECTIVE RULE CHECK (Section 16)

| Clause | Status | Notes |
|---|---|---|
| Wzmacnia project-first logic | PASS | todayByProject, project scoring, _UNASSIGNED handling |
| Porzadkuje relacji Project/Person/User/Task/Event/Message | PARTIAL | Task/Event/Message OK. Person entity missing (M-1). User vs Person missing (A-2). |
| Wzmacnia AI-native execution | PASS | AI generates narratives, deterministic pipeline, AI cannot override system |
| Nie psuje spojnosci i clarity | PASS | Clean architecture, well-separated concerns, no contradictions |

Result: 3/4 PASS, 1/4 PARTIAL — corrections M-1 and A-2 required for full compliance.

---

## END OF AUDIT
