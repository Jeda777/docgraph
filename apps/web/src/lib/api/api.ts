import axios, { type AxiosError } from 'axios'
import { authClient } from './auth'

// The session lives in the HttpOnly cookie Better Auth sets, so the client never reads or
// attaches tokens itself — `withCredentials` is all it needs.

export const api = axios.create({
  baseURL: `${location.origin}/api`,
  withCredentials: true,
})

/** The sign-out in progress, shared by every request that fails with 401 meanwhile. */
let pendingSignOut: Promise<unknown> | null = null

/** Signs out once, however many parallel requests get a 401 at the same time. */
const signOutOnce = () => {
  pendingSignOut ??= authClient
    .signOut()
    // The session is already gone on the server; a failed sign-out changes nothing.
    .catch(() => undefined)
    .finally(() => {
      pendingSignOut = null
    })
  return pendingSignOut
}

/** A 401 means the session ended (expired or signed out elsewhere): signing out sends the app to /login. */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) await signOutOnce()
    return Promise.reject(error)
  },
)
