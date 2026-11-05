---
name: pr-desc
description: Generate a pull request title, description following the repository's PR template, and suggested labels for a branch or set of changes. Use when the user asks to write a PR description, prepare a PR, describe changes, or create a pull request.
---

# PR Description

Produce a PR title, body and label following [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) and [Git & GitHub in `CONTRIBUTING.md`](../../../CONTRIBUTING.md#git--github).

## Workflow

1. **Get the changes.** `git fetch origin`, then `git log origin/main..HEAD --oneline` and `git diff origin/main...HEAD --stat`; read the full diff of anything non-trivial. Mention uncommitted changes (`git status`) — they won't be in the PR.
2. **Infer intent** — the purpose of the change, not just what moved. If a PR already exists (`gh pr view`), build on its body.
3. **Pick the type** — the dominant change decides (a feature with tests is `feat`). It sets the title icon and the single type label.
4. **Write title and body** in the output format below.
5. If commit messages break the [Commits](../../../CONTRIBUTING.md#commits) rules, suggest fixes.

## Rules

- English; concise and factual, no marketing language.
- Summary answers *why*, Changes answer *what* — no repetition between them.
- Changes: group by area (server, web, common, e2e, docs) when the PR touches several; skip trivial noise (formatting, renames done by tooling).
- `Closes #<n>` only when the branch name, commits or user indicate an issue — never invent one.
- Describe only what is in the diff.
- The title becomes the squash commit on `main`: after the icon it follows the [Commits](../../../CONTRIBUTING.md#commits) rules.

## Output format

Title and label go **above** the block (they are not part of the body). The block is the verbatim PR body, copy-paste ready:

- Exactly one fenced block tagged `md`; only `##` headings, in the template's order.
- No template HTML comments. Omit Related issues and Screenshots when not applicable; Summary, Changes and Testing are always present.
- Code inside the body is indented 4 spaces — a nested fence would break the outer block.

Title: <icon> <type>: <imperative summary>
Label: <type>

```md
## Summary
<1–3 sentences>

## Changes
- <notable change>

## Related issues
Closes #<n>

## Testing
- [x] `pnpm check`
- [x] `pnpm build`
- [x] `pnpm test`
- [ ] `pnpm test:e2e` (user-facing flows)
- [ ] Manually verified
```

Tick only checks that were actually run and passed in this session — run them if the user wants them ticked; drop the `pnpm test:e2e` line when no user-facing flow changed.

## Creating the PR

Only when the user asks: push the branch, then `gh pr create --draft --title "<title>" --label <type> --body-file <file>` (write the body to a temp file to keep formatting intact), or `gh pr edit --body-file` for an existing PR.
