import {
  type BaseEdge,
  type BaseNode,
  columnIdFromHandleId,
  type DatabaseDiagramNodeData,
  databaseDiagramNodeDataSchema,
} from '@docgraph/common/schemas'

/** Document types and node/edge helpers shared by the database diagram mapper files. */

/** Any node or edge of the document; only database tables and relations are interpreted. */
export type DiagramNode = BaseNode & { type?: string; data?: unknown }
export type DiagramEdge = BaseEdge & { type?: string; data?: unknown }

export type DiagramDocument = { nodes: DiagramNode[]; edges: DiagramEdge[] }

export type SchemaApplySummary = {
  tablesCreated: string[]
  tablesUpdated: string[]
  tablesRemoved: string[]
  relations: number
}

export type TableNode = DiagramNode & { data: DatabaseDiagramNodeData }

export const asTableNode = (node: DiagramNode): TableNode | undefined =>
  databaseDiagramNodeDataSchema.safeParse(node.data).success ? (node as TableNode) : undefined

export const edgeKey = (
  sourceNode: string,
  sourceColumn: string,
  targetNode: string,
  targetColumn: string,
) => `${sourceNode}:${sourceColumn}->${targetNode}:${targetColumn}`

export const keyOfEdge = (edge: DiagramEdge) =>
  edgeKey(
    edge.source,
    columnIdFromHandleId(edge.sourceHandle),
    edge.target,
    columnIdFromHandleId(edge.targetHandle),
  )
