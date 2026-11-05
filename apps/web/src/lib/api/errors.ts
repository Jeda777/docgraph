import { type ApiErrorCode, apiErrorSchema, GENERIC_ERROR_MESSAGE } from '@docgraph/common/schemas'
import { isAxiosError } from 'axios'
import { z } from 'zod'

export { GENERIC_ERROR_MESSAGE }
export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection.'

/**
 * A request of the Better Auth client that got no response (offline, server down). `fetch` reports
 * this as a plain `TypeError`, which our own bugs throw too, so the client's fetch rethrows it as
 * this class (`auth.ts`) and only this class counts as a network failure.
 */
export class NetworkError extends Error {
  override name = 'NetworkError'
}

/**
 * The only texts users see for API errors. The server's `message` explains what happened for
 * logs and API clients, but it is never shown: codes missing here get the generic message.
 */
const ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_FAILED: 'Some of the data is invalid. Check it and try again.',
  UNAUTHORIZED: 'Your session has expired. Log in again.',
  FORBIDDEN: "You don't have permission to do this.",
  NOT_FOUND: 'It no longer exists. Refresh the page and try again.',
  PAYLOAD_TOO_LARGE: 'The data is too large to save.',
  TOO_MANY_REQUESTS: 'Too many attempts. Wait a moment and try again.',
  EMAIL_DELIVERY_FAILED: "We couldn't send the email. Please try again later.",
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  INVALID_OTP: 'Invalid or expired verification code. Please try again.',
  OTP_ATTEMPTS_EXCEEDED: 'Too many wrong codes. Request a new code and try again.',
  INVALID_PASSWORD: 'Invalid password.',
  USER_ALREADY_EXISTS: 'User already exists.',
}

/**
 * Accepts any `code`: a server deployed ahead of an open tab may send codes this build doesn't
 * know yet, which then fall back to the generic message instead of breaking parsing.
 */
const receivedApiErrorSchema = apiErrorSchema.extend({ code: z.string() })
type ReceivedApiError = z.infer<typeof receivedApiErrorSchema>

/**
 * A failed response of the Better Auth client (`authClient`), i.e. a `BetterFetchError`: it keeps
 * the status and the parsed body. Matched by shape — `@better-fetch/fetch` is not a direct
 * dependency of the web.
 */
type AuthClientError = Error & { status: number; error: unknown }

const isAuthClientError = (error: unknown): error is AuthClientError =>
  error instanceof Error &&
  'status' in error &&
  typeof error.status === 'number' &&
  'error' in error

/** The server's error body, or `undefined` for network failures and non-API errors. */
export const getApiError = (error: unknown): ReceivedApiError | undefined => {
  let body: unknown
  if (isAxiosError(error)) body = error.response?.data
  else if (isAuthClientError(error)) body = error.error
  else return undefined
  const parsed = receivedApiErrorSchema.safeParse(body)
  return parsed.success ? parsed.data : undefined
}

/** Branch on the error `code`, never on the message text. */
export const isApiError = (error: unknown, ...codes: ApiErrorCode[]) => {
  const code = getApiError(error)?.code
  return code !== undefined && (codes as string[]).includes(code)
}

/** HTTP status of a failed request, `undefined` when no response arrived. */
export const getErrorStatus = (error: unknown) => {
  if (isAxiosError(error)) return error.response?.status
  if (isAuthClientError(error)) return error.status
  return undefined
}

const isNetworkError = (error: unknown) =>
  (isAxiosError(error) && !error.response) || error instanceof NetworkError

/** The text to show the user: the one defined for the error code, or a generic one. */
export const getErrorMessage = (error: unknown) => {
  const code = getApiError(error)?.code
  const message = code && ERROR_MESSAGES[code as ApiErrorCode]
  if (message) return message
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE
  return GENERIC_ERROR_MESSAGE
}
