import { type Context, Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { handleError } from './http-logging'
import {
  API_MAX_BODY_BYTES,
  apiBodyLimit,
  MCP_MAX_BODY_BYTES,
  mcpBodyLimit,
  securityHeaders,
} from './security'

const app = new Hono()
app.onError(handleError)
app.use('*', securityHeaders)
app.use('/api/*', apiBodyLimit)
app.use('/mcp/*', mcpBodyLimit)
app.get('/', (c) => c.html('<p>app</p>'))
const echoLength = async (c: Context) => c.json({ length: (await c.req.text()).length })
app.post('/api/thing', echoLength)
app.post('/mcp', echoLength)

const post = (path: string, body: RequestInit['body'], headers?: Record<string, string>) =>
  // `duplex` is required for stream bodies but missing from the `RequestInit` type
  app.request(path, { method: 'POST', body, headers, duplex: 'half' } as RequestInit)

const postBody = (body: RequestInit['body'], headers?: Record<string, string>) =>
  post('/api/thing', body, headers)

/**
 * A body of `size` bytes with its `Content-Length`, as browsers and MCP clients send it.
 * `Request` doesn't add the header for a string body by itself.
 */
const postSized = (path: string, size: number) =>
  post(path, 'x'.repeat(size), { 'content-length': String(size) })

/** A body without `Content-Length`, as sent with chunked transfer encoding. */
const streamOf = (size: number) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(size))
      controller.close()
    },
  })

describe('securityHeaders', () => {
  it('sets a CSP that allows scripts and connections to the app origin only', async () => {
    const res = await app.request('/')
    const csp = res.headers.get('content-security-policy')

    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    // APP_URL in the test setup
    expect(csp).toContain("connect-src 'self' ws://localhost:5173 data:")
  })

  it('sets the remaining hardening headers', async () => {
    const res = await app.request('/')

    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('permissions-policy')).toContain('camera=()')
    // HSTS only over HTTPS; the test APP_URL is plain HTTP
    expect(res.headers.has('strict-transport-security')).toBe(false)
  })

  it('also applies to error responses', async () => {
    const res = await postSized('/api/thing', API_MAX_BODY_BYTES + 1)

    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('apiBodyLimit', () => {
  it('accepts a body at the limit', async () => {
    const res = await postSized('/api/thing', API_MAX_BODY_BYTES)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ length: API_MAX_BODY_BYTES })
  })

  it('rejects a body over the limit by its Content-Length', async () => {
    const res = await postSized('/api/thing', API_MAX_BODY_BYTES + 1)

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds 1 MB',
    })
  })

  it('trusts the declared Content-Length without reading the body', async () => {
    // The streaming check would count 2 bytes and accept them
    const res = await postBody('xx', { 'content-length': String(API_MAX_BODY_BYTES + 1) })

    expect(res.status).toBe(413)
  })

  it('rejects a streamed body once it passes the limit', async () => {
    const res = await postBody(streamOf(API_MAX_BODY_BYTES + 1), {
      'transfer-encoding': 'chunked',
    })

    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('passes a streamed body under the limit on to the handler', async () => {
    const res = await postBody(streamOf(10), { 'transfer-encoding': 'chunked' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ length: 10 })
  })
})

describe('mcpBodyLimit', () => {
  // Only the declared Content-Length is checked (see above), so a small body stands in for 100 MB
  const postDeclared = (size: number) => post('/mcp', 'xx', { 'content-length': String(size) })

  it('accepts MCP bodies over the REST limit up to its own', async () => {
    const res = await postDeclared(MCP_MAX_BODY_BYTES)

    expect(res.status).toBe(200)
  })

  it('rejects a body over the limit', async () => {
    const res = await postDeclared(MCP_MAX_BODY_BYTES + 1)

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds 100 MB',
    })
  })
})
