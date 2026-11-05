import 'zod/compile'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { config } from './config'
import { crdt, createCrdtWebSocketServer, loadedDocumentNames, shutdownCrdt } from './crdt'
import { closeDb } from './db'
import { initDb } from './db/init'
import { log, setupLogging } from './logger'

await setupLogging()
await initDb()

const logger = log('server')

if (!config.smtp) {
  logger.warn(
    'SMTP is not configured: emails are not sent, their login codes and invitation links are logged instead',
  )
}

const app = createApp()

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.HOST,
    port: config.PORT,
    websocket: { server: createCrdtWebSocketServer() },
  },
  (info) => {
    logger.info(`Server is running on http://${config.HOST}:${config.PORT}`)
    crdt.hooks('onListen', {
      instance: crdt,
      configuration: crdt.configuration,
      port: info.port,
    })
  },
)

// Stays below Docker's default 10 s stop timeout, after which the process is killed.
const SHUTDOWN_TIMEOUT_MS = 8000

let shuttingDown = false

/**
 * Stores every open document before exiting: Hocuspocus debounces stores by a second, so
 * without this the last edits would be lost on every deploy or restart.
 */
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`${signal} received, shutting down`)

  setTimeout(() => {
    // Edits of these documents may be lost: a failed store or an MCP tool still holding one.
    logger.error('Graceful shutdown timed out, documents not released: {documents}', {
      documents: loadedDocumentNames(),
    })
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()

  try {
    // Stops accepting connections and resolves once the open ones ended: requests in flight
    // (possibly mid-transaction) finish before the pool closes. Node answers them with
    // `Connection: close`; idle keep-alive connections are dropped right away.
    const httpClosed = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if ('closeIdleConnections' in server) server.closeIdleConnections()
    // Also closes the WebSockets, which the HTTP server counts as open connections too.
    await shutdownCrdt()
    await httpClosed
    await closeDb()
    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Graceful shutdown failed: {error}', { error })
    process.exit(1)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
