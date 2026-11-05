import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { config } from '../config'
import { PayloadTooLargeException } from '../errors'

const MB = 1024 * 1024

/** REST bodies are small JSON objects (names, settings, credentials). */
export const API_MAX_BODY_BYTES = 1 * MB
/**
 * MCP tools carry whole documents and diagrams, e.g. the Markdown of `update_document`. As high as
 * the WebSocket limit, so an agent can write back any document it could read.
 */
export const MCP_MAX_BODY_BYTES = 100 * MB
/**
 * Largest incoming Hocuspocus message (the `ws` default). Restoring a backup sends the whole
 * document in one message, so keep this above the largest export a user may import back.
 */
export const WS_MAX_PAYLOAD_BYTES = 100 * MB

const limitBody = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw new PayloadTooLargeException(
        'PAYLOAD_TOO_LARGE',
        `Request body exceeds ${maxSize / MB} MB`,
      )
    },
  })

export const apiBodyLimit = limitBody(API_MAX_BODY_BYTES)
export const mcpBodyLimit = limitBody(MCP_MAX_BODY_BYTES)

const appUrl = new URL(config.APP_URL)
const isHttps = appUrl.protocol === 'https:'
// Older Safari versions don't match `ws:`/`wss:` against `'self'`, so the CRDT socket is listed.
const WS_ORIGIN = `${isHttps ? 'wss' : 'ws'}://${appUrl.host}`

/**
 * Security headers for every response. Scripts come from the app origin only; inline styles stay
 * allowed because Tiptap, React Flow and Base UI inject them; `data:`/`blob:` serve image exports.
 * Hono's defaults include CORP and COOP `same-origin`: no other site (email clients included) can
 * embed our files — hence inline email images (`src/emails/logo.ts`) — and cross-origin popups
 * lose `window.opener`.
 */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'data:'],
    // `data:` lets image exports turn the rendered data URL into a file with `fetch`
    connectSrc: ["'self'", WS_ORIGIN, 'data:'],
    objectSrc: ["'none'"],
    // Not `'none'`: html-to-image sets a same-origin `<base>` to resolve font URLs from the CSS
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    ...(isHttps && { upgradeInsecureRequests: [] }),
  },
  xFrameOptions: 'DENY',
  // Not Hono's `no-referrer`: with it browsers send `Origin: null` on same-origin POSTs, which
  // fails the origin checks of the CSRF protection and Better Auth.
  referrerPolicy: 'strict-origin-when-cross-origin',
  // Only over HTTPS, and without `includeSubDomains`: self-hosted instances often share a domain
  // with other services that must not be forced onto HTTPS.
  strictTransportSecurity: isHttps ? 'max-age=31536000' : false,
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
  },
})
