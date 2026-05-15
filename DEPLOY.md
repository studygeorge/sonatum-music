# Sonatum Music — Production Deploy & Operations

Сервер: `79.174.95.62` · домен: `sonatum-music.ru` · Ubuntu 24.04 · 4 CPU / 5.8 GB / 30 GB SSD.

## Архитектура

```
                          ┌──────────────────┐
   internet ──443──►       │  nginx (host)    │  TLS, gzip, статика, прокси
                          └─┬────────┬───────┘
                            │ /audio /images /sheets/uploads → /opt/sonatum/data
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
    ┌────────────────────┐    ┌────────────────────┐
    │  sonatum-frontend  │    │  sonatum-backend   │
    │  Next.js 14 stand. │    │  Next.js + Prisma  │
    │  127.0.0.1:3010    │    │  127.0.0.1:3011    │
    └─────────┬──────────┘    └──────────┬─────────┘
              │                          │
              └──── docker bridge ───────┘
                  (sonatum_sonatum_net)
                            │
                            ▼ host.docker.internal:5432
                    ┌──────────────────┐
                    │ PostgreSQL 16    │  on host
                    │ 172.17.0.1:5432  │
                    └──────────────────┘
```

- **nginx** на хосте: TLS-терминация, статика (`/audio` `/images` `/sheets` `/uploads` напрямую с диска), reverse-proxy на контейнеры.
- **Frontend container** (`sonatum-frontend`): Next.js standalone, порт 3010 (только loopback).
- **Backend container** (`sonatum-backend`): Next.js + Prisma, порт 3011 (только loopback).
- **PostgreSQL** на хосте; контейнеры подключаются через `host.docker.internal:5432`.
- **Static media** хранится в `/opt/sonatum/data/` (bind-mount в контейнеры; nginx раздаёт без проксирования через приложение).

## Раскладка файлов

```
/opt/sonatum/
├── backend/                 Исходники Next.js API + Prisma
├── frontend/                Исходники Next.js UI
├── data/                    Перманентные медиа (bind-mounted, бекапить отдельно!)
│   ├── audio/   images/   sheets/   uploads/
├── docs/                    ТЗ-доки (.docx) и парсеры
├── nginx/sonatum.conf       Прод-конфиг nginx (linked → /etc/nginx/sites-enabled)
├── scripts/
│   ├── deploy.sh            Pull + build + migrate + reload
│   └── backup-postgres.sh   Daily pg_dump → /var/backups/sonatum
├── systemd/sonatum-stack.service  Auto-start compose at boot
├── docker-compose.yml
├── secrets.env              ❗ НЕ КОММИТИТЬ. Содержит DATABASE_URL, токены
├── README.md
└── DEPLOY.md (этот файл)
```

## Что уже настроено

- ✅ Docker 29.4 + docker-compose v5.1, MTU=1450 (ens3 совпадает), DNS 1.1.1.1+8.8.8.8
- ✅ Postgres слушает `localhost,172.17.0.1`, pg_hba принимает `172.16.0.0/12` (все docker bridges)
- ✅ Sonatum schema принадлежит `sonatum_user`, гранты выданы
- ✅ Multi-stage Dockerfile с Next.js standalone (тонкие образы: backend 393MB, frontend 241MB)
- ✅ Healthchecks: backend `/api/health`, frontend `/`, frontend ждёт healthy backend
- ✅ TLS Let's Encrypt (existing), HTTP/2, gzip
- ✅ Автозапуск при reboot: `sonatum-stack.service`
- ✅ Бэкапы Postgres ежедневно в 03:00 → `/var/backups/sonatum/` с retention 14 дней
- ✅ Старые systemd-сервисы (`sonatum-backend.service` / `sonatum-frontend.service`) и PM2 удалены

## Доступы и креды

| Что | Где |
|---|---|
| SSH | `ssh root@79.174.95.62` (пароль из памяти) |
| Postgres | `sudo -u postgres psql -d sonatum_music` |
| Postgres user | `sonatum_user` / пароль в `/opt/sonatum/secrets.env` |
| Telegram bot | `@sonatumbot`, токен в `secrets.env` |
| Admin TG ID | `5525020749` (только этот ID получает админ-уведомления) |
| Test admin | `admin@sonatum.music / Admin123!` (см. seed) |

## Быстрые команды

```bash
# Статус стека
docker compose -f /opt/sonatum/docker-compose.yml ps

# Логи (хвостом)
docker compose -f /opt/sonatum/docker-compose.yml logs -f backend
docker compose -f /opt/sonatum/docker-compose.yml logs -f frontend

# Рестарт одного сервиса
docker compose -f /opt/sonatum/docker-compose.yml restart backend

# Healthcheck напрямую
curl https://sonatum-music.ru/api/health
```

## Деплой новой версии

Если код в git репо `studygeorge/sonatum-music`:

```bash
ssh root@79.174.95.62
cd /opt/sonatum
# 1) синхронизировать код (вручную или git pull в backend/frontend)
# 2) запустить деплой
./scripts/deploy.sh
```

`deploy.sh` делает: build → `prisma migrate deploy` через одноразовый контейнер → `up -d` → healthcheck wait → `nginx -t && reload` → prune dangling images.

При первом релизе из репо рекомендую сделать `/opt/sonatum/backend` и `/opt/sonatum/frontend` git-репозиториями (`git init && git remote add origin ...`), чтобы deploy.sh поддерживал `git pull`.

## Откат

```bash
# Список тегов сохранённых образов
docker images sonatum/backend
docker images sonatum/frontend

# Если делали `docker tag sonatum/backend:latest sonatum/backend:v2026-04-27`
docker compose -f /opt/sonatum/docker-compose.yml down
# Подменить tag в docker-compose.yml на нужный, потом:
docker compose -f /opt/sonatum/docker-compose.yml up -d
```

Для гарантированного rollback **тегайте каждый успешный билд**:
```bash
TAG=$(date +%Y%m%d-%H%M)
docker tag sonatum/backend:latest sonatum/backend:$TAG
docker tag sonatum/frontend:latest sonatum/frontend:$TAG
```

## Восстановление БД из бэкапа

```bash
ls /var/backups/sonatum/                       # выбрать дамп
gunzip -c /var/backups/sonatum/sonatum_music-YYYYMMDD-HHMMSS.sql.gz \
    | sudo -u postgres psql sonatum_music
docker compose -f /opt/sonatum/docker-compose.yml restart backend
```

## Известные точки риска

- **Диск 30 ГБ** — впритык. После релиза 1.0 рекомендую расширить до 50–80 ГБ. Места основные потребители: `/var/lib/docker/` (~5 ГБ), `/opt/sonatum/data/audio` (растёт линейно с загрузками), Postgres data (мал, но WAL может расти при долгих транзакциях).
- **SMTP исходящий заблокирован** хостингом — для писем регистрации/восстановления пароля нужен внешний транзакционный сервис (Resend/Mailgun/Postmark). Сейчас email-подтверждение де-факто отключено.
- **Postgres на хосте**, не в контейнере — данные не теряются при пересборке, но миграция на другой сервер потребует `pg_dump` + ручной перенос.
- **secrets.env** на сервере, права 600. Не попадает в git. При компрометации — менять `Sonatum_Music_2026_Strong_Pass`, перевыпускать TG-токен.
- **Cron-запись `/etc/cron.d/rondo`** заблокирована к удалению (chattr +i, не удаляется). Бинарь `/etc/rondo/rondo` отсутствует, угрозы нет, но cron-логи будут шумить «No such file or directory» при reboot.

## Editorial и алгоритмические подборки

Главная (`/api/home/feed`) собирает 7 секций **без LLM** — чисто SQL/Prisma:

| Секция        | Алгоритм                                                                              |
| ------------- | ------------------------------------------------------------------------------------- |
| `personalMix` | Топ по `likeCount` (заглушка под content-based)                                       |
| `history`     | Уникальные треки из `TrackActivity` юзера                                             |
| `newReleases` | Сортировка по `releaseDate` desc, fallback `createdAt`                                |
| `chart`       | Топ по `playCount`                                                                    |
| `editorial`   | `Playlist.type=EDITORIAL & isPublic`, сортировка по `updatedAt`                       |
| `radar`       | Треки за 14 дней (fallback 90), score = `likeCount + playCount`                       |
| `discoveries` | Артисты с PUBLISHED-треками за 30 дней, score = `Σplays + 5·Σlikes`                   |

Editorial-плейлисты обновляются cron'ом `/etc/cron.d/sonatum-editorial` каждые
6 часов через `POST /api/cron/refresh-editorial` (защищён `X-Cron-Secret`).
6 авто-рецептов: `auto-top-week`, `auto-fresh`, `auto-orthodox`, `auto-znamenny`,
`auto-bells`, `auto-chamber`. Код: `backend/app/api/cron/refresh-editorial/route.ts`.

## Email и аутентификация

Mailer (`backend/lib/mailer.ts`) использует **Resend** через HTTPS-API (SMTP
заблокирован хостингом). Без `RESEND_API_KEY` — fallback в console: письмо
печатается в `docker logs sonatum-backend`, ничего не падает.

Auth-флоу:

| Endpoint                          | Описание                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `POST /api/auth/send-verify`      | Verify-token (24 ч), email подтверждения                            |
| `POST /api/auth/verify-email`     | Активирует юзера, `emailVerified=NOW()`, `status=ACTIVE`            |
| `POST /api/auth/forgot-password`  | Reset-token (1 ч), email со ссылкой `/auth/reset/<token>`           |
| `POST /api/auth/reset-password`   | Смена пароля, инвалидация всех активных сессий                      |

UI: `/auth/forgot`, `/auth/reset/[token]`, `/auth/verify-email/[token]`.
Токены — таблица `verification_tokens` (purpose `VERIFY_EMAIL` / `PASSWORD_RESET`).

## Жалобы правообладателей

`/legal/copyright` — полный юр. текст + форма (компонент `CopyrightClaimForm`).
POST идёт в `/api/copyright-claim` (без auth). Записи в таблицу
`copyright_claims`. Админу — `SELECT * FROM copyright_claims ORDER BY "createdAt" DESC;`.

## Юридические страницы

Все страницы под `/legal/*` собраны из .docx файлов клиента в общий компонент
`LegalLayout`:

- `/legal/privacy` — Политика конфиденциальности
- `/legal/personal-data` — Политика обработки ПД
- `/legal/terms` — Пользовательское соглашение
- `/legal/refund` — Условия возврата
- `/legal/copyright` — Для правообладателей + форма жалобы
- `/legal/cookies` — Cookie (старая заглушка, заменить когда появится текст)

Cookie-баннер (`CookieBanner`) на каждой странице, состояние согласия — в
`localStorage` ключ `sonatum:cookie-consent`.

## Что сделать в ближайшее время (минимум)

1. Расширить диск до 50 ГБ.
2. **Получить Resend ключ**, добавить `RESEND_API_KEY` и `MAIL_FROM` в
   `/opt/sonatum/secrets.env`. До этого письма пишутся в логи (фолбэк).
3. Зарегистрировать почту `copyright@sonatum.ru` чтобы получать жалобы
   правообладателей (форма уже работает, но email-уведомлений админу нет).
4. Выложить инфра-файлы в git репо (`/opt/sonatum/` без `secrets.env`, `data/`,
   `node_modules`, `.next`).
5. Добавить uptime-мониторинг (UptimeRobot или Uptime Kuma).
6. Подключить ЮKassa для Premium-подписки и покупки треков.
