import * as argon2 from 'argon2'
import { and, eq, sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { migrate } from 'drizzle-orm/pg-core/async/session'
import { config } from '../config'
import { ARGON_OPTIONS } from '../lib/password'
import { log } from '../logger'
import { MIGRATIONS_DIR } from '../paths'
import { db } from './client'
import * as schema from './schema'

const logger = log('db')

// Arbitrary app-wide key for `pg_advisory_xact_lock`. drizzle's migrator takes no lock, so
// instances starting at the same time would both run the pending migrations: the second one
// now waits for the first to commit and then finds nothing left to apply.
const MIGRATIONS_LOCK_KEY = 4_217_390_651

/**
 * Applies the migrations from `MIGRATIONS_DIR` not yet recorded in `drizzle.__drizzle_migrations`,
 * in one transaction: all or none.
 */
export const runMigrations = async () => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MIGRATIONS_LOCK_KEY})`)
    await migrate(readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR }), tx, {
      migrationsFolder: MIGRATIONS_DIR,
    })
  })
  logger.info('All migrations complete')
}

/**
 * Makes sure an admin exists. With none left (e.g. the last admins demoted or deleted each other
 * in concurrent requests), `ADMIN_EMAIL` is upserted: created if missing, promoted back otherwise.
 * A password is set only when the account has none, so an existing user keeps theirs.
 */
export const seedAdmin = async () => {
  const [admin] = await db.select().from(schema.users).where(eq(schema.users.isAdmin, true))
  if (admin) return

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = config.adminSeed
  if (!ADMIN_EMAIL) throw new Error('No admin email provided')
  // Better Auth lowercases emails before every lookup.
  const email = ADMIN_EMAIL.toLowerCase()

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email, name: email.split('@')[0], isAdmin: true, emailVerified: true })
      .onConflictDoUpdate({ target: schema.users.email, set: { isAdmin: true } })
      .returning()
    if (!user) throw new Error('Failed to create the admin')
    if (!ADMIN_PASSWORD) return

    const [credential] = await tx
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.providerId, 'credential')))
    if (credential) return
    // The same shape Better Auth stores for an email & password account.
    await tx.insert(schema.accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: await argon2.hash(ADMIN_PASSWORD, ARGON_OPTIONS),
    })
  })

  logger.info(`Ensured admin ${email}`)
}

export const initDb = async () => {
  await runMigrations()
  await seedAdmin()
}
