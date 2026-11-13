# End-to-end tests

Playwright suite that drives the real app in Chromium: the production server bundle
(`apps/server/dist`) serving the built SPA, a throwaway PostgreSQL and Mailpit catching the
emails. Both run in [Testcontainers](https://testcontainers.com) started by `global-setup.ts`.

| Spec | What it covers |
| --- | --- |
| `tests/auth.setup.ts` | Signs in the seeded admin once and stores the session for the other specs |
| `tests/otp-login.spec.ts` | Login with a one-time code read from Mailpit, a rejected wrong code, the redirect back to a deep link, no account enumeration |
| `tests/diagram.spec.ts` | Creating a project and a flowchart through the UI, adding shapes, editing node text, reopening the item in a new tab and reloading it right after an edit |
| `tests/collaboration.spec.ts` | Two tabs on one item: flowchart nodes, node text and deletions, and document text sync live both ways; diagram undo/redo leaves the other tab's edits in place |
| `tests/concurrency/database-diagram.spec.ts` | Two users edit the same table and both end up with every change; a relation deleted while the other user is editing it stays deleted; an MCP agent redefines a table and adds another while the diagram is open, keeping the user's description |
| `tests/concurrency/business-process.spec.ts` | A lane added by one user while another edits an activity inside a lane keeps both changes and the activity in its lane; an MCP agent adds an activity to a lane and renames a lane while the user edits the process |
| `tests/concurrency/flowchart.spec.ts` | An MCP agent adds, connects and removes flowchart nodes while the user edits the flowchart, without losing the user's edit |
| `tests/password.spec.ts` | Password login, a rejected wrong password, logout, and setting a new password with a code from the email |
| `tests/invitation.spec.ts` | The admin invites a user in the Users dialog (a duplicate is refused), the invited user opens the link from the email and signs in with a code, and sees no admin features |
| `tests/user-management.spec.ts` | The admin's own row has no actions; promoting a user shows them the admin features, demoting removes them; deleting the user signs them out and their API key gets 401 |
| `tests/access-control.spec.ts` | A user outside a private project gets 404 for the project, its items and creating items, never sees it in the list, and is redirected in the app; adding them as a member grants access |
| `tests/access-revocation.spec.ts` | The admin removes a member in Project Settings while they have a flowchart open: without a reload the member is taken to the project list with a message, the admin's editor keeps working, and a deep link to the item sends the member away |
| `tests/archived-project.spec.ts` | An archived project stays readable, but refuses new items, and its diagram and document editors are read-only (no palette, text editing or import) |
| `tests/database-diagram.spec.ts` | Adding, renaming, describing, duplicating and deleting tables and adding a typed column in a database diagram, persisted across a reload |
| `tests/document-editor.spec.ts` | Headings, text marks, lists and blocks from the formatting toolbar with their active state; the slash menu filtered by title and keyword, picked with the keyboard or the mouse, closed with Escape; Markdown and keyboard shortcuts; toolbar undo/redo; toolbar, slash menu and undo/redo results persisted across a reload |
| `tests/business-process.spec.ts` | Palette search, adding and labelling business process activities and events, duplicating an element, persisted across a reload |
| `tests/mcp.spec.ts` | An API key created in the Profile dialog drives the `/mcp` endpoint through the official MCP SDK client: listing projects and items, writing a schema that shows up in the editor, reading it back; a revoked key gets 401; a read-only key limited to selected items, with an expiry date, sees only reading tools and those items |
| `tests/import-export.spec.ts` | Importing a database diagram fixture, rejecting a file of another type, JSON / PNG / DocGraph export and a DocGraph round trip into another item; Markdown import and Markdown / JSON / DocGraph export of a document; a DocGraph import replacing the content of a non-empty document |

## Running locally

Needs a running Docker daemon. From the repository root:

```sh
pnpm --filter e2e exec playwright install chromium  # once
pnpm test:e2e
```

`pnpm test:e2e` is a turbo task: it builds `server` and `web` first and caches the result, so a
rerun without changes replays the last output. Pass `--force` to run the suite anyway.

Each run starts fresh containers on random ports, so the development database and inbox stay
untouched and every run begins with an empty database. The global setup then starts the server on
[http://localhost:3100](http://localhost:3100) with the environment from `env.ts` and stops
everything when the suite ends. The port has to be free.

Useful variants:

```sh
pnpm --filter e2e test:e2e:ui          # interactive UI mode (run `pnpm build` first)
pnpm --filter e2e test:e2e --headed    # watch the browser, without turbo (run `pnpm build` first)
pnpm --filter e2e report               # open the last HTML report
```

## Writing tests

- Import `test` and `expect` from `lib/test.ts`, not `@playwright/test`: it fails every test whose
  pages log a Content-Security-Policy violation (also in contexts from `browser.newContext`).
- Locate elements the way users find them: roles and accessible names (`getByRole`,
  `getByLabel`). Flowchart and business process nodes are buttons named `<label>` or
  `<label>: <text>` inside `.react-flow__node`, database tables are found by their heading — see
  `lib/canvas.ts`. Export and import through the item menu with `lib/item-menu.ts`.
- Specs start signed in as the admin. Opt out with
  `test.use({ storageState: { cookies: [], origins: [] } })`. `browser.newContext()` inherits the
  admin session too, so pass the same empty `storageState` for a second, signed-out user.
- Need a second participant on the same item? Use the `collaborator` fixture from `lib/test.ts`:
  a page of a new regular user with their own session and browser context.
- Open an item with `openItem` (`lib/canvas.ts`), which waits for its editor.
- Drive the `/mcp` endpoint through the `agent` fixture from `lib/test.ts` and `callTool`
  (`lib/mcp.ts`). The fixture connects with a new API key of the `page` user and revokes it after
  the test, so specs running in parallel don't fill the admin's Profile with keys. The canvas renders only the nodes in view, so after an agent or
  a peer adds nodes, `fitView` (`lib/canvas.ts`) before looking for them.
- Need a regular user? `createUser` (`lib/api.ts`) invites one and sets their password through the
  email code reset; sign them in on a fresh context with `signIn`. Don't change the admin's
  password: a reset revokes the sessions other specs share.
- Set up state a test doesn't exercise through the REST API (`lib/api.ts`) and give it a
  unique name (`uniqueName`), since specs run in parallel.
- Read emails with `lib/mailpit.ts` (`waitForOtpCode`, `waitForInvitationLink`), passing the time
  the email was triggered so older messages are ignored.
- Never wait for fixed timeouts; wait for the state the user would see.
