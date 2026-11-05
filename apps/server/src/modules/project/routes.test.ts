import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  resetTestDb,
  sessionCookieFor,
} from '../../test/db'
import { projectRepository } from './repo'
import { projectsRouter } from './routes'

const app = new Hono()
app.route('/api', projectsRouter)

const INVALID_IDS = ['abc', '0', '-1', '1.5']

const headersFor = async (userId: string) => {
  return { ...(await sessionCookieFor(userId)), 'content-type': 'application/json' }
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('GET /api/projects', () => {
  it('lists a shared project once even with several assigned members', async () => {
    const viewer = await createUser()
    const otherMember = await createUser()
    const project = await createProject({ isForAllUsers: true })
    await projectRepository.addMembers(project.id, [viewer.id, otherMember.id])

    const res = await app.request('/api/projects', { headers: await headersFor(viewer.id) })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ id: string }>
    expect(body.map((row) => row.id)).toEqual([project.id])
  })
})

describe('GET /api/projects/:id', () => {
  it('returns the project for a valid id', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    const res = await app.request(`/api/projects/${project.id}`, {
      headers: await headersFor(admin.id),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: project.id })
  })

  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/projects/${id}`, { headers: await headersFor(admin.id) })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/projects', () => {
  it('rejects unknown member ids with 404 instead of 500', async () => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: await headersFor(admin.id),
      body: JSON.stringify({ name: 'Ghost', isForAllUsers: false, memberIds: [MISSING_ID] }),
    })

    expect(res.status).toBe(404)
  })

  it('adds a member listed twice only once instead of failing with 500', async () => {
    const admin = await createUser({ isAdmin: true })
    const member = await createUser()

    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: await headersFor(admin.id),
      body: JSON.stringify({
        name: 'Twice',
        isForAllUsers: false,
        memberIds: [member.id, member.id],
      }),
    })

    expect(res.status).toBe(200)
    const { id } = (await res.json()) as { id: string }
    const members = await projectRepository.getMembers(id)
    expect(members.map((row) => row.id)).toEqual([member.id])
  })
})

describe('PATCH /api/projects/:id', () => {
  it('replaces members with a member listed twice only once instead of failing with 500', async () => {
    const admin = await createUser({ isAdmin: true })
    const member = await createUser()
    const project = await createProject()

    const res = await app.request(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: await headersFor(admin.id),
      body: JSON.stringify({
        name: project.name,
        isForAllUsers: false,
        isArchived: false,
        memberIds: [member.id, member.id],
      }),
    })

    expect(res.status).toBe(200)
    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id)).toEqual([member.id])
  })

  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: await headersFor(admin.id),
      body: JSON.stringify({ name: 'Renamed', isForAllUsers: false, isArchived: false }),
    })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/projects/:id', () => {
  it('deletes the project for a valid id', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    const res = await app.request(`/api/projects/${project.id}`, {
      method: 'DELETE',
      headers: await headersFor(admin.id),
    })

    expect(res.status).toBe(204)
    await expect(projectRepository.findById(project.id)).resolves.toBeUndefined()
  })

  it.each(INVALID_IDS)('rejects the invalid id %s with 400', async (id) => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: await headersFor(admin.id),
    })

    expect(res.status).toBe(400)
  })
})
