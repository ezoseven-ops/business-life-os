# Business Life OS — Roles, Permissions & Access Control Architecture

**Version:** 1.0
**Date:** April 2, 2026
**Author:** System Architect
**Status:** Design Specification — Not Yet Implemented

---

## Executive Summary

This document transforms Business Life OS from a single-user/flat-member system into a multi-user operational platform with three distinct roles: Owner, Team Member, and Client. It covers the role model, permission matrix, Prisma schema changes, access control enforcement, invitation flow, migration plan, and risks.

### Current State

The system currently has two roles (`OWNER`, `MEMBER`) in the `UserRole` enum but enforces almost no distinction between them. Every authenticated user in a workspace sees everything. There is no concept of a Client user, no invitation system, no per-resource permission checks, and no project-level membership scoping. The `requireOwner()` utility exists but is only used for workspace settings updates.

### Key Design Decisions

1. **Client is a User, not a Person.** The existing `Person` model is a CRM contact record (external, no login). A Client is a real `User` account with limited workspace access.

2. **Person-to-User linking.** A `Person` (CRM contact) can optionally be linked to a `User` (Client account) via a new `userId` field on `Person`. This bridges CRM data with login access.

3. **Project-level scoping is the access boundary.** Clients don't see the whole workspace — they see only projects they're explicitly added to. Team Members see all projects in the workspace.

4. **No ABAC or policy engine.** We use simple role + ownership + membership checks in server actions. No external policy framework. Keeps it auditable and debuggable.

---

## 1. Role Model

### 1.1 Role Definitions

| Role | Identity | Description |
|------|----------|-------------|
| **OWNER** | Workspace creator | Full control. Manages workspace settings, billing, integrations, roles, and all data. One per workspace. |
| **TEAM** | Internal collaborator | Can create and manage tasks, notes, events, people. Sees all projects. Cannot manage workspace settings or roles. |
| **CLIENT** | External stakeholder | Limited portal view. Sees only projects they're assigned to. Can view and comment on their tasks. Cannot see internal data, other clients, or CRM contacts. |

### 1.2 Prisma Enum Change

```prisma
enum UserRole {
  OWNER
  TEAM      // renamed from MEMBER
  CLIENT
}
```

`MEMBER` is renamed to `TEAM` because "member" is ambiguous — everyone in a workspace is technically a member. `TEAM` makes the distinction from `CLIENT` immediately clear in code.

### 1.3 Role Hierarchy

```
OWNER > TEAM > CLIENT
```

An OWNER can do everything a TEAM member can. A TEAM member can do everything a CLIENT can. Permissions are additive — higher roles inherit lower role capabilities.

---

## 2. Permission Matrix

### 2.1 Entity-Level Permissions

| Action | OWNER | TEAM | CLIENT |
|--------|-------|------|--------|
| **Workspace** | | | |
| View workspace settings | Yes | No | No |
| Edit workspace settings | Yes | No | No |
| Manage integrations | Yes | No | No |
| Invite/remove TEAM | Yes | No | No |
| Invite/remove CLIENT | Yes | Yes | No |
| **Projects** | | | |
| Create project | Yes | Yes | No |
| View all projects | Yes | Yes | No |
| View assigned projects | Yes | Yes | Yes |
| Edit project settings | Yes | Creator only | No |
| Delete project | Yes | Creator only | No |
| Add members to project | Yes | Yes | No |
| **Tasks** | | | |
| Create task (any project) | Yes | Yes | No |
| Create task (assigned project) | Yes | Yes | No |
| View tasks (any project) | Yes | Yes | No |
| View tasks (assigned project) | Yes | Yes | Own + unassigned |
| Edit any task | Yes | No | No |
| Edit own/created task | Yes | Yes | No |
| Edit assigned task (status/comment) | Yes | Yes | Yes |
| Delete task | Yes | Creator only | No |
| Assign task to others | Yes | Yes | No |
| **Notes** | | | |
| Create note | Yes | Yes | No |
| View all notes | Yes | Yes | No |
| View project-scoped notes | Yes | Yes | Assigned projects |
| Edit own notes | Yes | Yes | No |
| Delete own notes | Yes | Yes | No |
| **Events** | | | |
| Create event | Yes | Yes | No |
| View all events | Yes | Yes | No |
| View events (invited/created) | Yes | Yes | Own only |
| Edit own events | Yes | Yes | No |
| Delete own events | Yes | Yes | No |
| **People (CRM)** | | | |
| View contacts | Yes | Yes | No |
| Create/edit contacts | Yes | Yes | No |
| Delete contacts | Yes | No | No |
| **Messages** | | | |
| View inbox | Yes | Yes | No |
| Reply to messages | Yes | Yes | No |
| **Activity** | | | |
| View all activity | Yes | Yes | No |
| View own activity | Yes | Yes | Yes |
| **Notifications** | | | |
| Receive notifications | Yes | Yes | Yes (own tasks only) |

### 2.2 Client Visibility Rules (Detail)

A CLIENT user sees:

- **Projects:** Only those where they appear in `ProjectMember` with `role: CLIENT`
- **Tasks:** Within assigned projects — only tasks where `assigneeId = userId`, `creatorId = userId`, or `assigneeId = null` (unassigned tasks in their project). They never see tasks assigned to others.
- **Notes:** Only project-scoped notes in their assigned projects. Never workspace-level notes.
- **Events:** Only events they created or where they appear in `EventAttendee`.
- **People:** Never. The CRM is internal-only.
- **Messages:** Never. Inbox is internal-only.
- **Activity:** Only their own actions.

### 2.3 Field-Level Restrictions for Client

Even when a CLIENT can see a task, certain fields are hidden:

- Internal comments (marked `internal: true`) — hidden
- Creator info — visible (they should know who assigned it)
- Other assignee's tasks — hidden
- Project-level financial data (future) — hidden

---

## 3. Prisma Schema Changes

### 3.1 UserRole Enum Update

```prisma
enum UserRole {
  OWNER
  TEAM
  CLIENT
}
```

### 3.2 New Model: ProjectMember

This is the core access scoping table. It defines who has access to which project and in what capacity.

```prisma
model ProjectMember {
  id        String             @id @default(cuid())
  projectId String
  userId    String
  role      ProjectMemberRole  @default(CONTRIBUTOR)
  addedById String?
  createdAt DateTime           @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedBy   User?    @relation("AddedByUser", fields: [addedById], references: [id])

  @@unique([projectId, userId])
  @@index([userId])
  @@index([projectId])
}

enum ProjectMemberRole {
  LEAD        // Project lead — full control within project
  CONTRIBUTOR // Team member — can create/edit tasks
  VIEWER      // Client or observer — read + comment only
}
```

**Why a separate table instead of a JSON array?** Because we need to query "which projects can this user see" efficiently, and we need to store per-project roles. A join table is the correct relational pattern.

### 3.3 New Model: Invitation

```prisma
model Invitation {
  id          String           @id @default(cuid())
  email       String
  role        UserRole         @default(TEAM)
  token       String           @unique @default(cuid())
  status      InvitationStatus @default(PENDING)
  workspaceId String
  invitedById String
  projectIds  String[]         // Projects to auto-assign on accept (for CLIENT)
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime         @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy   User      @relation(fields: [invitedById], references: [id])

  @@index([token])
  @@index([workspaceId])
  @@index([email])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}
```

### 3.4 New Model: EventAttendee

```prisma
model EventAttendee {
  id       String                @id @default(cuid())
  eventId  String
  userId   String
  status   EventAttendeeStatus   @default(PENDING)

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([eventId, userId])
  @@index([userId])
}

enum EventAttendeeStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

### 3.5 Comment Model Update

Add an `internal` flag so team members can leave comments that clients cannot see.

```prisma
model Comment {
  id        String   @id @default(cuid())
  content   String
  authorId  String
  taskId    String?
  noteId    String?
  internal  Boolean  @default(false)   // NEW: hidden from CLIENT users
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ... existing relations unchanged
}
```

### 3.6 Person Model Update

Link CRM contacts to User accounts:

```prisma
model Person {
  // ... existing fields unchanged
  userId    String?  @unique        // NEW: optional link to User account

  user      User?    @relation(fields: [userId], references: [id])
  // ... existing relations unchanged
}
```

### 3.7 Updated Relations on Existing Models

**User model** — add new relations:

```prisma
model User {
  // ... existing fields unchanged

  // NEW relations
  projectMemberships ProjectMember[]
  addedMembers       ProjectMember[]   @relation("AddedByUser")
  invitations        Invitation[]
  eventAttendances   EventAttendee[]
  linkedPerson       Person?           // CRM contact linked to this user
}
```

**Project model** — add members relation:

```prisma
model Project {
  // ... existing fields unchanged
  members  ProjectMember[]              // NEW
}
```

**Event model** — add attendees relation:

```prisma
model Event {
  // ... existing fields unchanged
  attendees EventAttendee[]             // NEW
}
```

**Workspace model** — add invitations relation:

```prisma
model Workspace {
  // ... existing fields unchanged
  invitations Invitation[]              // NEW
}
```

### 3.8 Schema Diagram (Entity Relationships)

```
Workspace
  ├── User (members, via workspaceId)
  │     ├── role: OWNER | TEAM | CLIENT
  │     ├── ProjectMember[] (which projects they access)
  │     └── linkedPerson? (CRM contact link)
  ├── Project
  │     ├── ProjectMember[] (who has access)
  │     │     └── role: LEAD | CONTRIBUTOR | VIEWER
  │     └── Task[]
  │           ├── creatorId → User
  │           └── assigneeId → User
  ├── Invitation[] (pending invites)
  ├── Event
  │     └── EventAttendee[]
  └── Person (CRM contacts, NOT users)
        └── userId? → User (optional link)
```

---

## 4. Access Control Rules

### 4.1 Enforcement Architecture

Access control is enforced at **two layers**:

**Layer 1: Action Guards** (in `action-utils.ts`)

```
requireAuth()          → Is the user logged in?
requireWorkspace()     → Does the user belong to a workspace?
requireRole(role)      → Does the user have at least this role?
requireProjectAccess() → Is the user a member of this project?
```

**Layer 2: Query Filters** (in service/query files)

Every database query includes appropriate `where` clauses based on the user's role. This is the defense-in-depth layer — even if an action guard is missed, the query itself won't return unauthorized data.

### 4.2 New Utility Functions

```typescript
// action-utils.ts additions

export async function requireRole(minimumRole: UserRole) {
  const session = await requireWorkspace()
  const hierarchy = { OWNER: 3, TEAM: 2, CLIENT: 1 }
  if (hierarchy[session.user.role] < hierarchy[minimumRole]) {
    throw new Error('Insufficient permissions')
  }
  return session
}

export async function requireProjectAccess(
  projectId: string,
  minimumProjectRole?: ProjectMemberRole
) {
  const session = await requireWorkspace()

  // OWNER and TEAM see all projects
  if (session.user.role === 'OWNER' || session.user.role === 'TEAM') {
    return session
  }

  // CLIENT must have explicit ProjectMember record
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  })

  if (!membership) {
    throw new Error('Access denied to this project')
  }

  if (minimumProjectRole) {
    const roleHierarchy = { LEAD: 3, CONTRIBUTOR: 2, VIEWER: 1 }
    if (roleHierarchy[membership.role] < roleHierarchy[minimumProjectRole]) {
      throw new Error('Insufficient project permissions')
    }
  }

  return { ...session, projectRole: membership.role }
}
```

### 4.3 Access Rules by Entity

#### Tasks

| Operation | Rule |
|-----------|------|
| **List tasks** | OWNER/TEAM: `WHERE project.workspaceId = workspace`. CLIENT: `WHERE project.workspaceId = workspace AND projectId IN (user's projects) AND (assigneeId = userId OR assigneeId IS NULL OR creatorId = userId)` |
| **View task** | OWNER/TEAM: Any task in workspace. CLIENT: Only if in assigned project AND (assignee, creator, or unassigned) |
| **Create task** | OWNER/TEAM: Any project in workspace. CLIENT: Never. |
| **Edit task** | OWNER: Any. TEAM: Tasks they created or are assigned to. CLIENT: Only status and comments on assigned tasks. |
| **Delete task** | OWNER: Any. TEAM: Only tasks they created. CLIENT: Never. |
| **Assign task** | OWNER/TEAM: Yes. CLIENT: Never. |

#### Projects

| Operation | Rule |
|-----------|------|
| **List projects** | OWNER/TEAM: All workspace projects. CLIENT: Only projects in ProjectMember. |
| **Create project** | OWNER/TEAM: Yes. CLIENT: Never. |
| **Edit project** | OWNER: Any. TEAM: Only if creator or LEAD. CLIENT: Never. |
| **Delete project** | OWNER: Any. TEAM: Only if creator. CLIENT: Never. |
| **Add member** | OWNER: Yes. TEAM: Yes (cannot add other TEAM, only CLIENT). CLIENT: Never. |

#### Notes

| Operation | Rule |
|-----------|------|
| **List notes** | OWNER/TEAM: All workspace notes. CLIENT: Only notes in assigned projects. |
| **Create note** | OWNER/TEAM: Yes. CLIENT: Never. |
| **Edit/Delete** | OWNER: Any. TEAM: Own notes only. CLIENT: Never. |

#### Events

| Operation | Rule |
|-----------|------|
| **List events** | OWNER/TEAM: All workspace events. CLIENT: Only events where they're creator or attendee. |
| **Create event** | OWNER/TEAM: Yes. CLIENT: Never. |
| **Edit/Delete** | OWNER: Any. TEAM: Own events only. CLIENT: Never. |

#### People (CRM)

| Operation | Rule |
|-----------|------|
| **Any access** | OWNER/TEAM: Yes. CLIENT: Never. CRM is internal-only. |

#### Messages/Inbox

| Operation | Rule |
|-----------|------|
| **Any access** | OWNER/TEAM: Yes. CLIENT: Never. Inbox is internal-only. |

#### Comments

| Operation | Rule |
|-----------|------|
| **View** | OWNER/TEAM: All. CLIENT: Only non-internal comments (`internal = false`) on visible tasks. |
| **Create** | OWNER/TEAM: On any visible task (can mark as internal). CLIENT: On assigned tasks only (always non-internal). |

### 4.4 Query Pattern for Client Scoping

The key query pattern for CLIENT task visibility:

```typescript
// In task.queries.ts
export async function getTasksForClient(workspaceId: string, userId: string) {
  // Get client's project IDs
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  })
  const projectIds = memberships.map(m => m.projectId)

  return prisma.task.findMany({
    where: {
      project: { workspaceId, id: { in: projectIds } },
      OR: [
        { assigneeId: userId },
        { assigneeId: null },
        { creatorId: userId },
      ],
    },
    include: {
      ...taskInclude,
      comments: {
        where: { internal: false }, // Filter out internal comments
        include: { author: { select: { id: true, name: true } } },
      },
    },
  })
}
```

---

## 5. Invitation Flow

### 5.1 Owner Invites Team Member

```
1. OWNER opens Settings > Team
2. OWNER enters email + role (TEAM)
3. System creates Invitation record (status: PENDING, token: unique, expiresAt: +7 days)
4. System sends email with invite link: /invite/{token}
5. Recipient clicks link
6. If no account: redirected to /signup?invite={token} (pre-filled email)
7. If has account: redirected to /invite/{token}/accept
8. On accept:
   a. Create User record (if new) with role: TEAM, workspaceId: invitation.workspaceId
   b. Update Invitation status: ACCEPTED, acceptedAt: now()
   c. Redirect to workspace home
```

### 5.2 Owner/Team Invites Client

```
1. OWNER/TEAM opens Project > Members or People > [Person] > Invite as Client
2. System shows form: email, select projects
3. System creates Invitation record (role: CLIENT, projectIds: [...])
4. System sends email with invite link: /invite/{token}
5. On accept:
   a. Create User record with role: CLIENT, workspaceId
   b. Create ProjectMember records for each projectId (role: VIEWER)
   c. If matching Person record exists (by email), set person.userId
   d. Update Invitation status: ACCEPTED
   e. Redirect to client portal view
```

### 5.3 Invitation Data Model

Each invitation stores:

- `email` — who it's for
- `role` — what workspace role they'll get (TEAM or CLIENT)
- `token` — unique URL-safe string
- `projectIds` — for CLIENT: which projects to auto-assign
- `invitedById` — who sent it (audit trail)
- `expiresAt` — default 7 days
- `status` — PENDING / ACCEPTED / EXPIRED / REVOKED

### 5.4 Edge Cases

- **Re-invite:** If email already has a PENDING invitation, revoke old one and create new.
- **Existing user, different workspace:** A user can belong to only one workspace (current constraint). Future: multi-workspace support. For now, reject if user already has a workspaceId.
- **Invite link expired:** Show "expired" page with option to request new invite from workspace admin.
- **OWNER demotion:** Not possible. Owner can transfer ownership to another TEAM member (separate flow, out of scope for MVP).

---

## 6. Migration Plan

### 6.1 Phase 1: Schema Migration (Non-Breaking)

All changes are additive. No data is lost or modified.

**Step 1: Rename MEMBER to TEAM**

```sql
-- Prisma handles enum renaming via migration
ALTER TYPE "UserRole" RENAME VALUE 'MEMBER' TO 'TEAM';
```

This is the only data-modifying step. All existing MEMBER users become TEAM users. Semantically identical — no behavior change.

**Step 2: Add new models**

Create tables: `ProjectMember`, `Invitation`, `EventAttendee`. All empty initially.

**Step 3: Add new fields**

- `Comment.internal` — default `false`, no existing data affected.
- `Person.userId` — nullable, no existing data affected.

**Step 4: Backfill ProjectMember**

For every existing User (OWNER + TEAM) in each workspace, create ProjectMember records for all projects in that workspace with role LEAD (for OWNER) or CONTRIBUTOR (for TEAM). This ensures the new access system doesn't break existing access.

```sql
-- Backfill: all existing users get access to all existing projects
INSERT INTO "ProjectMember" (id, "projectId", "userId", role, "createdAt")
SELECT
  gen_random_uuid(),
  p.id,
  u.id,
  CASE WHEN u.role = 'OWNER' THEN 'LEAD' ELSE 'CONTRIBUTOR' END,
  NOW()
FROM "User" u
CROSS JOIN "Project" p
WHERE u."workspaceId" = p."workspaceId"
  AND u.role IN ('OWNER', 'TEAM');
```

### 6.2 Phase 2: Enforce Access Control (Code Changes)

This is where behavior changes. Deploy incrementally:

1. **Update `action-utils.ts`** — Add `requireRole()` and `requireProjectAccess()`.
2. **Update task queries** — Add role-based filtering. OWNER/TEAM queries unchanged. New CLIENT query path.
3. **Update task actions** — Add permission checks before mutations.
4. **Update note/event queries** — Same pattern.
5. **Update page-level server components** — Add role checks in server pages to conditionally render.

### 6.3 Phase 3: Invitation System

1. Build `Invitation` CRUD actions
2. Build `/invite/[token]` pages (accept/decline)
3. Build team management UI in Settings
4. Wire up email sending (or link-copy for MVP)

### 6.4 Phase 4: Client Portal

1. Build filtered client layout (no sidebar items for CRM, Inbox, etc.)
2. Build client dashboard (their tasks across assigned projects)
3. Client commenting on tasks
4. Client event visibility

### 6.5 Rollout Order

```
Week 1: Phase 1 (schema) + Phase 2 steps 1-2 (guards + queries)
Week 2: Phase 2 steps 3-5 (enforcement in all actions + pages)
Week 3: Phase 3 (invitations)
Week 4: Phase 4 (client portal)
```

---

## 7. Risks

### 7.1 Data Access Regression

**Risk:** Existing OWNER/TEAM users lose access to data after migration.
**Mitigation:** The Phase 1 backfill creates ProjectMember records for all existing users + projects. Queries for OWNER/TEAM roles bypass ProjectMember checks entirely (they see everything). Only CLIENT users go through the ProjectMember filter path.

### 7.2 MEMBER → TEAM Rename Breaking References

**Risk:** Code references `UserRole.MEMBER` or string `'MEMBER'` break after enum rename.
**Mitigation:** Global search-replace `MEMBER` → `TEAM` in codebase. Prisma enum rename is atomic in migration. The session callback reads from DB, so JWT tokens with cached role will refresh on next DB lookup.

### 7.3 getTaskById Without Workspace Check

**Risk:** Already exists today. Any authenticated user can access any task by ID.
**Mitigation:** Phase 2 adds workspace ownership check to `getTaskById` and all single-entity queries. This is a security fix independent of the RBAC system.

### 7.4 Performance: Client Query Joins

**Risk:** Client queries require a join through ProjectMember to filter visible data, adding query complexity.
**Mitigation:** The `@@index([userId])` on ProjectMember ensures fast lookups. Client user counts will be small relative to data volume. Monitor query performance post-launch.

### 7.5 Single-Workspace Constraint

**Risk:** Current schema allows one workspace per user (`workspaceId` on User). A Client invited to Workspace A cannot also be a TEAM member in Workspace B.
**Mitigation:** This is acceptable for MVP. Multi-workspace support requires a `WorkspaceMember` join table (replacing the direct `workspaceId` field on User). Document this as a known limitation and future migration path.

### 7.6 Invitation Token Security

**Risk:** Invite links with predictable tokens could be guessed.
**Mitigation:** Use `cuid()` for tokens (22-character random). Add rate limiting on `/invite/[token]` endpoint. Expire tokens after 7 days. Allow OWNER to revoke.

### 7.7 Turbopack Cache After Schema Migration

**Risk:** As seen repeatedly during development, `prisma generate` after schema changes causes Turbopack stale cache, breaking the running dev server.
**Mitigation:** Document the post-migration process: `prisma migrate dev` → `prisma generate` → delete `.next` → restart dev server. Automate in a script.

---

## Appendix A: Files Requiring Changes

### High-Priority (Security)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add CLIENT role, ProjectMember, Invitation, EventAttendee, Comment.internal, Person.userId |
| `src/lib/action-utils.ts` | Add `requireRole()`, `requireProjectAccess()` |
| `src/modules/tasks/task.queries.ts` | Add workspace check to `getTaskById`, add client-scoped query |
| `src/modules/tasks/task.actions.ts` | Add role checks to all mutations |
| `src/modules/notes/note.service.ts` | Add workspace check to `getNoteById`, add client-scoped query |
| `src/modules/events/event.service.ts` | Add workspace check to `getEventById` |
| `src/modules/people/people.service.ts` | Add workspace check to `getPersonById` |

### Medium-Priority (Features)

| File | Change |
|------|--------|
| `src/lib/auth.ts` | Update `createUser` event to handle invite-based registration |
| `src/lib/auth-types.ts` | No change needed (role already in session type) |
| `src/modules/workspace/` | New: invitation actions, team management actions |
| `src/app/(app)/settings/` | New: team management page |
| `src/app/(app)/invite/` | New: invitation acceptance pages |

### Lower-Priority (Client Portal)

| File | Change |
|------|--------|
| `src/app/(app)/layout.tsx` | Conditionally render nav based on role |
| `src/app/(app)/page.tsx` | Different dashboard for CLIENT vs OWNER/TEAM |
| `src/components/MobileNav.tsx` | Hide CRM, Inbox, Notes tabs for CLIENT |

---

## Appendix B: Future Considerations (Out of Scope)

These are explicitly NOT part of this design but should be kept in mind:

1. **Multi-workspace support** — Replace `User.workspaceId` with a `WorkspaceMember` join table.
2. **Custom roles** — Allow OWNER to define custom roles with granular permissions.
3. **Row-level security (RLS)** — PostgreSQL RLS policies as a defense-in-depth layer below application code.
4. **Audit log** — Extend Activity model to log permission checks, not just data mutations.
5. **API keys / Service accounts** — For integrations that act on behalf of a workspace.
6. **Two-factor authentication** — Required for OWNER role.
7. **Client self-service portal** — Allow clients to create their own tasks within assigned projects.
