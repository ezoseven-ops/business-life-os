#!/bin/bash
set -e

echo "=== BLOS Deploy ==="
echo ""

cd /opt/blos

# 1. Pull latest
echo "[1/6] Pulling latest code..."
git pull origin main

# 2. Install deps
echo "[2/6] Installing dependencies..."
npm ci --production=false

# 3. Generate Prisma client
echo "[3/6] Generating Prisma client..."
npx prisma generate

# 4. Run migrations
echo "[4/6] Running database migrations..."
npx prisma migrate deploy

# 5. Build
echo "[5/6] Building..."
npx next build

# 6. Restart
echo "[6/6] Restarting PM2..."
pm2 reload ecosystem.config.cjs

# Health check
sleep 5
echo ""
echo "Health check..."
if curl -sf http://localhost:3000/api/health > /dev/null; then
  echo "Deploy successful!"
else
  echo "HEALTH CHECK FAILED — check logs:"
  pm2 logs blos-web --lines 30
  exit 1
fi
