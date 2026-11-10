import {
  AREA_NODE_TYPE,
  FLOWCHART_EDGE_TYPES,
  FLOWCHART_NODE_TYPES,
  type FlowchartEdgeData,
  type FlowchartEdgeType,
  type FlowchartNodeData,
  type FlowchartNodeType,
} from '@docgraph/common/schemas'
import type { Edge, EdgeTypes, Node, NodeTypes } from '@xyflow/react'
import { useState } from 'react'
import type { CrdtEditorProps } from '../../lib/types'
import { AreaNode } from '../base/area-node'
import { DiagramCanvas } from '../base/diagram-canvas'
import { FlowchartEdge } from './flowchart-edge'
import { FlowchartNode } from './flowchart-node'
import { fitNodesToText } from './flowchart-node-size.helpers'
import { FlowchartSidebar } from './sidebar/flowchart-sidebar'

export type FlowchartCanvasNode = Node<FlowchartNodeData, FlowchartNodeType>
export type FlowchartCanvasEdge = Edge<FlowchartEdgeData, FlowchartEdgeType>

const nodeTypes: NodeTypes = {
  ...Object.fromEntries(FLOWCHART_NODE_TYPES.map((type) => [type, FlowchartNode])),
  [AREA_NODE_TYPE]: AreaNode,
}

const edgeTypes: EdgeTypes = Object.fromEntries(
  FLOWCHART_EDGE_TYPES.map((type) => [type, FlowchartEdge]),
)

const createEdgeData = (): FlowchartEdgeData => ({ text: '' })

export const FlowchartDiagram = ({ connected, itemName }: CrdtEditorProps) => {
  const [activeEdgeType, setActiveEdgeType] = useState<FlowchartEdgeType>(FLOWCHART_EDGE_TYPES[0])

  return (
    <DiagramCanvas<FlowchartCanvasNode, FlowchartCanvasEdge>
      connected={connected}
      itemName={itemName}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      edgeType={activeEdgeType}
      createEdgeData={createEdgeData}
      normalizeNodes={fitNodesToText}
      renderSidebar={(collections, name) => (
        <FlowchartSidebar
          {...collections}
          itemName={name}
          activeEdgeType={activeEdgeType}
          onEdgeTypeChange={setActiveEdgeType}
        />
      )}
    />
  )
}
