# Docker

Production setup: the backend (Hono) serves the built frontend (Vite SPA), so a single
container handles both the UI and the API (`/api`, `/ws`, `/health`).

## Files

- `Dockerfile` – multi-stage build: installs workspace deps, builds `apps/web` (static
  frontend) and `apps/server` (single-file `dist/index.js` bundle made with esbuild). Everything
  is bundled into that one file except native packages (`argon2`), whose exact versions are
  emitted during the build to `dist/runtime-package.json` and installed alone in the final image.
- `docker-compose.example.yml` – the app (published image) plus a PostgreSQL service, with env
  config and a persistent volume for the database.
- `docker-compose.dev.yml` – PostgreSQL and Mailpit (SMTP catcher, UI on
  [http://localhost:8025](http://localhost:8025)) for local development.
- `nginx.example.conf` – reverse proxy example: TLS, HTTP → HTTPS redirect, WebSocket on `/ws`,
  body size for `/mcp`.

## Usage

```sh
cd docker
docker compose -f docker-compose.example.yml up -d
```

The Compose file uses the image published to `ghcr.io/jeda777/docgraph` for every release
(`linux/amd64` and `linux/arm64`). Tags: the exact version (`1.2.3`), the minor (`1.2`) and major
(`1`) lines, and `latest` for the newest stable release. To build the image from your checkout
instead, swap `image` for the commented-out `build` section and run `up --build -d`.

The app is available at [http://localhost:3000](http://localhost:3000). Log in with
`ADMIN_EMAIL` / `ADMIN_PASSWORD` from the Compose file.

Before running it for real, change at least these values in `docker-compose.example.yml`
(all variables are described in the [main README](../README.md#configuration)):

- `BETTER_AUTH_SECRET` – at least 32 random characters (`openssl rand -base64 32`).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` – the first admin account.
- `DB_PASSWORD` and `POSTGRES_PASSWORD` – the same new value in both services.
- `APP_URL` – the public origin (see [Reverse proxy](#reverse-proxy-tls)).
- `SMTP_*` – a working SMTP server. Without one, delete all the `SMTP_*` lines: one-time
  codes (login, password reset) and invitation links are then written to the server logs
  (`docker compose logs`), where anyone who can read the logs can use them. If you leave the
  example values in, sending fails with `EMAIL_DELIVERY_FAILED`.

For local development dependencies, create `apps/server/.env` from
`apps/server/.env.example` and run the following command from the repository root:

```sh
pnpm docker:dev
```

The development scripts pass `apps/server/.env` to Docker Compose so the same
environment configuration is available for Compose variable interpolation.
PostgreSQL uses `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from that file for its
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` settings.

## Reverse proxy (TLS)

The container speaks plain HTTP; put a reverse proxy in front of it for HTTPS. A complete
nginx example is in [`nginx.example.conf`](./nginx.example.conf). Whatever proxy you use:

- **`APP_URL` is the public origin**, e.g. `APP_URL: https://docs.example.com` (no path, no
  trailing slash). Better Auth trusts only this origin, and the server builds the CSP, the email
  links and HSTS (only for `https://`) from it. A mismatch shows up as a `403` on login or email
  links pointing to the wrong address.
- **Forward WebSockets on `/ws`**: pass the `Upgrade` and `Connection` headers and raise the read
  timeout (nginx closes idle proxied connections after 60 s by default). Messages can be up to
  100 MB (backup imports), so don't limit WebSocket frame size below that.
- **Allow 100 MB request bodies** (`client_max_body_size 100m` in nginx): MCP tools send whole
  documents to `/mcp`. The app enforces its own limits (1 MB on `/api`, 100 MB on `/mcp`).
- **Don't add security headers** in the proxy: the app already sends CSP, HSTS,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and the rest. A second CSP is enforced
  on top of the app's one and can break the editor.
- **Set `X-Forwarded-For` to the client address** (overwrite, don't append — `$remote_addr` in
  nginx): Better Auth rate-limits login by it. Without the header, or with more than one entry,
  all clients share one counter, so a single attacker can lock everyone out of login. If a CDN or
  load balancer (e.g. Cloudflare) sits in front of nginx, `$remote_addr` is that intermediary's
  address and everyone shares one counter again: restore the client address first with
  `set_real_ip_from` (the intermediary's ranges) and `real_ip_header` (`ngx_http_realip_module`).
- **Keep the port private**: publish the app on localhost only, so it is reachable through the
  proxy and not directly over HTTP, where clients could set `X-Forwarded-For` themselves and
  dodge the login rate limit:

  ```yaml
  ports:
    - 127.0.0.1:3000:3000
  ```

## Backup and restore

All data — users, projects, documents and diagrams (stored as Yjs state) — lives in PostgreSQL,
so a database dump is a full backup. Run from the `docker` directory:

```sh
docker compose -f docker-compose.example.yml exec -T postgres \
  pg_dump -U docgraph -d docgraph -Fc > docgraph-$(date +%F).dump
```

`-Fc` writes PostgreSQL's compressed custom format. The dump is consistent even while users are
editing, but misses edits from the last few seconds that the collaboration server hasn't stored
yet. Adjust `-U docgraph -d docgraph` here and below if you changed `DB_USER` / `DB_NAME`.

To run it from cron, escape `%` (cron treats it as a newline) or put the commands in a script.
Delete old dumps and copy the files off the host:

```cron
0 3 * * * cd /opt/docgraph/docker && docker compose -f docker-compose.example.yml exec -T postgres pg_dump -U docgraph -d docgraph -Fc > /var/backups/docgraph-$(date +\%F).dump
30 3 * * * find /var/backups -name 'docgraph-*.dump' -mtime +14 -delete
```

To restore, stop the app so nobody writes in the meantime, recreate the database empty, load the
dump and start the app again:

```sh
docker compose -f docker-compose.example.yml stop app
docker compose -f docker-compose.example.yml exec -T postgres dropdb -U docgraph --if-exists docgraph
docker compose -f docker-compose.example.yml exec -T postgres createdb -U docgraph docgraph
docker compose -f docker-compose.example.yml exec -T postgres \
  pg_restore -U docgraph -d docgraph --no-owner --exit-on-error < docgraph-2026-01-31.dump
docker compose -f docker-compose.example.yml start app
```

Restore into an empty database rather than with `pg_restore --clean`: `--clean` drops only the
objects that are in the dump, so tables added by newer migrations stay behind (and can block
dropping the old ones), which breaks the next update. `--exit-on-error` stops at the first error
instead of finishing with an easy-to-miss "errors ignored on restore".

Single documents can also be exported and imported from the UI (`.docgraph` / JSON), but that is
not a substitute for a database backup.

## Updating

Back up, pull the new image and recreate the container:

```sh
docker compose -f docker-compose.example.yml exec -T postgres \
  pg_dump -U docgraph -d docgraph -Fc > docgraph-before-update.dump
docker compose -f docker-compose.example.yml pull app
docker compose -f docker-compose.example.yml up -d
```

With a pinned tag (e.g. `:1.2`), change it in the Compose file first. Building from source
instead: `git pull`, then `up --build -d`.

- **Back up first**: migrations run automatically on server start and are forward-only — the way
  back to an older version is the old code plus the dump taken before the update, restored into
  an empty database as described in [Backup and restore](#backup-and-restore).
- **Downtime is a few seconds**: Compose stops the old container (SIGTERM, open documents are
  stored before exit) and starts the new one. Open editors reconnect by themselves; the pull (or build) runs
  before the old container is stopped.
- **PostgreSQL minor versions** (`18.6` → `18.7`): change the image tag and run
  `docker compose -f docker-compose.example.yml up -d`.
- **PostgreSQL major versions** (e.g. `18` → `19`) can't read each other's data directory, so
  they need a dump and restore. Since PostgreSQL 18 the image keeps its data in a per-version
  directory (`/var/lib/postgresql/18/docker`) inside the volume, so the new version starts with an
  empty cluster next to the old one, which stays as the way back:

  ```sh
  # Stop the app so the dump has every edit, then dump and check the file is readable
  docker compose -f docker-compose.example.yml stop app
  docker compose -f docker-compose.example.yml exec -T postgres \
    pg_dump -U docgraph -d docgraph -Fc > docgraph-pg18.dump
  docker compose -f docker-compose.example.yml exec -T postgres \
    pg_restore --list < docgraph-pg18.dump > /dev/null && echo OK
  # Change the postgres image tag, then start only the new database and restore into it
  docker compose -f docker-compose.example.yml up -d --wait postgres
  docker compose -f docker-compose.example.yml exec -T postgres \
    pg_restore -U docgraph -d docgraph --no-owner --exit-on-error < docgraph-pg18.dump
  docker compose -f docker-compose.example.yml up -d
  ```

  To roll back, set the old tag again. Once the new version works, free the space with
  `docker compose -f docker-compose.example.yml exec postgres rm -rf /var/lib/postgresql/18`.
- Check the release notes / commit log for new or changed env vars (the server refuses to start
  when a required one is missing — see `docker compose logs app`).

## Security headers and limits

Every response carries security headers: Content-Security-Policy, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS when `APP_URL` is HTTPS,
and `Cross-Origin-Resource-Policy` / `Cross-Origin-Opener-Policy: same-origin` — other sites
(including email clients) can't embed files served by DocGraph, and popups to other origins lose
`window.opener`.

Request bodies are limited to 1 MB on `/api` and 100 MB on `/mcp`, WebSocket messages to 100 MB;
larger requests get `413 PAYLOAD_TOO_LARGE`. Document content and backup imports go through the
WebSocket, so the 1 MB limit never applies to them.

## Notes

- In production the server binds to `0.0.0.0:PORT` (default `3000`) and serves the built
  frontend together with the API (`/api`, `/ws`, `/mcp`, `/health`).
- The database is PostgreSQL, configured via `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
  `DB_NAME` and `DB_SSL` (TLS for managed hosts); its data lives in the `db-data` volume. Schema
  migrations and admin seeding run automatically on server start.
- `docker stop` (SIGTERM) shuts the server down gracefully: open documents are stored before the
  process exits, within Docker's default 10 s stop timeout. `tini` runs as PID 1 in the image so
  the signal reaches Node.
- Locally (`pnpm dev`) the server runs on `localhost:3000` via tsx and Vite serves the frontend on
  `:5173`; start PostgreSQL and Mailpit first with `pnpm docker:dev`.
