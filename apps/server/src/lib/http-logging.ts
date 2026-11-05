import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { InternalServerErrorException, NotFoundException, toApiException } from '../errors'
import { log } from '../logger'

const logger = log('http')

/** Logs one line per request. Only the path is logged: query strings may carry tokens. */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  await next()
  const duration = Math.round(performance.now() - start)
  logger.info('{method} {path} {status} {duration}ms', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  })
}

/**
 * Every failure leaves as the shared `ApiError` JSON body. Expected HTTP exceptions keep their
 * status and message; anything else is logged, and only 5xx `ApiException`s thrown on purpose
 * keep their message (see `toApiException`).
 */
export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException && error.status < 500) {
    return toApiException(error).getResponse()
  }
  logger.error('Unhandled error on {method} {path}: {error}', {
    method: c.req.method,
    path: c.req.path,
    error,
  })
  if (error instanceof HTTPException) {
    return toApiException(error).getResponse()
  }
  return new InternalServerErrorException().getResponse()
}

export const handleNotFound: NotFoundHandler = (c) =>
  new NotFoundException('NOT_FOUND', `Route ${c.req.method} ${c.req.path} not found`).getResponse()
