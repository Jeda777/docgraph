import { z } from 'zod'

/** Shown for failures without a more specific reason, by both the server and the web. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again later.'

/**
 * Machine-readable error codes. Clients branch on these and pick the text they show from them;
 * `message` describes what happened for logs, API clients and MCP agents, and may change.
 * Generic codes mirror the HTTP status; specific ones name a case a client handles on its own
 * (e.g. highlighting the password field).
 */
export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'TOO_MANY_REQUESTS',
  'HTTP_ERROR',
  'INTERNAL_SERVER_ERROR',
  'EMAIL_DELIVERY_FAILED',
  'INVALID_CREDENTIALS',
  'INVALID_OTP',
  'OTP_ATTEMPTS_EXCEEDED',
  'INVALID_PASSWORD',
  'USER_ALREADY_EXISTS',
] as const

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** One failed check of a request validation; `path` is dot-separated, e.g. `memberIds.0`. */
export const apiErrorIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
})
export type ApiErrorIssue = z.infer<typeof apiErrorIssueSchema>

/** Body of every non-2xx response of the REST API. */
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  issues: z.array(apiErrorIssueSchema).optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>
