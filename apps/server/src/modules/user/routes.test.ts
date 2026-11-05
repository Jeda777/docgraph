import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleError } from '../../lib/http-logging'
import {
  addMember,
  createApiKeyFor,
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  resetTestDb,
  sessionCookieFor,
} from '../../test/db'
import { getUserFromApiKey, getUserFromHeaders } from '../auth/service'
import { userRepository } from './repo'

const { renderInvitationMock, sendMailMock } = vi.hoisted(() => ({
  // Import-time transport creation and unused mail paths stay hermetic.
  sendMailMock: vi.fn<(message: Record<string, unknown>) => Promise<void>>(async () => undefined),
  renderInvitationMock: vi.fn(async () => ({ subject: 'Invite', html: '<p>invite</p>' })),
}))

vi.mock('../../mailer', () => ({ mailer: { sendMail: sendMailMock } }))
vi.mock('../../emails', () => ({ renderInvitation: renderInvitationMock }))

const { usersRouter } = await import('./routes')

const app = new Hono()
app.route('/api', usersRouter)
app.onError(handleError)

const authHeaderFor = async (userId: string) => {
  return sessionCookieFor(userId)
}

const jsonHeaders = async (userId: string) => ({
  'content-type': 'application/json',
  ...(await authHeaderFor(userId)),
})

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
  sendMailMock.mockClear()
  renderInvitationMock.mockClear()
})

describe('GET /api/users', () => {
  it('requires authentication', async () => {
    const res = await app.request('/api/users')

    expect(res.status).toBe(401)
  })

  it('rejects non-admins with 403', async () => {
    const user = await createUser()

    const res = await app.request('/api/users', { headers: await authHeaderFor(user.id) })

    expect(res.status).toBe(403)
  })

  it('lists summaries with the role for admins', async () => {
    const admin = await createUser({ name: 'listed', isAdmin: true })

    const res = await app.request('/api/users', { headers: await authHeaderFor(admin.id) })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<Record<string, unknown>>
    expect(body).toHaveLength(1)
    expect(Object.keys(body[0]).sort()).toEqual(['email', 'id', 'isAdmin', 'name'])
    expect(body[0]).toMatchObject({ name: 'listed', isAdmin: true })
  })
})

describe('POST /api/users', () => {
  it('rejects non-admins with 403 without creating anything', async () => {
    const user = await createUser()

    const res = await app.request('/api/users', {
      method: 'POST',
      headers: await jsonHeaders(user.id),
      body: JSON.stringify({ email: 'invited@test.local', name: 'invited' }),
    })

    expect(res.status).toBe(403)
    expect(await userRepository.findByEmail('invited@test.local')).toBeUndefined()
  })

  it('creates the user and sends the invite as admin', async () => {
    const admin = await createUser({ isAdmin: true })

    const res = await app.request('/api/users', {
      method: 'POST',
      headers: await jsonHeaders(admin.id),
      body: JSON.stringify({ email: 'invited@test.local', name: 'invited' }),
    })

    expect(res.status).toBe(204)
    expect(await userRepository.findByEmail('invited@test.local')).toMatchObject({
      name: 'invited',
    })
    expect(sendMailMock).toHaveBeenCalledTimes(1)
  })
})

const patchUser = async (id: string, callerId: string, body: unknown) =>
  app.request(`/api/users/${id}`, {
    method: 'PATCH',
    headers: await jsonHeaders(callerId),
    body: JSON.stringify(body),
  })

const deleteUserRequest = async (id: string, callerId: string) =>
  app.request(`/api/users/${id}`, { method: 'DELETE', headers: await authHeaderFor(callerId) })

describe('PATCH /api/users/:id', () => {
  it('promotes and demotes a user, which takes effect on their session', async () => {
    const admin = await createUser({ isAdmin: true })
    const user = await createUser()
    const userHeaders = new Headers(await authHeaderFor(user.id))

    const promoted = await patchUser(user.id, admin.id, { isAdmin: true })
    expect(promoted.status).toBe(200)
    expect(await promoted.json()).toMatchObject({ id: user.id, isAdmin: true })
    await expect(getUserFromHeaders(userHeaders)).resolves.toMatchObject({ isAdmin: true })

    const demoted = await patchUser(user.id, admin.id, { isAdmin: false })
    expect(demoted.status).toBe(200)
    await expect(getUserFromHeaders(userHeaders)).resolves.toMatchObject({ isAdmin: false })
  })

  it('does not let admins change their own role, so an admin always remains', async () => {
    const admin = await createUser({ isAdmin: true })

    const res = await patchUser(admin.id, admin.id, { isAdmin: false })

    expect(res.status).toBe(400)
    expect(await userRepository.findById(admin.id)).toMatchObject({ isAdmin: true })
  })

  it('rejects non-admins with 403', async () => {
    const user = await createUser()
    const target = await createUser()

    const res = await patchUser(target.id, user.id, { isAdmin: true })

    expect(res.status).toBe(403)
    expect(await userRepository.findById(target.id)).toMatchObject({ isAdmin: false })
  })

  it('answers 404 for a missing user and 400 for an invalid body', async () => {
    const admin = await createUser({ isAdmin: true })
    const user = await createUser()

    expect((await patchUser(MISSING_ID, admin.id, { isAdmin: true })).status).toBe(404)
    expect((await patchUser(user.id, admin.id, { isAdmin: 'yes' })).status).toBe(400)
  })
})

describe('DELETE /api/users/:id', () => {
  it('deletes the user with their sessions, API keys and memberships', async () => {
    const admin = await createUser({ isAdmin: true })
    const user = await createUser()
    const userHeaders = new Headers(await authHeaderFor(user.id))
    const key = await createApiKeyFor(user.id)
    const project = await createProject()
    await addMember(project.id, user.id)

    const res = await deleteUserRequest(user.id, admin.id)

    expect(res.status).toBe(204)
    expect(await userRepository.findById(user.id)).toBeUndefined()
    await expect(getUserFromHeaders(userHeaders)).rejects.toMatchObject({ status: 401 })
    await expect(getUserFromApiKey(key)).rejects.toMatchObject({ status: 401 })
  })

  it('does not let admins delete themselves', async () => {
    const admin = await createUser({ isAdmin: true })

    const res = await deleteUserRequest(admin.id, admin.id)

    expect(res.status).toBe(400)
    expect(await userRepository.findById(admin.id)).toBeDefined()
  })

  it('rejects non-admins with 403 and answers 404 for a missing user', async () => {
    const admin = await createUser({ isAdmin: true })
    const user = await createUser()
    const target = await createUser()

    expect((await deleteUserRequest(target.id, user.id)).status).toBe(403)
    expect(await userRepository.findById(target.id)).toBeDefined()
    expect((await deleteUserRequest(MISSING_ID, admin.id)).status).toBe(404)
  })
})
