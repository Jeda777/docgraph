# AGENTS.md

Conventions for this repository — for coding agents and human contributors alike. App-specific rules live next to the code: [`apps/server/AGENTS.md`](./apps/server/AGENTS.md) and [`apps/web/AGENTS.md`](./apps/web/AGENTS.md). Read the one for the app you are changing.

## Language

All code and project text is in **English**: identifiers, comments, logs, UI copy, commits, PRs.

## Repository layout

- `apps/server` — Hono REST API, Better Auth, Drizzle (PostgreSQL), Hocuspocus
- `apps/web` — React 19 + Vite SPA (Tailwind 4, TanStack Query, Zustand, Yjs)
- `packages/common` — shared Zod schemas (`@docgraph/common/schemas`), diagram logic (`@docgraph/common/diagram`), test-only fixtures (`@docgraph/common/fixtures/*`, never import from app code)
- `e2e` — Playwright suite ([`e2e/README.md`](./e2e/README.md))
- `docker` — production Dockerfile, dev compose (PostgreSQL + Mailpit)
- `.agents/skills` — step-by-step procedures for agents (see [Skills](#skills))

Shared dependency versions use the pnpm catalog (`pnpm-workspace.yaml`) — `"catalog:"` for shared deps.

## Commands

```sh
pnpm docker:dev     # PostgreSQL + Mailpit (needed by `pnpm dev`)
pnpm dev            # all apps via turbo (web :5173, server :3000)
pnpm check          # Biome lint + format (`--write` to fix)
pnpm build
pnpm test
pnpm test:e2e       # Playwright, needs Docker
```

Single package: `pnpm --filter server <script>`, `pnpm --filter @docgraph/common test`. Full list: the README scripts table.

## Code style (Biome)

- Formatting and import order are Biome's job — run `pnpm check --write`, don't fix by hand.
- **Types: `export type X = { ... }`, never `interface`.** `import type` for type-only imports. No `any`.
- Named exports only (defaults only in `apps/server/src/emails` and tooling configs).
- Lint suppressions name the exact rule and a reason: `// biome-ignore lint/suspicious/noExplicitAny: <why>` — never a bare `biome-ignore lint` or a whole rule group.
- Comments explain *why*, not *what*; JSDoc for non-obvious helpers.

## Naming

- Files: kebab-case. Role suffixes: `*.helpers.ts` (pure functions), `*.config.ts` (static config), `*.model.ts` (domain/document types with their helpers), `*.test.ts(x)`.
- Zod: `xxxSchema` → `type Xxx = z.infer<…>`; inputs `xxxInputSchema` / `XxxInput`, outputs `xxxOutputSchema` / `XxxOutput`.
- Constants: UPPER_SNAKE_CASE. Loggers: `const logger = log('<subsystem>')` at module top.

## Shared schemas first

Request/response shapes are Zod schemas in `packages/common`, used by `zValidator` on the server and by forms and hooks on the web. Never hand-roll API types.

## Testing

- New behavior and bug fixes come with Vitest tests next to the code (`service.ts` → `service.test.ts`). App-specific test setup is described in each app's `AGENTS.md`.
- User-facing flows: e2e spec per the "Writing tests" rules in [`e2e/README.md`](./e2e/README.md).

## Docs in sync

Update in the same change:

- Env var → `apps/server/src/config.ts`, `apps/server/.env.example`, README env table.
- MCP tool → README tools table.
- e2e spec → spec table in `e2e/README.md`.
- Script → README scripts table (and [Commands](#commands) if commonly used).
- Convention → the matching `AGENTS.md` (Git & GitHub conventions → `CONTRIBUTING.md`).

## Validation checklist

Run before finishing any change:

1. `pnpm check`
2. `pnpm build`
3. `pnpm test`
4. User-facing flows changed: `pnpm test:e2e` (CI runs it on every PR).
5. New endpoint: schema in `packages/common` → `zValidator` route + service → typed hook in `apps/web/src/lib/api`.
6. Docs updated per [Docs in sync](#docs-in-sync).

## Git & GitHub

Before creating a branch, commit or pull request, read [Git & GitHub in `CONTRIBUTING.md`](./CONTRIBUTING.md#git--github) (naming, commit format, PR title icons, squash merge, labels).

## Skills

Procedures in `.agents/skills/<name>/SKILL.md` — read the matching one when the task fits. Claude Code exposes them as slash commands through thin adapters in `.claude/skills/`.

- **pr-review** — reviewing a PR, branch or diff.
- **pr-desc** — writing a PR title/description or opening a PR.
