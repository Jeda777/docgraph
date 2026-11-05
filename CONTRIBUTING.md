# Contributing to DocGraph

Thanks for your interest in contributing! Bug reports, feature ideas, documentation fixes and code are all welcome. This guide explains how to set up the project and what we expect from a pull request.

## Ways to contribute

- **Report a bug** — open an issue with the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md). Include reproduction steps, expected vs. actual behavior and your environment.
- **Suggest a feature** — use the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.md). Describe the problem first, then your proposed solution.
- **Send a pull request** — for anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.
- **Security vulnerabilities** — do **not** open a public issue. Follow [SECURITY.md](./SECURITY.md).

## Development setup

1. Install the prerequisites:
   - Node.js, the version in [`.node-version`](./.node-version)
   - pnpm 12 (`corepack enable`)
   - Docker (local PostgreSQL and Mailpit, server and end-to-end tests)
   - VS Code users: install the recommended extensions from [`.vscode/extensions.json`](./.vscode/extensions.json). The project uses TypeScript 7, which VS Code supports only through the [TypeScript 7](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview) extension.
2. Fork the repository and clone your fork.
3. Install dependencies and create the environment file (the example values work locally):

   ```sh
   pnpm install
   cp apps/server/.env.example apps/server/.env
   ```

4. Start PostgreSQL and Mailpit, then the dev environment:

   ```sh
   pnpm docker:dev
   pnpm dev
   ```

   Web app: http://localhost:5173 · API: http://localhost:3000 · Emails (Mailpit): http://localhost:8025

   Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `apps/server/.env`.

See the [README](./README.md#development) for all scripts and environment variables.

## Making changes

1. Create a branch off `main`, named as described in [Branches](#branches).
2. Follow the code conventions (below) and add tests for new behavior and bug fixes.
3. Run the [validation checklist](./AGENTS.md#validation-checklist) before pushing. CI runs the same checks on every pull request; the end-to-end suite is described in [e2e/README.md](./e2e/README.md).
4. Update the docs in the same change, as listed in [Docs in sync](./AGENTS.md#docs-in-sync).
5. Write commits and open the pull request following [Commits](#commits) and [Pull requests](#pull-requests), using the [PR template](./.github/pull_request_template.md). Keep it focused on one feature or fix, and link the issue it resolves.

## Git & GitHub

Types used below: `feat`, `fix`, `refactor`, `chore`, `docs`, `tests`, `perf`, `config`, `ops` (CI/CD, Docker, deployment).

### Branches

`<type>/<kebab-case-summary>` off `main` — e.g. `feat/document-tags`, `fix/login-redirect`. Keep it up to date with `main` (rebase or merge, both are fine); it is deleted after merge.

### Commits

- Branch commits use Conventional Commits: `type: imperative summary` — e.g. `fix: redirect to login on 401 response`. Commits on `main` are squash merges titled after the PR (see below).
- Lowercase, no trailing period, max 72 characters; the body (optional) explains *why*.
- One logical change per commit.

### Pull requests

- Title: `<icon> <type>: <summary>` — e.g. `🚀 feat: document tag editor`. Icons: 🚀 `feat` · 🔧 `fix` · ♻️ `refactor` · 🐢 `chore` · 📝 `docs` · 🧪 `tests` · ⚡ `perf` · ⚙️ `config` · 🛰️ `ops`.
- Pull requests are squash-merged: the title, icon included, becomes the single commit on `main`. Otherwise it follows the [Commits](#commits) rules.
- Body follows [`.github/pull_request_template.md`](./.github/pull_request_template.md) (agents: the **pr-desc** skill generates it).
- One feature or fix per PR, whatever its size — split it when it gets too big to review; link issues (`Closes #123`); draft until reviewable.
- The [validation checklist](./AGENTS.md#validation-checklist) passes before requesting review.

### Labels

- PRs: exactly one type label (same names as the types above).
- Issues: `bug` or `feat`.

### Releases

Maintainers release by pushing a SemVer tag from `main`:

```sh
git tag v1.2.3
git push origin v1.2.3
```

Creating a GitHub release with a new tag works the same way. [`release.yml`](./.github/workflows/release.yml) then:

1. Stops unless the tagged commit is on `main`.
2. Runs the full PR pipeline ([`pr.yml`](./.github/workflows/pr.yml)) on that commit.
3. Builds `docker/Dockerfile` for `linux/amd64` and `linux/arm64` and publishes `ghcr.io/jeda777/docgraph`.

Image tags: always the exact version (`1.2.3`). `1.2`, `1` (not for `0.x`) and `latest` move only when the tag is the highest stable version of that line, so tagging `v1.2.4` after `v1.3.0` leaves `1` and `latest` on 1.3.0. A pre-release (`v1.2.3-beta.1`) gets only its own tag. Running the workflow by hand on `main` publishes the tag `main`.

## Conventions

Code conventions live in `AGENTS.md` files — the single source of truth for human contributors and coding agents alike (Git & GitHub conventions are above):

| File | Covers |
| --- | --- |
| [`AGENTS.md`](./AGENTS.md) | Language, repo layout, commands, code style, naming, testing, docs in sync, validation checklist |
| [`apps/server/AGENTS.md`](./apps/server/AGENTS.md) | Server: module structure, layers, collaboration, errors, migrations, config |
| [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) | Web: structure, Yjs content, data fetching, error handling, memoization, state |

A few highlights:

- All code, comments, commits and PRs are written in English.
- Formatting and linting are enforced by Biome; Lefthook auto-fixes staged files on commit.
- Vendored UI code (`apps/web/src/components/ui`, `apps/web/src/components/reui`) is generated — please don't edit it in PRs.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](./LICENSE) that covers this project.
