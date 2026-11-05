import {
  DIAGRAM_GRAPH_TYPES,
  DIAGRAM_MAPS,
  type DiagramGraphType,
  type DiagramGraphUpdate,
  type SchemaApplyMode,
} from '@docgraph/common/schemas'
import type { Doc } from 'yjs'
import type { Actor } from '../auth/actor'
import {
  readCollection,
  readItemDocument,
  requireItemOfType,
  writeCollection,
  writeItemDocument,
} from '../item/item-document'
import { createItem } from '../item/service'
import { applyDiagramGraph } from './diagram-graph.apply'
import { toDiagramGraph } from './diagram-graph.mapper'
import type { GraphArea, GraphDocument, GraphEdge, GraphNode } from './diagram-graph.model'

const readGraphDocument = (doc: Doc): GraphDocument => ({
  nodes: readCollection<GraphNode>(doc, DIAGRAM_MAPS.nodes),
  edges: readCollection<GraphEdge>(doc, DIAGRAM_MAPS.edges),
  areas: readCollection<GraphArea>(doc, DIAGRAM_MAPS.areas),
})

/** Nodes, edges and areas of a flowchart or business process. */
export const getDiagramGraph = async (itemId: string, actor: Actor) => {
  const item = await requireItemOfType(itemId, DIAGRAM_GRAPH_TYPES, actor)
  const graph = await readItemDocument(itemId, (doc) =>
    toDiagramGraph(item.type, readGraphDocument(doc)),
  )
  return { item, graph }
}

/** Applies a graph update through Hocuspocus, so open editors see it live. */
export const updateDiagramGraph = async (
  itemId: string,
  update: DiagramGraphUpdate,
  mode: SchemaApplyMode,
  actor: Actor,
) => {
  const { item, value: summary } = await writeItemDocument(
    itemId,
    DIAGRAM_GRAPH_TYPES,
    actor,
    (doc, { type }) => {
      const result = applyDiagramGraph(type, readGraphDocument(doc), update, mode)
      writeCollection(doc, DIAGRAM_MAPS.nodes, result.nodes)
      writeCollection(doc, DIAGRAM_MAPS.edges, result.edges)
      return result.summary
    },
  )

  return { item, summary }
}

export const createDiagram = async (
  {
    projectId,
    name,
    type,
    graph,
  }: { projectId: string; name: string; type: DiagramGraphType; graph: DiagramGraphUpdate },
  actor: Actor,
) => {
  const isEmpty = !graph.nodes.length && !graph.edges.length
  // Validate before creating the item, so a bad graph leaves no empty diagram
  // behind (an agent retrying would otherwise pile up duplicates).
  if (!isEmpty) applyDiagramGraph(type, { nodes: [], edges: [], areas: [] }, graph, 'replace')

  const item = await createItem({ projectId, name, type }, actor)
  if (isEmpty) return { item, summary: undefined }

  const { summary } = await updateDiagramGraph(item.id, graph, 'replace', actor)
  return { item, summary }
}
