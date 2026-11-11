import { randomUUID } from 'node:crypto'
import { type APIRequestContext, expect, request as playwrightRequest } from '@playwright/test'
import { BASE_URL } from '../env'
import { waitForOtpCode } from './mailpit'

type Entity = { id: string; name: string }
export type ItemType = 'DOCUMENT' | 'BUSINESS_PROCESS' | 'DATABASE_DIAGRAM' | 'FLOWCHART'

/** A user created for one test; the password is set, so it can sign in either way. */
export type TestUser = { id: string; name: string; email: string; password: string }

/** Unique per call, so parallel tests and repeated runs never collide on names. */
export const uniqueName = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`

/** Unique address on the e2e domain; Mailpit catches everything sent to it. */
export const uniqueEmail = (prefix = 'user') => `${prefix}-${randomUUID().slice(0, 8)}@e2e.test`

/** Meets `passwordSchema`: length, upper and lower case, a digit and a special character. */
export const TEST_PASSWORD = 'Str0ng-e2e-password!'

const send = async <T>(
  request: APIRequestContext,
  method: 'post' | 'patch',
  path: string,
  data: unknown,
) => {
  // Better Auth checks the Origin of its endpoints like the browser would send it
  const response = await request[method](path, { data, headers: { origin: BASE_URL } })
  expect(response.ok(), `${method.toUpperCase()} ${path} answered ${response.status()}`).toBe(true)
  const body = await response.text()
  return (body ? JSON.parse(body) : undefined) as T
}

/**
 * Shortcuts for state a test needs but doesn't test itself. They call the REST API with the
 * signed-in session of `request` (e.g. `page.request`).
 */
export const createProject = (
  request: APIRequestContext,
  {
    name = uniqueName('Project'),
    isForAllUsers = true,
    memberIds = [],
  }: { name?: string; isForAllUsers?: boolean; memberIds?: string[] } = {},
) => send<Entity>(request, 'post', '/api/projects', { name, isForAllUsers, memberIds })

export const updateProject = (
  request: APIRequestContext,
  id: string,
  data: { name: string; isForAllUsers: boolean; memberIds: string[]; isArchived: boolean },
) => send<Entity>(request, 'patch', `/api/projects/${id}`, data)

export const createItem = (
  request: APIRequestContext,
  projectId: string,
  type: ItemType,
  name = uniqueName(type.toLowerCase()),
) => send<Entity>(request, 'post', '/api/items', { name, type, projectId })

/** Invites a user as the admin behind `request`; the invite leaves the account without a password. */
export const inviteUser = async (
  request: APIRequestContext,
  { name = uniqueName('User'), email = uniqueEmail() }: { name?: string; email?: string } = {},
) => {
  await send(request, 'post', '/api/users', { name, email })
  return { name, email }
}

const findUserId = async (request: APIRequestContext, email: string) => {
  const response = await request.get('/api/users')
  expect(response.ok()).toBe(true)
  const users = (await response.json()) as { id: string; email: string }[]
  const user = users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`No user ${email}`)
  return user.id
}

/**
 * Invites a regular (non-admin) user and gives them a password through the reset flow, the only
 * way an account gets one. `adminRequest` needs an admin session; the reset runs in a separate,
 * signed-out request context.
 */
export const createUser = async (adminRequest: APIRequestContext): Promise<TestUser> => {
  const { name, email } = await inviteUser(adminRequest)
  const id = await findUserId(adminRequest, email)

  const signedOut = await playwrightRequest.newContext({ baseURL: BASE_URL })
  try {
    const sentAt = new Date()
    await send(signedOut, 'post', '/api/auth/email-otp/send-verification-otp', {
      email,
      type: 'forget-password',
    })
    const otp = await waitForOtpCode(email, sentAt)
    await send(signedOut, 'post', '/api/auth/email-otp/reset-password', {
      email,
      otp,
      password: TEST_PASSWORD,
    })
  } finally {
    await signedOut.dispose()
  }

  return { id, name, email, password: TEST_PASSWORD }
}

/** Creates an API key for the user behind `request`; `key` is the plain key. */
export const createApiKey = (request: APIRequestContext, name = uniqueName('Agent key')) =>
  send<{ id: string; key: string }>(request, 'post', '/api/auth/api-key/create', { name })

export const revokeApiKey = (request: APIRequestContext, keyId: string) =>
  send(request, 'post', '/api/auth/api-key/delete', { keyId })

/** Signs `request` in with a password; a browser context's request shares its cookies. */
export const signIn = (request: APIRequestContext, user: Pick<TestUser, 'email' | 'password'>) =>
  send(request, 'post', '/api/auth/sign-in/email', { email: user.email, password: user.password })
