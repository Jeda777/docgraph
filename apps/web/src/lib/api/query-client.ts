import { QueryClient } from '@tanstack/react-query'
import { getErrorStatus } from './errors'

const MAX_RETRIES = 3

/** Request timeout and rate limiting are the 4xx answers that may change on the next attempt. */
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429])

/** Other client errors (4xx) answer the same on every attempt, so only those two retry. */
const shouldRetry = (failureCount: number, error: unknown) => {
  const status = getErrorStatus(error)
  const isClientError = status !== undefined && status >= 400 && status < 500
  if (isClientError && !RETRYABLE_CLIENT_STATUSES.has(status)) return false
  return failureCount < MAX_RETRIES
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
  },
})
