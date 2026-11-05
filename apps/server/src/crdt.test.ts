import {
  type AuthorizedScope,
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  MessageType,
  type onMessageParameters,
} from '@hocuspocus/provider'
import { type ServerType, serve } from '@hono/node-server'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import * as Y from 'yjs'
import {
  type ConnectionContext,
  closeExpiredSessionConnections,
  crdt,
  crdtWebSocket,
  createCrdtWebSocketServer,
  isMessageTooLarge,
  shutdownCrdt,
} from './crdt'
import { db, items, projects } from './db'
import { requireSameOrigin } from './lib/csrf'
import { handleError } from './lib/http-logging'
import { log } from './logger'
import { auth } from './modules/auth/better-auth'
import { deleteItem, updateItem } from './modules/item/service'
import { deleteProject, updateProject } from './modules/project/service'
import { deleteUser, updateUser } from './modules/user/service'
import {
  actorOf,
  addMember,
  createItem,
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  resetTestDb,
  sessionCookieFor,
} from './test/db'

/**
 * Integration tests of the collaboration server: a real Hono server with the `/ws`
 * route of `src/index.ts` and real Hocuspocus providers connecting to it over WebSockets,
 * authenticated with Better Auth session cookies like the browser does.
 */

// Same origin as APP_URL (src/test/setup.ts), which the WebSocket upgrade requires.
const APP_ORIGIN = 'http://localhost:5173'
// Hocuspocus stores after a 1 s debounce, so DB assertions need to wait longer than that.
const PERSIST_TIMEOUT = { timeout: 5000, interval: 50 }

type Headers = Record<string, string>

type AuthResult =
  | { status: 'authenticated'; scope: AuthorizedScope }
  | { status: 'failed'; reason: string }

type Client = {
  provider: HocuspocusProvider
  doc: Y.Doc
  fields: Y.Map<string>
  /** Resolves once the server accepted or refused the connection. */
  auth: Promise<AuthResult>
  /** Number of updates the server refused to apply (sync status "not saved"). */
  rejectedUpdates: () => number
}

let server: ServerType
let wsUrl: string
const cleanups: (() => void)[] = []

/** Connects a Hocuspocus provider to the item's document, sending `headers` with the handshake. */
const connect = (itemId: string, headers: Headers, url = wsUrl): Client => {
  // Node's WebSocket can't send cookies; `ws` takes handshake headers as a constructor option.
  class HeaderWebSocket extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, { headers })
    }
  }

  const socket = new HocuspocusProviderWebsocket({
    url,
    WebSocketPolyfill: HeaderWebSocket,
    maxAttempts: 1,
  })
  const doc = new Y.Doc()
  const provider = new HocuspocusProvider({
    websocketProvider: socket,
    name: itemId,
    document: doc,
  })

  const auth = new Promise<AuthResult>((resolve) => {
    provider.on('authenticated', ({ scope }: { scope: AuthorizedScope }) =>
      resolve({ status: 'authenticated', scope }),
    )
    provider.on('authenticationFailed', ({ reason }: { reason: string }) =>
      resolve({ status: 'failed', reason }),
    )
  })

  let rejected = 0
  provider.on('message', ({ message }: onMessageParameters) => {
    message.readVarString()
    if (message.readVarUint() === MessageType.SyncStatus && Number(message.readVarUint()) === 0)
      rejected++
  })

  provider.attach()
  cleanups.push(() => {
    // When the server closes the socket, the provider schedules a reconnect a second later,
    // and that `connect()` revives even a destroyed provider. The zombie socket then keeps
    // `server.close()` waiting (or hits a closed server), so it must never reconnect.
    socket.connect = async () => undefined
    provider.destroy()
    socket.destroy()
  })

  return { provider, doc, fields: doc.getMap('fields'), auth, rejectedUpdates: () => rejected }
}

/** Connects and waits until the client is authenticated and has the server's state. */
const connectSynced = async (itemId: string, headers: Headers, url = wsUrl) => {
  const client = connect(itemId, headers, url)
  const auth = await client.auth
  await vi.waitFor(() => expect(client.provider.isSynced).toBe(true))
  return { ...client, scope: auth.status === 'authenticated' ? auth.scope : undefined }
}

const headersFor = async (userId: string): Promise<Headers> => ({
  ...(await sessionCookieFor(userId)),
  origin: APP_ORIGIN,
})

/** The `fields` map of the CRDT state stored in `items.document`, or null when nothing is stored. */
const storedFields = async (itemId: string): Promise<Record<string, unknown> | null> => {
  const [row] = await db
    .select({ document: items.document })
    .from(items)
    .where(eq(items.id, itemId))
  if (!row?.document) return null

  const doc = new Y.Doc()
  Y.applyUpdate(doc, new Uint8Array(row.document))
  return doc.getMap('fields').toJSON()
}

/** CRDT state with the given `fields`, as stored in `items.document`. */
const documentWith = (fields: Record<string, string>) => {
  const doc = new Y.Doc()
  const map = doc.getMap('fields')
  for (const [key, value] of Object.entries(fields)) map.set(key, value)
  return Buffer.from(Y.encodeStateAsUpdate(doc))
}

/** The server's in-memory copy of the document. */
const serverFields = (itemId: string) => crdt.documents.get(itemId)?.getMap('fields').toJSON()

/** A restricted project with two assigned (non-admin) users and their handshake headers. */
const setupProjectWithTwoEditors = async (projectValues: { isArchived?: boolean } = {}) => {
  const project = await createProject(projectValues)
  const alice = await createUser()
  const bob = await createUser()
  await addMember(project.id, alice.id)
  await addMember(project.id, bob.id)
  return { project, alice: await headersFor(alice.id), bob: await headersFor(bob.id) }
}

beforeAll(async () => {
  const app = new Hono()
  app.onError(handleError)
  app.get('/ws', requireSameOrigin, crdtWebSocket)

  await new Promise<void>((resolve) => {
    server = serve(
      {
        fetch: app.fetch,
        hostname: '127.0.0.1',
        port: 0,
        websocket: { server: createCrdtWebSocketServer() },
      },
      (info) => {
        wsUrl = `ws://127.0.0.1:${info.port}/ws`
        resolve()
      },
    )
  })
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  // Hocuspocus stores and unloads a document after its last connection closes;
  // let that finish before the next test truncates the tables.
  await vi.waitFor(() => expect(crdt.getDocumentsCount()).toBe(0), PERSIST_TIMEOUT)
})

describe('two clients editing the same item', () => {
  it('syncs edits between the clients and persists the merged state to the database', async () => {
    const { project, alice, bob } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id)

    const first = await connectSynced(item.id, alice)
    const second = await connectSynced(item.id, bob)
    expect(first.scope).toBe('read-write')
    expect(second.scope).toBe('read-write')

    first.fields.set('title', 'Orders')
    second.fields.set('description', 'All customer orders')

    const merged = { title: 'Orders', description: 'All customer orders' }
    await vi.waitFor(() => {
      expect(first.fields.toJSON()).toEqual(merged)
      expect(second.fields.toJSON()).toEqual(merged)
    })
    await vi.waitFor(
      async () => expect(await storedFields(item.id)).toEqual(merged),
      PERSIST_TIMEOUT,
    )
  })

  it('loads the stored state for every client and persists later edits on top of it', async () => {
    const { project, alice, bob } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id, { document: documentWith({ title: 'Orders' }) })

    const first = await connectSynced(item.id, alice)
    const second = await connectSynced(item.id, bob)
    expect(first.fields.toJSON()).toEqual({ title: 'Orders' })
    expect(second.fields.toJSON()).toEqual({ title: 'Orders' })

    second.fields.set('title', 'Invoices')

    await vi.waitFor(() => expect(first.fields.get('title')).toBe('Invoices'))
    await vi.waitFor(
      async () => expect(await storedFields(item.id)).toEqual({ title: 'Invoices' }),
      PERSIST_TIMEOUT,
    )
  })
})

describe('archived documents', () => {
  const cases = [
    { name: 'an archived item', itemArchived: true, projectArchived: false },
    { name: 'an item of an archived project', itemArchived: false, projectArchived: true },
  ]

  for (const { name, itemArchived, projectArchived } of cases) {
    it(`opens ${name} read-only and never applies or persists edits`, async () => {
      const { project, alice, bob } = await setupProjectWithTwoEditors({
        isArchived: projectArchived,
      })
      const item = await createItem(project.id, {
        document: documentWith({ title: 'Orders' }),
        isArchived: itemArchived,
      })

      const editor = await connectSynced(item.id, alice)
      const viewer = await connectSynced(item.id, bob)
      expect(editor.scope).toBe('readonly')
      expect(viewer.scope).toBe('readonly')
      // Archived documents stay readable.
      expect(editor.fields.toJSON()).toEqual({ title: 'Orders' })
      expect(viewer.fields.toJSON()).toEqual({ title: 'Orders' })

      editor.fields.set('title', 'Changed')

      await vi.waitFor(() => expect(editor.rejectedUpdates()).toBeGreaterThan(0))
      expect(serverFields(item.id)).toEqual({ title: 'Orders' })
      expect(viewer.fields.toJSON()).toEqual({ title: 'Orders' })
      expect(await storedFields(item.id)).toEqual({ title: 'Orders' })
    })
  }

  it('stops persisting edits of open connections once the item gets archived', async () => {
    const { project, alice, bob } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id)

    const first = await connectSynced(item.id, alice)
    const second = await connectSynced(item.id, bob)
    first.fields.set('title', 'Orders')
    await vi.waitFor(
      async () => expect(await storedFields(item.id)).toEqual({ title: 'Orders' }),
      PERSIST_TIMEOUT,
    )

    await db.update(items).set({ isArchived: true }).where(eq(items.id, item.id))
    second.fields.set('title', 'Archived edit')

    // The store after the debounce finds the item archived, drops the write
    // and turns every open connection read-only.
    await vi.waitFor(() => {
      const connections = crdt.documents.get(item.id)?.getConnections() ?? []
      expect(connections).toHaveLength(2)
      expect(connections.every((connection) => connection.readOnly)).toBe(true)
    }, PERSIST_TIMEOUT)
    expect(await storedFields(item.id)).toEqual({ title: 'Orders' })

    first.fields.set('title', 'Another edit')
    await vi.waitFor(() => expect(first.rejectedUpdates()).toBeGreaterThan(0))
    expect(await storedFields(item.id)).toEqual({ title: 'Orders' })
  })

  it('stops persisting edits of open connections once the project gets archived', async () => {
    const { project, alice } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id, { document: documentWith({ title: 'Orders' }) })

    const client = await connectSynced(item.id, alice)
    await db.update(projects).set({ isArchived: true }).where(eq(projects.id, project.id))
    client.fields.set('title', 'Archived edit')

    await vi.waitFor(() => {
      const connections = crdt.documents.get(item.id)?.getConnections() ?? []
      expect(connections.every((connection) => connection.readOnly)).toBe(true)
    }, PERSIST_TIMEOUT)
    expect(await storedFields(item.id)).toEqual({ title: 'Orders' })
  })
})

describe('access control', () => {
  it('refuses a user without access to the restricted project', async () => {
    const { project } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id, { document: documentWith({ title: 'Secret' }) })
    const outsider = await createUser()

    const client = connect(item.id, await headersFor(outsider.id))

    await expect(client.auth).resolves.toMatchObject({ status: 'failed' })
    // Nothing of the document reaches the refused client.
    expect(client.fields.toJSON()).toEqual({})
  })

  it('refuses a user without access even when an editor has the document open', async () => {
    const { project, alice } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id)
    const editor = await connectSynced(item.id, alice)
    editor.fields.set('title', 'Secret')
    const outsider = await createUser()

    const client = connect(item.id, await headersFor(outsider.id))

    await expect(client.auth).resolves.toMatchObject({ status: 'failed' })
    expect(client.fields.toJSON()).toEqual({})
  })

  it('lets an admin in without an assignment', async () => {
    const { project } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id)
    const admin = await createUser({ isAdmin: true })

    const client = await connectSynced(item.id, await headersFor(admin.id))

    expect(client.scope).toBe('read-write')
  })

  it('refuses a connection without a session', async () => {
    const project = await createProject({ isForAllUsers: true })
    const item = await createItem(project.id)

    const client = connect(item.id, { origin: APP_ORIGIN })

    await expect(client.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('refuses a connection with an invalid session cookie', async () => {
    const project = await createProject({ isForAllUsers: true })
    const item = await createItem(project.id)
    const user = await createUser()
    const { cookie } = await sessionCookieFor(user.id)

    const client = connect(item.id, { cookie: `${cookie}tampered`, origin: APP_ORIGIN })

    await expect(client.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('refuses a document name that is not an existing item', async () => {
    const admin = await createUser({ isAdmin: true })

    const client = connect(MISSING_ID, await headersFor(admin.id))

    await expect(client.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('rejects the WebSocket upgrade from another origin with 403', async () => {
    const user = await createUser()
    const headers = { ...(await sessionCookieFor(user.id)), origin: 'https://evil.test' }

    const status = await new Promise<number | undefined>((resolve, reject) => {
      const socket = new WebSocket(wsUrl, { headers })
      // With this listener `ws` leaves aborting the refused handshake to us.
      socket.on('unexpected-response', (req, res) => {
        resolve(res.statusCode)
        req.destroy()
      })
      socket.on('open', () => {
        socket.close()
        reject(new Error('Expected the upgrade to be rejected'))
      })
    })

    expect(status).toBe(403)
  })
})

describe('closing open connections', () => {
  /** User ids of the item's open connections on the server. */
  const connectedUsers = (itemId: string) =>
    (crdt.documents.get(itemId)?.getConnections() ?? []).map(
      (connection) => (connection.context as ConnectionContext).userId,
    )

  const setup = async () => {
    const project = await createProject()
    const alice = await createUser()
    const bob = await createUser()
    await addMember(project.id, alice.id)
    await addMember(project.id, bob.id)
    const item = await createItem(project.id, { document: documentWith({ title: 'Orders' }) })
    const admin = actorOf(await createUser({ isAdmin: true }))
    return { project, item, alice, bob, admin }
  }

  it('disconnects the editors of a deleted item and refuses them afterwards', async () => {
    const { item, alice, admin } = await setup()
    const editor = await connectSynced(item.id, await headersFor(alice.id))
    editor.fields.set('title', 'Unsaved edit')
    await vi.waitFor(() => expect(serverFields(item.id)).toEqual({ title: 'Unsaved edit' }))

    await deleteItem(item.id, admin)

    // The pending store of the deleted item is dropped instead of failing, and the document
    // is unloaded.
    await vi.waitFor(() => expect(crdt.documents.has(item.id)).toBe(false), PERSIST_TIMEOUT)
    const again = connect(item.id, await headersFor(alice.id))
    await expect(again.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('disconnects the editors of an item that gets archived', async () => {
    const { item, alice, admin } = await setup()
    await connectSynced(item.id, await headersFor(alice.id))

    await updateItem({ id: item.id, name: item.name, isArchived: true }, admin)

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([]), PERSIST_TIMEOUT)
  })

  it('disconnects the editors of a deleted project', async () => {
    const { project, item, alice } = await setup()
    await connectSynced(item.id, await headersFor(alice.id))

    await deleteProject(project.id)

    await vi.waitFor(() => expect(crdt.documents.has(item.id)).toBe(false), PERSIST_TIMEOUT)
  })

  it('disconnects the editors of a project whose members changed', async () => {
    const { project, item, alice, bob } = await setup()
    await connectSynced(item.id, await headersFor(alice.id))
    await connectSynced(item.id, await headersFor(bob.id))

    await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: false,
      memberIds: [bob.id],
    })

    // Only the removed member is disconnected; the member who stays keeps editing.
    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([bob.id]), PERSIST_TIMEOUT)
    const removed = connect(item.id, await headersFor(alice.id))
    await expect(removed.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('reconnects the editors of a restored item with write access', async () => {
    const { project, alice, admin } = await setup()
    const item = await createItem(project.id, { isArchived: true })
    const viewer = await connectSynced(item.id, await headersFor(alice.id))
    expect(viewer.scope).toBe('readonly')

    await updateItem({ id: item.id, name: item.name, isArchived: false }, admin)

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([]), PERSIST_TIMEOUT)
    const editor = await connectSynced(item.id, await headersFor(alice.id))
    expect(editor.scope).toBe('read-write')
  })

  const projectArchiveCases = [
    { action: 'archived', archivedBefore: false, scopeAfter: 'readonly' },
    { action: 'restored', archivedBefore: true, scopeAfter: 'read-write' },
  ] as const

  for (const { action, archivedBefore, scopeAfter } of projectArchiveCases) {
    it(`reconnects the editors of a ${action} project with the new scope`, async () => {
      const { project, item, alice, bob } = await setup()
      if (archivedBefore) {
        await db.update(projects).set({ isArchived: true }).where(eq(projects.id, project.id))
      }
      await connectSynced(item.id, await headersFor(alice.id))

      await updateProject({
        id: project.id,
        name: project.name,
        isForAllUsers: false,
        isArchived: !archivedBefore,
        memberIds: [alice.id, bob.id],
      })

      await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([]), PERSIST_TIMEOUT)
      const again = await connectSynced(item.id, await headersFor(alice.id))
      expect(again.scope).toBe(scopeAfter)
    })
  }

  it('disconnects only the non-members of a project restricted to its members', async () => {
    const { project, item, alice, bob, admin } = await setup()
    await db.update(projects).set({ isForAllUsers: true }).where(eq(projects.id, project.id))
    const outsider = await createUser()
    await connectSynced(item.id, await headersFor(alice.id))
    await connectSynced(item.id, await headersFor(outsider.id))
    await connectSynced(item.id, await headersFor(admin.id))

    await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: false,
      memberIds: [alice.id, bob.id],
    })

    // Members and admins keep access, so they keep editing.
    await vi.waitFor(
      () => expect(connectedUsers(item.id)).toEqual([alice.id, admin.id]),
      PERSIST_TIMEOUT,
    )
  })

  it('keeps the editors connected when a project update only widens access', async () => {
    const { project, item, alice, bob } = await setup()
    await connectSynced(item.id, await headersFor(alice.id))
    const newcomer = await createUser()

    // Renamed, opened to all users and a member added at once; alice stops being a member but
    // keeps access because the project is now open to everyone.
    await updateProject({
      id: project.id,
      name: 'Renamed',
      isForAllUsers: true,
      isArchived: false,
      memberIds: [bob.id, newcomer.id],
    })

    expect(connectedUsers(item.id)).toEqual([alice.id])
  })

  it('disconnects only the connections of a session that ended', async () => {
    const { item, alice, bob } = await setup()
    const aliceHeaders = await headersFor(alice.id)
    await connectSynced(item.id, aliceHeaders)
    await connectSynced(item.id, await headersFor(bob.id))

    await auth.api.signOut({ headers: new Headers(aliceHeaders) })

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([bob.id]), PERSIST_TIMEOUT)
  })

  // Password change (revokeOtherSessions), password reset and revokeSessions delete all of a
  // user's sessions in one query; Better Auth must still run the delete hook for each row.
  it('disconnects every session of a user whose sessions were revoked at once', async () => {
    const { item, alice, bob } = await setup()
    const aliceHeaders = await headersFor(alice.id)
    await connectSynced(item.id, aliceHeaders)
    await connectSynced(item.id, await headersFor(alice.id))
    await connectSynced(item.id, await headersFor(bob.id))

    await auth.api.revokeSessions({ headers: new Headers(aliceHeaders) })

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([bob.id]), PERSIST_TIMEOUT)
  })

  it('disconnects a deleted user and keeps the others connected', async () => {
    const { item, alice, bob, admin } = await setup()
    const aliceHeaders = await headersFor(alice.id)
    await connectSynced(item.id, aliceHeaders)
    await connectSynced(item.id, await headersFor(bob.id))

    await deleteUser(alice.id, admin)

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([bob.id]), PERSIST_TIMEOUT)
    const again = connect(item.id, aliceHeaders)
    await expect(again.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('refuses a demoted admin the restricted projects they are no member of', async () => {
    const { item, bob, admin } = await setup()
    const formerAdmin = await createUser({ isAdmin: true })
    const formerAdminHeaders = await headersFor(formerAdmin.id)
    await connectSynced(item.id, formerAdminHeaders)
    await connectSynced(item.id, await headersFor(bob.id))

    await updateUser({ id: formerAdmin.id, isAdmin: false }, admin)

    await vi.waitFor(() => expect(connectedUsers(item.id)).toEqual([bob.id]), PERSIST_TIMEOUT)
    const again = connect(item.id, formerAdminHeaders)
    await expect(again.auth).resolves.toMatchObject({ status: 'failed' })
  })

  it('disconnects connections whose session expired', async () => {
    const { item, alice } = await setup()
    await connectSynced(item.id, await headersFor(alice.id))

    // Sessions last days; nothing expires yet.
    closeExpiredSessionConnections()
    expect(connectedUsers(item.id)).toEqual([alice.id])

    closeExpiredSessionConnections(Date.now() + 365 * 24 * 60 * 60 * 1000)
    expect(connectedUsers(item.id)).toEqual([])
  })
})

describe('shutdownCrdt', () => {
  it('stores pending edits right away and unloads every document', async () => {
    const { project, alice } = await setupProjectWithTwoEditors()
    const item = await createItem(project.id)
    const editor = await connectSynced(item.id, alice)
    editor.fields.set('title', 'Last edit')
    await vi.waitFor(() => expect(serverFields(item.id)).toEqual({ title: 'Last edit' }))

    await shutdownCrdt()

    expect(crdt.getDocumentsCount()).toBe(0)
    expect(await storedFields(item.id)).toEqual({ title: 'Last edit' })
  })
})

describe('oversized messages', () => {
  const MAX_PAYLOAD = 1024

  /** A server like the one above, with a small `maxPayload` so the test needn't send 100 MB. */
  const startSmallServer = () =>
    new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
      const app = new Hono()
      app.get('/ws', requireSameOrigin, crdtWebSocket)
      const small = serve(
        {
          fetch: app.fetch,
          hostname: '127.0.0.1',
          port: 0,
          websocket: { server: createCrdtWebSocketServer(MAX_PAYLOAD) },
        },
        (info) =>
          resolve({
            url: `ws://127.0.0.1:${info.port}/ws`,
            close: () => new Promise((done) => small.close(() => done())),
          }),
      )
    })

  const LOG_MESSAGE =
    'WebSocket message over the size limit rejected, closing the connection of user {userId} to documents {documents}'

  it('closes a socket that has not joined a document with 1009 and logs it', async () => {
    const warn = vi.spyOn(log('crdt'), 'warn')
    const small = await startSmallServer()
    cleanups.push(() => warn.mockRestore())
    // No session cookie: the upgrade only checks the origin, so even a signed-out client gets
    // this far, and its message is rejected before Hocuspocus authenticates anything.
    const headers = { origin: APP_ORIGIN }

    const code = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(small.url, { headers })
      socket.on('open', () => socket.send(new Uint8Array(MAX_PAYLOAD + 1)))
      socket.on('close', resolve)
      socket.on('error', reject)
    })
    await small.close()

    expect(code).toBe(1009)
    expect(warn).toHaveBeenCalledWith(LOG_MESSAGE, { userId: undefined, documents: [] })
  })

  it('logs the user and document of an editor whose edit is too large', async () => {
    const warn = vi.spyOn(log('crdt'), 'warn')
    const small = await startSmallServer()
    const project = await createProject()
    const user = await createUser()
    await addMember(project.id, user.id)
    const item = await createItem(project.id)
    const client = await connectSynced(item.id, await headersFor(user.id), small.url)
    // After the provider's cleanup (pushed by `connect`), so no socket keeps the server open
    cleanups.push(() => {
      warn.mockRestore()
      void small.close()
    })
    const closeCode = new Promise<number>((resolve) =>
      client.provider.on('close', ({ event }: { event: { code: number } }) => resolve(event.code)),
    )

    client.fields.set('title', 'x'.repeat(MAX_PAYLOAD))

    expect(await closeCode).toBe(1009)
    expect(warn).toHaveBeenCalledWith(LOG_MESSAGE, { userId: user.id, documents: [item.id] })
  })
})

describe('isMessageTooLarge', () => {
  it('recognizes the error `ws` raises for a message over maxPayload', () => {
    const error = Object.assign(new RangeError('Max payload size exceeded'), {
      code: 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH',
    })

    expect(isMessageTooLarge(error)).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isMessageTooLarge(new Error('Connection reset'))).toBe(false)
    expect(
      isMessageTooLarge(Object.assign(new Error('Bad frame'), { code: 'WS_ERR_INVALID_OPCODE' })),
    ).toBe(false)
    expect(isMessageTooLarge({ code: 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH' })).toBe(false)
  })
})
