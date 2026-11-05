import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { csrfProtection, isSameOriginRequest, requireSameOrigin } from './csrf'
import { handleError } from './http-logging'

// APP_URL in the test setup
const APP_ORIGIN = 'http://localhost:5173'
const SIBLING_ORIGIN = 'http://evil.localhost:5173'

const app = new Hono()
app.onError(handleError)
app.use('/api/*', csrfProtection)
app.post('/api/thing', (c) => c.text('ok'))
app.get('/ws', requireSameOrigin, (c) => c.text('upgraded'))

const post = (headers: Record<string, string>) =>
  app.request('/api/thing', { method: 'POST', headers, body: 'a=1' })

describe('isSameOriginRequest', () => {
  it('accepts the app origin or a same-origin fetch', () => {
    expect(isSameOriginRequest(new Headers({ origin: APP_ORIGIN }))).toBe(true)
    expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  it('rejects same-site, cross-site and missing origins', () => {
    expect(isSameOriginRequest(new Headers({ origin: SIBLING_ORIGIN }))).toBe(false)
    expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-site' }))).toBe(false)
    expect(isSameOriginRequest(new Headers())).toBe(false)
  })
})

describe('csrfProtection', () => {
  it('allows form posts from the app origin', async () => {
    const res = await post({
      'content-type': 'application/x-www-form-urlencoded',
      origin: APP_ORIGIN,
    })
    expect(res.status).toBe(200)
  })

  it('blocks form posts from a sibling subdomain', async () => {
    const res = await post({
      'content-type': 'application/x-www-form-urlencoded',
      origin: SIBLING_ORIGIN,
      'sec-fetch-site': 'same-site',
    })
    expect(res.status).toBe(403)
  })

  it('blocks text/plain posts without an origin', async () => {
    const res = await post({ 'content-type': 'text/plain' })
    expect(res.status).toBe(403)
  })
})

describe('requireSameOrigin (WebSocket upgrade)', () => {
  it('allows the handshake from the app origin', async () => {
    const res = await app.request('/ws', { headers: { origin: APP_ORIGIN } })
    expect(res.status).toBe(200)
  })

  it('rejects the handshake from another origin', async () => {
    const res = await app.request('/ws', { headers: { origin: SIBLING_ORIGIN } })
    expect(res.status).toBe(403)
  })

  it('rejects the handshake without an origin', async () => {
    const res = await app.request('/ws')
    expect(res.status).toBe(403)
  })
})
