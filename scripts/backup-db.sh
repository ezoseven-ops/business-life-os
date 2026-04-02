#!/bin/bash
# Daily PostgreSQL backup
# Add to cron: 0 3 * * * /opt/blos/scripts/backup-db.sh

BACKUP_DIR="/var/backups/blos"
DB_NAME="blos_prod"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "Backing up $DB_NAME..."
pg_dump "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"

# Rotate old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete

echo "Backup complete: ${DB_NAME}_${DATE}.sql.gz"
echo "Remaining backups:"
ls -lh "$BACKUP_DIR"
