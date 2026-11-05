import { and, eq, sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config'
import { userRepository } from '../modules/user/repo'
import { MIGRATIONS_DIR } from '../paths'
import { createUser, migrateTestDb, resetTestDb, setUserPassword } from '../test/db'
import { db } from './client'
import { runMigrations, seedAdmin } from './init'
import { accounts, users } from './schema'

const credentialsOf = (userId: string) =>
  db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
  config.adminSeed.ADMIN_EMAIL = 'Root@Test.local'
  config.adminSeed.ADMIN_PASSWORD = 'seed-password-123'
})

afterEach(() => {
  config.adminSeed.ADMIN_EMAIL = undefined
  config.adminSeed.ADMIN_PASSWORD = undefined
})

describe('seedAdmin', () => {
  it('creates the admin with a password when nobody exists', async () => {
    await seedAdmin()

    const [user] = await db.select().from(users)
    expect(user).toMatchObject({ email: 'root@test.local', isAdmin: true, emailVerified: true })
    expect(await credentialsOf(user?.id ?? '')).toHaveLength(1)
  })

  it('leaves the users alone while an admin exists', async () => {
    const admin = await createUser({ isAdmin: true })

    await seedAdmin()

    expect((await db.select().from(users)).map((user) => user.id)).toEqual([admin.id])
  })

  it('promotes the seed user back when no admin is left, keeping their password', async () => {
    const demoted = await createUser({ email: 'root@test.local', isAdmin: false })
    await setUserPassword(demoted.id, 'their-own-password')
    const before = await credentialsOf(demoted.id)

    await seedAdmin()

    expect(await userRepository.findById(demoted.id)).toMatchObject({ isAdmin: true })
    expect(before).toHaveLength(1)
    expect(await credentialsOf(demoted.id)).toEqual(before)
  })
})

describe('runMigrations', () => {
  it('applies every migration once when two instances start at the same time', async () => {
    // Back to an empty database: only a fresh one has migrations left to race on.
    await db.execute(sql`drop schema drizzle cascade`)
    await db.execute(sql`drop schema public cascade`)
    await db.execute(sql`create schema public`)

    await Promise.all([runMigrations(), runMigrations()])

    const { rows } = await db.execute<{ name: string }>(
      sql`select name from drizzle.__drizzle_migrations order by id`,
    )
    const local = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR })
    expect(rows.map((row) => row.name)).toEqual(local.map((migration) => migration.name))
  })

  it('skips the migrations already applied', async () => {
    await runMigrations()

    const { rows } = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    )
    const local = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR })
    expect(rows[0]?.count).toBe(local.length)
  })
})
