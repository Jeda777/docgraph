import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { apiKeys, db } from '../../db'
import { handleError } from '../../lib/http-logging'
import { createUser, MISSING_ID, migrateTestDb, resetTestDb, sessionCookieFor } from '../../test/db'
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

const createKey = async (cookie: string, name = 'agent', options: Record<string, unknown> = {}) => {
  const res = await request('/create', cookie, { name, ...options })
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

  it('gives keys without restrictions the full access of their owner', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie)

    await expect(getUserFromApiKey(created.key)).resolves.toMatchObject({
      apiKeyRestrictions: { readOnly: false, projects: null },
    })
  })

  it('stores the restrictions of a key', async () => {
    const { cookie } = await signIn()
    const restrictions = {
      readOnly: true,
      projects: [{ projectId: MISSING_ID, itemIds: [MISSING_ID] }],
    }

    const created = await createKey(cookie, 'agent', { metadata: restrictions })

    await expect(getUserFromApiKey(created.key)).resolves.toMatchObject({
      apiKeyRestrictions: restrictions,
    })
  })

  it('rejects invalid restrictions', async () => {
    const { cookie } = await signIn()

    for (const metadata of [
      { readOnly: 'yes', projects: null },
      { readOnly: false, projects: [] },
      { readOnly: false, projects: [{ projectId: MISSING_ID, itemIds: [] }] },
      { readOnly: false, projects: [{ projectId: MISSING_ID }, { projectId: MISSING_ID }] },
    ]) {
      const res = await request('/create', cookie, { name: 'agent', metadata })
      expect(res.status).toBe(400)
    }
  })

  it('refuses a key whose stored restrictions are unreadable', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie)
    await db
      .update(apiKeys)
      .set({ metadata: JSON.stringify({ readOnly: 'maybe' }) })
      .where(eq(apiKeys.id, created.id))

    await expect(getUserFromApiKey(created.key)).rejects.toMatchObject({ status: 401 })
  })

  it('does not let keys be updated', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie, 'agent', {
      metadata: { readOnly: true, projects: null },
    })

    const res = await request('/update', cookie, {
      keyId: created.id,
      metadata: { readOnly: false, projects: null },
    })

    expect(res.status).toBe(404)
    await expect(getUserFromApiKey(created.key)).resolves.toMatchObject({
      apiKeyRestrictions: { readOnly: true },
    })
  })

  it('sets the expiry and stops accepting expired keys', async () => {
    const { cookie } = await signIn()
    const created = await createKey(cookie, 'agent', { expiresIn: 7 * 24 * 60 * 60 })

    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, created.id))
    expect(row?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000)

    await db
      .update(apiKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiKeys.id, created.id))
    await expect(getUserFromApiKey(created.key)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects expiry beyond the allowed range', async () => {
    const { cookie } = await signIn()

    for (const expiresIn of [60 * 60, 400 * 24 * 60 * 60]) {
      const res = await request('/create', cookie, { name: 'agent', expiresIn })
      expect(res.status).toBe(400)
    }
  })
})
