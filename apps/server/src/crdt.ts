import { Database } from '@hocuspocus/extension-database'
import { type Connection, Hocuspocus } from '@hocuspocus/server'
import { upgradeWebSocket } from '@hono/node-server'
import { WebSocketServer } from 'ws'
import { toUint8Array } from './lib/binary'
import { WS_MAX_PAYLOAD_BYTES } from './lib/security'
import { log } from './logger'
import { getSessionFromHeaders } from './modules/auth/service'
import { onSessionEnded } from './modules/auth/session-events'
import {
  getItemDocumentAccess,
  loadItemDocument,
  saveItemDocument,
} from './modules/item/document-store'

/** What a connection was authenticated with; set by `onAuthenticate`. */
export type ConnectionContext = {
  userId: string
  /** Admins see every project, so membership changes never lock them out. */
  isAdmin: boolean
  sessionId: string
  /** Epoch ms; the session's expiry as of the handshake. */
  sessionExpiresAt: number
  projectId: string
}

const logger = log('crdt')

type CloseReason = { code: number; reason: string }

/** Hocuspocus' own code for "reconnect": the provider reconnects and authenticates again. */
const RESET_CONNECTION: CloseReason = { code: 4205, reason: 'Reset Connection' }
const SERVICE_RESTART: CloseReason = { code: 1012, reason: 'Service Restart' }

/** How often connections are checked for an expired session. */
const SESSION_CHECK_INTERVAL_MS = 60_000

/**
 * Hocuspocus checks `connection.readOnly` on every incoming message, so
 * flipping it here immediately stops persisting further edits from these
 * clients (they get sync nacks). Clients only learn their new scope fully
 * after reconnecting, but their writes are already rejected server-side.
 */
const markDocumentReadOnly = (documentName: string) => {
  const document = crdt.documents.get(documentName)
  if (!document) return

  for (const connection of document.getConnections()) connection.readOnly = true
}

export const crdt = new Hocuspocus({
  debounce: 1000,
  // The browser sends the HttpOnly session cookie with the WebSocket handshake (same origin),
  // so the client never handles the session token itself.
  onAuthenticate: async ({
    requestHeaders,
    documentName,
    connectionConfig,
  }): Promise<ConnectionContext> => {
    if (!documentName) throw new Error('Missing document name')

    const { sessionId, sessionExpiresAt, user } = await getSessionFromHeaders(requestHeaders)
    const { item, readOnly } = await getItemDocumentAccess(documentName, user)
    if (readOnly) connectionConfig.readOnly = true

    // Becomes `connection.context`, so access changes can find the affected connections.
    return {
      userId: user.id,
      isAdmin: user.isAdmin,
      sessionId,
      sessionExpiresAt: sessionExpiresAt.getTime(),
      projectId: item.projectId,
    }
  },
  extensions: [
    new Database({
      fetch: ({ documentName }) => loadItemDocument(documentName),
      store: async ({ documentName, state }) => {
        const persisted = await saveItemDocument(documentName, state)
        if (!persisted) markDocumentReadOnly(documentName)
      },
    }),
  ],
})

/**
 * Detaches the matching connections (stopping their edits at once) and closes their WebSockets,
 * so the providers reconnect and access is checked again. `connection.close()` alone — all
 * Hocuspocus' `closeConnections` does — keeps the socket, leaving the editor silently detached.
 * Other documents sharing the socket reconnect too.
 *
 * Known limitation: a connection authenticated just before the change but joining its document
 * after this ran keeps stale access until it reconnects; `saveItemDocument` still refuses writes
 * to deleted or archived items.
 */
const closeConnectionsWhere = (
  matches: (connection: Connection<ConnectionContext>, documentName: string) => boolean,
  { code, reason }: CloseReason = RESET_CONNECTION,
) => {
  for (const [documentName, document] of crdt.documents) {
    for (const connection of document.getConnections() as Connection<ConnectionContext>[]) {
      if (!matches(connection, documentName)) continue
      connection.close({ code, reason })
      connection.webSocket.close(code, reason)
    }
  }
}

/** Reconnects every editor of the item, after it was deleted or (un)archived. */
export const closeItemConnections = (itemId: string) =>
  closeConnectionsWhere((_connection, documentName) => documentName === itemId)

/**
 * Reconnects the editors of the project's items: all of them after it was deleted or
 * (un)archived. With `members` (the project is restricted to them), only the users who lost
 * access: neither members nor admins.
 */
export const closeProjectConnections = (projectId: string, members?: ReadonlySet<string>) =>
  closeConnectionsWhere(
    ({ context }) =>
      context?.projectId === projectId &&
      (!members || (!context.isAdmin && !members.has(context.userId))),
  )

/**
 * Reconnects every editor of the user: after a role change (a demoted admin loses the restricted
 * projects they are no member of) or after the user was deleted, which removes their sessions
 * in the database without Better Auth's session hooks.
 */
export const closeUserConnections = (userId: string) =>
  closeConnectionsWhere(({ context }) => context?.userId === userId)

// Deleted sessions: sign-out, revoked sessions, password change or reset.
onSessionEnded((sessionId) =>
  closeConnectionsWhere((connection) => connection.context?.sessionId === sessionId),
)

/**
 * Expired sessions are not deleted, so nothing announces them: connections are checked
 * periodically instead. Better Auth extends a session while it is used, so the provider's
 * reconnect succeeds when the session was refreshed in the meantime (e.g. by REST calls).
 */
export const closeExpiredSessionConnections = (now = Date.now()) =>
  closeConnectionsWhere((connection) => (connection.context?.sessionExpiresAt ?? 0) <= now)

const sessionCheck = setInterval(closeExpiredSessionConnections, SESSION_CHECK_INTERVAL_MS)
// Must not keep the process (or a test run) alive on its own.
sessionCheck.unref()

/** Names (item ids) of the documents still loaded, e.g. those a shutdown could not release. */
export const loadedDocumentNames = () => [...crdt.documents.keys()]

/**
 * Stores every open document and unloads it, for a graceful shutdown: pending debounced
 * stores run now instead of being lost with the process. Resolves once no document is
 * loaded any more — which never happens for a document whose store failed (Hocuspocus keeps
 * it in memory) or that an MCP tool still holds open; the caller needs a timeout.
 */
export const shutdownCrdt = async () => {
  clearInterval(sessionCheck)
  const unloaded = new Promise<void>((resolve) => {
    crdt.configuration.extensions.push({
      afterUnloadDocument: async ({ instance }) => {
        if (instance.getDocumentsCount() === 0) resolve()
      },
    })
    if (crdt.getDocumentsCount() === 0) resolve()
  })

  closeConnectionsWhere(() => true, SERVICE_RESTART)
  // Documents kept open by server-side edits (MCP tools) have no client connection to close.
  crdt.flushPendingStores()

  await unloaded
}

/**
 * The `ws` server behind `crdtWebSocket`; pass it as `websocket.server` to `serve`. `maxPayload`
 * is only overridden by tests.
 */
export const createCrdtWebSocketServer = (maxPayload = WS_MAX_PAYLOAD_BYTES) =>
  new WebSocketServer({ noServer: true, maxPayload })

export const crdtWebSocket = upgradeWebSocket((c) => {
  let connection: ReturnType<typeof crdt.handleConnection> | undefined

  return {
    onOpen(_evt, ws) {
      if (!ws.raw) return
      connection = crdt.handleConnection(ws.raw, c.req.raw, {})
    },
    onMessage(evt) {
      const bytes = toUint8Array(evt.data)
      if (bytes) connection?.handleMessage(bytes)
    },
    onClose() {
      connection?.handleClose()
    },
    onError(evt, ws) {
      // `ws` then closes with 1009; the provider reconnects and resends the same message, so
      // without this log an oversized document fails silently.
      const error = 'error' in evt ? evt.error : evt
      if (isMessageTooLarge(error)) {
        logger.warn(
          'WebSocket message over the size limit rejected, closing the connection of user {userId} to documents {documents}',
          socketDetails(ws.raw),
        )
      } else {
        logger.warn('WebSocket error: {error}', { error })
      }
    },
  }
})

/**
 * Who a socket belongs to and which documents it has open, for logs. Empty while the socket has
 * not joined a document yet (e.g. a message too large before authentication).
 */
const socketDetails = (socket: unknown) => {
  const documents: string[] = []
  let userId: string | undefined
  for (const [documentName, document] of crdt.documents) {
    for (const connection of document.getConnections() as Connection<ConnectionContext>[]) {
      if (connection.webSocket !== socket) continue
      documents.push(documentName)
      userId = connection.context?.userId
    }
  }
  return { userId, documents }
}

/** The error `ws` raises for a message over `maxPayload`. */
export const isMessageTooLarge = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
