# Web rules (`apps/web`)

General conventions: [root `AGENTS.md`](../../AGENTS.md).

## Structure

- Features: `src/features/<feature>/{components,hooks,lib,pages}`. A page with its own components is a folder (`pages/<page>/index.tsx` + `components/`); a single-page feature uses `features/<feature>/index.tsx`.
- Pages are lazy-loaded in `src/App.tsx` with `lazyNamed` (named exports).
- Only components shared by several features go to `src/components`.
- `src/components/ui` and `src/components/reui` are vendored — **never edit them**.

## Static files

- No inline `<script>` in `index.html` (server CSP) — put scripts in `public/` (e.g. `public/theme.js`).
- Never put files in `public/assets/` — that path is cached as `immutable` for Vite's hashed output only.

## Collaborative content (Yjs)

- Item content lives in a Yjs document via the Hocuspocus provider (`useHocuspocusProvider`) — never via REST, which handles metadata only.
- Diagram collections go through `useYjsCollection` / `useDiagramCollections`; local UI state (selection, dragging) stays out of the shared document.
- Local edits not yet flushed (within the throttle window or while a drag holds writes) survive a peer's update and are written on the next flush:
  - **Whole items:** the flush writes the whole item, so the last write wins per item — a peer's concurrent change to another field of that item (e.g. an agent renaming a node being moved) is overwritten.
  - **References:** `useDiagramCollections` passes `canWrite`, so an edge or child node is not written when the node it points at was deleted meanwhile; the document's version wins and a new item is dropped.
- Diagram undo/redo (`useYjsUndo`):
  - **What it tracks:** only transactions with origin `COLLECTION_WRITE_ORIGIN`. It reverts only this client's edits and doesn't overwrite a peer's newer value, though it brings back an item a peer deleted after this client edited it.
  - **Writes:** diagram writes go through the collection (`setItems` / `replaceItems`); an outer transaction wrapping `replaceItems` passes `COLLECTION_WRITE_ORIGIN`.
  - **`normalizeNodes` vs `repairItems`:** make local edits valid as they are written (`normalizeNodes`, e.g. the flowchart's `fitNodesToText`), so undo reverts the fix with the edit. Fixes for what this client didn't cause (a peer's edit, an older document, an undo restoring an edge without its node) go through `repairItems` (`repairNodes` in node components). It keeps them out of the undo history, but undo can then no longer restore this client's earlier edit of that item.
  - **After undo/redo:** nodes left without their parent (with everything nested in them) and edges left without a node are dropped, along with references to them (`dropOrphans`).
  - **During a drag:** undo and redo are off while a drag holds writes.
- Hide editing controls for read-only documents with `useDocumentReadOnly`.

## Server communication

- Only through TanStack Query hooks in `src/lib/api` (single axios client `api`); never `fetch` or axios in components.
- Query keys live in `src/lib/api/query-keys.ts`: list keys UPPER_SNAKE (`PROJECTS_QUERY_KEY`), detail keys derived (`PROJECT_DETAIL_QUERY_KEY(id)`); mutations invalidate through them.
- No per-hook `retry` overrides — the global policy in `src/lib/api/query-client.ts` already skips 4xx except 408 and 429.

## Errors

- Only the helpers from `@/lib/api` (plus `showErrorToast` from `@/lib/error-toast`): `getErrorMessage(error)` (text from `ERROR_MESSAGES`), `isApiError(error, ...codes)`, `getErrorStatus(error)`. Never read `error.response?.data` or compare message strings.
- Field errors (e.g. `INVALID_PASSWORD`) → `form.setError(field, { message: getErrorMessage(error) })`.
- Any other failed action → `showErrorToast('Could not create the project', error)` (title names the action). No form- or dialog-level error text.

## Memoization

React Compiler memoizes automatically — no `useMemo` / `useCallback` / `memo` by default. Exceptions:

- `memo` (inline at the declaration) on components rendered by a library (React Flow `nodeTypes` / `edgeTypes`) and on frequently re-rendered `.map` list items.
- `useMemo` / `useCallback` when an effect depends on the identity (with a comment), or in code the compiler skips (prefer fixing the pattern).

## State & forms

- Global state: Zustand stores in `src/lib/stores`.
- Forms: react-hook-form + zodResolver with schemas from `packages/common`.

## Naming

- Components: PascalCase arrow functions, one per file, `XxxProps` type above it.
- Hooks: `use-*.ts` exporting `useXxx`. Stores: `xxx-store.ts` exporting `useXxxStore`.

## Testing

jsdom + Testing Library (`vitest.setup.ts` stubs what jsdom lacks); build API errors with `apiAxiosError` (`src/lib/api/test-utils.ts`).

## Imports

`@/*` alias for long or cross-feature paths; short paths within a feature stay relative.
