#!/usr/bin/env bash
# Daily Postgres dump for sonatum_music. Wired up via /etc/cron.d/sonatum-backup.
set -euo pipefail

BACKUP_DIR=/var/backups/sonatum
DB=sonatum_music
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/${DB}-${TS}.sql.gz"

sudo -u postgres pg_dump --format=plain --no-owner --no-privileges "$DB" \
    | gzip -9 > "$OUT"

# Drop old dumps
find "$BACKUP_DIR" -name "${DB}-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Quick sanity log
echo "[$(date -Iseconds)] backup ok: $OUT ($(du -h "$OUT" | cut -f1))" \
    >> /var/log/sonatum-backup.log
