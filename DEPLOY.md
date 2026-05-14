# DWIGHT â€” Deployment

## Quickstart (single-host with docker compose)

Requirements on the host:
- Docker + Docker Compose v2
- Ports 80/443 open and a DNS A-record pointing `PUBLIC_HOST` â†’ host IP

Steps:

```sh
# 1. Clone repo to /opt/dwight (or wherever)
git clone <repo> /opt/dwight
cd /opt/dwight

# 2. Configure
cp .env.prod.example .env.prod
$EDITOR .env.prod          # set PUBLIC_HOST, POSTGRES_PASSWORD, AUTH_SECRET

# 3. Build + start
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Apply DB schema (first time only)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec app node -e "require('drizzle-orm/postgres-js/migrator');" \
  # or copy drizzle/*.sql files into the db container and `psql -f`
# Easiest: run `pnpm db:push` locally with DATABASE_URL pointed at the prod db
# through an SSH tunnel.

# 5. Smoke
curl https://${PUBLIC_HOST}/healthz
```

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) builds + pushes the image
to GHCR on every push to `main` and SSH-deploys to the host.

Required repo secrets:
- `DEPLOY_HOST` â€” server hostname/IP
- `DEPLOY_USER` â€” SSH user
- `DEPLOY_SSH_KEY` â€” private key (deploy-only key recommended)

The deploy step pulls the new image and runs `docker compose up -d`, then
`curl /healthz` for smoke.

## TLS

Caddy auto-issues Let's Encrypt certs for `PUBLIC_HOST`. Email defaults to
`acme-default@nobody`, override via env if needed.

## SSE

`/s/:id/stream` requires no-buffer streaming. The Caddyfile sets
`flush_interval -1` on a regex-matched route so SSE messages are not
buffered.

## Backups

`docker compose ... exec db pg_dump -U dwight dwight > backup.sql`

## Migration 0007 (Phase 11.2): drop EITHER from confirmation_mode enum

Vor dem `pnpm db:push` / `psql -f drizzle/0007_*.sql` zwingend Pre-flight ausführen:

```sh
DATABASE_URL=postgres://... node scripts/check-confirmation-mode.mjs
```n
Wenn das Skript mit Exit 1 abbricht, läuft noch eine aktive Session mit `confirmationMode = 'EITHER'`. Diese Session manuell auf `PEERS` migrieren oder beenden, bevor die SQL-Migration angewendet wird. Anschließend:

```sh
psql -f drizzle/0007_confirmation_mode_2vals.sql
```

