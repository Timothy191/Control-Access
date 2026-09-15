#!/usr/bin/env bash
set -eo pipefail

PROJECT_DIR="/home/server/Projects/Control-Access"
DB_FILE="$PROJECT_DIR/mine_management.db"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mine_management_${TIMESTAMP}.db"
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
    echo "[$(date -Iseconds)] [ERROR] Database file $DB_FILE not found." >> "$LOG_FILE"
    exit 1
fi

# Execute safe, online live SQLite WAL backup using sqlite3 online backup API
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Verify backup integrity
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
    echo "[$(date -Iseconds)] [ERROR] Integrity check failed for backup $BACKUP_FILE: $INTEGRITY" >> "$LOG_FILE"
    rm -f "$BACKUP_FILE"
    exit 1
fi

SIZE_KB=$(du -k "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] [SUCCESS] Verified backup created: mine_management_${TIMESTAMP}.db (${SIZE_KB} KB, integrity: ok)" >> "$LOG_FILE"

# Retention policy: purge backups older than 180 days
find "$BACKUP_DIR" -name "mine_management_*.db" -type f -mtime +180 -delete

exit 0
