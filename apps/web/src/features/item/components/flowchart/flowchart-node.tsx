import type { FlowchartNodeData, FlowchartNodeType } from '@docgraph/common/schemas'
import { type Node, type NodeProps, NodeResizer, Position } from '@xyflow/react'
import { type CSSProperties, memo, useEffect } from 'react'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { BaseNode } from '../base/base-node'
import { useDiagramMutationContext } from '../base/diagram-canvas'
import { EditableNodeText, getAutoSize } from '../base/editable-node-text'
import { NodeHandle } from '../base/node-handle'
import { getFlowchartTool } from './flowchart-tool-registry'

export type FlowchartNode = Node<FlowchartNodeData, FlowchartNodeType>
export type FlowchartNodeProps = NodeProps<FlowchartNode> & { style?: CSSProperties }

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 96
const DEFAULT_MIN_WIDTH = 80
const DEFAULT_MIN_HEIGHT = 48

const finiteDimension = (value: number | string | undefined, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const FlowchartNode = memo(
  ({
    id,
    type,
    data,
    width: measuredWidth,
    height: measuredHeight,
    selected,
    style,
  }: FlowchartNodeProps) => {
    const readOnly = useDocumentReadOnly()
    const mutations = useDiagramMutationContext()
    const tool = getFlowchartTool(type)
    const width = finiteDimension(style?.width ?? measuredWidth, tool.defaultWidth ?? DEFAULT_WIDTH)
    const height = finiteDimension(
      style?.height ?? measuredHeight,
      tool.defaultHeight ?? DEFAULT_HEIGHT,
    )
    const minWidth = tool.minWidth ?? DEFAULT_MIN_WIDTH
    const minHeight = tool.minHeight ?? DEFAULT_MIN_HEIGHT
    const label = data.text ? `${tool.label}: ${data.text}` : tool.label
    const connectable = tool.connectable !== false
    const autoSize = {
      defaultWidth: tool.defaultWidth ?? DEFAULT_WIDTH,
      defaultHeight: tool.defaultHeight ?? DEFAULT_HEIGHT,
      minWidth,
      minHeight,
      preserveAspectRatio: tool.preserveAspectRatio,
    }
    const { width: desiredWidth, height: desiredHeight } = getAutoSize(data.text, autoSize)

    useEffect(() => {
      if (!mutations || readOnly) return
      const currentWidth = finiteDimension(style?.width ?? measuredWidth, desiredWidth)
      const currentHeight = finiteDimension(style?.height ?? measuredHeight, desiredHeight)
      if (currentWidth >= desiredWidth && currentHeight >= desiredHeight) return

      mutations.setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, style: { ...node.style, width: desiredWidth, height: desiredHeight } }
            : node,
        ),
      )
    }, [
      desiredHeight,
      desiredWidth,
      id,
      measuredHeight,
      measuredWidth,
      mutations,
      readOnly,
      style?.height,
      style?.width,
    ])

    return (
      <BaseNode
        aria-label={label}
        className='group h-full w-full overflow-visible rounded-none border-0 bg-transparent shadow-none'
      >
        <NodeResizer
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={tool.preserveAspectRatio}
          isVisible={selected && !readOnly}
        />
        <div className='relative h-full w-full'>
          <div className='pointer-events-none absolute inset-0 h-full w-full overflow-visible'>
            {tool.render(width, height)}
          </div>
          <div className='absolute inset-0 flex items-center justify-center'>
            <EditableNodeText
              nodeId={id}
              value={data.text}
              label={label}
              readOnly={readOnly}
              autoSize={autoSize}
              className='relative z-1'
            />
          </div>
          {connectable && (
            <>
              <NodeHandle
                id='top'
                position={Position.Top}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='right'
                position={Position.Right}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='bottom'
                position={Position.Bottom}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='left'
                position={Position.Left}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
            </>
          )}
        </div>
      </BaseNode>
    )
  },
)
