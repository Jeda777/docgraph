import { boolean, text, timestamp } from 'drizzle-orm/pg-core'
import { ulid } from 'ulid'

/** ULID primary key; Better Auth generates its ids the same way (`advanced.database.generateId`). */
export const id = text('id')
  .primaryKey()
  .$default(() => ulid())

export const timestampTz = (name: string) => timestamp(name, { mode: 'date', withTimezone: true })

export const createdAt = timestampTz('created_at').notNull().defaultNow()

export const updatedAt = timestampTz('updated_at')
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

/** Archived rows stay readable but refuse every edit; deleting removes the row for good. */
export const isArchived = boolean('is_archived').notNull().default(false)
