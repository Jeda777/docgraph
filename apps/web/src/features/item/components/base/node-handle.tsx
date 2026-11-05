import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'

export type NodeHandleProps = {
  id: string
  position: Position
  className?: string
  inset?: number
}

const OFFSET_SIDE = {
  [Position.Top]: 'top',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
  [Position.Right]: 'right',
} as const

const DEFAULT_HANDLE_OFFSET = -12

/** Connection handle, sized and offset the same way in every diagram node. */
export const NodeHandle = ({
  id,
  position,
  className,
  inset = DEFAULT_HANDLE_OFFSET,
}: NodeHandleProps) => (
  <Handle
    id={id}
    type='source'
    position={position}
    className={cn(className)}
    style={{
      [OFFSET_SIDE[position]]: inset,
      width: 8,
      height: 8,
      zIndex: 20,
      pointerEvents: 'all',
    }}
  />
)
