import {
  businessProcessEdgeData,
  businessProcessNodeZIndex,
  clearDeletedBusinessProcessReferences,
  isValidBusinessProcessConnection,
  layoutAllParticipantLanes,
} from '@docgraph/common/diagram'
import {
  AREA_NODE_TYPE,
  BUSINESS_PROCESS_EDGE_TYPES,
  BUSINESS_PROCESS_NODE_TYPES,
  type BusinessProcessEdgeData,
  type BusinessProcessEdgeType,
  businessProcessEdgeKindByType,
} from '@docgraph/common/schemas'
import type { Connection, EdgeTypes, NodeTypes } from '@xyflow/react'
import { useState } from 'react'
import type { CrdtEditorProps } from '../../lib/types'
import { AreaNode } from '../base/area-node'
import { DiagramCanvas, type DiagramCanvasCollections } from '../base/diagram-canvas'
import { normalizeBoundaryEventAttachments } from './business-process-attachments'
import {
  BusinessProcessEdge,
  type BusinessProcessEdge as BusinessProcessEdgeNode,
} from './business-process-edge'
import {
  BusinessProcessNode,
  type BusinessProcessNode as BusinessProcessNodeElement,
} from './business-process-node'
import { businessProcessEdgeToolRegistry } from './business-process-tool-registry'
import { BusinessProcessSidebar } from './sidebar/business-process-sidebar'

export type BusinessProcessCanvasNode = BusinessProcessNodeElement
export type BusinessProcessCanvasEdge = BusinessProcessEdgeNode

const nodeTypes: NodeTypes = Object.fromEntries([
  ...BUSINESS_PROCESS_NODE_TYPES.map((type) => [type, BusinessProcessNode]),
  [AREA_NODE_TYPE, AreaNode],
])

const edgeTypes: EdgeTypes = Object.fromEntries(
  BUSINESS_PROCESS_EDGE_TYPES.map((type) => [type, BusinessProcessEdge]),
)

const createEdgeData = (type: BusinessProcessEdgeType): BusinessProcessEdgeData => {
  const tool = businessProcessEdgeToolRegistry.find((entry) => entry.edgeType === type)
  return tool?.createData() ?? businessProcessEdgeData.sequenceFlow()
}

// Attached boundary events are pinned to their activity by `normalizeBoundaryEventAttachments`,
// which only changes what is displayed. Dragging them would save positions the canvas never shows.
const isBusinessProcessNodeDraggable = (node: BusinessProcessCanvasNode) =>
  !(node.data.kind === 'participant' && node.data.participantType === 'lane') &&
  !(node.data.kind === 'event' && node.data.context === 'boundary' && node.data.attachedToId)

export const BusinessProcessDiagram = ({ connected, itemName }: CrdtEditorProps) => {
  const [activeEdgeType, setActiveEdgeType] = useState<BusinessProcessEdgeType>(
    BUSINESS_PROCESS_EDGE_TYPES[0],
  )
  const isValidConnection = (
    connection: Connection,
    nodes: BusinessProcessCanvasNode[],
    _edges: BusinessProcessCanvasEdge[],
    reconnectingEdge?: BusinessProcessCanvasEdge,
  ) =>
    isValidBusinessProcessConnection(
      connection,
      nodes,
      reconnectingEdge?.data?.kind ??
        businessProcessEdgeKindByType[reconnectingEdge?.type ?? activeEdgeType],
    )
  const renderSidebar = (
    collections: DiagramCanvasCollections<BusinessProcessCanvasNode, BusinessProcessCanvasEdge>,
    name: string,
  ) => (
    <BusinessProcessSidebar
      {...collections}
      itemName={name}
      activeEdgeType={activeEdgeType}
      onEdgeTypeChange={setActiveEdgeType}
    />
  )

  return (
    <DiagramCanvas<BusinessProcessCanvasNode, BusinessProcessCanvasEdge>
      connected={connected}
      itemName={itemName}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      zIndexMode='manual'
      edgeType={activeEdgeType}
      createEdgeData={createEdgeData}
      isNodeDraggable={isBusinessProcessNodeDraggable}
      getNodeZIndex={businessProcessNodeZIndex}
      transformNodes={normalizeBoundaryEventAttachments}
      normalizeNodes={layoutAllParticipantLanes}
      cleanDeletedReferences={clearDeletedBusinessProcessReferences}
      isValidConnection={isValidConnection}
      renderSidebar={renderSidebar}
    />
  )
}
