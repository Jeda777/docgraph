import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { API_KEY_NAME_MAX_LENGTH, OTP_CODE_LENGTH, passwordSchema } from '@docgraph/common/schemas'
import * as argon2 from 'argon2'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins'
import { ulid } from 'ulid'
import { config } from '../../config'
import { db, schema } from '../../db'
import { ARGON_OPTIONS } from '../../lib/password'
import { OTP_VALID_MINUTES, sendOtpEmail } from './otp-email'
import { notifySessionEnded } from './session-events'

/** Prefix that makes leaked keys easy to recognize (and to grep for). */
export const API_KEY_PREFIX = 'dg_'

/**
 * Endpoints that set a password, with the body field carrying it; Better Auth itself only checks
 * its length.
 */
const PASSWORD_FIELDS: Partial<Record<string, string>> = {
  '/email-otp/reset-password': 'password',
  '/change-password': 'newPassword',
}

/**
 * Owns sessions, password and email-code login, password reset and the API keys MCP clients
 * send in the `x-api-key` header. Mounted under `/api/auth`
 * by `routes.ts`; sign-up is disabled everywhere — admins invite users instead.
 */
export const auth = betterAuth({
  baseURL: config.APP_URL,
  basePath: '/api/auth',
  secret: config.BETTER_AUTH_SECRET,
  trustedOrigins: [new URL(config.APP_URL).origin],
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  user: {
    additionalFields: {
      isAdmin: { type: 'boolean', required: false, defaultValue: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: async (password) => argon2.hash(password, ARGON_OPTIONS),
      verify: async ({ hash, password }) => argon2.verify(hash, password),
    },
  },
  plugins: [
    emailOTP({
      disableSignUp: true,
      otpLength: OTP_CODE_LENGTH,
      expiresIn: OTP_VALID_MINUTES * 60,
      storeOTP: 'hashed',
      sendVerificationOTP: sendOtpEmail,
    }),
    apiKey({
      defaultPrefix: API_KEY_PREFIX,
      requireName: true,
      maximumNameLength: API_KEY_NAME_MAX_LENGTH,
      // Agents call MCP tools in bursts; the plugin's default is 10 requests a day.
      rateLimit: { enabled: false },
      // `usePlural` makes the adapter look up `apiKeys` in the Drizzle schema.
      schema: { apikey: { modelName: 'apiKey' } },
    }),
  ],
  databaseHooks: {
    // Runs for every deleted session row, also when a whole user's sessions are revoked at once.
    session: { delete: { after: async (session) => notifySessionEnded(session.id) } },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const field = PASSWORD_FIELDS[ctx.path]
      if (!field) return
      const result = passwordSchema.safeParse(ctx.body?.[field])
      if (!result.success) {
        throw new APIError('BAD_REQUEST', {
          code: 'VALIDATION_FAILED',
          message: result.error.issues[0]?.message ?? 'Invalid password',
        })
      }
    }),
  },
  advanced: {
    // The REST API validates every id as a ULID, user ids included.
    database: { generateId: () => ulid() },
    // The session cookie is only ever sent by the app's own pages.
    defaultCookieAttributes: { sameSite: 'strict' },
  },
  // Would let users set any name or image without validation; the app has no profile editing,
  // names come from the admin's invite (`POST /api/users`).
  disabledPaths: ['/update-user'],
  telemetry: { enabled: false },
})
