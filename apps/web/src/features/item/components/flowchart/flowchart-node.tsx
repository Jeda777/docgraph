import type { FlowchartNodeData, FlowchartNodeType } from '@docgraph/common/schemas'
import { type Node, type NodeProps, NodeResizer, Position } from '@xyflow/react'
import { memo, useEffect } from 'react'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { BaseNode } from '../base/base-node'
import { useDiagramMutationContext } from '../base/diagram-canvas'
import { EditableNodeText } from '../base/editable-node-text'
import { NodeHandle } from '../base/node-handle'
import { fitNodeToText, getTextFitSize } from './flowchart-node-size.helpers'
import { getFlowchartTool } from './flowchart-tool-registry'

export type FlowchartNode = Node<FlowchartNodeData, FlowchartNodeType>
export type FlowchartNodeProps = NodeProps<FlowchartNode>

export const FlowchartNode = memo(
  ({ id, type, data, width: drawnWidth, height: drawnHeight, selected }: FlowchartNodeProps) => {
    const readOnly = useDocumentReadOnly()
    const mutations = useDiagramMutationContext()
    const tool = getFlowchartTool(type)
    // The drawn size (0 until measured): React Flow draws `width`/`height` from resizing over `style`.
    const width = drawnWidth || tool.defaultWidth
    const height = drawnHeight || tool.defaultHeight
    const label = data.text ? `${tool.label}: ${data.text}` : tool.label
    const connectable = tool.connectable !== false
    const autoSize = {
      defaultWidth: tool.defaultWidth,
      defaultHeight: tool.defaultHeight,
      minWidth: tool.minWidth,
      minHeight: tool.minHeight,
      preserveAspectRatio: tool.preserveAspectRatio,
    }
    const fit = getTextFitSize(type, data.text)

    // A peer's text edit or an older document can leave the node smaller than its text; local
    // edits already fit (`fitNodesToText`). Every client grows it, so it isn't anyone's undo step.
    useEffect(() => {
      if (!mutations || readOnly) return
      if (width >= fit.width && height >= fit.height) return
      mutations.repairNodes((nodes) =>
        nodes.map((node) => (node.id === id ? fitNodeToText(node as FlowchartNode) : node)),
      )
    }, [fit.height, fit.width, height, id, mutations, readOnly, width])

    return (
      <BaseNode
        aria-label={label}
        className='group h-full w-full overflow-visible rounded-none border-0 bg-transparent shadow-none'
      >
        <NodeResizer
          minWidth={fit.width}
          minHeight={fit.height}
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
