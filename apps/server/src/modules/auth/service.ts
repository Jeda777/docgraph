import { API_ERROR_CODES, type ApiErrorCode } from '@docgraph/common/schemas'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { User } from '../../db'
import {
  ApiException,
  InternalServerErrorException,
  keepNonBodyHeaders,
  UnauthorizedException,
} from '../../errors'
import { userRepository } from '../user/repo'
import { auth } from './better-auth'
import { trackEmailDelivery } from './otp-email'

/** Better Auth's own error codes the web reacts to, translated to the codes of `ApiError`. */
const AUTH_ERRORS: Partial<Record<string, { status: ContentfulStatusCode; code: ApiErrorCode }>> = {
  INVALID_EMAIL_OR_PASSWORD: { status: 401, code: 'INVALID_CREDENTIALS' },
  INVALID_OTP: { status: 401, code: 'INVALID_OTP' },
  OTP_EXPIRED: { status: 401, code: 'INVALID_OTP' },
  // The code is burned after too many wrong tries; only a new one helps, so the web says so.
  TOO_MANY_ATTEMPTS: { status: 401, code: 'OTP_ATTEMPTS_EXCEEDED' },
  INVALID_PASSWORD: { status: 400, code: 'INVALID_PASSWORD' },
}

const isApiErrorCode = (code: unknown): code is ApiErrorCode =>
  (API_ERROR_CODES as readonly unknown[]).includes(code)

type AuthErrorBody = { code?: unknown; message?: unknown }

/**
 * Turns a failed Better Auth response into an `ApiException`, so `/api/auth/*` answers with the
 * same `ApiError` body as the rest of the API. Headers such as `Set-Cookie` or `X-Retry-After`
 * are kept.
 */
const authErrorToApiException = async (res: Response): Promise<ApiException> => {
  const body = (await res.json().catch(() => undefined)) as AuthErrorBody | undefined
  const headers = keepNonBodyHeaders(res)

  const known = typeof body?.code === 'string' ? AUTH_ERRORS[body.code] : undefined
  // Codes of our own, thrown from `better-auth.ts` hooks (e.g. VALIDATION_FAILED).
  const ownCode = isApiErrorCode(body?.code) ? body.code : undefined
  const status = known?.status ?? (res.status as ContentfulStatusCode)
  // 5xx messages come from code we don't own and may reveal internals.
  const message = status < 500 && typeof body?.message === 'string' ? body.message : undefined

  return new ApiException(status, { code: known?.code ?? ownCode, message, headers })
}

/**
 * Runs a `/api/auth/*` request through Better Auth; a failed response is thrown as an
 * `ApiException`.
 */
export const handleAuthRequest = async (request: Request) => {
  const { result: res, deliveryFailed } = await trackEmailDelivery(() => auth.handler(request))
  if (deliveryFailed) throw new InternalServerErrorException('EMAIL_DELIVERY_FAILED')
  if (res.status >= 400) throw await authErrorToApiException(res)
  return res
}

const INVALID_SESSION_MESSAGE = 'Invalid or expired session'

type SessionUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>['user']

const toUser = (user: SessionUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  image: user.image ?? null,
  isAdmin: user.isAdmin ?? false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

/** The session of the session cookie among the request headers, with its user. */
export const getSessionFromHeaders = async (
  headers: Headers,
): Promise<{ sessionId: string; sessionExpiresAt: Date; user: User }> => {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new UnauthorizedException('UNAUTHORIZED', INVALID_SESSION_MESSAGE)

  const { user } = session
  return {
    sessionId: session.session.id,
    sessionExpiresAt: session.session.expiresAt,
    user: toUser(user),
  }
}

/** The user of the session cookie among the request headers. */
export const getUserFromHeaders = async (headers: Headers): Promise<User> =>
  (await getSessionFromHeaders(headers)).user

const INVALID_API_KEY_MESSAGE = 'Invalid API key'

/**
 * The owner of a personal API key. Better Auth checks the hash, `enabled` and expiry, and records
 * the use in `lastRequest`.
 */
export const getUserFromApiKey = async (key?: string): Promise<User> => {
  if (!key) throw new UnauthorizedException('UNAUTHORIZED', INVALID_API_KEY_MESSAGE)

  const result = await auth.api.verifyApiKey({ body: { key } })
  if (!result.valid || !result.key) {
    throw new UnauthorizedException('UNAUTHORIZED', INVALID_API_KEY_MESSAGE)
  }

  const user = await userRepository.findById(result.key.referenceId)
  if (!user) throw new UnauthorizedException('UNAUTHORIZED', INVALID_API_KEY_MESSAGE)

  return user
}
