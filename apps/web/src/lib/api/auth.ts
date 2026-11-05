import { apiKeyClient } from '@better-auth/api-key/client'
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { NetworkError } from './errors'

/**
 * Client of `/api/auth`, used only by `use-auth.ts` and `use-api-keys.ts`. Every call passes
 * `throw: true`, so failures reach TanStack Query as errors `errors.ts` understands. A `fetch`
 * `TypeError` (no response) is rethrown as `NetworkError` to tell it apart from bugs.
 */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [
    emailOTPClient(),
    apiKeyClient(),
    inferAdditionalFields({
      user: {
        isAdmin: {
          type: 'boolean',
        },
      },
    }),
  ],
  sessionOptions: {
    refetchInterval: 30,
    refetchOnWindowFocus: true,
  },
  fetchOptions: {
    throw: true,
    customFetchImpl: async (input, init) => {
      try {
        return await fetch(input, init)
      } catch (error) {
        if (error instanceof TypeError) throw new NetworkError(error.message, { cause: error })
        throw error
      }
    },
  },
})
