# Sonatum Music — Production Infrastructure

Production stack for `sonatum-music.ru`. Postgres + nginx live on the host;
backend and frontend run as Docker containers behind nginx.

## Layout

```
/opt/sonatum/
├── backend/              Next.js 14 API (Prisma 5)  — container `sonatum-backend`
├── frontend/             Next.js 14 UI              — container `sonatum-frontend`
├── data/
│   ├── audio/            Track audio (persisted, served by nginx)
│   ├── images/           Cover art / avatars
│   ├── sheets/           Sheet music PDFs
│   └── uploads/          User uploads
├── nginx/sonatum.conf    Production nginx vhost (symlinked into sites-enabled)
├── scripts/
│   ├── deploy.sh         Pull + rebuild + migrate + reload
│   └── backup-postgres.sh  Daily pg_dump → /var/backups/sonatum
├── systemd/
│   └── sonatum-stack.service  Auto-start compose at boot
├── docker-compose.yml
└── secrets.env           Backend secrets — never commit to git
```

## Architecture

- **nginx** (host): TLS termination, gzip, static media, reverse proxy.
- **frontend** (container): Next.js standalone, port 3010 on host.
- **backend** (container): Next.js standalone + Prisma, port 3011 on host.
- **PostgreSQL** (host): reachable from containers via `host.docker.internal`.
- **Static media**: bind-mounted into containers and served directly by nginx.

Ports 3010/3011 are bound to `127.0.0.1` only — only nginx can reach them.

## First-time setup

```bash
# 1. Postgres needs to accept connections from the docker bridge.
#    Edit /etc/postgresql/16/main/postgresql.conf:
#       listen_addresses = 'localhost,172.17.0.1'
#    Edit /etc/postgresql/16/main/pg_hba.conf, add:
#       host  sonatum_music  sonatum_user  172.17.0.0/16  scram-sha-256
#    systemctl restart postgresql

# 2. Secrets
cp secrets.env.example secrets.env
$EDITOR secrets.env   # set DATABASE_URL, TELEGRAM_BOT_TOKEN, ALLOWED_ADMIN_TG_ID

# 3. Build + start
docker compose build
docker compose up -d
docker compose ps

# 4. Nginx vhost (host-side)
ln -s /opt/sonatum/nginx/sonatum.conf /etc/nginx/sites-available/sonatum-music
ln -sf /etc/nginx/sites-available/sonatum-music /etc/nginx/sites-enabled/sonatum-music
cp /opt/sonatum/nginx/connection_upgrade.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx

# 5. Boot persistence
cp /opt/sonatum/systemd/sonatum-stack.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sonatum-stack

# 6. Daily backups
echo '0 3 * * * root /opt/sonatum/scripts/backup-postgres.sh' \
    > /etc/cron.d/sonatum-backup
```

## Day-to-day

```bash
# Deploy a new version
git -C /opt/sonatum pull && /opt/sonatum/scripts/deploy.sh

# Logs
docker compose logs -f backend
docker compose logs -f frontend

# Health
docker compose ps
curl -fsS http://127.0.0.1:3011/api/health
curl -fsS http://127.0.0.1:3010/

# Restore a dump
gunzip -c /var/backups/sonatum/sonatum_music-YYYYMMDD-HHMMSS.sql.gz \
    | sudo -u postgres psql sonatum_music
```

## Notes

- `output: 'standalone'` is enabled in both `next.config` files — image runtime
  ships only the production server and the dependencies it actually imports.
- Healthcheck on backend hits `/api/health`. Frontend waits for backend to be
  healthy before starting (compose `depends_on.condition`).
- Memory limits: backend 1.5 GB, frontend 768 MB. Adjust in `docker-compose.yml`.
- Static media volumes are read-only in the frontend container (it only displays
  them; uploads go through the backend API).
