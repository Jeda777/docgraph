import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundException } from '../errors'
import { userRepository } from '../modules/user/repo'
import { MISSING_ID, migrateTestDb, resetTestDb } from '../test/db'

const uniqueEmail = (() => {
  let n = 0
  return () => `user-${++n}@test.local`
})()

/** Structural shape of errors thrown by repos, for assertions. */
type ExpectedError = { status: number; message: string }

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
})

describe('createRepo (exercised through the users table)', () => {
  it('create returns the stored row with database defaults applied', async () => {
    const row = await userRepository.create({ name: 'alice', email: uniqueEmail() })

    expect(row.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(row.isAdmin).toBe(false)
    expect(row.emailVerified).toBe(false)
  })

  it('findById returns the row or undefined', async () => {
    const created = await userRepository.create({ name: 'bob', email: uniqueEmail() })

    await expect(userRepository.findById(created.id)).resolves.toMatchObject({ id: created.id })
    await expect(userRepository.findById(MISSING_ID)).resolves.toBeUndefined()
  })

  it('getByIdOrThrow throws 404 naming the table and id', async () => {
    const created = await userRepository.create({ name: 'carol', email: uniqueEmail() })
    await expect(userRepository.getByIdOrThrow(created.id)).resolves.toMatchObject({
      id: created.id,
    })

    const error = await captureError(userRepository.getByIdOrThrow(MISSING_ID))
    expect(error).toBeInstanceOf(NotFoundException)
    expect(error.status).toBe(404)
    expect(error.message).toContain('users')
    expect(error.message).toContain(MISSING_ID)
  })

  it('update applies the patch and throws 404 for a missing id', async () => {
    const created = await userRepository.create({
      name: 'original',
      email: uniqueEmail(),
      isAdmin: false,
    })

    const updated = await userRepository.update(created.id, { isAdmin: true, name: 'renamed' })
    expect(updated.isAdmin).toBe(true)
    expect(updated.name).toBe('renamed')

    const error = await captureError(userRepository.update(MISSING_ID, { isAdmin: true }))
    expect(error.status).toBe(404)
  })

  it('delete removes and returns the row, throwing 404 otherwise', async () => {
    const created = await userRepository.create({ name: 'gone', email: uniqueEmail() })

    const deleted = await userRepository.delete(created.id)
    expect(deleted.id).toBe(created.id)
    await expect(userRepository.findById(created.id)).resolves.toBeUndefined()

    const error = await captureError(userRepository.delete(created.id))
    expect(error.status).toBe(404)
  })
})
