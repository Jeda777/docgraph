import type { ApiKeyRestrictions } from '@docgraph/common/schemas'
import * as argon2 from 'argon2'
import { makeSignature } from 'better-auth/crypto'
import { sql } from 'drizzle-orm'
import { onTestFinished } from 'vitest'
import { db, type Transaction } from '../db'
import { runMigrations } from '../db/init'
import { accounts, items, projects, projectsToUsers, users } from '../db/schema'
import { ARGON_OPTIONS } from '../lib/password'
import type { Actor } from '../modules/auth/actor'
import { auth } from '../modules/auth/better-auth'

let migrated = false
let seq = 0

/** Applies the SQL migrations to the test file's database (once per file). */
export const migrateTestDb = async () => {
  if (!migrated) {
    await runMigrations()
    migrated = true
  }
}

/** Wipes all rows between tests (the migrations history stays). */
export const resetTestDb = async () => {
  await db.execute(sql`
    truncate table api_keys, items, projects_to_users, projects, sessions, accounts,
      verifications, users cascade
  `)
}

type NewUser = typeof users.$inferInsert
type NewProject = typeof projects.$inferInsert
type NewItem = typeof items.$inferInsert

/** Inserts a user with unique defaults, returning the stored row. */
export const createUser = async (values: Partial<NewUser> = {}) => {
  const n = ++seq
  const [row] = await db
    .insert(users)
    .values({ name: `user-${n}`, email: `user-${n}@test.local`, ...values })
    .returning()
  if (!row) throw new Error('Failed to create user')
  return row
}

/** Gives a user an email & password login, the way Better Auth stores it. */
export const setUserPassword = async (userId: string, password: string) => {
  await db.insert(accounts).values({
    userId,
    accountId: userId,
    providerId: 'credential',
    password: await argon2.hash(password, ARGON_OPTIONS),
  })
}

/** Inserts a project with a unique default name, returning the stored row. */
export const createProject = async (values: Partial<NewProject> = {}) => {
  const n = ++seq
  const [row] = await db
    .insert(projects)
    .values({ name: `project-${n}`, ...values })
    .returning()
  if (!row) throw new Error('Failed to create project')
  return row
}

/** Inserts an item into a project, returning the stored row. */
export const createItem = async (projectId: string, values: Partial<NewItem> = {}) => {
  const n = ++seq
  const [row] = await db
    .insert(items)
    .values({ name: `item-${n}`, type: 'DATABASE_DIAGRAM', projectId, ...values })
    .returning()
  if (!row) throw new Error('Failed to create item')
  return row
}

/** Grants a user access to a restricted project. */
export const addMember = async (projectId: string, userId: string) => {
  await db.insert(projectsToUsers).values({ projectId, userId })
}

/** Builds an `Actor` from any user-like row. */
export const actorOf = (user: { id: string; isAdmin: boolean }): Actor => ({
  id: user.id,
  isAdmin: user.isAdmin,
})

/** A `cookie` header carrying a fresh Better Auth session of the user. */
export const sessionCookieFor = async (userId: string) => {
  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(userId)
  const signature = await makeSignature(session.token, ctx.secret)
  return { cookie: `${ctx.authCookies.sessionToken.name}=${session.token}.${signature}` }
}

/**
 * Creates a personal API key of the user through Better Auth, returning its plain value.
 * Without `restrictions` the key has the user's full access, like keys created before them.
 */
export const createApiKeyFor = async (
  userId: string,
  { name = 'agent', restrictions }: { name?: string; restrictions?: ApiKeyRestrictions } = {},
) => {
  const { key } = await auth.api.createApiKey({ body: { name, userId, metadata: restrictions } })
  return key
}

/** A ULID no row has, for "not found" cases. */
export const MISSING_ID = '01ZZZZZZZZZZZZZZZZZZZZZZZZ'

/** A transaction left open until `commit`, to hold row locks while other queries run. */
export type OpenTransaction = { tx: Transaction; commit: () => Promise<void> }

/** Thrown inside an open transaction to roll it back; never escapes `openTransaction`. */
class RollbackSignal extends Error {}

/**
 * Opens a transaction on its own pooled connection and keeps it open; `commit` ends it. Use it to
 * play a concurrent request that has taken its locks but not committed yet. Call it inside a test:
 * a transaction still open when the test ends (it failed before `commit`) is rolled back, so its
 * locks and connection don't hang the next test or the pool shutdown.
 */
export const openTransaction = async (): Promise<OpenTransaction> => {
  let release = (_outcome: 'commit' | 'rollback') => {}
  const released = new Promise<'commit' | 'rollback'>((resolve) => {
    release = resolve
  })
  let open = (_tx: Transaction) => {}
  const opened = new Promise<Transaction>((resolve) => {
    open = resolve
  })
  const finished = db
    .transaction(async (tx) => {
      open(tx)
      if ((await released) === 'rollback') throw new RollbackSignal()
    })
    .catch((error) => {
      if (!(error instanceof RollbackSignal)) throw error
    })
  const tx = await Promise.race([
    opened,
    finished.then(() => {
      throw new Error('The transaction ended before it was opened')
    }),
  ])
  onTestFinished(async () => {
    release('rollback')
    await finished.catch(() => {})
  })
  return {
    tx,
    commit: async () => {
      release('commit')
      await finished
    },
  }
}

// Below the 5 s test timeout, so a lock that never blocks fails with this message.
const LOCK_WAIT_TIMEOUT_MS = 2_000

/**
 * Resolves once `count` queries of this file's database are blocked on a lock, proving that the
 * code under test really waits instead of reading past an uncommitted change.
 */
export const waitForLockWaits = async (count = 1) => {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const { rows } = await db.execute<{ waiting: number }>(sql`
      select count(*)::int as waiting from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
    `)
    if ((rows[0]?.waiting ?? 0) >= count) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Expected ${count} queries waiting on a lock within ${LOCK_WAIT_TIMEOUT_MS} ms`)
}
