import { idParamSchema } from '@docgraph/common/schemas'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ConflictException, InternalServerErrorException } from '../errors'
import { csrfProtection } from './csrf'
import { handleError, handleNotFound } from './http-logging'
import { zValidator } from './validator'

const app = new Hono()
app.onError(handleError)
app.notFound(handleNotFound)
app.use('/csrf', csrfProtection)
app.post('/csrf', (c) => c.text('ok'))
app.get('/conflict', () => {
  throw new ConflictException('USER_ALREADY_EXISTS')
})
app.get('/plain', () => {
  throw new HTTPException(401)
})
app.get('/rate-limited', () => {
  throw new HTTPException(429, {
    res: new Response('Slow down', { status: 429, headers: { 'retry-after': '30' } }),
  })
})
app.get('/teapot', () => {
  throw new HTTPException(418, { message: "I'm a teapot" })
})
app.get('/library-crash', () => {
  throw new HTTPException(503, { message: 'Upstream pool exhausted at 10.0.0.5' })
})
app.get('/intended-500', () => {
  throw new InternalServerErrorException('EMAIL_DELIVERY_FAILED', 'Failed to send invite email')
})
app.get('/crash', () => {
  throw new Error('database password leaked here')
})
app.get('/items/:id', zValidator('param', idParamSchema), (c) => c.json(c.req.valid('param')))
app.post(
  '/items',
  zValidator(
    'json',
    z.object({ name: z.string().min(1, 'Name is required'), tags: z.array(z.string()) }),
  ),
  (c) => c.json(c.req.valid('json')),
)

const postJson = (body: string) =>
  app.request('/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body })

describe('API error responses', () => {
  it('serializes typed exceptions with their code and the status text', async () => {
    const res = await app.request('/conflict')

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      code: 'USER_ALREADY_EXISTS',
      message: 'Conflict',
    })
  })

  it('reports every failed validation check with its path', async () => {
    const res = await postJson(JSON.stringify({ name: '', tags: ['a', 1] }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Invalid request data',
      issues: [
        { path: 'name', message: 'Name is required' },
        { path: 'tags.1', message: expect.any(String) },
      ],
    })
  })

  it('validates route params the same way', async () => {
    const res = await app.request('/items/abc')

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED', issues: [{ path: 'id' }] })
  })

  it('turns malformed JSON into a 400 error body', async () => {
    const res = await postJson('{')

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      code: 'BAD_REQUEST',
      message: 'Malformed JSON in request body',
    })
  })

  it('turns plain HTTP exceptions from Hono middleware into error bodies', async () => {
    const csrf = await app.request('/csrf', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'a=1',
    })
    const plain = await app.request('/plain')

    expect(csrf.status).toBe(403)
    expect(await csrf.json()).toEqual({ code: 'FORBIDDEN', message: 'Forbidden' })
    expect(plain.status).toBe(401)
    expect(await plain.json()).toEqual({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
  })

  it('gives other 4xx statuses their own code and keeps the headers of a custom response', async () => {
    const limited = await app.request('/rate-limited')
    const teapot = await app.request('/teapot')

    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('30')
    expect(limited.headers.get('content-type')).toBe('application/json')
    expect(await limited.json()).toEqual({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests',
    })
    expect(teapot.status).toBe(418)
    expect(await teapot.json()).toEqual({ code: 'HTTP_ERROR', message: "I'm a teapot" })
  })

  it('hides unexpected errors behind a generic 500', async () => {
    const res = await app.request('/crash')

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again later.',
    })
  })

  it('hides the message of 5xx exceptions not thrown on purpose', async () => {
    const library = await app.request('/library-crash')
    const intended = await app.request('/intended-500')

    expect(library.status).toBe(503)
    expect(await library.json()).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again later.',
    })
    expect(intended.status).toBe(500)
    expect(await intended.json()).toEqual({
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Failed to send invite email',
    })
  })

  it('answers unknown routes with a 404 error body', async () => {
    const res = await app.request('/nope')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route GET /nope not found' })
  })
})
