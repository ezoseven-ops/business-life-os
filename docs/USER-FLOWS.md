# Business Life OS — User Flows by Role

**Version:** 1.0
**Date:** April 2, 2026
**Depends on:** ARCHITECTURE-RBAC.md
**Status:** Design Specification — Not Yet Implemented

---

## 1. CLIENT FLOW

The Client is the most constrained and most carefully designed role. They are an external stakeholder — a customer, a vendor, a partner — who needs visibility into their work without seeing internal operations.

### 1.1 First Contact: The Invitation

The client has never heard of Business Life OS. They get an email.

```
Subject: Karol invited you to collaborate on "Farma Foto z Anką"

Hi Anna,

Karol from Karol's Workspace invited you to view your project
and track progress together.

[Open Your Portal →]

This link expires in 7 days.
```

The email is short, professional, not pushy. The button goes to `/invite/{token}`.

### 1.2 First Screen: Accept & Set Up

The invite page shows:

```
┌─────────────────────────────┐
│                             │
│  Karol's Workspace          │
│  invited you to collaborate │
│                             │
│  Project: Farma Foto z Anką │
│                             │
│  ┌───────────────────────┐  │
│  │ Your name             │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Set a password         │  │
│  └───────────────────────┘  │
│                             │
│  [ Accept & Continue ]      │
│                             │
└─────────────────────────────┘
```

No workspace creation. No onboarding wizard. Name, password, done. They land directly in their portal.

### 1.3 The Client Portal: What They See

After accepting, the client sees a completely different app from what the Owner sees. The navigation, dashboard, and available actions are all stripped down.

**Client Bottom Navigation (3 items, no FAB):**

```
[ My Tasks ]    [ Updates ]    [ Profile ]
```

No Home. No Inbox. No People. No FAB menu. Three tabs, that's it.

**Client Dashboard — "My Tasks" (default tab):**

```
┌─────────────────────────────────┐
│  Farma Foto z Anką              │
│                                 │
│  TO DO                       2  │
│  ┌─────────────────────────┐    │
│  │ ○  Approve final layout │    │
│  │    Due Apr 5 · High     │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ ○  Review brand colors  │    │
│  │    Due Apr 8 · Medium   │    │
│  └─────────────────────────┘    │
│                                 │
│  WAITING FOR YOU             1  │
│  ┌─────────────────────────┐    │
│  │ ⏳ Send product photos  │    │
│  │    Due Apr 3 · Urgent   │    │
│  └─────────────────────────┘    │
│                                 │
│  DONE                        3  │
│  ┌─────────────────────────┐    │
│  │ ✓  Signed contract      │    │
│  │    Completed Mar 28     │    │
│  └─────────────────────────┘    │
│  + 2 more completed             │
│                                 │
└─────────────────────────────────┘
```

Key design choices:

- **Grouped by action needed**, not by status. "TO DO" are tasks assigned to them that need action. "WAITING FOR YOU" is a special label for tasks with status WAITING where assignee is the client — this is the team telling the client "we're blocked on you."
- **Project name is the page heading.** If the client has access to multiple projects, a project switcher appears at the top. No workspace name visible — clients don't care about the workspace.
- **No task creation.** Clients cannot create tasks. They respond to tasks assigned to them.
- **Due dates are prominent.** The most important signal for a client is "when do I need to do this?"

### 1.4 Client Task Detail

Client taps a task:

```
┌─────────────────────────────────┐
│  ← Approve final layout         │
│                                 │
│  STATUS                         │
│  [ To Do ] [ Done ]             │
│                                 │
│  DUE DATE                       │
│  April 5, 2026                  │
│                                 │
│  DESCRIPTION                    │
│  Please review the attached     │
│  layout and confirm it's ready  │
│  for print. Pay attention to    │
│  the logo placement on page 3.  │
│                                 │
│  ATTACHMENTS                    │
│  📎 layout-v3-final.pdf         │
│                                 │
│  ─────────────────────────────  │
│  COMMENTS                    2  │
│  ┌─────────────────────────┐    │
│  │ Karol · Mar 31          │    │
│  │ Updated the layout per  │    │
│  │ your feedback on colors │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Anna (You) · Mar 30     │    │
│  │ Logo on page 3 is too   │    │
│  │ small, please enlarge   │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Write a comment...      │    │
│  │                    Send │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

What the client CAN do on a task:

- **Change status:** Only between `To Do` and `Done`. Two buttons. No "In Progress" or "Waiting" — those are internal statuses. When a client marks "Done", it means "I've done my part."
- **Add a comment.** This is the primary communication channel. No email, no separate inbox, no chat. Comment on the task.
- **View and download attachments.**
- **View description and due date.**

What the client CANNOT do:

- Edit title, description, due date, priority, or assignee.
- See internal comments (marked `internal: true`).
- See who else is assigned to tasks in the project.
- Delete anything.

### 1.5 Client "Updates" Tab

The second tab shows a chronological feed of things that changed on their tasks:

```
┌─────────────────────────────────┐
│  Updates                        │
│                                 │
│  TODAY                          │
│  Karol commented on             │
│  "Approve final layout"         │
│  "Updated the layout per..."    │
│  2h ago                         │
│                                 │
│  YESTERDAY                      │
│  Karol assigned you             │
│  "Review brand colors"          │
│  Due Apr 8                      │
│                                 │
│  Karol completed                │
│  "Design homepage mockup"       │
│                                 │
│  MAR 28                         │
│  Karol created                  │
│  "Send product photos"          │
│  Due Apr 3                      │
│                                 │
└─────────────────────────────────┘
```

This is a filtered activity feed — only events related to the client's visible tasks. No internal noise. When a client taps an update, it navigates to the task detail.

### 1.6 Client "Profile" Tab

Minimal:

```
┌─────────────────────────────────┐
│  Profile                        │
│                                 │
│  ACCOUNT                        │
│  ┌───────────────────────┐      │
│  │ A   Anna Kowalska     │      │
│  │     anna@example.com  │      │
│  └───────────────────────┘      │
│                                 │
│  WORKSPACE                      │
│  Karol's Workspace              │
│                                 │
│  [ Sign out ]                   │
│                                 │
└─────────────────────────────────┘
```

No settings. No integrations. No workspace management. Name, email, sign out.

### 1.7 Client Daily Workflow

A real client's day with the app:

1. **Morning push notification:** "You have 1 task due today: Send product photos"
2. Opens app. Sees "WAITING FOR YOU" section with the urgent task at top.
3. Taps the task. Reads description. Downloads attachment reference.
4. Does the work offline (takes photos, emails files, etc.)
5. Returns to app. Adds comment: "Photos sent via email, 15 high-res JPGs."
6. Taps "Done."
7. Gets notification later: "Karol commented on 'Send product photos': Got them, thanks!"
8. Checks Updates tab next day — sees a new task was assigned.

Total app time per day: **2-5 minutes.** That's the target.

---

## 2. OWNER FLOW

The Owner is the operator. They need to see everything at a glance, identify problems before they escalate, and control the machine.

### 2.1 Owner Dashboard — The Command Center

The current home page shows a greeting, quick actions, Today's Focus, and Activity. For the Owner, this becomes a **real-time operations dashboard.**

```
┌───────────────────────────────────┐
│  Home                        🔔 5 │
│                                   │
│  Good morning, Karol              │
│  3 overdue · 7 due today · 2 🔥  │
│                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ Task │ │Event │ │ Note │      │
│  └──────┘ └──────┘ └──────┘      │
│                                   │
│  ═══════════════════════════════  │
│  🔴 OVERDUE                   3  │
│  ┌─────────────────────────────┐  │
│  │ ⚠ Send product photos      │  │
│  │   Farma Foto · Anna · -1d  │  │
│  ├─────────────────────────────┤  │
│  │ ⚠ Invoice Q1 consulting    │  │
│  │   Business Life · Karol · -3d │
│  ├─────────────────────────────┤  │
│  │ ⚠ Review contract draft    │  │
│  │   Farma Foto · unassigned · -2d│
│  └─────────────────────────────┘  │
│                                   │
│  ═══════════════════════════════  │
│  🟡 WAITING ON CLIENTS         2  │
│  ┌─────────────────────────────┐  │
│  │ ⏳ Approve final layout    │  │
│  │   Farma Foto · Anna · Apr 5│  │
│  ├─────────────────────────────┤  │
│  │ ⏳ Sign NDA document       │  │
│  │   NewCo · Marek · Apr 4    │  │
│  └─────────────────────────────┘  │
│                                   │
│  ═══════════════════════════════  │
│  📋 DUE TODAY                  4  │
│  ┌─────────────────────────────┐  │
│  │ Debug test task             │  │
│  │   Farma Foto · Karol · High│  │
│  ├─────────────────────────────┤  │
│  │ Send invoice to John        │  │
│  │   BizLife · Karol · Medium  │  │
│  └─────────────────────────────┘  │
│  + 2 more                         │
│                                   │
│  ═══════════════════════════════  │
│  Activity                   See all│
│  Karol created a event · 1m ago   │
│  Anna commented · 2h ago          │
│  Marek viewed "Sign NDA" · 3h ago │
│                                   │
└───────────────────────────────────┘
```

### 2.2 What Changed vs. Current Dashboard

| Current | Owner Dashboard |
|---------|----------------|
| Greeting + task count | Greeting + **problem count** (overdue, due today, blocked) |
| "Today's Focus" (flat list) | **Three priority sections:** Overdue (red), Waiting on Clients (yellow), Due Today (neutral) |
| Checkbox per task (non-functional) | Each task card is tappable → navigates to detail |
| Activity (own actions only) | Activity includes **client actions** — "Anna commented", "Marek viewed" |
| No problem detection | **Overdue section is always first.** If there are 0 overdue, section is hidden. If there are overdue, they scream. |

### 2.3 The "Waiting on Clients" Section — Why It Matters

This is the single most important operational insight. When a task has `status: WAITING` and the assignee is a CLIENT user, the Owner needs to know:

- Which client is blocking progress?
- How long have they been blocking?
- Is the deadline approaching?

This section shows those tasks with the client's name and the deadline. If a client hasn't responded in 48h, the task gets a subtle "no response" indicator. The Owner can then decide to follow up via comment, WhatsApp, or phone.

### 2.4 Owner Navigation

The Owner sees the full navigation — everything the current app has, plus a Team section:

**Bottom Nav:** `[ Home ] [ Inbox ] [ + ] [ Tasks ] [ People ]`

**Accessible Pages (unchanged from current + new):**

- `/` — Dashboard (command center above)
- `/inbox` — All conversations (Telegram, WhatsApp)
- `/tasks` — All tasks across all projects, all assignees
- `/people` — CRM contacts
- `/notes` — All notes
- `/calendar` — All events
- `/settings` — Workspace settings + **Team management** (new)
- `/settings/team` — Invite/manage TEAM and CLIENT users (new)

### 2.5 Owner: Team Management Screen

Accessed from Settings:

```
┌───────────────────────────────────┐
│  ← Team                    + Invite│
│                                   │
│  TEAM MEMBERS                  1  │
│  ┌─────────────────────────────┐  │
│  │ K  Karol (You)       Owner  │  │
│  │    karol@businesslifeos.com │  │
│  └─────────────────────────────┘  │
│                                   │
│  CLIENTS                       2  │
│  ┌─────────────────────────────┐  │
│  │ A  Anna Kowalska     Client │  │
│  │    anna@example.com         │  │
│  │    Project: Farma Foto z Anką│  │
│  └─────────────────────────────┘  │
│  ┌─────────────────────────────┐  │
│  │ M  Marek Nowak       Client │  │
│  │    marek@newco.pl           │  │
│  │    Project: NewCo Branding  │  │
│  └─────────────────────────────┘  │
│                                   │
│  PENDING INVITATIONS           1  │
│  ┌─────────────────────────────┐  │
│  │ ✉  jan@studio.com    Team   │  │
│  │    Sent 2 days ago          │  │
│  │    [ Resend ] [ Revoke ]    │  │
│  └─────────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

Tapping "+ Invite" opens a form:

```
┌───────────────────────────────────┐
│  ← Invite                        │
│                                   │
│  EMAIL                            │
│  ┌───────────────────────────┐    │
│  │ email@example.com         │    │
│  └───────────────────────────┘    │
│                                   │
│  ROLE                             │
│  [ Team Member ]  [ Client ]      │
│                                   │
│  ── if Client selected ──         │
│  ASSIGN TO PROJECTS               │
│  ☑ Farma Foto z Anką              │
│  ☐ NewCo Branding                 │
│  ☐ Business Life OS               │
│                                   │
│  [ Send Invitation ]              │
│                                   │
└───────────────────────────────────┘
```

### 2.6 Owner: Project-Level View

When the Owner goes to a project, they see a tab layout:

```
┌───────────────────────────────────┐
│  ← Farma Foto z Anką              │
│                                   │
│  [ Tasks ] [ Members ] [ Notes ]  │
│                                   │
│  Members tab shows:               │
│  ┌─────────────────────────────┐  │
│  │ K Karol         Lead        │  │
│  │ A Anna          Client      │  │
│  │           [ + Add Member ]  │  │
│  └─────────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

This is where the Owner (or Team member) can add a Client to a project, or see who has access.

### 2.7 Owner's Daily Workflow

1. **Morning:** Opens app. Sees 3 overdue tasks in red. One is assigned to client Anna (-1 day). Opens it, adds comment: "Hi Anna, any update on the photos? We need them to proceed."
2. **Checks "Waiting on Clients":** Marek's NDA signing is due tomorrow. No action needed yet.
3. **Checks "Due Today":** 4 tasks. 2 are his own. Works through them, marks as done.
4. **Inbox:** 2 new Telegram messages from a contact. Reads, creates a task from one of them.
5. **Afternoon:** Gets a notification — "Anna commented on 'Send product photos'." Opens it, reviews, marks task as In Progress.
6. **End of day:** Quick check — 0 overdue. Good. Creates a note for tomorrow's meeting.

Total dashboard time: **5-10 minutes per check, 2-3 checks per day.**

---

## 3. TEAM MEMBER FLOW

The Team member is a co-worker. They see almost everything the Owner sees, but they can't manage workspace settings, roles, or integrations. Their view is work-focused, not control-focused.

### 3.1 Team Dashboard

The Team member's home page is similar to the Owner's but scoped to their assigned work first:

```
┌───────────────────────────────────┐
│  Home                        🔔 3 │
│                                   │
│  Good morning, Jan                │
│  2 tasks due today                │
│                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ Task │ │Event │ │ Note │      │
│  └──────┘ └──────┘ └──────┘      │
│                                   │
│  ═══════════════════════════════  │
│  🔴 YOUR OVERDUE              1  │
│  ┌─────────────────────────────┐  │
│  │ ⚠ Write blog post draft    │  │
│  │   Content · Jan · -2d       │  │
│  └─────────────────────────────┘  │
│                                   │
│  ═══════════════════════════════  │
│  📋 YOUR TASKS TODAY           2  │
│  ┌─────────────────────────────┐  │
│  │ Design social media banner  │  │
│  │   Farma Foto · Jan · Med   │  │
│  ├─────────────────────────────┤  │
│  │ Review Anna's feedback      │  │
│  │   Farma Foto · Jan · High  │  │
│  └─────────────────────────────┘  │
│                                   │
│  ═══════════════════════════════  │
│  Activity                         │
│  Anna commented on "Layout" · 1h  │
│  Karol assigned you "Review" · 3h │
│                                   │
└───────────────────────────────────┘
```

Key differences from Owner dashboard:

- **No "Waiting on Clients" section.** That's the Owner's concern. Team members see their own work.
- **Sections are "Your Overdue" and "Your Tasks Today"** — scoped to `assigneeId = userId`.
- **Activity shows things relevant to them** — tasks assigned to them, comments on their tasks, mentions.

### 3.2 Team Navigation

**Bottom Nav:** `[ Home ] [ Inbox ] [ + ] [ Tasks ] [ People ]`

Same as Owner. Team members have full access to:

- All tasks (can see tasks assigned to others, not just their own)
- All notes
- All events
- CRM contacts
- Inbox / messages

What they CANNOT access:

- Settings > Workspace settings (name, slug)
- Settings > Integrations management
- Settings > Team management (invite/remove users) — unless inviting a Client to a project

### 3.3 Team: Task Interactions

A Team member can:

- **Create tasks** in any project
- **Edit tasks** they created or are assigned to (title, description, status, priority, due date)
- **Assign tasks** to anyone (Owner, other Team, or a Client)
- **Comment** on any task (can mark comments as internal)
- **Delete** tasks they created

A Team member CANNOT:

- Delete tasks created by others
- Edit tasks they neither created nor are assigned to (they can view and comment)

### 3.4 Team: Working With Clients

When a Team member assigns a task to a Client, they should be aware they're assigning to an external user. The assignee dropdown shows:

```
TEAM
  Karol (Owner)
  Jan (You)

CLIENTS
  Anna Kowalska · Farma Foto
  Marek Nowak · NewCo
```

The CLIENT section is visually distinct. When a client is selected as assignee, a subtle note appears: "Anna will see this task in her portal."

When writing a comment on a task that a Client can see, there's a toggle:

```
┌─────────────────────────────────┐
│ Great work on the design.       │
│                                 │
│ ☐ Internal only (hidden from    │
│   client)                       │
│                          Send   │
└─────────────────────────────────┘
```

Unchecked = client sees it. Checked = only OWNER/TEAM see it. Default: unchecked (public).

### 3.5 Team Daily Workflow

1. **Morning:** Opens app. Sees 1 overdue (blog post, -2 days). Knows to prioritize it.
2. **Checks "Your Tasks Today":** 2 tasks. Opens the high-priority one first — "Review Anna's feedback." Goes to task, reads Anna's comment, makes changes, comments back. Marks as Done.
3. **Gets notification mid-day:** "Karol assigned you 'Prepare presentation deck' — Due Apr 5." Opens it, reads description, starts working.
4. **Inbox:** Checks if any messages need attention. Sees a Telegram message from a new contact, adds them to CRM.
5. **Creates a task** from the FAB: "Follow up with printer" in Farma Foto project, assigns to self.
6. **End of day:** Marks the blog post as In Progress. Will finish tomorrow.

---

## 4. SYSTEM LOGIC

What happens behind the scenes when key events occur.

### 4.1 Task Created

```
TRIGGER: createTaskAction(input)
ACTOR: Owner or Team member (never Client)

ACTIONS:
1. Validate input (Zod schema)
2. Create task in database
3. Log activity: "{actor} created a task"
4. IF task has an assignee:
   a. Create notification for assignee:
      "{actor} assigned you '{title}'"
   b. IF assignee is a CLIENT:
      - Verify assignee has ProjectMember access to the project
      - If not, auto-create ProjectMember record (role: VIEWER)
5. Revalidate /tasks and project page cache
```

### 4.2 Task Assigned (or Reassigned)

```
TRIGGER: updateTaskAction(id, { assigneeId })
ACTOR: Owner or Team member

ACTIONS:
1. Update task.assigneeId
2. Log activity: "{actor} assigned '{title}' to {assignee}"
3. Notify NEW assignee: "You were assigned '{title}'"
4. IF old assignee existed and is different:
   Notify OLD assignee: "You were unassigned from '{title}'"
5. IF new assignee is CLIENT:
   - Ensure ProjectMember record exists
   - Task will now appear in client's portal
6. Revalidate caches
```

### 4.3 Task Completed

```
TRIGGER: updateTaskAction(id, { status: 'DONE' })
ACTOR: Owner, Team, or Client

ACTIONS:
1. Update task.status = DONE
2. Log activity: "{actor} completed '{title}'"
3. IF actor is CLIENT:
   Notify task CREATOR: "Client {name} completed '{title}'"
   Notify OWNER (if different): same
4. IF actor is TEAM/OWNER:
   Notify assignee (if different from actor): "'{title}' was marked done"
5. Revalidate caches
```

### 4.4 Client Comments

```
TRIGGER: addCommentAction(taskId, content)
ACTOR: Client

ACTIONS:
1. Verify client has access to this task
   (assigneeId = userId OR creatorId = userId OR unassigned in their project)
2. Create comment with internal = false (always public for clients)
3. Log activity: "Client {name} commented on '{title}'"
4. Notify task CREATOR: "{client} commented on '{title}': '{preview}'"
5. Notify OWNER (if different from creator): same
6. Notify other commenters on this task (except the client themselves)
7. Revalidate task detail cache
```

This is critical: **every client comment creates a notification for the Owner.** Client communication is never silent.

### 4.5 Deadline Missed

```
TRIGGER: Scheduled job runs daily at 00:01 workspace local time
CHECK: All tasks WHERE dueDate < today AND status NOT IN (DONE)

ACTIONS:
1. For each overdue task:
   a. IF not already flagged overdue today:
      - Notify task ASSIGNEE: "'{title}' is overdue (due {date})"
      - Notify task CREATOR (if different): same
      - Notify OWNER (if different from both): same
   b. IF assignee is CLIENT and task has been overdue > 48h:
      - Add to Owner's "Stale Client Tasks" (future: automated follow-up)
2. These tasks appear in the red "OVERDUE" section on Owner/Team dashboards
```

### 4.6 Invitation Accepted

```
TRIGGER: Client clicks invite link and submits account creation form
INPUT: invitation.token

ACTIONS:
1. Validate token exists, status = PENDING, not expired
2. Create User record:
   - email: invitation.email
   - name: from form
   - role: invitation.role (CLIENT or TEAM)
   - workspaceId: invitation.workspaceId
3. IF role = CLIENT:
   a. Create ProjectMember records for each projectId in invitation.projectIds
      (role: VIEWER)
   b. Look up Person by email match in workspace:
      IF found, set person.userId = newUser.id (link CRM contact to user account)
4. Update invitation: status = ACCEPTED, acceptedAt = now()
5. Log activity: "{name} joined the workspace as {role}"
6. Notify OWNER: "{name} accepted your invitation"
7. Create session, redirect to appropriate dashboard
```

### 4.7 Task Status Change Visibility

When a task's status changes, the system must decide who to notify and what they see:

| Status Change | Who Sees It | Label for Client |
|---------------|-------------|------------------|
| TODO → IN_PROGRESS | Owner, Team, (Client if assigned) | "Work started on '{title}'" |
| IN_PROGRESS → WAITING | Owner, Team | Not visible as status to Client — Client sees task as "To Do" with their name on it |
| WAITING → TODO | Owner, Team | Not visible |
| Any → DONE | Everyone with access | "'{title}' completed" |
| DONE → TODO | Owner, Team, (Client if assigned) | "'{title}' reopened" |

**Client status mapping:**

The Client sees only two statuses: "To Do" and "Done." Internally the system has 4 statuses (TODO, IN_PROGRESS, WAITING, DONE). The mapping:

| Internal Status | Client Sees |
|-----------------|-------------|
| TODO | To Do |
| IN_PROGRESS | To Do |
| WAITING | To Do (with "Waiting for you" label if they're the assignee) |
| DONE | Done |

---

## 5. UI BEHAVIOR BY ROLE

### 5.1 Navigation Comparison

| Element | OWNER | TEAM | CLIENT |
|---------|-------|------|--------|
| **Bottom Nav** | Home, Inbox, +, Tasks, People | Home, Inbox, +, Tasks, People | My Tasks, Updates, Profile |
| **FAB Menu** | Event, Task, Note, Voice | Event, Task, Note, Voice | None |
| **Home** | Command center (overdue, waiting, due today) | Personal focus (your overdue, your tasks today) | N/A — "My Tasks" IS their home |
| **Inbox** | Full message list | Full message list | None |
| **Tasks** | All tasks, all projects, all assignees | All tasks, all projects, all assignees | Only their assigned tasks in their projects |
| **People** | Full CRM | Full CRM | None |
| **Notes** | All notes | All notes | None |
| **Calendar** | All events | All events | None (future: events they're invited to) |
| **Settings** | Full settings + Team Management | Profile only | Profile only |
| **Notifications** | All activity | Activity on their tasks + assignments | Activity on their tasks only |

### 5.2 What Each Role CANNOT See

**CLIENT cannot see:**

- Other clients' tasks
- Internal comments
- CRM contacts
- Inbox / messages
- Notes (unless project-scoped, future)
- Calendar (unless event attendee, future)
- Workspace settings
- Team list (beyond names on their tasks)
- Task priority labels (they see due dates, not internal priority scoring)
- "In Progress" or "Waiting" status (simplified to "To Do" / "Done")

**TEAM cannot see:**

- Workspace settings (name, slug, billing)
- Integration configuration (Telegram bot token, etc.)
- Team management (invite/remove/change roles) — except adding Clients to projects

**OWNER cannot see:** Everything is visible. No restrictions.

### 5.3 Visual Differentiation

The app should feel like the same product for all roles, not three different apps. Key differences are what's present and what's absent — not different colors or layouts.

- **Same color scheme, same typography, same card styles.** A task card looks the same whether you're a Client or an Owner.
- **Navigation is the differentiator.** Client sees 3 tabs, TEAM/OWNER see 5 tabs + FAB.
- **Dashboard content is the differentiator.** Client sees their tasks. Owner sees the operations view. Team sees their personal focus.
- **No "admin panel" aesthetic.** The Owner dashboard is not a separate admin area. It's the same Home page with different content.

---

## 6. MINIMAL MVP VERSION

### 6.1 What to Build First

Strip every nice-to-have. The MVP must deliver exactly three things:

1. **Owner can invite a Client and assign them tasks.**
2. **Client can see their tasks, mark them done, and comment.**
3. **Owner can see what's overdue and what's waiting on clients.**

Everything else is phase 2.

### 6.2 MVP Scope — IN

| Feature | Details |
|---------|---------|
| **UserRole: CLIENT** | Add to enum, add to session |
| **Invitation (link only)** | No email sending. Owner copies a link. Client opens it, creates account. |
| **ProjectMember table** | Scoping boundary. Backfill for existing users. |
| **Client portal: My Tasks** | Filtered task list — only tasks assigned to client in their projects. Grouped by To Do / Done. |
| **Client portal: Task detail** | View-only + comment + mark Done. No edit. |
| **Client portal: Profile tab** | Name, email, sign out. |
| **Client nav: 3 tabs** | My Tasks, Updates, Profile. No FAB. |
| **Comment.internal flag** | Boolean on comment. Client can't see internal comments. |
| **Owner dashboard: Overdue section** | Tasks where dueDate < today AND status != DONE. |
| **Owner dashboard: Waiting on Clients section** | Tasks where status = WAITING AND assignee.role = CLIENT. |
| **Settings > Team page** | List users + copy invite link. |
| **Access control in actions** | `requireRole()` and `requireProjectAccess()` in all server actions. |
| **getById workspace checks** | Fix existing security gap: verify workspace ownership on all single-entity queries. |

### 6.3 MVP Scope — OUT (Phase 2+)

| Feature | Why Deferred |
|---------|-------------|
| Email invitation delivery | Can use copy-link for now. Email requires SMTP/Resend setup. |
| Client event visibility | Calendar is not critical for client collaboration. |
| Client file uploads | Comments are enough for MVP communication. |
| Client project-scoped notes | Notes are internal for MVP. |
| Multi-project client view | Support one project per client invite initially. Multi-project later. |
| Overdue notification emails | Push notifications or in-app only for MVP. |
| Automated follow-ups | Manual comments for now. |
| Client self-service task creation | Clients respond to tasks, not create them, in MVP. |
| Team member role permissions (LEAD vs CONTRIBUTOR) | All Team members have equal access in MVP. ProjectMemberRole exists in schema but is not enforced. |
| Per-task visibility overrides | If it's in the project and assigned to client, client sees it. No per-task hide/show. |

### 6.4 MVP Implementation Order

```
Step 1: Schema migration (1 day)
  - Add CLIENT to UserRole
  - Create ProjectMember table + backfill
  - Add Comment.internal
  - Add Person.userId
  - Add Invitation table

Step 2: Access control (1 day)
  - requireRole() + requireProjectAccess()
  - Fix getById workspace checks
  - Add client-scoped task query

Step 3: Invitation flow (1 day)
  - Settings > Team page
  - Invite form (copy link)
  - /invite/[token] accept page
  - Account creation for invited users

Step 4: Client portal (2 days)
  - Client layout (3-tab nav, no FAB)
  - My Tasks page (filtered task list)
  - Task detail (view + comment + done)
  - Updates feed
  - Profile page

Step 5: Owner dashboard upgrade (1 day)
  - Overdue section
  - Waiting on Clients section
  - Click-through to task detail

Step 6: Comment internal flag (0.5 day)
  - Toggle in comment form for OWNER/TEAM
  - Filter in client queries

Step 7: Testing + polish (1.5 days)
  - E2E test: invite → accept → see tasks → comment → done
  - E2E test: owner creates task → assigns to client → client completes
  - Edge cases: expired invite, duplicate email, etc.
```

**Total: ~8 working days for a fully functional multi-role system.**

### 6.5 The Acid Test

The MVP is done when this scenario works end-to-end:

1. Karol (Owner) opens Settings > Team. Clicks "Invite Client."
2. Enters anna@example.com, selects "Client", checks "Farma Foto z Anką" project.
3. Copies the invite link. Sends it to Anna via WhatsApp.
4. Anna opens the link. Creates her account (name + password).
5. Anna sees "Farma Foto z Anką" with 2 tasks assigned to her.
6. Anna opens "Approve final layout." Reads the description. Adds comment: "Looks good, approved."
7. Anna taps "Done."
8. Karol gets a notification: "Anna completed 'Approve final layout.'"
9. Karol opens the task. Sees Anna's comment. Sees task is Done.
10. Karol checks his dashboard. The overdue section is clear. Life is good.

That's the entire product in 10 steps.
