import { join } from 'node:path'

/**
 * Settings shared by the Playwright config, the global setup and the specs. PostgreSQL and Mailpit
 * run in throwaway containers on random ports (`global-setup.ts`), so the suite never touches the
 * development database or inbox.
 */
export const E2E_PORT = 3100
export const BASE_URL = `http://localhost:${E2E_PORT}`

/** Seeded on the first server start; only valid against the throwaway e2e database. */
export const ADMIN_EMAIL = 'admin@e2e.test'
export const ADMIN_PASSWORD = 'E2e-test-passw0rd'

/** Signed-in browser state written by `auth.setup.ts` and reused by the other specs. */
export const ADMIN_STORAGE_STATE = join(import.meta.dirname, '.auth/admin.json')

/** Set by the global setup; workers inherit it from the main Playwright process. */
const MAILPIT_URL_ENV = 'E2E_MAILPIT_URL'

export const setMailpitUrl = (url: string) => {
  process.env[MAILPIT_URL_ENV] = url
}

export const getMailpitUrl = () => {
  const url = process.env[MAILPIT_URL_ENV]
  if (!url) throw new Error(`${MAILPIT_URL_ENV} is not set — run the suite through Playwright`)
  return url
}

export type ContainerEndpoints = {
  db: { host: string; port: number; user: string; password: string; database: string }
  smtp: { host: string; port: number }
}

/** Environment of the production server bundle (`apps/server/dist`) started for the suite. */
export const createServerEnv = ({ db, smtp }: ContainerEndpoints): Record<string, string> => ({
  APP_URL: BASE_URL,
  PORT: String(E2E_PORT),
  HOST: 'localhost',
  LOG_LEVEL: 'warning',
  BETTER_AUTH_SECRET: 'e2e-secret-used-only-by-the-playwright-suite',
  DB_HOST: db.host,
  DB_PORT: String(db.port),
  DB_USER: db.user,
  DB_PASSWORD: db.password,
  DB_NAME: db.database,
  DB_SSL: 'false',
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  SMTP_HOST: smtp.host,
  SMTP_PORT: String(smtp.port),
  SMTP_USER: 'e2e',
  SMTP_PASSWORD: 'e2e',
  SMTP_TLS: 'false',
  SMTP_FROM: 'no-reply@e2e.test',
})
