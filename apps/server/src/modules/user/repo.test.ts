import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db'
import { createUser, MISSING_ID, migrateTestDb, resetTestDb } from '../../test/db'
import { userRepository } from './repo'

const OTHER_MISSING_ID = '01YYYYYYYYYYYYYYYYYYYYYYYY'

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('userRepository.findByEmail', () => {
  it('finds a user by exact email match', async () => {
    const created = await createUser({ email: 'alice@test.local' })

    await expect(userRepository.findByEmail('alice@test.local')).resolves.toMatchObject({
      id: created.id,
      name: created.name,
    })
  })

  it('returns undefined for unknown or differently-cased emails', async () => {
    await createUser({ email: 'alice@test.local' })

    await expect(userRepository.findByEmail('nobody@test.local')).resolves.toBeUndefined()
    // The lookup is case-sensitive by design (emails are stored normalized).
    await expect(userRepository.findByEmail('ALICE@TEST.LOCAL')).resolves.toBeUndefined()
  })
})

describe('userRepository.findAllSummaries', () => {
  it('returns identity fields and the role ordered by name', async () => {
    const first = await createUser({ name: 'zeta' })
    const second = await createUser({ name: 'alpha', isAdmin: true })
    await createUser({ name: 'mike', email: 'dropped@test.local' })

    const summaries = await userRepository.findAllSummaries()

    expect(summaries.map((row) => row.name)).toEqual(['alpha', 'mike', 'zeta'])
    for (const row of summaries) {
      expect(Object.keys(row).sort()).toEqual(['email', 'id', 'isAdmin', 'name'])
    }
    expect(summaries[0]).toMatchObject({ id: second.id, name: 'alpha' })
    expect(summaries.find((row) => row.id === first.id)?.name).toBe('zeta')
  })

  it('returns an empty list when there are no users', async () => {
    await expect(userRepository.findAllSummaries()).resolves.toEqual([])
  })
})

describe('userRepository.assertExists', () => {
  it('resolves when every id exists', async () => {
    const first = await createUser()
    const second = await createUser()

    await expect(userRepository.assertExists([first.id, second.id])).resolves.toBeUndefined()
  })

  it('short-circuits on an empty id list', async () => {
    await expect(userRepository.assertExists([])).resolves.toBeUndefined()
  })

  it('rejects with 404 naming only the missing ids', async () => {
    const existing = await createUser()

    await expect(
      userRepository.assertExists([existing.id, OTHER_MISSING_ID, MISSING_ID]),
    ).rejects.toMatchObject({
      status: 404,
      message: `Users with ids ${OTHER_MISSING_ID}, ${MISSING_ID} not found`,
    })
  })
})

describe('userRepository.lockAdminIds', () => {
  it('returns the admin ids in id order', async () => {
    const first = await createUser({ isAdmin: true })
    await createUser()
    const second = await createUser({ isAdmin: true })

    const ids = await db.transaction((tx) => userRepository.lockAdminIds(tx))

    expect(ids).toEqual([first.id, second.id].sort())
  })
})
