import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// biome-ignore lint/style/noDefaultExport: vite config
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      execArgv: ['--no-experimental-webstorage'],
      setupFiles: ['./vitest.setup.ts'],
      pool: 'vmThreads',
    },
  }),
)
