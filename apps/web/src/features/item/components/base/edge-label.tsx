import { EdgeLabelRenderer } from '@xyflow/react'
import type { ReactNode } from 'react'

export type EdgeLabelProps = {
  x: number
  y: number
  children: ReactNode
}

/** Small badge centred on the edge, shared by every diagram's edge label. */
export const EdgeLabel = ({ x, y, children }: EdgeLabelProps) => (
  <EdgeLabelRenderer>
    <div
      className='nodrag nopan pointer-events-none absolute rounded border bg-card px-1 py-0.5 text-[10px] text-muted-foreground'
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
    >
      {children}
    </div>
  </EdgeLabelRenderer>
)
