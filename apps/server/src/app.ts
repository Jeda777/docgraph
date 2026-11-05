import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type MiddlewareHandler } from 'hono'
import { crdtWebSocket } from './crdt'
import { csrfProtection, requireSameOrigin } from './lib/csrf'
import { handleError, handleNotFound, requestLogger } from './lib/http-logging'
import { apiBodyLimit, mcpBodyLimit, securityHeaders } from './lib/security'
import { log } from './logger'
import { authRouter } from './modules/auth/routes'
import { itemsRouter } from './modules/item/routes'
import { mcpRouter } from './modules/mcp/routes'
import { projectsRouter } from './modules/project/routes'
import { usersRouter } from './modules/user/routes'
import { STATIC_DIR } from './paths'

const logger = log('http')

/**
 * Hashed assets under `/assets/` are cached forever (so `apps/web/public/assets/` must stay
 * empty); index.html, the SPA fallback and other `public/` files are revalidated every time.
 * Set after `next()`: @hono/node-server 2 calls `serveStatic`'s `onFound` too late for headers.
 */
const staticCacheControl: MiddlewareHandler = async (c, next) => {
  await next()
  if (!c.res.ok) return
  const isHashedAsset =
    c.req.path.startsWith('/assets/') && !c.res.headers.get('content-type')?.startsWith('text/html')
  c.header('Cache-Control', isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache')
}

export type CreateAppOptions = {
  /** Directory of the built frontend; without an `index.html` there, only the API is served. */
  staticDir?: string
}

/** The HTTP app: API routes, MCP, the CRDT WebSocket upgrade and the built frontend. */
export const createApp = ({ staticDir = STATIC_DIR }: CreateAppOptions = {}) => {
  const app = new Hono()

  app.onError(handleError)
  app.notFound(handleNotFound)
  app.use('*', securityHeaders)
  // Static assets and the frequent /health probe are left out to keep the log readable
  app.use('/api/*', requestLogger)
  app.use('/mcp/*', requestLogger)
  // Only /api is cookie-authenticated; /mcp uses an x-api-key header browsers never attach by themselves
  app.use('/api/*', csrfProtection)
  // After the logger, so rejected bodies show up in the log
  app.use('/api/*', apiBodyLimit)
  app.use('/mcp/*', mcpBodyLimit)

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.get('/ws', requireSameOrigin, crdtWebSocket)
  app.route('/', mcpRouter)
  app.route('/api', authRouter)
  app.route('/api', itemsRouter)
  app.route('/api', projectsRouter)
  app.route('/api', usersRouter)
  // Must precede the SPA fallback below, which would answer unknown API routes with index.html
  app.all('/api/*', handleNotFound)
  app.all('/mcp/*', handleNotFound)

  if (!existsSync(join(staticDir, 'index.html'))) {
    logger.warn(`Static directory ${staticDir} not found, serving API only`)
    return app
  }

  app.use('*', staticCacheControl)
  app.use('*', serveStatic({ root: staticDir, precompressed: true }))
  app.get('*', serveStatic({ root: staticDir, precompressed: true, path: 'index.html' }))

  return app
}
