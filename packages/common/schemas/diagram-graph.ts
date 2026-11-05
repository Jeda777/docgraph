import { z } from 'zod'
import { nonEmptyStringSchema } from './common'
import { DIAGRAM_HANDLE_IDS, positionSchema, sizeSchema } from './diagram'

/**
 * DIAGRAM GRAPH (MCP)
 *
 * View of a flowchart or business process diagram exchanged with AI agents:
 * nodes and edges with short type names (`process`, `decision`, `activity`, …)
 * and plain labels. Positions and sizes are optional on input — nodes without
 * a position are laid out automatically.
 */

/** Item types whose documents are exchanged as a diagram graph. */
export const DIAGRAM_GRAPH_TYPES = ['FLOWCHART', 'BUSINESS_PROCESS'] as const
export type DiagramGraphType = (typeof DIAGRAM_GRAPH_TYPES)[number]

const extraDataSchema = z.record(z.string(), z.unknown())

export const diagramGraphNodeSchema = z.object({
  id: nonEmptyStringSchema.describe(
    'Stable node id. Reuse ids returned by get_diagram to change existing nodes; pick new unique, readable ids (e.g. "validate-order") for new nodes',
  ),
  type: nonEmptyStringSchema
    .optional()
    .describe('Short node type, see the tool description. Required for new nodes'),
  text: z.string().optional().describe('Label shown in the node'),
  parentId: nonEmptyStringSchema
    .nullable()
    .optional()
    .describe(
      'BUSINESS_PROCESS only: containing pool or lane (or the activity of a boundary event); null moves the node to the top level',
    ),
  position: positionSchema
    .optional()
    .describe('Top-left corner, relative to the parent. Omit to place the node automatically'),
  size: sizeSchema.optional(),
  data: extraDataSchema
    .optional()
    .describe(
      'BUSINESS_PROCESS only: type-specific fields, e.g. { "taskType": "userTask" } or { "context": "start", "eventType": "message" }',
    ),
})
export type DiagramGraphNode = z.infer<typeof diagramGraphNodeSchema>

export const diagramGraphEdgeSchema = z.object({
  id: nonEmptyStringSchema
    .optional()
    .describe('Existing edge id to change it; omitted for new edges (an id is generated)'),
  type: nonEmptyStringSchema
    .optional()
    .describe('Short edge type; defaults to the main flow of the diagram type'),
  source: nonEmptyStringSchema.describe('Source node id'),
  target: nonEmptyStringSchema.describe('Target node id'),
  sourceHandle: z
    .enum(DIAGRAM_HANDLE_IDS)
    .optional()
    .describe('Omit to pick the side automatically'),
  targetHandle: z
    .enum(DIAGRAM_HANDLE_IDS)
    .optional()
    .describe('Omit to pick the side automatically'),
  text: z.string().optional().describe('Label shown on the edge'),
  data: extraDataSchema
    .optional()
    .describe('BUSINESS_PROCESS only: type-specific fields, e.g. { "condition": "amount > 100" }'),
})
export type DiagramGraphEdge = z.infer<typeof diagramGraphEdgeSchema>

export const diagramGraphUpdateSchema = z.object({
  nodes: z.array(diagramGraphNodeSchema).default([]),
  edges: z.array(diagramGraphEdgeSchema).default([]),
  removeNodeIds: z
    .array(nonEmptyStringSchema)
    .default([])
    .describe('Nodes to delete, with their edges and contained nodes'),
  removeEdgeIds: z.array(nonEmptyStringSchema).default([]).describe('Edges to delete'),
})
export type DiagramGraphUpdate = z.infer<typeof diagramGraphUpdateSchema>
