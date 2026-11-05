import { z } from 'zod'
import { areaNodeSchema } from './area-node'
import {
  baseEdgeSchema,
  baseNodeSchema,
  DIAGRAM_HANDLE_IDS,
  refineDiagramCollections,
} from './diagram'
import type { ItemType } from './item'

export const FLOWCHART_NODE_TYPES = [
  'flowchartProcessNode',
  'flowchartDecisionNode',
  'flowchartDocumentNode',
  'flowchartMultipleDocumentsNode',
  'flowchartStartOvalNode',
  'flowchartStartCircleNode',
  'flowchartTerminatorNode',
  'flowchartPreparationNode',
  'flowchartDelayNode',
  'flowchartSummingJunctionNode',
  'flowchartOrJunctionNode',
  'flowchartLoopLimitNode',
  'flowchartDataNode',
  'flowchartDatabaseNode',
  'flowchartStoredDataNode',
  'flowchartInternalStorageNode',
  'flowchartDirectDataNode',
  'flowchartSequentialDataNode',
  'flowchartCardNode',
  'flowchartPaperTapeNode',
  'flowchartDisplayNode',
  'flowchartManualInputNode',
  'flowchartManualOperationNode',
  'flowchartMergeOrStorageNode',
  'flowchartExtractOrMeasurementNode',
  'flowchartCollateNode',
  'flowchartSortNode',
  'flowchartOnPageReferenceNode',
  'flowchartOffPageReferenceNode',
  'flowchartPredefinedProcessNode',
  'flowchartParallelModeNode',
  'flowchartTransferNode',
  'flowchartAnnotationBracketNode',
  'flowchartAnnotationCalloutNode',
] as const
export type FlowchartNodeType = (typeof FLOWCHART_NODE_TYPES)[number]

export const FLOWCHART_EDGE_TYPES = [
  'flowchartFlowLineEdge',
  'flowchartBidirectionalFlowLineEdge',
] as const
export type FlowchartEdgeType = (typeof FLOWCHART_EDGE_TYPES)[number]

export const flowchartNodeDataSchema = z.strictObject({
  text: z.string(),
})
export type FlowchartNodeData = z.infer<typeof flowchartNodeDataSchema>

export const flowchartNodeSchema = baseNodeSchema.extend({
  type: z.enum(FLOWCHART_NODE_TYPES),
  data: flowchartNodeDataSchema,
})
export type FlowchartNode = z.infer<typeof flowchartNodeSchema>

export const flowchartEdgeDataSchema = z.strictObject({
  text: z.string(),
})
export type FlowchartEdgeData = z.infer<typeof flowchartEdgeDataSchema>

export const flowchartEdgeSchema = baseEdgeSchema.extend({
  type: z.enum(FLOWCHART_EDGE_TYPES),
  sourceHandle: z.enum(DIAGRAM_HANDLE_IDS),
  targetHandle: z.enum(DIAGRAM_HANDLE_IDS),
  data: flowchartEdgeDataSchema,
})
export type FlowchartEdge = z.infer<typeof flowchartEdgeSchema>

export const flowchartSchema = z
  .strictObject({
    type: z.literal('FLOWCHART' satisfies ItemType),
    nodes: z.array(flowchartNodeSchema),
    edges: z.array(flowchartEdgeSchema),
    areas: z.array(areaNodeSchema),
  })
  .superRefine((document, context) => {
    refineDiagramCollections(document, context)

    const nodeIds = new Set(document.nodes.map((node) => node.id))
    for (const [index, edge] of document.edges.entries()) {
      if (!nodeIds.has(edge.source)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'source'],
          message: 'Edge source must reference a flowchart node.',
        })
      }
      if (!nodeIds.has(edge.target)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'target'],
          message: 'Edge target must reference a flowchart node.',
        })
      }
    }
  })
export type Flowchart = z.infer<typeof flowchartSchema>
