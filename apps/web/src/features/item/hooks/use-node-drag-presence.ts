import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useRef } from 'react'

/** Shape of the React Flow change we care about, without the xyflow types. */
type SizeChange = { type: string; id?: string; resizing?: boolean }

/**
 * Drag and resize handling for every diagram type. While a node moves, its collection holds the
 * CRDT writes back and peers only see a move cursor (awareness); the final geometry is flushed
 * at the end. `hold` is the owning collections' `useYjsCollection` hold, composed if several.
 */
export const useNodeDragPresence = (hold: (ids: string[]) => void) => {
  const provider = useHocuspocusProvider()
  const resizingRef = useRef<string | null>(null)

  const onNodeDragStart = (_: unknown, node: { id: string }) => {
    hold([node.id])
    provider.awareness?.setLocalStateField('draggingNodeId', node.id)
  }

  const onNodeDragStop = () => {
    hold([])
    provider.awareness?.setLocalStateField('draggingNodeId', null)
  }

  /**
   * Resizing has no start/stop callbacks on `<ReactFlow>` — it shows up as
   * dimension changes carrying a `resizing` flag. Feed the node changes through
   * this from `onNodesChange` to get the same hold-and-announce treatment.
   */
  const trackResize = (changes: SizeChange[]) => {
    const change = changes.find((c) => c.type === 'dimensions' && c.resizing !== undefined)
    if (!change) return

    if (change.resizing && change.id && resizingRef.current !== change.id) {
      resizingRef.current = change.id
      hold([change.id])
      provider.awareness?.setLocalStateField('draggingNodeId', change.id)
    } else if (!change.resizing && resizingRef.current) {
      resizingRef.current = null
      hold([])
      provider.awareness?.setLocalStateField('draggingNodeId', null)
    }
  }

  return { onNodeDragStart, onNodeDragStop, trackResize }
}
