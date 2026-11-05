# Server rules (`apps/server`)

General conventions: [root `AGENTS.md`](../../AGENTS.md).

## Module structure

- Module per entity: `src/modules/<entity>/{routes,service,repo}.ts`.
- One owner per cross-cutting rule — never duplicate it:
  - `modules/project/access.ts` — project visibility (`requireProjectAccess` for single rows, `visibilityWhere` for lists); no access → 404, never 403.
  - `modules/item/access.ts` — `requireItemAccess` for single items (404 names only the item, never its project); don't pair `getByIdWithoutDocument` with `requireProjectAccess` yourself.
  - `modules/item/document-store.ts` — the only reader/writer of `items.document` (CRDT blob); decides read-only.
  - `modules/auth/middleware.ts` — `requireAuth`, `requireAdmin`, `requireApiKey` (`x-api-key`, for `/mcp`); never reimplement auth checks.
  - `modules/auth/better-auth.ts` — sessions, login, password reset, API keys under `/api/auth/*`; no hand-written auth endpoints.
  - `src/lib/security.ts` — security headers (CSP: scripts from the app origin only) and body/WebSocket size limits; read its JSDoc before changing limits or embedding server files elsewhere.
- Server-side editing of item content lives in domain modules — `modules/item/item-document.ts`, `modules/diagram`, `modules/document` — never in `modules/mcp`, which only registers tools (`server.ts`) and mounts the handler (`routes.ts`). `modules/diagram` and `modules/document` have no routes/repo and name files `<subject>.<layer>.ts` (e.g. `database-diagram.service.ts`).

## Layers

- **routes.ts** — thin `Hono` router: `basePath('/<entity>')`, `use('*', requireAuth)`, `zValidator` per endpoint (from `src/lib/validator.ts`, never `@hono/zod-validator`), `requireAdmin` where needed, then delegate to the service. No business logic. Mounted under `/api` in `createApp` (`src/app.ts`); `src/index.ts` only starts the app.
- **service.ts** — business logic; throw typed exceptions from `src/errors.ts`; wrap multi-step writes in `db.transaction`.
- **repo.ts** — `...createRepo(table)` plus entity methods; every method takes optional `tx?: Transaction`.

## Collaboration (`src/crdt.ts`)

- Hocuspocus authenticates WebSockets with the session cookie, persists only through `document-store.ts` and enforces read-only server-side.
- Access is checked only on connect: a service that narrows access calls `closeItemConnections` / `closeProjectConnections` / `closeUserConnections` **after the commit** (see their JSDoc for when each applies).
- Ended sessions close their connections too: deleted ones (sign-out, revoked sessions, password change or reset) through `notifySessionEnded` in `modules/auth/session-events.ts`, called from Better Auth's session delete hook; expired ones through the periodic `closeExpiredSessionConnections`. Delete sessions through Better Auth so the hook fires.
- Never exit the process without `shutdownCrdt` (stores open documents).

## Errors

- Every non-2xx REST response is an `ApiError` (`{ code, message, issues? }`, `packages/common/schemas/error.ts`) produced by `handleError` / `handleNotFound` — never `c.text` or a hand-built `c.json`. Only the MCP handler answers with JSON-RPC errors.
- Exceptions take the code first, an optional message second: `throw new ConflictException('USER_ALREADY_EXISTS')`. Add a message only when it says more than the code; never put internal details in it.
- The web never shows `message` — it picks text by `code`. A failure the web must handle specially gets its own code: add it to `API_ERROR_CODES`, the exception's code type in `src/errors.ts` and `ERROR_MESSAGES` in `apps/web/src/lib/api/errors.ts`.

## Database & migrations

- Schema in `src/db/schema.ts`; import helpers from `'../../db'`.
- Migrations: change `src/db/schema.ts`, then `pnpm --filter server db:generate --name <name>` writes `drizzle/<timestamp>_<name>/migration.sql` (+ `snapshot.json`, commit both). Review the SQL; data changes (backfills, renames drizzle-kit reads as drop + add) go into it by hand, or into an empty file from `db:generate --custom --name <name>`. Never edit a migration that has shipped. The server applies pending ones on start (`runMigrations`, under an advisory lock), so the image needs no drizzle-kit.
- Archive vs delete: archiving is the `is_archived` flag (`PATCH`, row stays readable but read-only); `DELETE` removes for good. No soft deletes (`deleted_at`).
- Users with access to a restricted project are its **members** (`projects_to_users`, `memberIds` / `members`).

## Configuration

Env vars are validated in `src/config.ts` — read them only through `config`, never `process.env`. New vars also go to `.env.example` and the README env table.

## Testing

Tests run against real PostgreSQL (needs Docker): `src/test/global-setup.ts` starts one Testcontainers instance per run and `src/test/setup.ts` gives every test file its own database. Use helpers from `src/test/db.ts` (`migrateTestDb`, `resetTestDb`, `createUser`, `sessionCookieFor`, …); test routes via `app.request` on a fresh `Hono` app.

Code that relies on locks (`for('update')`, advisory locks) gets a concurrency test: hold the competing change in `openTransaction()`, start the code under test, `await waitForLockWaits()` to prove it blocks, then `commit()` and assert what it saw (examples: `modules/user/service.test.ts`, `modules/item/document-store.test.ts`).

## Imports

No path alias — relative imports.
