import 'zod/compile'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, inject, vi } from 'vitest'

// Environment for the whole test run. This file is registered as a Vitest
// setup file, so it runs before any module imports `config`, which parses
// process.env at load time.
// Always overwrite: ambient env vars (e.g. a developer's real DB_* settings)
// must never leak into the test run — resetTestDb() wipes everything.
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-at-least-32-chars'
process.env.APP_URL = 'http://localhost:5173'
process.env.SMTP_HOST = 'localhost'
process.env.SMTP_PORT = '3025'
process.env.SMTP_USER = 'test-user'
process.env.SMTP_PASSWORD = 'test-password'
process.env.SMTP_TLS = 'false'
process.env.SMTP_FROM = 'noreply@test.local'

// Every test file gets its own empty database in the PostgreSQL container started by
// `global-setup.ts`, so files run in parallel without seeing each other's rows or locks.
const postgres = inject('postgres')
const database = `test_${randomUUID().replaceAll('-', '')}`

const withAdminClient = async (query: string) => {
  const client = new Client({ ...postgres })
  await client.connect()
  try {
    await client.query(query)
  } finally {
    await client.end()
  }
}

await withAdminClient(`create database "${database}"`)

process.env.DB_HOST = postgres.host
process.env.DB_PORT = String(postgres.port)
process.env.DB_USER = postgres.user
process.env.DB_PASSWORD = postgres.password
process.env.DB_NAME = database
process.env.DB_SSL = 'false'
// Enough for the concurrency tests, small enough for many files in parallel.
process.env.DB_POOL_MAX = '5'

// Collects the pool of every copy of the client the file loads (`vi.resetModules` makes new ones),
// so all of them are closed before the database is dropped.
const { poolClosers } = vi.hoisted(() => ({ poolClosers: [] as Array<() => Promise<void>> }))

vi.mock('../db/client', async (importOriginal) => {
  const client = await importOriginal<typeof import('../db/client')>()
  poolClosers.push(client.closeDb)
  return client
})

afterAll(async () => {
  await Promise.all(poolClosers.map((close) => close()))
  await withAdminClient(`drop database "${database}" with (force)`)
})
