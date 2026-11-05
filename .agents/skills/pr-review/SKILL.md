---
name: pr-review
description: Review a pull request, branch, or diff against this repository's conventions and general code-review best practices. Use when the user asks to review a PR, review changes, check a diff, or look at someone's branch before merging.
---

# PR Review

Review in two passes: first the change itself (correctness, security, scope), then compliance with the repository conventions in the `AGENTS.md` files. Report only findings you have verified in the code — no speculation.

## Workflow

1. **Pick the target.**
   - PR number/URL: `gh pr view <n>` (title, body, base branch) and `gh pr diff <n>`; check it out (`gh pr checkout <n>`) before running checks.
   - Branch: `git fetch origin` then `git diff origin/main...HEAD` and `git log origin/main..HEAD --oneline`.
   - Uncommitted work: `git diff HEAD`; staged only: `git diff --cached`.
2. **Read the rules** — the root `AGENTS.md` always, plus `apps/server/AGENTS.md` / `apps/web/AGENTS.md` for the apps the diff touches.
3. **Understand intent** from the PR body, commits and diff shape before judging the implementation. Flag scope creep (unrelated changes).
4. **Read every changed file in full context** — open callers and callees when a hunk changes behavior; never judge a hunk in isolation.
5. **Run both checklists** below.
6. **Verify mechanically** — the [validation checklist](../../../AGENTS.md#validation-checklist): `pnpm check`, `pnpm build`, `pnpm test`; `pnpm test:e2e` for user-facing flows (needs Docker — if unavailable, say so). Separate failures caused by the change from pre-existing ones.
7. **Report** in the output format below.

## General checklist

- **Correctness**: logic errors, edge cases (empty, null/undefined, error paths), race conditions, off-by-one.
- **Security**: committed secrets (env files other than `*.example`), injection (SQL, XSS), new endpoints without `requireAuth` / `requireAdmin`, project data read without `requireProjectAccess` / `visibilityWhere`, access narrowed without closing WebSocket connections, internal details in error messages.
- **Error handling**: failures reach the caller; no silently swallowed exceptions.
- **Breaking changes**: `packages/common` schema changes stay backwards-compatible; DB changes come with a migration.
- **Performance**: N+1 queries, needless re-renders, large payloads.
- **Tests**: new behavior and fixes are covered (unit/integration next to the code, e2e for new user-facing flows); tests assert behavior, not implementation.

## Repository checklist

Check the diff against each section of the rules rather than from memory. Most often missed:

- [ ] `interface`, default exports, `any`, bare or group-wide `biome-ignore` ([AGENTS.md](../../../AGENTS.md#code-style-biome)).
- [ ] Business logic in `routes.ts`, `zValidator` not from `src/lib/validator.ts`, hand-built error responses, hand-rolled API types ([apps/server/AGENTS.md](../../../apps/server/AGENTS.md)).
- [ ] `fetch`/axios in components, inline query keys, `error.response?.data`, form-level error text, manual memoization without a reason, item content via REST ([apps/web/AGENTS.md](../../../apps/web/AGENTS.md)).
- [ ] Edits in `src/components/ui` or `src/components/reui`.
- [ ] Docs not updated per [Docs in sync](../../../AGENTS.md#docs-in-sync).
- [ ] PR title, commits and branch name per [Git & GitHub](../../../CONTRIBUTING.md#git--github).

## Severity

- 🔴 **Blocking** — bugs, security issues, failing checks, broken conventions with real impact.
- 🟡 **Should fix** — design, maintainability, missing tests, convention drift.
- 🟢 **Nit** — naming, wording, minor style not caught by Biome.

## Output format

```md
## PR Review: <title/branch>

**Verdict:** ✅ approve | 🟡 approve with comments | ❌ request changes

<1–2 sentences: what the change does and overall assessment>

### 🔴 Blocking
- `path/file.ts:42` — problem, why it matters, suggested fix

### 🟡 Should fix
- ...

### 🟢 Nits
- ...

### Checks
- `pnpm check`: pass/fail
- `pnpm build`: pass/fail
- `pnpm test`: pass/fail
- `pnpm test:e2e`: pass/fail/not run (reason)
```

Omit empty severity sections. Post comments to GitHub (`gh pr review`) only when the user asks.
