import { csrf } from 'hono/csrf'
import { createMiddleware } from 'hono/factory'
import { config } from '../config'
import { ForbiddenException } from '../errors'

/**
 * The public origin of the app. Compared against `Origin` instead of the request URL, which
 * differs behind the Vite dev proxy or a TLS-terminating reverse proxy.
 */
const APP_ORIGIN = new URL(config.APP_URL).origin

/**
 * Session cookies are `SameSite=Strict`, which still lets same-site (e.g. sibling subdomain)
 * pages send them. A request counts as ours only if the browser marks it `same-origin` or its
 * `Origin` is the app origin.
 */
export const isSameOriginRequest = (headers: Headers) =>
  headers.get('sec-fetch-site') === 'same-origin' || headers.get('origin') === APP_ORIGIN

/**
 * Blocks cross-origin form-style submissions (the only unsafe requests a foreign page can send
 * without a CORS preflight). JSON requests from other origins already fail the preflight.
 */
export const csrfProtection = csrf({
  origin: APP_ORIGIN,
  secFetchSite: 'same-origin',
})

/**
 * Browsers send cookies with WebSocket handshakes from any origin and WebSockets bypass CORS,
 * so the upgrade must check the origin itself (cross-site WebSocket hijacking).
 */
export const requireSameOrigin = createMiddleware(async (c, next) => {
  if (!isSameOriginRequest(c.req.raw.headers))
    throw new ForbiddenException('FORBIDDEN', 'Cross-origin request')
  await next()
})
