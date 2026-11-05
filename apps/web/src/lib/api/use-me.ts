import { authClient } from './auth'

/**
 * Set once the first session fetch settles. Better Auth sets `isPending` back to `true` on every
 * refetch (window focus, polling) while there is no session, which would unmount logged-out pages
 * (e.g. `/reset`) and wipe their forms, so only the first load counts as pending.
 */
let hasLoadedOnce = false

/**
 * The signed-in user, refetched from the server (e.g. on window focus) so it never goes stale.
 * `data` is `null` when there is no session; `isPending` is `true` only until the first fetch settles.
 */
export const useMe = () => {
  const session = authClient.useSession()
  if (!session.isPending) hasLoadedOnce = true

  return {
    ...session,
    isPending: session.isPending && !hasLoadedOnce,
    id: session.data?.user.id ?? null,
    isAdmin: session.data?.user.isAdmin ?? false,
    name: session.data?.user.name ?? null,
    email: session.data?.user.email ?? null,
  }
}
