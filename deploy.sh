#!/bin/bash
# HIVE Deploy Script — run on server to pull latest changes and restart
# Usage: ./deploy.sh

set -e

echo "🐝 HIVE Deploy"
echo "══════════════════════════════"

# Pull latest code
echo "📥 Pulling latest changes..."
git fetch origin
git reset --hard origin/master
echo "✓ Code updated"

# Install any new dependencies
echo "📦 Installing dependencies..."
npm install --production=false
echo "✓ Dependencies installed"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo "✓ Prisma client generated"

# Push any schema changes to DB (safe — won't drop data)
echo "🗄️  Syncing database schema..."
npx prisma db push --skip-generate
echo "✓ Database synced"

# Build the app
echo "🏗️  Building..."
npm run build
echo "✓ Build complete"

# Restart the app (tries pm2 first, then systemd)
echo "🔄 Restarting..."
if command -v pm2 &> /dev/null && pm2 list | grep -q "hive"; then
  pm2 restart hive
  echo "✓ Restarted via pm2"
elif systemctl is-active --quiet hive 2>/dev/null; then
  sudo systemctl restart hive
  echo "✓ Restarted via systemd"
else
  echo "⚠ No process manager detected. Start manually with: npm start"
fi

echo ""
echo "══════════════════════════════"
echo "🐝 Deploy complete!"
echo "══════════════════════════════"
