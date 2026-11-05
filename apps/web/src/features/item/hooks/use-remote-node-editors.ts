import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useEffect, useState } from 'react'

export type EditingState = {
  nodeId: string
  field: string
}

/**
 * Read side of collaborative edit presence. Returns a map of field id -> the
 * editing user's color for every remote user currently editing a field of the
 * given node. Local state only updates when that map changes, so unrelated
 * awareness traffic (cursors, drags) doesn't re-render the node.
 */
export const useRemoteNodeEditors = (nodeId: string): Record<string, string> => {
  const provider = useHocuspocusProvider()
  const [editors, setEditors] = useState<Record<string, string>>({})

  useEffect(() => {
    const awareness = provider.awareness
    if (!awareness) return
    const selfId = awareness.clientID
    let lastKey = ''

    const update = () => {
      const next: Record<string, string> = {}
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === selfId) return
        const editing = state.editing as EditingState | null | undefined
        if (editing && editing.nodeId === nodeId) {
          next[editing.field] = state.color || 'red'
        }
      })

      const key = JSON.stringify(next)
      if (key !== lastKey) {
        lastKey = key
        setEditors(next)
      }
    }

    awareness.on('change', update)
    update()
    return () => awareness.off('change', update)
  }, [provider, nodeId])

  return editors
}
