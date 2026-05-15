#!/usr/bin/env bash
# Hits the backend's refresh-editorial endpoint to rebuild auto-* playlists.
# Wired up via /etc/cron.d/sonatum-editorial.
set -euo pipefail

# Pull CRON_SECRET from the same secrets.env the containers use
SECRET=$(grep -E '^CRON_SECRET=' /opt/sonatum/secrets.env | cut -d= -f2-)

if [ -z "$SECRET" ]; then
    echo "[$(date -Iseconds)] CRON_SECRET missing in /opt/sonatum/secrets.env" >> /var/log/sonatum-editorial.log
    exit 1
fi

RESPONSE=$(curl -fsS -X POST \
    -H "X-Cron-Secret: $SECRET" \
    -H "Content-Type: application/json" \
    http://127.0.0.1:3011/api/cron/refresh-editorial 2>&1) || {
    echo "[$(date -Iseconds)] FAIL: $RESPONSE" >> /var/log/sonatum-editorial.log
    exit 1
}

echo "[$(date -Iseconds)] $RESPONSE" >> /var/log/sonatum-editorial.log
