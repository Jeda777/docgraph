import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: vitest requires a default export from its config file
export default defineConfig({
  test: {
    // Starts the PostgreSQL container (Docker) shared by all test files
    globalSetup: ['./src/test/global-setup.ts'],
    // Creates the file's own database and sets the env vars before any module imports `config`
    setupFiles: ['./src/test/setup.ts'],
    execArgv: ['--no-experimental-webstorage'],
    pool: 'vmThreads',
  },
})
