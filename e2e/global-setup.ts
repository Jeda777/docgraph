import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { join } from 'node:path'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer, Wait } from 'testcontainers'
import { BASE_URL, createServerEnv, setMailpitUrl } from './env'

const SERVER_DIR = join(import.meta.dirname, '../apps/server')
const SERVER_START_TIMEOUT_MS = 60_000

const MAILPIT_HTTP_PORT = 8025
const MAILPIT_SMTP_PORT = 1025

const isServerUp = async () => {
  try {
    return (await fetch(`${BASE_URL}/health`)).ok
  } catch {
    return false
  }
}

const waitForServer = async (server: ChildProcess) => {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The e2e server exited with code ${server.exitCode} before it was ready`)
    }
    if (await isServerUp()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`The e2e server did not answer ${BASE_URL}/health within 60 s`)
}

const stopServer = async (server: ChildProcess) => {
  if (server.exitCode !== null) return
  const exited = once(server, 'exit')
  server.kill()
  await exited
}

/**
 * Starts a throwaway PostgreSQL and Mailpit, then the production server bundle against them.
 * Playwright starts `webServer` before the global setup, so the server is spawned here instead —
 * only now are the containers' random ports known. Returns the teardown.
 */
// biome-ignore lint/style/noDefaultExport: Playwright global setup
export default async function globalSetup() {
  // A server left over on the port would silently run the suite against the wrong database
  if (await isServerUp()) {
    throw new Error(`${BASE_URL} is already in use — stop the server running there first`)
  }

  const [postgres, mailpit] = await Promise.all([
    new PostgreSqlContainer('postgres:18.6')
      .withDatabase('docgraph_e2e')
      .withUsername('docgraph')
      .withPassword('docgraph')
      .withTmpFs({ '/var/lib/postgresql': 'rw' })
      .start(),
    new GenericContainer('axllent/mailpit')
      .withEnvironment({ MP_SMTP_AUTH_ACCEPT_ANY: '1', MP_SMTP_AUTH_ALLOW_INSECURE: '1' })
      .withExposedPorts(MAILPIT_HTTP_PORT, MAILPIT_SMTP_PORT)
      .withWaitStrategy(Wait.forHttp('/api/v1/info', MAILPIT_HTTP_PORT))
      .start(),
  ])

  setMailpitUrl(`http://${mailpit.getHost()}:${mailpit.getMappedPort(MAILPIT_HTTP_PORT)}`)

  const env = createServerEnv({
    db: {
      host: postgres.getHost(),
      port: postgres.getPort(),
      user: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
    },
    smtp: { host: mailpit.getHost(), port: mailpit.getMappedPort(MAILPIT_SMTP_PORT) },
  })

  // The production bundle serves both the API and the built SPA from one origin, like the
  // Docker image does — `pnpm test:e2e` builds both first.
  const server = spawn(process.execPath, ['dist/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  })

  const teardown = async () => {
    await stopServer(server)
    await Promise.all([postgres.stop(), mailpit.stop()])
  }

  try {
    await waitForServer(server)
  } catch (error) {
    await teardown()
    throw error
  }

  return teardown
}
