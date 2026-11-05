import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleError } from '../../lib/http-logging'
import { createUser, migrateTestDb, resetTestDb, setUserPassword } from '../../test/db'

const { mailAttachments, sendMailMock, renderOtpMock } = vi.hoisted(() => {
  // The rendered mail carries the logo; it must reach `sendMail` as rendered.
  const mailAttachments = [{ filename: 'logo.png', cid: 'logo' }]
  return {
    mailAttachments,
    // Explicit signatures keep `mock.calls` entries typed instead of empty tuples.
    sendMailMock: vi.fn<
      (message: Record<string, unknown>, options: { logWithoutSmtp: string }) => Promise<void>
    >(async () => undefined),
    renderOtpMock: vi.fn<
      (input: { name: string; otp: string; type: string }) => Promise<{
        subject: string
        html: string
        attachments: typeof mailAttachments
      }>
    >(async () => ({ subject: 'Your code', html: '<p>code</p>', attachments: mailAttachments })),
  }
})

vi.mock('../../mailer', () => ({ mailer: { sendMail: sendMailMock } }))
vi.mock('../../emails', () => ({ renderOtp: renderOtpMock }))

const { authRouter } = await import('./routes')

const app = new Hono()
app.route('/api', authRouter)
app.onError(handleError)

const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'Sup3rsecret!'

const postJson = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
  })

/** The `name=value` part of the session cookie a response sets. */
const sessionCookieOf = (res: Response) => {
  const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token='))
  if (!cookie) throw new Error('No session cookie was set')
  return cookie
}

const cookieHeaderOf = (res: Response) => sessionCookieOf(res).split(';')[0] ?? ''

/** The OTP code embedded in the most recent email. */
const lastOtpCode = (): string => {
  const call = renderOtpMock.mock.calls.at(-1)?.[0]
  if (!call) throw new Error('renderOtp was never called')
  return call.otp
}

/** The id of the user a session cookie signs in, `null` once the session has ended. */
const sessionUserId = async (cookie: string) => {
  const res = await app.request('/api/auth/get-session', { headers: { cookie } })
  const body = (await res.json()) as { user?: { id: string } } | null
  return body?.user?.id ?? null
}

const sendOtp = (email: string, type: 'sign-in' | 'forget-password') =>
  postJson('/api/auth/email-otp/send-verification-otp', { email, type })

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
  sendMailMock.mockClear()
  renderOtpMock.mockClear()
})

describe('POST /api/auth/sign-in/email', () => {
  it('sets an HttpOnly, SameSite=Strict session cookie that authenticates requests', async () => {
    const user = await createUser({ email: 'jane@test.local' })
    await setUserPassword(user.id, PASSWORD)

    const res = await postJson('/api/auth/sign-in/email', {
      email: user.email,
      password: PASSWORD,
    })

    expect(res.status).toBe(200)
    const cookie = sessionCookieOf(res)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')

    expect(await sessionUserId(cookieHeaderOf(res))).toBe(user.id)
  })

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const user = await createUser()
    await setUserPassword(user.id, PASSWORD)

    const res = await postJson('/api/auth/sign-in/email', {
      email: user.email,
      password: 'WrongPassw0rd!',
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('never signs anybody up', async () => {
    const res = await postJson('/api/auth/sign-up/email', {
      email: 'new@test.local',
      password: PASSWORD,
      name: 'new',
    })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('email OTP sign-in', () => {
  it('emails a code to an existing user and signs them in with it', async () => {
    const user = await createUser({ name: 'jane' })

    expect((await sendOtp(user.email, 'sign-in')).status).toBe(200)
    expect(renderOtpMock.mock.calls[0]?.[0]).toMatchObject({ name: 'jane', type: 'sign-in' })
    expect(sendMailMock.mock.calls[0]?.[0]).toMatchObject({
      to: user.email,
      subject: 'Your code',
      html: '<p>code</p>',
    })
    expect(sendMailMock.mock.calls[0]?.[0].attachments).toBe(mailAttachments)
    expect(sendMailMock.mock.calls[0]?.[1]).toEqual({ logWithoutSmtp: `Code: ${lastOtpCode()}` })

    const code = lastOtpCode()
    const res = await postJson('/api/auth/sign-in/email-otp', { email: user.email, otp: code })
    expect(res.status).toBe(200)
    expect(cookieHeaderOf(res)).toBeTruthy()
  })

  it('answers unknown emails like known ones and sends nothing', async () => {
    const res = await sendOtp('ghost@test.local', 'sign-in')

    expect(res.status).toBe(200)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('rejects a wrong code with INVALID_OTP', async () => {
    const user = await createUser()
    await sendOtp(user.email, 'sign-in')
    const wrongCode = lastOtpCode() === '000000' ? '000001' : '000000'

    const res = await postJson('/api/auth/sign-in/email-otp', { email: user.email, otp: wrongCode })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'INVALID_OTP' })
  })

  it('tells the user to request a new code after too many wrong ones', async () => {
    const user = await createUser()
    await sendOtp(user.email, 'sign-in')
    const code = lastOtpCode()
    const wrongCode = code === '000000' ? '000001' : '000000'
    // Better Auth allows 3 attempts per code.
    for (let i = 0; i < 3; i++) {
      await postJson('/api/auth/sign-in/email-otp', { email: user.email, otp: wrongCode })
    }

    const res = await postJson('/api/auth/sign-in/email-otp', { email: user.email, otp: code })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' })
  })

  it('reports mail delivery failures as EMAIL_DELIVERY_FAILED', async () => {
    const user = await createUser()
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'))

    const res = await sendOtp(user.email, 'sign-in')

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' })
  })
})

describe('password reset with an email code', () => {
  const resetPassword = (email: string, otp: string, password: string) =>
    postJson('/api/auth/email-otp/reset-password', { email, otp, password })

  it('lets invited users without a password set their first one', async () => {
    const user = await createUser()
    await sendOtp(user.email, 'forget-password')
    expect(renderOtpMock.mock.calls[0]?.[0]).toMatchObject({ type: 'forget-password' })

    expect((await resetPassword(user.email, lastOtpCode(), 'First-passw0rd')).status).toBe(200)

    const login = await postJson('/api/auth/sign-in/email', {
      email: user.email,
      password: 'First-passw0rd',
    })
    expect(login.status).toBe(200)
  })

  it('enforces the password rules of the app', async () => {
    const user = await createUser()
    await sendOtp(user.email, 'forget-password')

    const res = await resetPassword(user.email, lastOtpCode(), 'weakpassword')

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})

describe('POST /api/auth/change-password', () => {
  const signIn = async (email: string, password = PASSWORD) =>
    cookieHeaderOf(await postJson('/api/auth/sign-in/email', { email, password }))

  const changePassword = (cookie: string, currentPassword: string, newPassword: string) =>
    postJson(
      '/api/auth/change-password',
      { currentPassword, newPassword, revokeOtherSessions: true },
      { cookie },
    )

  it('rejects a wrong current password with INVALID_PASSWORD', async () => {
    const user = await createUser()
    await setUserPassword(user.id, PASSWORD)

    const res = await changePassword(await signIn(user.email), 'Wrong-passw0rd', 'Fresh-passw0rd')

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'INVALID_PASSWORD' })
  })

  it('enforces the password rules of the app', async () => {
    const user = await createUser()
    await setUserPassword(user.id, PASSWORD)

    const res = await changePassword(await signIn(user.email), PASSWORD, 'weakpassword')

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })
})

describe('POST /api/auth/update-user', () => {
  it('is disabled, so users cannot rename themselves', async () => {
    const user = await createUser({ name: 'jane' })
    await setUserPassword(user.id, PASSWORD)
    const signIn = await postJson('/api/auth/sign-in/email', {
      email: user.email,
      password: PASSWORD,
    })

    const res = await postJson(
      '/api/auth/update-user',
      { name: 'x'.repeat(10_000) },
      { cookie: cookieHeaderOf(signIn) },
    )

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
  })
})
