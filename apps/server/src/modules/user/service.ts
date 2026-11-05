import type { UserUpdateInput, UserUpdateOutput } from '@docgraph/common/schemas'
import { config } from '../../config'
import { closeUserConnections } from '../../crdt'
import { db, type Transaction } from '../../db'
import { renderInvitation } from '../../emails'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '../../errors'
import { log } from '../../logger'
import { mailer } from '../../mailer'
import type { Actor } from '../auth/actor'
import { userRepository } from './repo'

const logger = log('user')

export const inviteUser = async (input: { email: string; name: string }) => {
  // Better Auth lowercases emails before every lookup.
  const email = input.email.toLowerCase()

  return db.transaction(async (tx) => {
    const existingUser = await userRepository.findByEmail(email, tx)
    if (existingUser) {
      throw new ConflictException('USER_ALREADY_EXISTS')
    }

    // No password yet: the user logs in with an email code and may set one later.
    await userRepository.create({ email, name: input.name }, tx)

    // The email is sent inside the transaction on purpose: if delivery fails, the
    // user row is rolled back, so the invite can simply be retried.
    try {
      const url = `${config.APP_URL}/login-otp?email=${encodeURIComponent(email)}`
      const mail = await renderInvitation({ url, name: input.name })
      await mailer.sendMail({ to: email, ...mail }, { logWithoutSmtp: `Link: ${url}` })
    } catch (error) {
      logger.error('Failed to send invite email: {error}', { error })
      throw new InternalServerErrorException('EMAIL_DELIVERY_FAILED')
    }
  })
}

export const listUsers = async () => userRepository.findAllSummaries()

/**
 * Keeps an admin on the instance: the caller may not change their own role or delete themselves,
 * and must still be an admin once the admin rows are locked. Without the lock, two admins could
 * demote or delete each other in concurrent requests (both pass `requireAdmin` before either
 * commits) and leave no admin; `seedAdmin` would restore one only on the next start.
 */
const lockAdminsAndAssertActor = async (
  tx: Transaction,
  targetId: string,
  actor: Actor,
  selfMessage: string,
) => {
  if (targetId === actor.id) throw new BadRequestException('BAD_REQUEST', selfMessage)
  const adminIds = await userRepository.lockAdminIds(tx)
  if (!adminIds.includes(actor.id)) throw new ForbiddenException()
}

export const updateUser = async (
  input: UserUpdateInput & { id: string },
  actor: Actor,
): Promise<UserUpdateOutput> => {
  const { before, user } = await db.transaction(async (tx) => {
    await lockAdminsAndAssertActor(tx, input.id, actor, 'You cannot change your own role')
    const before = await userRepository.getByIdOrThrow(input.id, tx)
    const user = await userRepository.update(input.id, { isAdmin: input.isAdmin }, tx)
    return { before, user }
  })
  // After the commit: open editors were authorized with the old role.
  if (before.isAdmin !== user.isAdmin) closeUserConnections(user.id)

  return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
}

/**
 * Deletes the user for good; their sessions, accounts, API keys and project memberships go with
 * the row (`on delete cascade`). Projects and items have no owner, so no content is lost.
 */
export const deleteUser = async (id: string, actor: Actor) => {
  await db.transaction(async (tx) => {
    await lockAdminsAndAssertActor(tx, id, actor, 'You cannot delete yourself')
    await userRepository.delete(id, tx)
  })
  closeUserConnections(id)
}
