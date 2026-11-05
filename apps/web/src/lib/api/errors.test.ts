import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  GENERIC_ERROR_MESSAGE,
  getApiError,
  getErrorMessage,
  getErrorStatus,
  isApiError,
  NETWORK_ERROR_MESSAGE,
  NetworkError,
} from './errors'
import { queryClient } from './query-client'
import { apiAxiosError } from './test-utils'

const responseError = (status: number, data: unknown) =>
  new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    data,
  } as AxiosError['response'])

const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK)

describe('getApiError', () => {
  it('parses the server error body', () => {
    expect(getApiError(apiAxiosError(409, 'CONFLICT', 'Taken'))).toEqual({
      code: 'CONFLICT',
      message: 'Taken',
    })
  })

  it('parses bodies with a code unknown to this build', () => {
    const error = responseError(409, { code: 'CODE_FROM_A_NEWER_SERVER', message: 'Name taken' })

    expect(getApiError(error)?.code).toBe('CODE_FROM_A_NEWER_SERVER')
    expect(getErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE)
    expect(isApiError(error, 'CONFLICT')).toBe(false)
  })

  it('ignores bodies of another shape and non-axios errors', () => {
    expect(getApiError(responseError(502, '<html>Bad gateway</html>'))).toBeUndefined()
    expect(getApiError(networkError())).toBeUndefined()
    expect(getApiError(new Error('boom'))).toBeUndefined()
  })
})

describe('isApiError', () => {
  it('matches any of the given codes', () => {
    const error = apiAxiosError(401, 'INVALID_OTP', 'Invalid code')

    expect(isApiError(error, 'INVALID_OTP')).toBe(true)
    expect(isApiError(error, 'INVALID_CREDENTIALS', 'INVALID_OTP')).toBe(true)
    expect(isApiError(error, 'UNAUTHORIZED')).toBe(false)
    expect(isApiError(new Error('boom'), 'UNAUTHORIZED')).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('shows the text defined for the code, never the server message', () => {
    const error = apiAxiosError(500, 'EMAIL_DELIVERY_FAILED', 'SMTP timeout at mail.internal')

    expect(getErrorMessage(error)).toBe("We couldn't send the email. Please try again later.")
  })

  it('hides validation details behind one message', () => {
    const error = responseError(400, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid request data',
      issues: [{ path: 'name', message: 'Invalid input: expected string' }],
    })

    expect(getErrorMessage(error)).toBe('Some of the data is invalid. Check it and try again.')
  })

  it('uses the generic message for codes without a text of their own', () => {
    expect(getErrorMessage(apiAxiosError(409, 'CONFLICT', 'Name taken'))).toBe(
      GENERIC_ERROR_MESSAGE,
    )
    expect(getErrorMessage(apiAxiosError(500, 'INTERNAL_SERVER_ERROR', 'DB down'))).toBe(
      GENERIC_ERROR_MESSAGE,
    )
  })

  it('explains network failures and falls back for anything else', () => {
    expect(getErrorMessage(networkError())).toBe(NETWORK_ERROR_MESSAGE)
    expect(getErrorMessage(new Error('boom'))).toBe(GENERIC_ERROR_MESSAGE)
    expect(getErrorMessage(responseError(502, 'Bad gateway'))).toBe(GENERIC_ERROR_MESSAGE)
  })
})

describe('getErrorStatus', () => {
  it('reads the response status', () => {
    expect(getErrorStatus(responseError(403, null))).toBe(403)
    expect(getErrorStatus(networkError())).toBeUndefined()
  })
})

describe('query retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown,
  ) => boolean

  it('never retries client errors', () => {
    expect(retry(0, responseError(404, null))).toBe(false)
    expect(retry(0, responseError(401, null))).toBe(false)
  })

  it('retries timeouts, rate limits, server and network errors up to three times', () => {
    expect(retry(0, responseError(408, null))).toBe(true)
    expect(retry(0, responseError(429, null))).toBe(true)
    expect(retry(0, responseError(503, null))).toBe(true)
    expect(retry(2, networkError())).toBe(true)
    expect(retry(3, networkError())).toBe(false)
  })
})

/** Shape of the `BetterFetchError` the Better Auth client throws for a failed response. */
const authClientError = (status: number, body: unknown) =>
  Object.assign(new Error('Unauthorized'), { status, statusText: 'Unauthorized', error: body })

describe('errors of the Better Auth client', () => {
  it('reads the code and status from the error body', () => {
    const error = authClientError(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid' })

    expect(isApiError(error, 'INVALID_CREDENTIALS')).toBe(true)
    expect(getErrorStatus(error)).toBe(401)
    expect(getErrorMessage(error)).toBe('Invalid email or password. Please try again.')
  })

  it('reports failed fetches as network errors', () => {
    expect(getErrorMessage(new NetworkError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('does not mistake other TypeErrors for network failures', () => {
    expect(
      getErrorMessage(new TypeError("Cannot read properties of undefined (reading 'id')")),
    ).toBe(GENERIC_ERROR_MESSAGE)
  })
})
