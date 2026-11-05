import { nonEmptyStringSchema, passwordSchema } from '@docgraph/common/schemas'
import { z } from 'zod'

const adminSeedSchema = z.object({
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: passwordSchema.optional(),
})

const smtpSchema = z
  .object({
    SMTP_HOST: nonEmptyStringSchema,
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: nonEmptyStringSchema,
    SMTP_PASSWORD: nonEmptyStringSchema,
    SMTP_TLS: z.literal(['true', 'false']).transform((value) => value === 'true'),
    SMTP_FROM: z.email(),
  })
  .transform((env) => ({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_TLS,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    from: env.SMTP_FROM,
  }))

const SMTP_KEYS = smtpSchema.in.keyof().options

const dbSchema = z
  .object({
    DB_USER: nonEmptyStringSchema.default('docgraph'),
    DB_PASSWORD: nonEmptyStringSchema.default('docgraph'),
    DB_HOST: nonEmptyStringSchema.default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: nonEmptyStringSchema.default('docgraph'),
    // `no-verify` encrypts without checking the server certificate, for hosts with a private CA
    DB_SSL: z.literal(['true', 'false', 'no-verify']).default('false'),
    DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  })
  .transform((env) => ({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'false' ? false : { rejectUnauthorized: env.DB_SSL === 'true' },
    max: env.DB_POOL_MAX,
  }))

const envSchema = z.object({
  /** Signs the session cookies and encrypts Better Auth's secrets. */
  BETTER_AUTH_SECRET: nonEmptyStringSchema.min(32),
  APP_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: nonEmptyStringSchema.default('localhost'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warning', 'error', 'fatal']).default('info'),
  // `json` emits one JSON object per line for log aggregators (Loki, Datadog, ...)
  LOG_FORMAT: z.enum(['text', 'json']).default('text'),
})

export const config = {
  ...envSchema.parse(process.env),
  // Any SMTP_* var opts into sending emails, so a partial setup fails at startup
  // instead of silently falling back to logging emails (see `mailer`)
  smtp: SMTP_KEYS.some((key) => process.env[key]) ? smtpSchema.parse(process.env) : null,
  adminSeed: adminSeedSchema.parse(process.env),
  db: dbSchema.parse(process.env),
}
