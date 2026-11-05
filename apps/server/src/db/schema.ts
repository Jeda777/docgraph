import { ITEM_TYPES } from '@docgraph/common/schemas'
import { defineRelations, type InferSelectModel } from 'drizzle-orm'
import {
  bigint,
  boolean,
  bytea,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  varchar,
} from 'drizzle-orm/pg-core'
import { createdAt, id, isArchived, timestampTz, updatedAt } from './schema-helpers'

export const users = pgTable('users', {
  id: id,
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: createdAt,
  updatedAt: updatedAt,
})
export type User = InferSelectModel<typeof users>

export const sessions = pgTable(
  'sessions',
  {
    id: id,
    expiresAt: timestampTz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt,
    updatedAt: updatedAt,
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_userId_idx').on(table.userId)],
)

export const accounts = pgTable(
  'accounts',
  {
    id: id,
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestampTz('access_token_expires_at'),
    refreshTokenExpiresAt: timestampTz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => [index('accounts_userId_idx').on(table.userId)],
)

export const verifications = pgTable(
  'verifications',
  {
    id: id,
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
)

export const projects = pgTable('projects', {
  id: id,
  name: varchar('name', { length: 255 }).notNull(),
  isForAllUsers: boolean('is_for_all_users').notNull().default(false),

  createdAt: createdAt,
  updatedAt: updatedAt,
  isArchived: isArchived,
})
export type Project = InferSelectModel<typeof projects>
export type ProjectUpdate = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>

export const items = pgTable(
  'items',
  {
    id: id,
    name: varchar('name', { length: 255 }).notNull(),
    type: text('type', { enum: ITEM_TYPES }).notNull(),
    document: bytea('document'),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    createdAt: createdAt,
    updatedAt: updatedAt,
    isArchived: isArchived,
  },
  // Items are listed per project (`findAllByProjectId`) and cascade-deleted with it.
  (t) => [index('items_project_id_idx').on(t.projectId)],
)
export type Item = InferSelectModel<typeof items>
export type ItemUpdate = Partial<Omit<Item, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>

export const projectsToUsers = pgTable(
  'projects_to_users',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  // The primary key starts with project_id, so it can't serve lookups by user (a user's projects).
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index('projects_to_users_user_id_idx').on(t.userId),
  ],
)

/**
 * Personal API keys for non-browser clients (MCP), owned by Better Auth's API key plugin
 * (`modules/auth/better-auth.ts`), which stores only the SHA-256 hash in `key`.
 * Property names must match the plugin's field names.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: id,
    configId: text('config_id').notNull().default('default'),
    name: text('name'),
    start: text('start'),
    prefix: text('prefix'),
    key: text('key').notNull().unique(),
    referenceId: text('reference_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refillInterval: bigint('refill_interval', { mode: 'number' }),
    refillAmount: integer('refill_amount'),
    lastRefillAt: timestampTz('last_refill_at'),
    enabled: boolean('enabled').notNull().default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(true),
    rateLimitTimeWindow: bigint('rate_limit_time_window', { mode: 'number' }),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').notNull().default(0),
    remaining: integer('remaining'),
    lastRequest: timestampTz('last_request'),
    expiresAt: timestampTz('expires_at'),
    permissions: text('permissions'),
    metadata: text('metadata'),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (t) => [
    index('api_keys_reference_id_idx').on(t.referenceId),
    index('api_keys_config_id_idx').on(t.configId),
  ],
)

export const relations = defineRelations(
  { users, projects, items, projectsToUsers, sessions, accounts },
  (r) => ({
    users: {
      projects: r.many.projects({
        from: r.users.id.through(r.projectsToUsers.userId),
        to: r.projects.id.through(r.projectsToUsers.projectId),
      }),
      sessions: r.many.sessions(),
      accounts: r.many.accounts(),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
      }),
    },
    accounts: {
      user: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
      }),
    },
    projects: {
      users: r.many.users(),
      items: r.many.items(),
    },
    items: {
      project: r.one.projects({
        from: r.items.projectId,
        to: r.projects.id,
      }),
    },
  }),
)
