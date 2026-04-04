#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Business Life OS — Production Deploy Script
#
# Usage: npm run deploy
#
# Steps:
# 1. Validate required environment variables
# 2. Install dependencies + generate Prisma client
# 3. Run database migrations
# 4. Build the Next.js app
# 5. Run tests (optional, skip with --skip-tests)
# 6. Start/restart the PM2 process
# 7. Health check
# ─────────────────────────────────────────────

HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
MAX_HEALTH_RETRIES=15
SKIP_TESTS=false

for arg in "$@"; do
  case $arg in
    --skip-tests) SKIP_TESTS=true ;;
  esac
done

echo "============================================"
echo " Business Life OS — Deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ─── Step 1: Env validation ───
echo ""
echo "[1/7] Validating environment variables..."

REQUIRED_VARS=(
  "DATABASE_URL"
  "AUTH_SECRET"
  "NODE_ENV"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "FATAL: Missing required environment variables:"
  for var in "${MISSING[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Copy .env.example to .env and fill in required values."
  exit 1
fi

# Warn about optional but recommended vars
RECOMMENDED_VARS=("OPENAI_API_KEY" "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET")
for var in "${RECOMMENDED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "  WARN: $var not set — related features will be disabled"
  fi
done

echo "  OK: All required env vars present"

# ─── Step 2: Install dependencies ───
echo ""
echo "[2/7] Installing dependencies..."
npm ci --production=false 2>&1 | tail -5
echo "  OK: Dependencies installed (prisma generate ran via postinstall)"

# ─── Step 3: Database migrations ───
echo ""
echo "[3/7] Running database migrations..."
npx prisma migrate deploy 2>&1 | tail -5
echo "  OK: Migrations applied"

# ─── Step 4: Build ───
echo ""
echo "[4/7] Building Next.js application..."
npm run build 2>&1 | tail -10
echo "  OK: Build complete"

# ─── Step 5: Tests ───
echo ""
if [ "$SKIP_TESTS" = true ]; then
  echo "[5/7] Skipping tests (--skip-tests flag)"
else
  echo "[5/7] Running tests..."
  if npm test 2>&1 | tail -20; then
    echo "  OK: Tests passed"
  else
    echo "  WARN: Tests failed — continuing deploy (review test output)"
  fi
fi

# ─── Step 6: Start/restart PM2 ───
echo ""
echo "[6/7] Starting application with PM2..."

if command -v pm2 &> /dev/null; then
  # Check if the process is already running
  if pm2 describe blos-web > /dev/null 2>&1; then
    pm2 restart ecosystem.config.cjs 2>&1 | tail -3
    echo "  OK: Application restarted"
  else
    pm2 start ecosystem.config.cjs 2>&1 | tail -3
    echo "  OK: Application started"
  fi
  pm2 save 2>&1 | tail -1
else
  echo "  WARN: PM2 not installed — starting with next start"
  echo "  Install PM2 for production: npm install -g pm2"
  echo "  Starting in background..."
  mkdir -p /var/log/blos
  nohup npm start > /var/log/blos/out.log 2> /var/log/blos/error.log &
  echo "  PID: $!"
fi

# ─── Step 7: Health check ───
echo ""
echo "[7/7] Running health check..."

HEALTHY=false
for i in $(seq 1 $MAX_HEALTH_RETRIES); do
  sleep 2
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    RESPONSE=$(curl -sf "$HEALTH_URL")
    echo "  OK: Health check passed (attempt $i/$MAX_HEALTH_RETRIES)"
    echo "  Response: $RESPONSE"
    HEALTHY=true
    break
  fi
  echo "  Waiting for server... ($i/$MAX_HEALTH_RETRIES)"
done

echo ""
echo "============================================"
if [ "$HEALTHY" = true ]; then
  echo " DEPLOY SUCCESSFUL"
  echo " App running at: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
else
  echo " DEPLOY WARNING: Health check failed"
  echo " The build succeeded but the server may not be responding."
  echo " Check logs: pm2 logs blos-web"
fi
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
