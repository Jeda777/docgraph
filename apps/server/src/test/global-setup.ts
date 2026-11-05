import { PostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

/** Where the throwaway PostgreSQL listens; every test file creates its own database there. */
export type TestPostgres = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

// Declaration merging is the only way to type `inject`, so this one has to be an interface.
declare module 'vitest' {
  export interface ProvidedContext {
    postgres: TestPostgres
  }
}

/**
 * Starts one PostgreSQL container for the whole run (same image as the e2e suite and production).
 * Durability is switched off and the data lives in tmpfs: nothing outlives the run anyway.
 * Returns the teardown.
 */
// biome-ignore lint/style/noDefaultExport: Vitest global setup
export default async function globalSetup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:18.6')
    .withDatabase('docgraph_test')
    .withUsername('docgraph')
    .withPassword('docgraph')
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .withCommand([
      'postgres',
      '-c',
      'fsync=off',
      '-c',
      'synchronous_commit=off',
      '-c',
      'full_page_writes=off',
      '-c',
      'max_connections=300',
    ])
    .start()

  project.provide('postgres', {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  })

  return async () => {
    await container.stop()
  }
}
