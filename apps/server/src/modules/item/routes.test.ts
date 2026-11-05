import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createItem,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
  sessionCookieFor,
} from '../../test/db'
import { itemRepository } from './repo'
import { itemsRouter } from './routes'

const app = new Hono()
app.route('/api', itemsRouter)

const INVALID_IDS = ['abc', '0', '-1', '1.5']

const headersFor = async (userId: string) => {
  return { ...(await sessionCookieFor(userId)), 'content-type': 'application/json' }
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('GET /api/items/:id', () => {
  it('returns the item for a valid id', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)

    const res = await app.request(`/api/items/${item.id}`, { headers: await headersFor(admin.id) })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: item.id })
  })

  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/items/${id}`, { headers: await headersFor(admin.id) })

    expect(res.status).toBe(400)
  })

  it('answers 404 naming only the item when the user has no access to its project', async () => {
    const stranger = await createUser()
    const project = await createProject()
    const item = await createItem(project.id)

    const res = await app.request(`/api/items/${item.id}`, {
      headers: await headersFor(stranger.id),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ message: `Item with id ${item.id} not found` })
  })
})

describe('POST /api/items', () => {
  it('returns the created item without its document', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    const res = await app.request('/api/items', {
      method: 'POST',
      headers: await headersFor(admin.id),
      body: JSON.stringify({ name: 'Guide', type: 'DOCUMENT', projectId: project.id }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ name: 'Guide', type: 'DOCUMENT', projectId: project.id })
    expect(body).not.toHaveProperty('document')
  })
})

describe('PATCH /api/items/:id', () => {
  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/items/${id}`, {
      method: 'PATCH',
      headers: await headersFor(admin.id),
      body: JSON.stringify({ name: 'Renamed', isArchived: false }),
    })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/items/:id', () => {
  it('deletes the item for a valid id', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)

    const res = await app.request(`/api/items/${item.id}`, {
      method: 'DELETE',
      headers: await headersFor(admin.id),
    })

    expect(res.status).toBe(204)
    await expect(itemRepository.findById(item.id)).resolves.toBeUndefined()
  })

  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/items/${id}`, {
      method: 'DELETE',
      headers: await headersFor(admin.id),
    })

    expect(res.status).toBe(400)
  })
})
