import {
  FLOWCHART_EDGE_TYPES,
  FLOWCHART_NODE_TYPES,
  type FlowchartEdgeType,
  type FlowchartNodeType,
} from '@docgraph/common/schemas'
import type { ReactNode } from 'react'
import {
  type FlowchartShapeGeometry,
  flowchartShapeGeometry,
  renderFlowchartEdgePreview,
  renderFlowchartShape,
} from './flowchart-shapes'

export type FlowchartNodeTool = {
  kind: 'node'
  type: FlowchartNodeType
  label: string
  geometry: FlowchartShapeGeometry
  width: number
  height: number
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  connectable: boolean
  preserveAspectRatio?: boolean
  preview: () => ReactNode
  render: (width: number, height: number) => ReactNode
}

export type FlowchartEdgeTool = {
  kind: 'edge'
  type: FlowchartEdgeType
  label: string
  preview: () => ReactNode
}

export type FlowchartTool = FlowchartNodeTool | FlowchartEdgeTool

const nodeLabels: Record<FlowchartNodeType, string> = {
  flowchartProcessNode: 'Process',
  flowchartDecisionNode: 'Decision',
  flowchartDocumentNode: 'Document',
  flowchartMultipleDocumentsNode: 'Multi-Document',
  flowchartStartOvalNode: 'Start (Oval)',
  flowchartStartCircleNode: 'Start (Circle)',
  flowchartTerminatorNode: 'Terminator',
  flowchartPreparationNode: 'Preparation',
  flowchartDelayNode: 'Delay',
  flowchartSummingJunctionNode: 'Summing Junction',
  flowchartOrJunctionNode: 'Or',
  flowchartLoopLimitNode: 'Loop Limit',
  flowchartDataNode: 'Data',
  flowchartDatabaseNode: 'Database',
  flowchartStoredDataNode: 'Stored Data',
  flowchartInternalStorageNode: 'Internal Storage',
  flowchartDirectDataNode: 'Direct Data',
  flowchartSequentialDataNode: 'Sequential Data',
  flowchartCardNode: 'Card',
  flowchartPaperTapeNode: 'Tape',
  flowchartDisplayNode: 'Display',
  flowchartManualInputNode: 'Manual Input',
  flowchartManualOperationNode: 'Manual Operation',
  flowchartMergeOrStorageNode: 'Merge or Storage',
  flowchartExtractOrMeasurementNode: 'Extract or Measurement',
  flowchartCollateNode: 'Collate',
  flowchartSortNode: 'Sort',
  flowchartOnPageReferenceNode: 'On-Page Reference',
  flowchartOffPageReferenceNode: 'Off-Page Reference',
  flowchartPredefinedProcessNode: 'Predefined Process',
  flowchartParallelModeNode: 'Parallel Mode',
  flowchartTransferNode: 'Transfer',
  flowchartAnnotationBracketNode: 'Annotation (Bracket)',
  flowchartAnnotationCalloutNode: 'Annotation (Callout)',
}

const nodeDefaults: Record<
  FlowchartNodeType,
  Pick<
    FlowchartNodeTool,
    | 'width'
    | 'height'
    | 'defaultWidth'
    | 'defaultHeight'
    | 'minWidth'
    | 'minHeight'
    | 'connectable'
    | 'preserveAspectRatio'
  >
> = Object.fromEntries(
  FLOWCHART_NODE_TYPES.map((type) => [
    type,
    {
      width: 160,
      height: 80,
      defaultWidth: 160,
      defaultHeight: 80,
      minWidth: 80,
      minHeight: 48,
      connectable: !type.includes('Annotation'),
      preserveAspectRatio: [
        'flowchartStartCircleNode',
        'flowchartSummingJunctionNode',
        'flowchartOrJunctionNode',
        'flowchartOnPageReferenceNode',
      ].includes(type),
    },
  ]),
) as Record<
  FlowchartNodeType,
  Pick<
    FlowchartNodeTool,
    | 'width'
    | 'height'
    | 'defaultWidth'
    | 'defaultHeight'
    | 'minWidth'
    | 'minHeight'
    | 'connectable'
    | 'preserveAspectRatio'
  >
>

const createNodeTool = (type: FlowchartNodeType): FlowchartNodeTool => {
  const dimensions = nodeDefaults[type]
  return {
    kind: 'node',
    type,
    label: nodeLabels[type],
    geometry: flowchartShapeGeometry[type],
    ...dimensions,
    preview: () => renderFlowchartShape(type, 48, 34, nodeLabels[type], true),
    render: (width, height) => renderFlowchartShape(type, width, height, nodeLabels[type]),
  }
}

const nodeTools = FLOWCHART_NODE_TYPES.map(createNodeTool)

const edgeTools: FlowchartEdgeTool[] = [
  {
    kind: 'edge',
    type: FLOWCHART_EDGE_TYPES[0],
    label: 'Flow Line',
    preview: () => renderFlowchartEdgePreview(false),
  },
  {
    kind: 'edge',
    type: FLOWCHART_EDGE_TYPES[1],
    label: 'Bidirectional Flow Line',
    preview: () => renderFlowchartEdgePreview(true),
  },
]

export const flowchartNodeToolRegistry = nodeTools as readonly FlowchartNodeTool[]
export const flowchartEdgeToolRegistry = edgeTools as readonly FlowchartEdgeTool[]
export const flowchartToolRegistry = [...nodeTools, ...edgeTools] as readonly FlowchartTool[]

export function getFlowchartTool(type: FlowchartNodeType): FlowchartNodeTool
export function getFlowchartTool(type: FlowchartEdgeType): FlowchartEdgeTool
export function getFlowchartTool(type: FlowchartNodeType | FlowchartEdgeType): FlowchartTool {
  const tool = flowchartToolRegistry.find((entry) => entry.type === type)
  if (!tool) throw new Error(`Unknown flowchart tool: ${type}`)
  return tool
}
