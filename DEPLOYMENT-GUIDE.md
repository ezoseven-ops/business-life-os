# Business Life OS — Deployment Execution Package

**Version:** 0.1.0
**Date:** April 2026
**Target:** First controlled deployment (single founder + small team)

---

## 1. Recommended Deployment Architecture

### Architecture Decision

**Single VPS + Managed PostgreSQL.** No Docker. No Kubernetes. No multi-server.

This is the safest first deployment for this app because:

- The app uses Next.js `output: 'standalone'` — builds to a self-contained server
- In-memory rate limiting is per-process (single server required)
- Agent sessions live in the database — no sticky sessions needed
- Session cleanup runs via `instrumentation.ts` interval — works on single instance
- PM2 handles process management, restart, and log rotation
- Google Calendar sync, webhooks, and AI calls are all stateless per-request

### Component Map

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| **App hosting** | Single VPS (Hetzner, DigitalOcean, or Contabo) | Cost-effective, full control, no vendor lock-in |
| **Database** | Managed PostgreSQL (Supabase, Neon, or provider-managed) | Automated backups, no DBA overhead, connection pooling |
| **Process manager** | PM2 | Already configured in `ecosystem.config.cjs`, proven for Node.js |
| **Reverse proxy** | Nginx | SSL termination, static file serving, request buffering |
| **SSL** | Let's Encrypt via Certbot | Free, automated renewal |
| **DNS** | Cloudflare (free tier) | DDoS protection, DNS management, optional CDN |
| **Docker** | No | Adds complexity without benefit for single-server. Standalone Next.js output is already self-contained |

### Why NOT Docker

- Next.js standalone output already bundles everything needed
- PM2 gives process management, auto-restart, log management
- Docker adds a layer of indirection that makes debugging harder for a first deployment
- No horizontal scaling needed — this is a controlled launch

### Why Managed PostgreSQL

- Automatic daily backups
- Point-in-time recovery
- No manual `pg_dump` scripts to maintain
- Connection pooling built in
- One less thing to administer on the VPS

---

## 2. Server Spec Recommendation

### Minimum Spec (Controlled First Deployment)

| Spec | Value | Notes |
|------|-------|-------|
| **Provider** | Hetzner CX32 or DigitalOcean Droplet | ~$10-15/month |
| **CPU** | 2 vCPU (AMD/Intel) | Next.js build needs 2 cores; runtime is fine on 1 |
| **RAM** | 4 GB | Next.js + Node.js + PM2 + Prisma connection pool |
| **Storage** | 40 GB SSD | OS + app + node_modules + build artifacts + logs |
| **OS** | Ubuntu 24.04 LTS | Long-term support, widest package compatibility |
| **Node.js** | 20 LTS (v20.x) | Required for Next.js 16.x. Do NOT use Node 22 yet |
| **Reverse proxy** | Nginx 1.24+ | Already in Ubuntu 24.04 repos |
| **SSL** | Let's Encrypt (Certbot) | Free, auto-renewal |

### Database Spec

| Spec | Value |
|------|-------|
| **Provider** | Supabase Free/Pro, Neon Free, or provider-managed PostgreSQL |
| **PostgreSQL version** | 16.x |
| **Storage** | 1 GB is sufficient for first year |
| **Connection limit** | Minimum 20 connections |
| **Region** | Same region as VPS (latency matters for Prisma queries) |

### Why 4 GB RAM

- Next.js standalone server: ~200-400 MB
- PM2 overhead: ~50 MB
- Prisma Client: ~100 MB with connection pool
- OpenAI API calls: memory spikes during AI classification
- Build step (`next build`): peaks at ~1.5 GB
- Leaves headroom for OS + Nginx

---

## 3. Complete Environment Checklist

### REQUIRED (app will not start without these)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `AUTH_SECRET` | NextAuth session encryption key. Generate: `openssl rand -base64 32`. Must be at least 32 characters |
| `NODE_ENV` | Must be `production` on the server |
| `NEXT_PUBLIC_APP_URL` | Full public URL of the app, e.g. `https://app.yourdomain.com`. Used for OAuth callbacks, PWA manifest, and email links |
| `AUTH_URL` | Same as `NEXT_PUBLIC_APP_URL`. Required by Auth.js for callback URL resolution |

### REQUIRED FOR CORE FEATURES

| Variable | Feature | What Happens Without It |
|----------|---------|------------------------|
| `OPENAI_API_KEY` | AI classification, agent routing, voice transcription, collaborator parsing | Agent mode disabled. Command Center reverts to manual capture only. No voice transcription |
| `GOOGLE_CLIENT_ID` | Google OAuth login | Login page shows no providers. Users cannot authenticate in production (Credentials provider is dev-only) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login | Same as above |

**CRITICAL: In production, the Credentials provider is disabled.** Google OAuth is the ONLY login method. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, nobody can log in.

### REQUIRED IF USING GOOGLE CALENDAR

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CALENDAR_CLIENT_ID` | OAuth for Calendar API access. Can be same as login OAuth client if scopes are configured, or a separate client |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | OAuth secret for Calendar API |

The Google Cloud Console project must have the Calendar API enabled and the OAuth consent screen configured with redirect URI: `{NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`

### OPTIONAL — MESSAGING

| Variable | Feature |
|----------|---------|
| `TELEGRAM_WEBHOOK_SECRET` | Telegram bot webhook verification. Set to the bot token. Webhook URL: `{NEXT_PUBLIC_APP_URL}/api/webhooks/telegram` |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verification token (you choose this value) |
| `WHATSAPP_APP_SECRET` | WhatsApp Business API app secret for signature verification |

### OPTIONAL — EMAIL

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Transactional email via Resend. Used for invitation emails |
| `EMAIL_FROM` | Sender address. Default: `noreply@businesslifeos.com`. Must match verified domain in Resend |

### OPTIONAL — FILE STORAGE

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name. Default: `blos-files` |
| `R2_PUBLIC_URL` | Public URL for R2 bucket (for image serving) |

### OPTIONAL — MONITORING

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Sentry project DSN. If not set, all Sentry calls no-op silently. Error monitoring is highly recommended for production |

---

## 4. Exact Deployment Commands

### 4A. Local — Before First Deployment

Run these on your development machine to verify everything is clean:

```bash
# 1. Verify TypeScript compiles clean
npx tsc --noEmit

# 2. Verify build succeeds locally
npm run build

# 3. Verify tests pass
npm test

# 4. Ensure all code is committed and pushed
git status
git push origin main
```

### 4B. Server — Initial Setup (One Time)

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Verify Node version
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x

# 4. Install PM2 globally
sudo npm install -g pm2

# 5. Install Nginx
sudo apt install -y nginx

# 6. Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# 7. Create app directory and log directory
sudo mkdir -p /opt/blos
sudo mkdir -p /var/log/blos
sudo chown $USER:$USER /opt/blos
sudo chown $USER:$USER /var/log/blos

# 8. Clone the repository
cd /opt/blos
git clone <your-repo-url> .

# 9. Create the .env file
cp .env.example .env
nano .env   # Fill in all required values (see Section 3)

# 10. Configure Nginx (see Section 4D below)

# 11. Set up SSL
sudo certbot --nginx -d app.yourdomain.com

# 12. Set up PM2 startup hook (survives reboot)
pm2 startup
# Run the command PM2 tells you to run (starts with sudo)
```

### 4C. Server — First Deploy

```bash
cd /opt/blos

# 1. Install dependencies (includes prisma generate via postinstall)
npm ci --production=false

# 2. Run database migrations
npx prisma migrate deploy

# 3. Build the app
npm run build

# 4. Start with PM2
pm2 start ecosystem.config.cjs

# 5. Save PM2 process list (survives reboot)
pm2 save

# 6. Verify health
sleep 5
curl -s http://localhost:3000/api/health | head
# Should return: {"status":"ok","timestamp":"...","uptime":...}

# 7. Verify via public URL
curl -s https://app.yourdomain.com/api/health
```

Or use the deploy script (does steps 1-6 automatically):

```bash
cd /opt/blos
npm run deploy -- --skip-tests
```

### 4D. Nginx Configuration

Create `/etc/nginx/sites-available/blos`:

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    # Certbot will add SSL configuration automatically
    # After running: sudo certbot --nginx -d app.yourdomain.com

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # Required for voice upload (Whisper transcription)
        client_max_body_size 25M;
    }

    # Cache static assets from Next.js
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable, max-age=31536000";
    }

    # PWA service worker — no cache
    location /sw.js {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "no-cache";
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/blos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4E. Subsequent Deploys

```bash
cd /opt/blos

# 1. Pull latest code
git pull origin main

# 2. Run deploy script
npm run deploy -- --skip-tests

# The deploy script handles:
#   npm ci → prisma migrate deploy → npm run build → pm2 restart → health check
```

---

## 5. Database / Prisma Procedure

### When to Run Each Command

| Command | When | What It Does |
|---------|------|--------------|
| `prisma generate` | After `npm ci` (runs automatically via `postinstall`). Also runs as part of `npm run build` | Generates the Prisma Client TypeScript types from `schema.prisma` |
| `prisma migrate deploy` | Before `npm run build`, after `npm ci`. On every deploy | Applies any pending migration SQL files to the production database. Safe to run if no pending migrations (no-op) |
| `prisma db push` | NEVER in production | Development only. Pushes schema changes without creating migration files. Dangerous in production |
| `prisma migrate dev` | NEVER on the server | Development only. Creates new migration files. Run locally, commit the files, deploy them |

### How to Verify Migrations Worked

```bash
# Check migration status
npx prisma migrate status

# Expected output for healthy state:
# Database schema is up to date!

# If pending migrations exist:
# Following migration(s) have not yet been applied:
#   20260403182506_init
# ...
```

### What to Do If Migration Fails

1. **Read the error carefully.** Prisma gives specific SQL errors.

2. **Common causes:**
   - Column already exists → the migration was partially applied. Check the `_prisma_migrations` table
   - Connection refused → DATABASE_URL is wrong or DB is down
   - Permission denied → DB user lacks DDL permissions

3. **Recovery steps:**
   ```bash
   # Check what migrations have been applied
   npx prisma migrate status

   # If a migration is marked as failed, you may need to:
   # 1. Fix the database state manually
   # 2. Mark the migration as applied:
   npx prisma migrate resolve --applied "20260403182506_init"

   # Or mark it as rolled back:
   npx prisma migrate resolve --rolled-back "20260403182506_init"
   ```

4. **If schema drift appears** (schema doesn't match migrations):
   ```bash
   # Check for drift
   npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma

   # This shows what SQL would need to run to fix the drift
   ```

### What to Back Up Before Changing the Database

```bash
# Always take a dump before running migrations on production
pg_dump $DATABASE_URL --format=custom --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Restore if needed:
pg_restore --clean --if-exists -d $DATABASE_URL backup_YYYYMMDD_HHMMSS.dump
```

If using managed PostgreSQL (Supabase, Neon), use their built-in backup/snapshot feature before running migrations.

---

## 6. PM2 / Runtime Procedure

### Starting the App

```bash
# First time
pm2 start ecosystem.config.cjs

# Save process list (survives reboot)
pm2 save
```

### Restarting After Code Update

```bash
# Graceful restart (zero-downtime for single instance)
pm2 restart blos-web

# Or restart all
pm2 restart all
```

### Inspecting Logs

```bash
# Real-time logs (follow mode)
pm2 logs blos-web

# Last 200 lines
pm2 logs blos-web --lines 200

# Error logs only
pm2 logs blos-web --err

# Log files are also at:
#   /var/log/blos/out.log
#   /var/log/blos/error.log
```

### Reload After Code Updates

```bash
# Full deploy flow (recommended)
cd /opt/blos
git pull origin main
npm run deploy -- --skip-tests

# Manual reload (if deploy script not used)
npm ci
npx prisma migrate deploy
npm run build
pm2 restart blos-web
```

### Surviving Reboot

```bash
# One-time setup (generates systemd service)
pm2 startup
# PM2 will print a command starting with 'sudo' — run that exact command

# After any change to the process list:
pm2 save
```

### Verifying Process Health

```bash
# Process status table
pm2 status

# Detailed info (memory, CPU, restarts, uptime)
pm2 describe blos-web

# Monitor dashboard (live)
pm2 monit

# Health endpoint
curl -s http://localhost:3000/api/health
# Returns: {"status":"ok","timestamp":"...","uptime":...,"sessionsCleanedUp":0}
```

### Key Thresholds (from ecosystem.config.cjs)

| Setting | Value | Meaning |
|---------|-------|---------|
| `max_memory_restart` | 1 GB | Auto-restart if memory exceeds 1 GB |
| `max_restarts` | 10 | Stop restart loop after 10 rapid crashes |
| `min_uptime` | 10s | Process must run >10s to count as "stable" |
| `restart_delay` | 4s | Wait 4s between restart attempts |

---

## 7. Post-Deploy Smoke Test

Run this checklist manually after the first deployment. Each item should be verified in order.

### Infrastructure

- [ ] `curl https://app.yourdomain.com/api/health` returns `{"status":"ok"}`
- [ ] `pm2 status` shows `blos-web` as `online`
- [ ] `pm2 describe blos-web` shows 0 restarts
- [ ] Nginx access logs show requests arriving: `tail /var/log/nginx/access.log`

### Authentication

- [ ] Navigate to `https://app.yourdomain.com` — redirects to `/login`
- [ ] "Sign in with Google" button is visible
- [ ] Click Google sign-in → OAuth flow completes → redirected to dashboard
- [ ] Session persists on page refresh
- [ ] Profile/settings page shows correct user info

### Dashboard / Command Center

- [ ] Dashboard loads with dark Command Center card
- [ ] "Agent Active" indicator shows green dot
- [ ] Splash/daily quote appears on loading screen
- [ ] Input textarea is visible and accepts text

### Voice Capture

- [ ] Click microphone button → browser asks for microphone permission
- [ ] Grant permission → recording indicator appears (red dot + timer)
- [ ] Stop recording → "Transcribing voice..." spinner appears
- [ ] Transcription completes → text appears in input → auto-submits to agent

### Agent / Command Flow

- [ ] Type "create a project called Test Project" → command preview appears with "Create Project" label
- [ ] Confirm → project created → success checkmark
- [ ] Type "add a task called First Task to Test Project" → command preview with "Create Task"
- [ ] Confirm → task created

### Multi-Step Command

- [ ] Type "create a task called Task A and a task called Task B in Test Project"
- [ ] Execution plan shows 2 steps
- [ ] Remove one step → converts to single command preview
- [ ] Or execute all → both created → "All 2 commands executed"

### Capture / Note

- [ ] Type a general sentence like "Met with John, discussed API design, he's great with TypeScript"
- [ ] Agent routes to capture → draft review shows classification (Note or Collaborator)
- [ ] Confirm → saved

### Collaborator Profile

- [ ] Navigate to People → person detail page
- [ ] Collaborator Profile Card visible
- [ ] "AI Parse" button works → enter description → parse succeeds
- [ ] "Edit" button → form fields → save works

### Google Calendar (if configured)

- [ ] Settings → Google Calendar section shows "Connect" button
- [ ] Click Connect → Google OAuth flow → redirected back
- [ ] Status shows "Connected"
- [ ] "Sync Now" button → pulls events
- [ ] Create event via command center → appears in calendar
- [ ] Calendar page shows events

### Messaging (if configured)

- [ ] Navigate to Inbox page
- [ ] If Telegram/WhatsApp configured: send test message to bot
- [ ] Message appears in inbox thread
- [ ] Reply from inbox → message sent

### Mobile Layout

- [ ] Open on phone (or Chrome DevTools mobile view)
- [ ] Bottom navigation bar visible
- [ ] FAB (floating action button) visible
- [ ] All pages scroll correctly
- [ ] PWA: "Add to Home Screen" prompt works (or manual add)
- [ ] Standalone PWA opens without browser chrome

### Error Handling

- [ ] Navigate to `/nonexistent-route` → should show 404 or redirect
- [ ] Health endpoint returns 200 under normal load
- [ ] If Sentry DSN is set: trigger an error → verify it appears in Sentry dashboard

---

## 8. Failure / Rollback Plan

### Build Fails

**Symptom:** `npm run build` exits with error.

```bash
# 1. Read the error — usually TypeScript or import errors
npm run build 2>&1 | tail -30

# 2. If it's a Prisma Client error ("Cannot find module @prisma/client"):
npx prisma generate
npm run build

# 3. If it's a dependency error:
rm -rf node_modules
npm ci --production=false
npm run build

# 4. The previous working build still exists in .next/
# PM2 is still running the old build — the app is still up
# You have time to fix and rebuild
```

### App Won't Start

**Symptom:** PM2 shows status as `errored` or restart count climbing.

```bash
# 1. Check what's happening
pm2 logs blos-web --lines 50

# 2. Common causes:
#    - Missing env var → check .env file
#    - Port already in use → kill old process: lsof -i :3000
#    - Database unreachable → verify DATABASE_URL and network

# 3. If env var issue:
nano /opt/blos/.env
pm2 restart blos-web

# 4. If nothing works, start manually to see full output:
pm2 stop blos-web
cd /opt/blos
NODE_ENV=production node .next/standalone/server.js
# This shows the full error — fix it, then restart PM2
```

### Migration Fails

**Symptom:** `prisma migrate deploy` shows SQL error.

```bash
# 1. Check migration status
npx prisma migrate status

# 2. If the migration partially applied:
#    a. Fix the database state manually (drop the partially created table/column)
#    b. Then re-run: npx prisma migrate deploy

# 3. If you need to revert entirely:
#    a. Restore from backup:
pg_restore --clean --if-exists -d $DATABASE_URL backup.dump
#    b. Or if using managed DB: restore from provider's snapshot

# 4. Deploy the previous known-good code:
git checkout <previous-commit>
npm ci
npm run build
pm2 restart blos-web
```

### Prisma Generate Fails

**Symptom:** `prisma generate` shows schema parse error.

```bash
# 1. Validate the schema
npx prisma validate

# 2. If schema has errors — fix in schema.prisma

# 3. If binary download fails (network issue):
npx prisma generate --no-engine
# Or set: PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
```

### OAuth Fails

**Symptom:** Google Sign-In shows error or redirect fails.

```bash
# 1. Check that the redirect URI is correctly configured in Google Cloud Console:
#    https://app.yourdomain.com/api/auth/callback/google

# 2. Verify env vars are set:
grep GOOGLE_CLIENT /opt/blos/.env

# 3. Check that AUTH_URL matches the actual URL:
grep AUTH_URL /opt/blos/.env
# Must be: https://app.yourdomain.com (no trailing slash)

# 4. Check Nginx is passing headers correctly:
#    X-Forwarded-Proto must be "https"
```

### OpenAI Fails

**Symptom:** Agent returns errors, voice transcription fails, capture classification fails.

```bash
# 1. Verify API key
grep OPENAI_API_KEY /opt/blos/.env

# 2. Check if it's a rate limit:
pm2 logs blos-web --lines 50 | grep -i "openai\|rate\|429"

# 3. The app degrades gracefully — OpenAI failures show as error banners
#    in the UI, not crashes. The app stays up.

# 4. Check OpenAI status: https://status.openai.com
```

### Google Calendar Fails

**Symptom:** Sync fails, events don't appear.

```bash
# 1. Check failed sync entries in the UI:
#    Settings → Google Calendar → "Failed Syncs" section

# 2. Retry individual events from the UI

# 3. Check if tokens expired:
#    Disconnect and reconnect Google Calendar in Settings

# 4. Verify Calendar API is enabled in Google Cloud Console
```

### PM2 Process Crashes Repeatedly

**Symptom:** `pm2 status` shows high restart count.

```bash
# 1. Check error logs
pm2 logs blos-web --err --lines 100

# 2. If memory issue (OOM):
pm2 describe blos-web | grep memory
# Consider increasing max_memory_restart in ecosystem.config.cjs

# 3. If it's a code issue — rollback:
git log --oneline -5   # Find last good commit
git checkout <commit>
npm ci && npm run build && pm2 restart blos-web

# 4. Stop the crash loop:
pm2 stop blos-web
# Fix the issue, then:
pm2 start blos-web
```

### Health Check Fails After Deploy

**Symptom:** `curl /api/health` returns 503 or connection refused.

```bash
# 1. Is the process running?
pm2 status

# 2. Is it listening on port 3000?
ss -tlnp | grep 3000

# 3. Can you reach it directly?
curl -v http://localhost:3000/api/health

# 4. Is Nginx forwarding correctly?
sudo nginx -t
sudo systemctl status nginx

# 5. Is the database reachable?
#    The health endpoint checks DB connectivity
#    503 with "Database unreachable" = DB connection issue
#    Check DATABASE_URL and network/firewall rules
```

---

## 9. Final Go / No-Go Verdict

### Status: READY TO DEPLOY — with these prerequisites

The codebase is production-ready. The build system, deploy script, error handling, auth, RBAC, rate limiting, monitoring hooks, and UI are all in place. TypeScript compiles with zero errors.

### Prerequisites Before First Deploy

**You must have these ready before running the deploy script:**

1. **A VPS provisioned** with Ubuntu 24.04, Node.js 20 LTS, PM2, and Nginx installed

2. **A PostgreSQL database** accessible from the VPS with connection string ready

3. **A Google Cloud project** with:
   - OAuth 2.0 Client ID configured
   - Authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
   - (Optional) Calendar API enabled with redirect URI: `https://yourdomain.com/api/integrations/google-calendar/callback`

4. **An OpenAI API key** with GPT-4o-mini and Whisper access

5. **A domain name** pointed to the VPS IP address

6. **The `.env` file** filled in with all required variables from Section 3

7. **PWA icons** in `public/icons/` — currently present (`icon-192.png`, `icon-512.png`). Verify they are actual image files, not placeholders

### What Does NOT Block Deployment

- Telegram/WhatsApp webhooks — optional, configure later
- Cloudflare R2 — optional, file uploads work without it
- Resend email — optional, invitations can be shared manually
- Sentry — optional, errors still log to PM2 logs
- Vitest — tests are a development tool, not needed on the server

### Known Limitations for First Deployment

- **Rate limiting is in-memory.** Restarting the app resets rate limit counters. Acceptable for controlled launch
- **No Redis.** If you ever scale to multiple instances, rate limiting and sessions need Redis. Not needed now
- **Session cleanup interval** runs every 5 minutes in the Node.js process. If PM2 restarts the process, the interval restarts too — this is fine

### Deploy Sequence Summary

```
1. Provision VPS + managed PostgreSQL
2. Install Node.js 20, PM2, Nginx, Certbot
3. Clone repo to /opt/blos
4. Fill in .env
5. npm run deploy
6. Configure Nginx + SSL
7. Run smoke test checklist
8. Done
```

---

*This guide was produced from a direct audit of the Business Life OS codebase at version 0.1.0. All paths, commands, and configurations reference the actual project structure.*
