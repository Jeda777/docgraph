import { defineConfig } from 'drizzle-kit'
import { config } from './src/config'

// `db:generate` writes SQL migrations to `drizzle/` from `src/db/schema.ts`; the server applies
// them on start with drizzle-orm's migrator (`runMigrations` in src/db/init.ts), so the runtime
// image never needs drizzle-kit.
// biome-ignore lint/style/noDefaultExport: drizzle-kit loads the config from the default export
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: config.db,
})
