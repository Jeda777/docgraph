import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useSyncExternalStore } from 'react'

/**
 * Whether the server opened this document connection with the `readonly` scope
 * (archived item or project). The scope arrives in the authentication reply and
 * is re-evaluated on every reconnect, so the flag follows the server's verdict.
 */
export const useDocumentReadOnly = () => {
  const provider = useHocuspocusProvider()

  // The provider only updates `authorizedScope` while emitting `authenticated`,
  // so subscribing to that event keeps the external store value fresh.
  const subscribe = (onStoreChange: () => void) => {
    provider.on('authenticated', onStoreChange)
    return () => {
      provider.off('authenticated', onStoreChange)
    }
  }

  const getSnapshot = () => provider.authorizedScope === 'readonly'

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
