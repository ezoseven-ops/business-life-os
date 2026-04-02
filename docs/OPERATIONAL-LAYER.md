# Business Life OS — Operational Layer

**Version:** 1.0
**Date:** April 2, 2026
**Depends on:** ARCHITECTURE-RBAC.md, USER-FLOWS.md, IMPLEMENTATION-BLUEPRINT.md
**Status:** Design Specification — Not Yet Implemented

---

## Premise

The three preceding documents define what each role can see and do. This document defines what happens when they don't do anything. A real operational system has to account for silence, inaction, and drift — not just happy-path activity.

No database schema changes. No new models. Everything in this document uses the existing Notification model, Activity model, and computed query logic.

---

## 1. SYSTEM RULES

### 1.1 The Staleness Clock

Every task assigned to a CLIENT has an implicit clock. The clock is not a database field — it is computed at query time from existing timestamps.

**Staleness = time since the last meaningful action on the task by the assignee.**

A "meaningful action" is:

- The client changed the task status
- The client added a comment
- The task was assigned to the client (resets the clock)

The clock is computed as:

```
lastClientAction = MAX(
  latest Comment.createdAt WHERE authorId = task.assigneeId,
  latest Activity.createdAt WHERE userId = task.assigneeId AND entityId = task.id,
  task.updatedAt WHERE the update was by the assignee
)

staleness = NOW() - lastClientAction
```

In practice, the simplest implementation: query the Activity table for the most recent entry where `userId = assigneeId AND entityId = taskId`. If none exists, use the task's `createdAt` (meaning the client has never acted on it since creation/assignment).

### 1.2 Staleness Thresholds

| Time Since Last Client Action | Label | Who Sees It | What Happens |
|------|-------|-------------|-------------|
| 0–24h | Fresh | Nobody | Nothing. Normal operating window. |
| 24–48h | Quiet | Owner only | Yellow dot on task in Owner dashboard. No notification. |
| 48–72h | Stale | Owner + Client | Owner: task promoted to "Needs Attention" list. Client: gentle nudge notification (once). |
| 72h+ | Silent | Owner + Client | Owner: task turns red in dashboard, counter shows days silent. Client: second nudge (once). |
| 5d+ | Dead | Owner only | Owner gets a single notification: "Task '{title}' has had no client response for {n} days." Task shows skull icon in dashboard. No further client nudges. |

**Key principle: the system nudges twice, then stops.** After the 48h and 72h nudges, the client is not bothered again. It becomes the Owner's problem to follow up manually. The app does not become a nag machine.

### 1.3 Overdue vs. Stale — Two Different Signals

These are independent conditions and a task can be both:

**Overdue** = `task.dueDate < TODAY AND task.status != DONE`. This is about the deadline.

**Stale** = `staleness > 48h AND task.assignee.role = CLIENT AND task.status != DONE`. This is about inaction.

A task can be:

- On time and active (due next week, client commented today) — no signal
- On time but stale (due next week, but no client action for 3 days) — yellow/red signal
- Overdue but active (past due, but client commented an hour ago) — overdue signal only
- Overdue and stale (past due AND no action for days) — both signals, loudest alarm

The Owner dashboard shows both dimensions. They are displayed separately because the response is different: overdue tasks need deadline management, stale tasks need client engagement.

### 1.4 Task Lifecycle Events That Reset Clocks

| Event | Resets Staleness Clock? | Resets Overdue? |
|-------|------------------------|-----------------|
| Client adds comment | Yes | No |
| Client changes status | Yes | No (unless marked DONE) |
| Owner/Team adds comment | No — this is internal action | No |
| Task reassigned to client | Yes (fresh start) | No |
| Due date extended | No | Yes (new deadline) |
| Task marked DONE | Clock stops entirely | Overdue clears |
| Task reopened (DONE → TODO) | Clock restarts from now | Depends on dueDate |

**Critical:** Owner or Team commenting on a task does NOT reset the client staleness clock. Only client actions count. Otherwise the Owner could "reset the clock" by commenting, hiding the real problem — the client isn't engaging.

### 1.5 Rules for Automatic Notifications

The system sends notifications automatically based on staleness thresholds. Each notification is sent exactly once per threshold crossing. This is enforced by checking: "has a notification of this type already been sent for this task at this threshold?"

| Threshold | Recipient | Notification Type | Message | Sent Once? |
|-----------|-----------|-------------------|---------|------------|
| 48h stale | Client | `CLIENT_NUDGE_48H` | "'{title}' is waiting for your response" | Yes — once per task per 48h crossing |
| 72h stale | Client | `CLIENT_NUDGE_72H` | "Reminder: '{title}' still needs your action" | Yes — once per task per 72h crossing |
| 72h stale | Owner | `OWNER_STALE_ALERT` | "No client response on '{title}' for 3 days" | Yes — once per task per 72h crossing |
| 5d stale | Owner | `OWNER_DEAD_TASK` | "'{title}' has had no client response for {n} days" | Yes — once per task per 5d crossing |
| Overdue (any) | Owner | `TASK_OVERDUE` | "'{title}' is past due ({date})" | Yes — once per task when it first becomes overdue |
| Overdue (any) | Assignee | `TASK_OVERDUE` | "'{title}' is past due ({date})" | Yes — once per task |

**No notification spam.** Each notification type fires once per task. If a task has been stale for 10 days, the client got exactly 2 nudges (at 48h and 72h) and the Owner got exactly 2 alerts (at 72h and 5d). That's it.

### 1.6 When the Scheduled Check Runs

A single server-side function runs once per day (or on page load — see Minimal Implementation). It checks all tasks where:

```
status != DONE
AND assignee.role = CLIENT
AND assigneeId IS NOT NULL
```

For each task, it computes staleness and compares against thresholds. If a threshold was crossed since the last check, it creates the appropriate notification(s).

This does NOT require a cron job for MVP. See Section 4.

---

## 2. OWNER SIGNALS

### 2.1 Dashboard Signal Hierarchy

The Owner dashboard (from USER-FLOWS.md) has three sections. This document adds a fourth: stale client tasks. The sections are ordered by urgency:

```
1. 🔴 OVERDUE              — Past-due tasks (any assignee)
2. 🟠 NEEDS ATTENTION       — Stale client tasks (48h+ no response)
3. 🟡 WAITING ON CLIENTS    — Active waiting tasks (client assigned, not stale yet)
4. 📋 DUE TODAY             — Tasks due today
```

Note: "WAITING ON CLIENTS" from USER-FLOWS.md is refined. It now only shows tasks where `status = WAITING, assignee.role = CLIENT, staleness < 48h`. Once staleness crosses 48h, the task moves UP to "NEEDS ATTENTION." This means a task physically migrates between sections as time passes, creating a visible escalation that the Owner cannot miss.

### 2.2 Signal Indicators on Task Cards

Each task card in the Owner dashboard shows compact signals:

```
┌─────────────────────────────────────────┐
│ ⚠ Approve final layout                  │
│   Farma Foto · Anna · Due Apr 5         │
│   🔇 3 days silent · 📅 1 day overdue   │
└─────────────────────────────────────────┘
```

The two indicators:

**🔇 {n} days silent** — Shows when staleness > 48h. Counts days since last client action. Color escalates: yellow at 48h, orange at 72h, red at 5d+.

**📅 {n} day(s) overdue** — Shows when `dueDate < today`. Always red.

If neither condition applies, no indicators are shown. A healthy task card is clean.

### 2.3 What Requires Owner Attention

Signals are not interruptions — they are dashboard sections that the Owner checks during their daily review. The system does NOT pop alerts or send push notifications for dashboard changes. The dashboard is a pull-based tool.

The only push notification the Owner receives:

- `OWNER_STALE_ALERT` at 72h (once per task) — because 3 days of client silence is a real problem
- `OWNER_DEAD_TASK` at 5d (once per task) — because at this point the task is likely abandoned
- `TASK_OVERDUE` when a task first becomes overdue (once per task)

Everything else is visible on the dashboard when the Owner opens it. No notification fatigue.

### 2.4 Owner Quick Actions

From any task card in the "NEEDS ATTENTION" section, the Owner can:

**Tap the card → open task detail.** Standard navigation. Then:

1. **Add a comment** (the most common action). "Hi Anna, any update on this?" The comment goes to the client. Simple, human, direct.

2. **Reassign the task.** If the client is unresponsive, the Owner can reassign to a Team member or to themselves. This removes the task from the client's portal and resets all staleness tracking.

3. **Extend the deadline.** Change the due date. This clears the overdue signal. The task remains in "NEEDS ATTENTION" if still stale, but at least the deadline pressure is relieved.

4. **Mark as Done internally.** If the Owner decides to absorb the task or skip it. Task disappears from all active views.

No new UI is needed for these actions. They are all existing task-detail operations (comment, reassign, edit due date, change status). The operational layer just makes the right tasks visible at the right time.

### 2.5 "Needs Attention" Count in Navigation

The Owner's Home tab in the bottom nav shows a badge when there are tasks in the "NEEDS ATTENTION" state:

```
[ Home 🔴3 ]  [ Inbox ]  [ + ]  [ Tasks ]  [ People ]
```

The badge number = count of tasks where `assignee.role = CLIENT AND staleness > 48h AND status != DONE`. This is the ONLY place the staleness system touches the global navigation. It's one number. It tells the Owner: "You have 3 client situations that need your involvement."

---

## 3. CLIENT EXPERIENCE

### 3.1 Design Philosophy: Pressure Without Annoyance

The client is not an employee. They don't report to the Owner. They're a customer, a vendor, a partner. If the app becomes pushy, they'll stop opening it. The nudge system must:

- Be polite, not demanding
- Give context (what task, what's expected)
- Never imply blame or urgency beyond what's real
- Stop after two attempts

### 3.2 The Two Nudges

**Nudge 1 — At 48h (Gentle Reminder)**

Appears as a notification in the client's "Updates" tab:

```
┌─────────────────────────────────────────┐
│  📋 Waiting for your response            │
│  "Approve final layout" is waiting for   │
│  your review.                            │
│  2 days ago                              │
└─────────────────────────────────────────┘
```

Tone: informational. "This is waiting for you." No exclamation marks. No "urgent" language. It's a reminder that the task exists, not a demand.

**Nudge 2 — At 72h (Firmer Reminder)**

```
┌─────────────────────────────────────────┐
│  ⏰ Still needs your action              │
│  "Approve final layout" hasn't had an    │
│  update in 3 days. Due Apr 5.            │
│  1 day ago                               │
└─────────────────────────────────────────┘
```

Tone: factual with deadline context. Mentions how long it's been waiting AND the due date if one exists. Still not aggressive.

**After Nudge 2: silence from the system.** The client has been told twice. Further nagging does not help — it irritates. The Owner must now engage directly with a comment.

### 3.3 Visual Signals in Client Portal

In addition to nudge notifications, the client's "My Tasks" tab shows visual escalation:

**Fresh task (< 24h or recently acted on):**
```
┌─────────────────────────────────────────┐
│  ○  Approve final layout                 │
│     Due Apr 5                            │
└─────────────────────────────────────────┘
```

Clean card. No indicators.

**Stale task (48h+ since client's last action):**
```
┌─────────────────────────────────────────┐
│  ○  Approve final layout                 │
│     Due Apr 5 · Waiting for your response│
└─────────────────────────────────────────┘
```

Subtle text addition: "Waiting for your response." Not a badge, not a color change, not an alert. Just informational text.

**Overdue task:**
```
┌─────────────────────────────────────────┐
│  ○  Approve final layout                 │
│     Overdue · Was due Apr 5              │
└─────────────────────────────────────────┘
```

"Overdue" replaces the due date. Factual.

**Overdue AND stale:**
```
┌─────────────────────────────────────────┐
│  ○  Approve final layout                 │
│     Overdue · Waiting for your response  │
└─────────────────────────────────────────┘
```

Both signals shown. This is the loudest the client-facing UI ever gets. No red banners. No modal pop-ups. No countdown timers.

### 3.4 Task Ordering in Client Portal

The task list is sorted by implicit urgency. The client doesn't see priority labels (those are internal), but the ordering communicates what matters:

```
WAITING FOR YOU  (status: WAITING, assignee: this client)
  1. Overdue + stale tasks first (sorted by overdue days desc)
  2. Overdue tasks (sorted by due date asc)
  3. Stale tasks (sorted by staleness desc)
  4. Fresh waiting tasks (sorted by due date asc)

TO DO  (status: TODO/IN_PROGRESS, assignee: this client)
  1. Overdue first
  2. Due soonest first
  3. Most recently assigned last

DONE  (status: DONE)
  Most recently completed first
```

The client never knows this sorting exists. They just see their tasks in an order that happens to surface the most important ones at the top.

### 3.5 What Happens When Client Acts After Being Stale

When a client comments or marks a task done after the staleness nudges:

1. The staleness clock resets to zero.
2. All staleness indicators disappear from both client portal and Owner dashboard.
3. Owner gets a standard notification: "Anna commented on 'Approve final layout'" or "Anna completed 'Approve final layout.'"
4. No acknowledgment of the delay. The system doesn't say "Thanks for finally responding!" It acts like nothing happened. This is deliberate — it avoids making the client feel judged.

The notification to the Owner is identical whether the response comes at 1 hour or 5 days. The Owner can see in the activity history that there was a gap, but the notification itself carries no shame signal.

---

## 4. MINIMAL IMPLEMENTATION

### 4.1 No Cron Job Needed

The staleness check does not require a scheduled background job for MVP. Instead, it runs as a **lazy computation at query time.**

When the Owner dashboard loads:

1. Fetch all tasks where `assignee.role = CLIENT AND status != DONE`
2. For each task, compute staleness from the Activity table
3. Group tasks into dashboard sections based on thresholds
4. Check if nudge notifications should be sent (see 4.2)

This is a read-time computation, not a write-time event. It adds ~1 query to the dashboard page load (fetch client-assigned tasks + join activity for last action). For a workspace with 50 client tasks, this is well within acceptable performance.

### 4.2 Lazy Notification Dispatch

Nudge notifications are sent lazily when the Owner dashboard loads — not on a timer. This means:

- If the Owner opens their dashboard every morning, nudges go out every morning for newly-stale tasks.
- If the Owner doesn't open the app for 3 days, nudges wait until they do.

This is acceptable for MVP because:

1. The Owner is the primary user. They open the app daily.
2. A few hours' delay on a 48h nudge is irrelevant.
3. No infrastructure cost (no cron, no worker, no queue).

**Implementation pattern:**

```
// Pseudocode — runs inside the Owner dashboard server component

for each clientTask where staleness > 48h:
  if not exists Notification where
    type = 'CLIENT_NUDGE_48H'
    AND linkUrl contains task.id
    AND userId = task.assigneeId:
      createNotification(task.assigneeId, {
        type: 'CLIENT_NUDGE_48H',
        title: 'Waiting for your response',
        body: '"{title}" is waiting for your review.',
        linkUrl: '/portal/tasks/{task.id}'
      })

for each clientTask where staleness > 72h:
  // same pattern with CLIENT_NUDGE_72H and OWNER_STALE_ALERT
```

The check "has this notification already been sent?" prevents duplicates. The Owner can open their dashboard 50 times a day and each nudge fires exactly once.

### 4.3 What Exists Today vs. What's Needed

| Component | Current State | Change Needed |
|-----------|--------------|---------------|
| Notification model | Exists. Has `type`, `title`, `body`, `linkUrl`, `userId`, `read`. | No schema change. Use `type` field to store nudge type strings (CLIENT_NUDGE_48H, etc.) |
| Activity model | Exists. Logs all user actions with timestamps. | No schema change. Used as data source for staleness computation. |
| Notification service | `createNotification(userId, data)` exists. | No change. Called for nudge creation. |
| Dashboard page | `src/app/(app)/page.tsx` — renders task sections. | Add staleness computation + lazy notification dispatch in the server component. |
| Task queries | `task.queries.ts` — workspace-scoped queries. | Add `getClientTasksWithStaleness(workspaceId)` — joins Activity to compute last client action per task. |

### 4.4 Single New Function

One new query function is needed:

```
getClientTasksWithStaleness(workspaceId)
```

Returns: all tasks where `assignee.role = CLIENT AND status != DONE`, each annotated with:

- `lastClientAction: Date` — the most recent Activity entry by the assignee for this task, or `task.createdAt` if none
- `stalenessHours: number` — computed as `(NOW - lastClientAction)` in hours
- `isOverdue: boolean` — computed as `dueDate < today`

This is the only new query. Everything else — dashboard sections, sorting, notification dispatch — is application logic in the page server component, not in the database layer.

### 4.5 Exact Files Touched

| File | Change | Phase |
|------|--------|-------|
| `src/modules/tasks/task.queries.ts` | Add `getClientTasksWithStaleness()` | Phase 5 (Owner Dashboard) |
| `src/app/(app)/page.tsx` | Add staleness computation, lazy nudge dispatch, "NEEDS ATTENTION" section | Phase 5 |
| `src/app/(app)/components/NeedsAttentionSection.tsx` | NEW. Orange-themed task section for stale client tasks. Shows "🔇 {n} days silent" indicator. | Phase 5 |
| `src/app/(client)/portal/page.tsx` | Add "Waiting for your response" text on stale tasks. Sort by urgency. | Phase 4 |

**Total: 3 files modified, 1 file new.** All within existing Phase 4 and Phase 5 from IMPLEMENTATION-BLUEPRINT.md. No new phases needed.

### 4.6 What We Get Without Any Automation

With this minimal implementation, the Owner gets:

1. A dashboard that automatically surfaces the most urgent client situations every time they open the app.
2. A notification badge on the Home tab telling them exactly how many client tasks need attention.
3. One-tap navigation from any stale task to its detail page, where they can comment, reassign, or adjust.

The Client gets:

1. Task ordering that naturally surfaces what they should act on first.
2. Two gentle nudge notifications (at 48h and 72h) that appear in their Updates tab.
3. Subtle "Waiting for your response" text on stale tasks.

Nobody gets:

- Email reminders (requires SMTP setup — Phase 2+ of a separate effort)
- Push notifications (requires service worker + push API — separate effort)
- Automated follow-up messages (too robotic for client relationships)
- Slack/WhatsApp pings (requires integration work)

All of these can be layered on later. The operational intelligence — knowing which tasks are stale and surfacing them — is the hard part, and it's solved here entirely inside the app with zero external dependencies.

### 4.7 Future: Graduating to Real Automation

When the time comes to add actual background processing, the upgrade path is clean:

1. **Add a daily cron job** (Vercel Cron, Railway, or simple `setInterval` in a long-running process) that calls `getClientTasksWithStaleness()` and dispatches notifications. Remove the lazy dispatch from the dashboard page.

2. **Add email delivery** to `createNotification()` — after creating the DB record, also send an email via Resend/Postmark/SendGrid. The notification content is already formatted.

3. **Add push notifications** via web push or mobile push. Again, the notification record already exists — just add a delivery channel.

The operational logic (thresholds, rules, deduplication) doesn't change. Only the delivery mechanism upgrades.
