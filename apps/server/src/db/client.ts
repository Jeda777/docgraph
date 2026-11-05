import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../config'
import { log } from '../logger'
import * as schema from './schema'

const logger = log('db')

const pool = new Pool(config.db)

// An idle client that loses its connection (e.g. the database restarts) emits 'error' on the
// pool; without a listener Node treats it as unhandled and crashes the process. The pool
// already drops the broken client and opens a new one on the next query.
pool.on('error', (error) => {
  logger.error('Idle database client error: {error}', { error })
})

export const db = drizzle({
  client: pool,
  relations: schema.relations,
})

/** Closes every pooled connection; for a graceful shutdown, after the last query. */
export const closeDb = () => pool.end()

export type Database = typeof db
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export type DbOrTx = Database | Transaction
