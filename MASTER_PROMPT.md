# BUSINESS LIFE OS — MASTER VERIFICATION & IMPLEMENTATION PROMPT

## WHAT THIS DOCUMENT IS
This is a self-audit prompt. It captures every feature, assumption, and requirement from the original architecture sessions. Use it to verify what is built, what is broken, and what is missing — then act on the gaps.

---

## 1. PRODUCT DEFINITION

**Business Life OS** is a centralized operational command center for an entrepreneur managing multiple projects, collaborators, tasks, notes, decisions, and communication across different channels.

### Problems it solves:
- Fragmented information across WhatsApp, Telegram, notes, and tasks
- Lack of visibility over projects and progress
- Difficulty tracking who is doing what
- Losing context from conversations
- Inability to quickly convert ideas into execution
- Communication chaos

### Target user: Solo entrepreneur / founder managing a team

---

## 2. CRITICAL REQUIREMENTS (from user's architecture prompt)

- [x] Modular monolith
- [x] One database (PostgreSQL)
- [x] One deployable application (Next.js)
- [x] Mobile-first (optimized for iPhone)
- [ ] PWA-ready (manifest, service worker, installable)
- [ ] Telegram integration (inbound/outbound) — backend exists, NOT wired to UI
- [ ] WhatsApp integration (inbound/outbound) — backend exists, NOT wired to UI
- [ ] Voice notes + transcription — DB/schema ready, NO frontend recording
- [ ] AI gates (transcription + task extraction) — service exists, NOT connected
- [ ] Apple Calendar integration — adapter exists, NOT connected
- [ ] Communication inbox with thread view — flat list only, no threads

---

## 3. MVP SCOPE — FEATURE-BY-FEATURE STATUS

### CORE (must be stable)

| Feature | Status | Notes |
|---------|--------|-------|
| Auth | ✅ WORKING | Auth.js with Credentials, auto-login via seed |
| Workspace | ✅ WORKING | Auto-created, single workspace per user |
| Projects | ✅ WORKING | CRUD, status, task count, detail page |
| Tasks | ✅ WORKING | Create, toggle status, priority, grouping |
| People / Contacts | ⚠️ PARTIAL | Schema + service exist. Page exists at /people. **NOT linked from main nav or FAB. User cannot easily access it.** |
| Notes | ✅ WORKING | Quick notes, create via FAB |
| Activity log | ✅ WORKING | Shows on dashboard |
| Basic notifications | ⚠️ PARTIAL | Model exists, /notifications page exists. **No triggers actually create notifications.** |

### SECOND LAYER (planned for MVP)

| Feature | Status | Notes |
|---------|--------|-------|
| Telegram integration | ⚠️ BACKEND ONLY | Adapter + webhook route exist. No UI to connect, configure, or view threads. |
| WhatsApp integration | ⚠️ BACKEND ONLY | Adapter + webhook route exist. No UI to connect or configure. |
| Voice notes + transcription | ❌ NOT FUNCTIONAL | Schema + AI job exist. Voice page says "Coming in Phase 4". No recording widget. |
| AI gates (transcription + task extraction) | ❌ NOT FUNCTIONAL | Service code exists but nothing triggers it. No OpenAI key configured. |
| Communication inbox | ⚠️ FLAT LIST | Shows last 100 messages. **No conversation threading, no reply capability, no person-linked view, no forwarding.** |

### MISSING FEATURES (explicitly mentioned in architecture)

| Feature | Status | Where mentioned |
|---------|--------|-----------------|
| **Forward/share conversation threads to collaborators** | ❌ MISSING | User's current complaint: "nie widze wgl przekazywania tematow do wspolpracownikow linkami" |
| Convert note/message to task | ❌ MISSING | Core MVP goal: "convert notes/communication into tasks" |
| Assign tasks to people/collaborators | ⚠️ SCHEMA ONLY | assigneeId field exists, no UI to assign |
| Task due dates with calendar | ⚠️ SCHEMA ONLY | dueDate field exists, no date picker in UI |
| File attachments | ❌ MISSING | File model exists, no upload UI |
| Comments on tasks/notes | ❌ MISSING | Comment model + service exist, no UI |
| Collaborator invites | ❌ MISSING | Workspace has members relation, no invite flow |
| Search across entities | ❌ MISSING | Not implemented at all |
| PWA manifest + service worker | ❌ MISSING | No manifest.json, no SW |

---

## 4. USER-FACING PAGES — CURRENT STATE

| Page | Route | In Nav? | Status |
|------|-------|---------|--------|
| Dashboard | `/` | ✅ Home | Working — shows tasks, activity |
| Tasks | `/tasks` | ✅ Tasks | Working — create, toggle, group |
| Projects | `/projects` | ✅ Projects | Working — list, detail |
| Project Detail | `/projects/[id]` | via link | Working — progress, tasks |
| Inbox | `/inbox` | ✅ Inbox | Flat message list, no threading |
| Notes | `/notes` | via FAB | **Not in bottom nav** |
| New Note | `/notes/new` | via FAB | Working |
| People | `/people` | ❌ NOT IN NAV | Page exists but unreachable from main UI |
| Voice | `/voice` | ❌ NOT IN NAV | Placeholder only |
| Calendar | `/calendar` | ❌ NOT IN NAV | Empty/placeholder |
| Notifications | `/notifications` | via bell icon | Exists but no notifications generated |
| Settings | `/settings` | ❌ NOT IN NAV | Page exists |

### Bottom Nav currently shows:
1. Home
2. Tasks
3. Inbox
4. Projects

### Missing from easy access:
- People/Contacts
- Notes list
- Settings

---

## 5. THE SPECIFIC GAP THE USER IS ASKING ABOUT

> "nie widze wgl przekazywania tematow do wspolpracownikow linkami"
> (I don't see any forwarding of topics to collaborators via links at all)

This refers to the core product promise: **the ability to share/forward conversation threads, topics, tasks, or notes to collaborators via links.**

### What was promised in architecture:
- Entrepreneur receives message on Telegram/WhatsApp
- Wants to forward the relevant conversation/topic to a collaborator
- Collaborator gets a link and can see the context
- Can convert conversations into actionable tasks

### What exists now:
- Messages come in via webhooks (if configured)
- They appear in a flat list on /inbox
- **NO ability to:**
  - Open a full conversation thread
  - Forward a message or thread to another person
  - Share a link to a conversation
  - Tag/assign a conversation to a collaborator
  - Convert a message into a task
  - Reply to a message from within the app

---

## 6. IMPLEMENTATION PRIORITY (to match original vision)

### P0 — Fix immediately (core promise broken)
1. **Conversation thread view** — clicking a person/message opens full thread
2. **Forward/share to collaborator** — select thread → share link or assign
3. **Convert message → task** — button on any message to create task from it
4. **People in main nav** — contacts must be easily accessible
5. **Notes list page** — accessible from nav, not just creation

### P1 — Required for MVP
6. **Task assignment UI** — assign tasks to people
7. **Task due date picker** — date selection in task form
8. **Reply from inbox** — send message back via Telegram/WhatsApp
9. **Comments on tasks** — threaded discussion
10. **Notification triggers** — create real notifications on events

### P2 — Important for completeness
11. **File upload** on tasks and notes
12. **Voice recording widget** + transcription flow
13. **AI task extraction** from notes/voice
14. **PWA manifest** + installability
15. **Search** across all entities
16. **Collaborator invite flow**
17. **Calendar view** with task due dates

---

## 7. DATABASE STATE

Schema has 20 models and is well-designed. All the models needed for the missing features already exist:
- `Person` — has telegramId, whatsappId
- `Message` — has direction, channel, content, personId
- `Comment` — has taskId, noteId, authorId
- `File` — has taskId, noteId, workspaceId
- `VoiceNote` — has audioUrl, transcription, status
- `AiJob` — has type, status, input, output
- `Notification` — has type, title, body, linkUrl
- `Task` — has assigneeId, dueDate, calendarEventId

**The database is ready. The problem is the UI and wiring.**

---

## 8. TECH STACK CONFIRMED

- Next.js 16.2.1 (App Router)
- Tailwind CSS v4
- Prisma 6.19.2 + PostgreSQL 16
- Auth.js v5 (next-auth)
- TypeScript
- Zod validation
- Server Actions pattern with safeAction wrapper

---

## 9. WHAT TO DO NEXT

Read this document. Then:

1. **Do NOT add new Prisma models** — everything needed is already in the schema
2. **Do NOT redesign the UI** — the current mobile-first design is approved
3. **DO build the missing UI and wiring** for features that have backend but no frontend
4. **DO prioritize the P0 items** — they are the core product promise
5. **DO keep the same patterns** — Server Actions, safeAction, revalidatePath, client/server split
