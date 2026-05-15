#!/usr/bin/env bash
# One-shot deploy: pull latest code, rebuild containers, run prisma migrate, swap traffic.
# Usage: /opt/sonatum/scripts/deploy.sh
set -euo pipefail

cd /opt/sonatum

# 1) Build new images (no traffic interruption — old containers keep serving)
docker compose build --pull

# 2) Run prisma migrations against the live DB using the new builder image
docker compose run --rm --no-deps backend npx prisma migrate deploy

# 3) Recreate containers with zero-ish downtime (compose stops old, starts new)
docker compose up -d --remove-orphans

# 4) Wait for healthchecks
echo "Waiting for backend health..."
for i in {1..30}; do
    if docker inspect --format '{{.State.Health.Status}}' sonatum-backend 2>/dev/null | grep -q healthy; then
        echo "backend healthy"
        break
    fi
    sleep 2
done

# 5) Reload nginx (no-op if config unchanged)
nginx -t && systemctl reload nginx

# 6) Prune dangling images
docker image prune -f >/dev/null

echo "Deploy complete: $(date -Iseconds)"
docker compose ps
