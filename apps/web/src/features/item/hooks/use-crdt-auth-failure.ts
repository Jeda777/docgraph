import { useHocuspocusEvent } from '@hocuspocus/provider-react'
import { toast } from '@/components/ui/toast'
import { getErrorStatus, useMe } from '@/lib/api'

/**
 * The CRDT server authenticates with the session cookie of the WebSocket handshake, so a refused
 * connection mostly means the session or the access is gone. Refetching the user
 * sends the app to /login if the session ended; refetching the item answers 404 if access is gone,
 * and `ItemPage` leaves the editor.
 * `refetchItem` is `ItemPage`'s own query `refetch`: a second observer would refetch on every open.
 */
export const useCrdtAuthFailure = (refetchItem: () => Promise<{ error: unknown }>) => {
  const session = useMe()

  useHocuspocusEvent('authenticationFailed', async () => {
    const [, { error }] = await Promise.all([session.refetch(), refetchItem()])

    if (getErrorStatus(error) === 404) {
      toast.add({
        type: 'error',
        title: 'Item closed',
        description: 'This item was deleted or you no longer have access to it.',
      })
      return
    }

    toast.add({
      type: 'error',
      title: 'Connection failed',
      description: 'Could not authenticate with the collaboration server.',
    })
  })
}
