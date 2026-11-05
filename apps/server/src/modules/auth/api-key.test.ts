import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { handleError } from '../../lib/http-logging'
import { createUser, migrateTestDb, resetTestDb, sessionCookieFor } from '../../test/db'
import { API_KEY_PREFIX } from './better-auth'
import { authRouter } from './routes'
import { getUserFromApiKey } from './service'

const app = new Hono()
app.route('/api', authRouter)
app.onError(handleError)

const ORIGIN = 'http://localhost:5173'

const request = (path: string, cookie: string, body?: unknown) =>
  app.request(`/api/auth/api-key${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: ORIGIN, cookie },
  })

const signIn = async () => {
  const user = await createUser()
  const { cookie } = await sessionCookieFor(user.id)
  return { user, cookie }
}

type CreatedKey = { id: string; key: string; name: string }

const createKey = async (cookie: string, name = 'agent') => {
  const res = await request('/create', cookie, { name })
  expect(res.status).toBe(200)
  return (await res.json()) as CreatedKey
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('API keys', () => {
  it('creates a prefixed key that resolves to its owner', async () => {
    const { user, cookie } = await signIn()

    const created = await createKey(cookie)

    expect(created.key.startsWith(API_KEY_PREFIX)).toBe(true)
    await expect(getUserFromApiKey(created.key)).resolves.toMatchObject({ id: user.id })
  })

  it('lists own keys without their value', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie, 'laptop')
    await createKey((await signIn()).cookie, 'other')

    const res = await request('/list', cookie)

    expect(res.status).toBe(200)
    const { apiKeys } = (await res.json()) as { apiKeys: Record<string, unknown>[] }
    expect(apiKeys).toHaveLength(1)
    expect(apiKeys[0]).toMatchObject({ id: created.id, name: 'laptop' })
    expect(apiKeys[0]).not.toHaveProperty('key')
  })

  it('rejects creating a key without a name', async () => {
    const { cookie } = await signIn()

    const res = await request('/create', cookie, {})

    expect(res.status).toBe(400)
  })

  it("does not delete someone else's key", async () => {
    const owner = await signIn()
    const created = await createKey(owner.cookie)
    const { cookie } = await signIn()

    const res = await request('/delete', cookie, { keyId: created.id })

    expect(res.status).toBe(404)
    await expect(getUserFromApiKey(created.key)).resolves.toMatchObject({ id: owner.user.id })
  })

  it('stops accepting a deleted key', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie)

    const res = await request('/delete', cookie, { keyId: created.id })

    expect(res.status).toBe(200)
    await expect(getUserFromApiKey(created.key)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects unknown keys', async () => {
    await expect(getUserFromApiKey(`${API_KEY_PREFIX}unknown`)).rejects.toMatchObject({
      status: 401,
    })
    await expect(getUserFromApiKey(undefined)).rejects.toMatchObject({ status: 401 })
  })
})
