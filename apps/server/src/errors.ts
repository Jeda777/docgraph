import {
  type ApiError,
  type ApiErrorCode,
  type ApiErrorIssue,
  GENERIC_ERROR_MESSAGE,
} from '@docgraph/common/schemas'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Code and default message of every status with a code of its own. */
const STATUSES: Partial<Record<number, { code: ApiErrorCode; message: string }>> = {
  400: { code: 'BAD_REQUEST', message: 'Bad request' },
  401: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
  403: { code: 'FORBIDDEN', message: 'Forbidden' },
  404: { code: 'NOT_FOUND', message: 'Not found' },
  409: { code: 'CONFLICT', message: 'Conflict' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' },
  429: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests' },
}

/** `HTTP_ERROR` for statuses without a code of their own; clients then branch on the status. */
const codeForStatus = (status: number): ApiErrorCode =>
  STATUSES[status]?.code ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR')

const messageForStatus = (status: number) =>
  STATUSES[status]?.message ?? (status >= 500 ? GENERIC_ERROR_MESSAGE : 'Request failed')

type ApiExceptionOptions = {
  code?: ApiErrorCode
  /** Details for logs, API clients and MCP agents; defaults to the status text. */
  message?: string
  issues?: ApiErrorIssue[]
  /** Extra response headers, e.g. `WWW-Authenticate` or `Retry-After`. */
  headers?: Headers
}

/**
 * Base of every error the API returns on purpose. Responds with the shared `ApiError` JSON body,
 * so clients parse one shape for all failures.
 */
export class ApiException extends HTTPException {
  readonly code: ApiErrorCode
  readonly issues?: ApiErrorIssue[]
  readonly headers?: Headers

  constructor(status: ContentfulStatusCode, options: ApiExceptionOptions = {}) {
    super(status, { message: options.message ?? messageForStatus(status) })
    this.code = options.code ?? codeForStatus(status)
    this.issues = options.issues
    this.headers = options.headers
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, ...(this.issues && { issues: this.issues }) }
  }

  override getResponse(): Response {
    return Response.json(this.toJSON(), { status: this.status, headers: this.headers })
  }
}

/** Codes each exception class accepts, so a code can't contradict its status. */
type BadRequestCode = Extract<ApiErrorCode, 'BAD_REQUEST' | 'INVALID_PASSWORD'>
type UnauthorizedCode = Extract<
  ApiErrorCode,
  'UNAUTHORIZED' | 'INVALID_CREDENTIALS' | 'INVALID_OTP' | 'OTP_ATTEMPTS_EXCEEDED'
>
type ForbiddenCode = Extract<ApiErrorCode, 'FORBIDDEN'>
type NotFoundCode = Extract<ApiErrorCode, 'NOT_FOUND'>
type ConflictCode = Extract<ApiErrorCode, 'CONFLICT' | 'USER_ALREADY_EXISTS'>
type PayloadTooLargeCode = Extract<ApiErrorCode, 'PAYLOAD_TOO_LARGE'>
type InternalServerErrorCode = Extract<
  ApiErrorCode,
  'INTERNAL_SERVER_ERROR' | 'EMAIL_DELIVERY_FAILED'
>

/*
 * Each exception takes the code first; users see the text the web defines for it. `message` is
 * optional and only worth passing when it tells more than the code, e.g. which id was missing.
 */

export class BadRequestException extends ApiException {
  constructor(code: BadRequestCode = 'BAD_REQUEST', message?: string) {
    super(400, { code, message })
  }
}

/** A request that does not match its Zod schema; `issues` lists every failed check. */
export class ValidationException extends ApiException {
  constructor(issues: ApiErrorIssue[]) {
    super(400, { code: 'VALIDATION_FAILED', message: 'Invalid request data', issues })
  }
}

export class UnauthorizedException extends ApiException {
  constructor(code: UnauthorizedCode = 'UNAUTHORIZED', message?: string) {
    super(401, { code, message })
  }
}

export class ForbiddenException extends ApiException {
  constructor(code: ForbiddenCode = 'FORBIDDEN', message?: string) {
    super(403, { code, message })
  }
}

export class NotFoundException extends ApiException {
  constructor(code: NotFoundCode = 'NOT_FOUND', message?: string) {
    super(404, { code, message })
  }
}

export class ConflictException extends ApiException {
  constructor(code: ConflictCode = 'CONFLICT', message?: string) {
    super(409, { code, message })
  }
}

export class PayloadTooLargeException extends ApiException {
  constructor(code: PayloadTooLargeCode = 'PAYLOAD_TOO_LARGE', message?: string) {
    super(413, { code, message })
  }
}

export class InternalServerErrorException extends ApiException {
  constructor(code: InternalServerErrorCode = 'INTERNAL_SERVER_ERROR', message?: string) {
    super(500, { code, message })
  }
}

/** Body headers of an original response; the `ApiError` JSON body brings its own. */
const BODY_HEADERS = new Set(['content-type', 'content-length', 'content-encoding'])

/**
 * Headers of a response that should survive when it is answered with an `ApiError` body instead
 * (e.g. `WWW-Authenticate`, `Set-Cookie`, `X-Retry-After`).
 */
export const keepNonBodyHeaders = (res: Response): Headers => {
  const headers = new Headers()
  for (const [name, value] of res.headers) {
    if (!BODY_HEADERS.has(name)) headers.append(name, value)
  }
  return headers
}

/**
 * Converts any `HTTPException` (including the plain ones Hono's own middleware throw, e.g. CSRF
 * or malformed JSON) into an `ApiException`, so it responds with the shared JSON body. Headers of
 * a custom `res` (e.g. `WWW-Authenticate`) are kept. Their 5xx messages come from code we don't
 * own and may reveal internals, so the status text replaces them.
 */
export const toApiException = (error: HTTPException): ApiException => {
  if (error instanceof ApiException) return error
  const status = error.status as ContentfulStatusCode
  const headers = error.res ? keepNonBodyHeaders(error.res) : undefined
  const message = status < 500 && error.message ? error.message : undefined
  return new ApiException(status, { message, headers })
}
