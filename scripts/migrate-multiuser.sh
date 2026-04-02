#!/bin/bash
# Multi-user migration script
# Run this after pulling the code changes

set -e

echo "🔄 Step 1: Clearing Turbopack cache..."
rm -rf .next

echo "🔄 Step 2: Running Prisma migration..."
npx prisma migrate dev --name add-multiuser-rbac

echo "🔄 Step 3: Backfilling ProjectMember records for existing users..."
npx tsx scripts/backfill-project-members.ts

echo "✅ Migration complete!"
echo ""
echo "Run 'npm run dev' to start the dev server."
echo ""
echo "To invite a team member or client:"
echo "  1. Go to Settings → Team"
echo "  2. Click '+ Invite'"
echo "  3. Enter their email and select a role"
echo "  4. Share the /invite/[token] link with them"
