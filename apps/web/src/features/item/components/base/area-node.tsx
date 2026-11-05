import { AREA_NODE_SIZE } from '@docgraph/common/diagram'
import { AREA_NODE_TYPE, type AreaNodeData } from '@docgraph/common/schemas'
import { type Node, type NodeProps, NodeResizer, type XYPosition } from '@xyflow/react'
import { memo } from 'react'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'

export type AreaNode = Node<AreaNodeData, typeof AREA_NODE_TYPE>

export const createAreaNode = (state: AreaNode[], position: XYPosition): AreaNode => ({
  id: crypto.randomUUID(),
  type: AREA_NODE_TYPE,
  position,
  style: { ...AREA_NODE_SIZE },
  data: {
    name: 'area',
    color: '#3b82f6',
    alpha: 0.1,
    order: state.reduce((max, area) => Math.max(max, area.data.order ?? 0), -1) + 1,
  },
})

export const AreaNode = memo(({ data, selected }: NodeProps<AreaNode>) => {
  const readOnly = useDocumentReadOnly()

  return (
    <>
      <NodeResizer minWidth={160} minHeight={120} isVisible={selected && !readOnly} />
      <div
        className='relative w-full h-full rounded-md border border-foreground/10'
        style={{
          background: `color-mix(in srgb, ${data.color} calc(${data.alpha} * 100%), transparent)`,
        }}
      >
        <span className='absolute top-1 left-2 text-xs font-semibold text-foreground/70'>
          {data.name}
        </span>
      </div>
    </>
  )
})
