import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app'

const INDEX_HTML = '<!doctype html><title>DocGraph</title><div id="root"></div>'
const ASSET_JS = 'console.log("app")'

let staticDir: string
let app: ReturnType<typeof createApp>

/** A built frontend as Vite leaves it: unhashed index.html and hashed files in assets/. */
beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), 'docgraph-static-'))
  mkdirSync(join(staticDir, 'assets'))
  writeFileSync(join(staticDir, 'index.html'), INDEX_HTML)
  writeFileSync(join(staticDir, 'assets', 'index-abc123.js'), ASSET_JS)
  app = createApp({ staticDir })
})

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true })
})

const expectSecurityHeaders = (res: Response) => {
  const csp = res.headers.get('content-security-policy')
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(res.headers.get('x-frame-options')).toBe('DENY')
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
}

describe('createApp with a built frontend', () => {
  it('serves index.html on / with the CSP and no caching', async () => {
    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toBe(INDEX_HTML)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expectSecurityHeaders(res)
  })

  it('serves hashed assets with long-term caching and the security headers', async () => {
    const res = await app.request('/assets/index-abc123.js')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    expect(await res.text()).toBe(ASSET_JS)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expectSecurityHeaders(res)
  })

  it('answers client-side routes with index.html', async () => {
    const res = await app.request('/projects/01ARZ3NDEKTSV4RRFFQ69G5FAV')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(INDEX_HTML)
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expectSecurityHeaders(res)
  })

  it('answers a missing asset with index.html, never cached as immutable', async () => {
    const res = await app.request('/assets/missing-123.js')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(INDEX_HTML)
    expect(res.headers.get('cache-control')).toBe('no-cache')
  })

  it('answers unknown API routes with a JSON 404, not index.html', async () => {
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
    expect(res.headers.get('cache-control')).toBeNull()
    expectSecurityHeaders(res)
  })

  it('answers MCP routes without an API key with a JSON 401, not index.html', async () => {
    const res = await app.request('/mcp/unknown')

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
    expectSecurityHeaders(res)
  })

  it('answers /health with the security headers', async () => {
    const res = await app.request('/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
    expectSecurityHeaders(res)
  })
})

describe('createApp without a built frontend', () => {
  it('serves the API only and answers / with a JSON 404', async () => {
    const apiOnly = createApp({ staticDir: join(staticDir, 'missing') })

    const res = await apiOnly.request('/')

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
    expectSecurityHeaders(res)
  })
})
