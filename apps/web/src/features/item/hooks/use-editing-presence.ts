import { useHocuspocusProvider } from '@hocuspocus/provider-react'

/**
 * Write side of collaborative edit presence. Wire `startEditing` to an input's
 * `onFocus` and `stopEditing` to its `onBlur` to broadcast which node field the
 * local user is currently editing. `field` is an arbitrary id agreed upon with
 * the renderer (e.g. `'name'`, `'description'`, `value:${id}:value`).
 */
export const useEditingPresence = () => {
  const provider = useHocuspocusProvider()

  const startEditing = (nodeId: string, field: string) => {
    provider.awareness?.setLocalStateField('editing', { nodeId, field })
  }

  const stopEditing = () => {
    provider.awareness?.setLocalStateField('editing', null)
  }

  return { startEditing, stopEditing }
}
