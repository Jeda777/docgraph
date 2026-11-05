import { z } from 'zod'
import { nonEmptyStringSchema } from './common'

/**
 * Shapes shared by every diagram type: React Flow nodes and edges as stored in
 * a diagram's CRDT document. Each diagram type narrows `type` and `data`.
 */

/** Names of the Yjs maps a diagram's CRDT document keeps its elements in, one entry per id. */
export const DIAGRAM_MAPS = { nodes: 'nodes', edges: 'edges', areas: 'areas' } as const

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const sizeSchema = z.object({
  width: z.number(),
  height: z.number(),
})

/**
 * React Flow node CSS style. Only the size keys are validated — other CSS
 * properties pass through untouched so documents round-trip without loss.
 */
export const nodeStyleSchema = sizeSchema.partial().loose()

export const baseNodeSchema = z
  .object({
    id: nonEmptyStringSchema,
    position: positionSchema,
    measured: sizeSchema.partial().optional(),
    style: nodeStyleSchema.optional(),
  })
  .loose()
export type BaseNode = z.infer<typeof baseNodeSchema>

export const baseEdgeSchema = z
  .object({
    id: nonEmptyStringSchema,
    source: nonEmptyStringSchema,
    sourceHandle: nonEmptyStringSchema,
    target: nonEmptyStringSchema,
    targetHandle: nonEmptyStringSchema,
  })
  .loose()
export type BaseEdge = z.infer<typeof baseEdgeSchema>

/** Connection points on the four sides of every flowchart and business process node. */
export const DIAGRAM_HANDLE_IDS = ['top', 'right', 'bottom', 'left'] as const
export type DiagramHandleId = (typeof DIAGRAM_HANDLE_IDS)[number]

/**
 * Refinements shared by flowchart and business process documents. Nodes and
 * areas are both React Flow nodes, so their ids must be unique together.
 */
export const refineDiagramCollections = (
  document: { nodes: BaseNode[]; edges: BaseEdge[]; areas: BaseNode[] },
  context: z.RefinementCtx,
) => {
  const checkUniqueIds = (
    items: { id: string }[],
    path: keyof typeof DIAGRAM_MAPS,
    seen: Set<string>,
  ) => {
    for (const [index, item] of items.entries()) {
      if (seen.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: [path, index, 'id'],
          message: 'Collection ids must be unique.',
        })
      }
      seen.add(item.id)
    }
  }

  const renderedNodeIds = new Set<string>()
  checkUniqueIds(document.nodes, 'nodes', renderedNodeIds)
  checkUniqueIds(document.areas, 'areas', renderedNodeIds)
  checkUniqueIds(document.edges, 'edges', new Set())

  for (const [index, node] of document.nodes.entries()) {
    const sizes = [
      node.style?.width,
      node.style?.height,
      node.measured?.width,
      node.measured?.height,
    ]
    if (sizes.some((size) => size !== undefined && size < 0)) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'style'],
        message: 'Node dimensions cannot be negative.',
      })
    }
  }
}

/**
 * How an MCP agent's content is written into a diagram (database schema or graph):
 * `merge` keeps elements that are not mentioned, `replace` removes them.
 */
export const SCHEMA_APPLY_MODES = ['merge', 'replace'] as const
export type SchemaApplyMode = (typeof SCHEMA_APPLY_MODES)[number]
