#!/bin/sh
# HIVE container entrypoint — first-boot initialization + start.
set -e

echo "=== HIVE startup ==="

DATA_DIR="/app/data"
DB_FILE="$DATA_DIR/hive.db"

# 1. Ensure persistent directories exist on the volume
mkdir -p "$DATA_DIR/backups" /app/public/uploads

# 2. The app resolves its DB and backup paths from process.cwd():
#      /app/dev.db    (src/lib/prisma.ts, scripts/init-db.js, backupScheduler)
#      /app/backups   (src/lib/backupScheduler.ts)
#    Symlink both onto the mounted volume so data survives rebuilds.
ln -sfn "$DB_FILE" /app/dev.db
ln -sfn "$DATA_DIR/backups" /app/backups

# 3. Create / sync the database schema (DATABASE_URL points at $DB_FILE)
if [ ! -f "$DB_FILE" ]; then
  echo "No database found — creating schema at $DB_FILE ..."
  npx prisma db push --accept-data-loss
  echo "Database created. Set ALLOW_SEED=true and visit /api/auth/seed once to create the admin."
else
  echo "Database exists — syncing schema ..."
  npx prisma db push
fi

# 4. Enable WAL mode + sane sync level (idempotent; runtime client re-checks too)
node scripts/init-db.js

# 5. Start Next.js
echo "Starting HIVE on :${PORT:-3000} (TZ=$TZ) ..."
exec npm start
