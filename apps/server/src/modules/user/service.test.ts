import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, users } from '../../db'
import {
  actorOf,
  createUser,
  migrateTestDb,
  openTransaction,
  resetTestDb,
  waitForLockWaits,
} from '../../test/db'
import { userRepository } from './repo'

const { mailAttachments, renderInvitationMock, sendMailMock } = vi.hoisted(() => {
  // The rendered mail carries the logo; it must reach `sendMail` as rendered.
  const mailAttachments = [{ filename: 'logo.png', cid: 'logo' }]
  return {
    mailAttachments,
    // Import-time transport creation and unused mail paths stay hermetic.
    sendMailMock: vi.fn<
      (message: Record<string, unknown>, options: { logWithoutSmtp: string }) => Promise<void>
    >(async () => undefined),
    renderInvitationMock: vi.fn<
      (input: { url: string; name: string }) => Promise<{
        subject: string
        html: string
        attachments: typeof mailAttachments
      }>
    >(async () => ({ subject: 'Invite', html: '<p>invite</p>', attachments: mailAttachments })),
  }
})

vi.mock('../../mailer', () => ({ mailer: { sendMail: sendMailMock } }))
vi.mock('../../emails', () => ({ renderInvitation: renderInvitationMock }))

const { deleteUser, inviteUser, updateUser } = await import('./service')

/** Structural shape of errors thrown by services, for assertions. */
type ExpectedError = { status: number; message: string; code: string }

const captureError = async (promise: Promise<unknown>): Promise<ExpectedError> =>
  promise.then(
    () => {
      throw new Error('Expected the promise to reject')
    },
    (error) => error as ExpectedError,
  )

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
  sendMailMock.mockClear()
  renderInvitationMock.mockClear()
})

describe('inviteUser', () => {
  it('creates the user and emails a login link', async () => {
    await inviteUser({ email: 'new@test.local', name: 'newcomer' })

    const [row] = await db.select().from(users).where(eq(users.email, 'new@test.local'))
    expect(row).toMatchObject({ name: 'newcomer', isAdmin: false })

    expect(renderInvitationMock).toHaveBeenCalledTimes(1)
    expect(renderInvitationMock.mock.calls[0][0]).toMatchObject({
      url: 'http://localhost:5173/login-otp?email=new%40test.local',
      name: 'newcomer',
    })
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({
      to: 'new@test.local',
      subject: 'Invite',
      html: '<p>invite</p>',
    })
    expect(sendMailMock.mock.calls[0][0].attachments).toBe(mailAttachments)
    expect(sendMailMock.mock.calls[0][1]).toEqual({
      logWithoutSmtp: 'Link: http://localhost:5173/login-otp?email=new%40test.local',
    })
  })

  it('rejects duplicate emails with 409 and sends nothing', async () => {
    await createUser({ email: 'taken@test.local' })

    const error = await captureError(inviteUser({ email: 'taken@test.local', name: 'dup' }))

    expect(error.status).toBe(409)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('rolls back the created user when the invite email fails', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'))

    const error = await captureError(inviteUser({ email: 'doomed@test.local', name: 'doomed' }))

    expect(error.status).toBe(500)
    expect(error.code).toBe('EMAIL_DELIVERY_FAILED')
    expect(await userRepository.findByEmail('doomed@test.local')).toBeUndefined()
  })
})

/*
 * Two admins demoting or deleting each other in concurrent requests: both pass `requireAdmin`
 * before either commits. The admin-row lock makes the second request wait for the first and then
 * see that its caller is no longer an admin. The first cases run the requests one after another,
 * with the second caller's actor still claiming admin as `requireAdmin` resolved it; the rest run
 * them on separate connections at the same time.
 */
describe('admin changes keep an admin', () => {
  const twoAdmins = async () => {
    const alice = await createUser({ isAdmin: true })
    const bob = await createUser({ isAdmin: true })
    return { alice, bob, aliceActor: actorOf(alice), bobActor: actorOf(bob) }
  }

  it('refuses a role change from an admin demoted in the meantime', async () => {
    const { alice, bob, aliceActor, bobActor } = await twoAdmins()

    await updateUser({ id: alice.id, isAdmin: false }, bobActor)
    const error = await captureError(updateUser({ id: bob.id, isAdmin: false }, aliceActor))

    expect(error.status).toBe(403)
    expect(await userRepository.findById(bob.id)).toMatchObject({ isAdmin: true })
  })

  it('refuses a delete from an admin deleted in the meantime', async () => {
    const { alice, bob, aliceActor, bobActor } = await twoAdmins()

    await deleteUser(alice.id, bobActor)
    const error = await captureError(deleteUser(bob.id, aliceActor))

    expect(error.status).toBe(403)
    expect(await userRepository.findById(bob.id)).toBeDefined()
  })

  const adminIds = async () =>
    (await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true))).map(
      (user) => user.id,
    )

  it('makes a role change wait for an uncommitted demotion of its caller', async () => {
    const { alice, bob, aliceActor } = await twoAdmins()
    // Bob's request has locked the admins and demoted Alice, but not committed yet.
    const bobsRequest = await openTransaction()
    await userRepository.lockAdminIds(bobsRequest.tx)
    await userRepository.update(alice.id, { isAdmin: false }, bobsRequest.tx)

    const alicesRequest = captureError(updateUser({ id: bob.id, isAdmin: false }, aliceActor))
    await waitForLockWaits()
    await bobsRequest.commit()

    expect((await alicesRequest).status).toBe(403)
    expect(await adminIds()).toEqual([bob.id])
  })

  it('makes a delete wait for an uncommitted delete of its caller', async () => {
    const { alice, bob, aliceActor } = await twoAdmins()
    const bobsRequest = await openTransaction()
    await userRepository.lockAdminIds(bobsRequest.tx)
    await userRepository.delete(alice.id, bobsRequest.tx)

    const alicesRequest = captureError(deleteUser(bob.id, aliceActor))
    await waitForLockWaits()
    await bobsRequest.commit()

    expect((await alicesRequest).status).toBe(403)
    expect(await adminIds()).toEqual([bob.id])
  })

  it('keeps an admin when two admins demote each other at the same time', async () => {
    const { alice, bob, aliceActor, bobActor } = await twoAdmins()

    const results = await Promise.allSettled([
      updateUser({ id: alice.id, isAdmin: false }, bobActor),
      updateUser({ id: bob.id, isAdmin: false }, aliceActor),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await adminIds()).toHaveLength(1)
  })

  it('keeps an admin when two admins delete each other at the same time', async () => {
    const { alice, bob, aliceActor, bobActor } = await twoAdmins()

    const results = await Promise.allSettled([
      deleteUser(alice.id, bobActor),
      deleteUser(bob.id, aliceActor),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await adminIds()).toHaveLength(1)
  })
})
