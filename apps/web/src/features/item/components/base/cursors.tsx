import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { useMe } from '@/lib/api'
import { collaboratorColor } from '../../lib/node-color.helpers'
import { BaseCursor } from './base-cursor'

/** Throttle interval for broadcasting the local pointer over awareness. */
const BROADCAST_INTERVAL_MS = 50

export type AwarenessCursorState = {
  clientId: number
  name?: string
  color?: string
  /** Id of the node this user is currently dragging, if any. */
  draggingNodeId?: string | null
  /** Pointer position in flow (canvas) coordinates. `null` while hidden. */
  cursor?: { x: number; y: number } | null
}

/**
 * Screen-space rects where cursors must not be drawn (sidebar & co). Read from
 * the DOM instead of hardcoding the sidebar width; recomputed on every render,
 * which `useViewport()` already forces on pan/zoom.
 */
const hiddenRects = () =>
  Array.from(document.querySelectorAll('[data-hide-cursor]'), (el) => el.getBoundingClientRect())

const isOnScreen = (p: { x: number; y: number }, rects: DOMRect[]) =>
  p.x >= 0 &&
  p.y >= 0 &&
  p.x <= window.innerWidth &&
  p.y <= window.innerHeight &&
  !rects.some((r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom)

/**
 * Collaborative cursor layer, shared by every diagram type. Broadcasts the local
 * pointer via the Yjs awareness protocol in flow coordinates (stable across each
 * viewer's pan/zoom) and renders every remote cursor, converting back to screen
 * space for the current viewport. Must be rendered inside `<ReactFlow>`.
 */
export const Cursors = () => {
  const provider = useHocuspocusProvider()
  const { name } = useMe()
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow()
  // Re-render on pan/zoom so remote cursors track the moving viewport.
  useViewport()
  const [cursors, setCursors] = useState<AwarenessCursorState[]>([])

  useEffect(() => {
    const awareness = provider.awareness
    if (!awareness) return

    awareness.setLocalStateField('name', name || 'Anonymous')
    awareness.setLocalStateField('color', collaboratorColor(awareness.clientID))

    let lastMove = 0
    let hidden = false
    const handleMove = (e: MouseEvent) => {
      // Over the sidebar the position is nobody's business: clear it once and
      // stop broadcasting until the pointer comes back over the canvas. Edit
      // presence (`editing`) is a separate field and keeps flowing.
      if ((e.target as Element | null)?.closest('[data-hide-cursor]')) {
        if (!hidden) {
          hidden = true
          awareness.setLocalStateField('cursor', null)
        }
        return
      }
      hidden = false

      const now = Date.now()
      if (now - lastMove < BROADCAST_INTERVAL_MS) return
      lastMove = now
      awareness.setLocalStateField('cursor', screenToFlowPosition({ x: e.clientX, y: e.clientY }))
    }
    window.addEventListener('mousemove', handleMove)

    const update = () => {
      setCursors(
        Array.from(awareness.getStates().entries()).map(
          ([clientId, state]) => ({ ...state, clientId }) as AwarenessCursorState,
        ),
      )
    }
    awareness.on('change', update)
    update()

    return () => {
      window.removeEventListener('mousemove', handleMove)
      awareness.off('change', update)
    }
  }, [provider, name, screenToFlowPosition])

  const awareness = provider.awareness
  if (!awareness) return null
  const selfId = awareness.clientID
  const visible = cursors.filter((c) => c.cursor && c.clientId !== selfId)
  // `getBoundingClientRect` forces layout, and this renders on every pan frame:
  // don't measure anything when there is nobody to draw.
  const rects = visible.length ? hiddenRects() : []

  return (
    <div className='fixed inset-0 pointer-events-none z-50'>
      {visible.map((c) => {
        if (!c.cursor) return null
        const position = flowToScreenPosition(c.cursor)
        // Off-screen or behind the sidebar: don't render it at all.
        if (!isOnScreen(position, rects)) return null
        return (
          <BaseCursor
            key={c.clientId}
            position={position}
            name={c.name || 'Anonymous'}
            color={c.color}
            dragging={!!c.draggingNodeId}
          />
        )
      })}
    </div>
  )
}
