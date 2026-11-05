import { AREA_NODE_SIZE } from '@docgraph/common/diagram'
import {
  AREA_NODE_TYPE,
  type DiagramGraphType,
  type DiagramHandleId,
} from '@docgraph/common/schemas'
import {
  asRecord,
  CONFIGS,
  type GraphDocument,
  readSize,
  sizeOf,
  textOf,
  toShortType,
} from './diagram-graph.model'

/**
 * Pure conversion between a flowchart / business process document (React Flow
 * nodes, edges and areas as stored in the CRDT maps) and the graph exchanged
 * with AI agents over MCP. Nothing here touches the database or Yjs.
 *
 * This file reads a diagram as a graph; `diagram-graph.apply.ts` writes a graph
 * back, using `.layout.ts` for placement and `.validate.ts` for checks.
 */

/** Short node and edge type names of a diagram type, as agents send and receive them. */
export const diagramGraphTypeNames = (type: DiagramGraphType) => {
  const config = CONFIGS[type]
  return {
    nodes: config.nodeTypes.map((entry) => toShortType(config, entry)),
    edges: config.edgeTypes.map((entry) => toShortType(config, entry)),
    defaultEdge: toShortType(config, config.defaultEdgeType),
  }
}

/** Fields of node/edge data beyond the ones the graph shows on its own. */
const extraData = (data: unknown) => {
  const { kind: _kind, text: _text, ...rest } = asRecord(data)
  return Object.keys(rest).length ? rest : undefined
}

/** Diagram → graph. Elements the graph cannot describe are skipped. */
export const toDiagramGraph = (type: DiagramGraphType, { nodes, edges, areas }: GraphDocument) => {
  const config = CONFIGS[type]
  const knownNodes = nodes.filter((node) => node.type && config.nodeTypes.includes(node.type))

  return {
    nodes: knownNodes.map((node) => ({
      id: node.id,
      type: toShortType(config, node.type as string),
      text: textOf(node.data),
      ...(node.parentId ? { parentId: node.parentId } : {}),
      position: node.position,
      size: sizeOf(config, node),
      ...(config.supportsData && extraData(node.data) ? { data: extraData(node.data) } : {}),
    })),
    edges: edges
      .filter((edge) => edge.type && config.edgeTypes.includes(edge.type))
      .map((edge) => ({
        id: edge.id,
        type: toShortType(config, edge.type as string),
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle as DiagramHandleId,
        targetHandle: edge.targetHandle as DiagramHandleId,
        text: textOf(edge.data),
        ...(config.supportsData && extraData(edge.data) ? { data: extraData(edge.data) } : {}),
      })),
    areas: areas
      .filter((area) => area.type === AREA_NODE_TYPE)
      .map((area) => {
        const data = asRecord(area.data)
        return {
          id: area.id,
          name: data.name,
          color: data.color,
          position: area.position,
          size: readSize(area, AREA_NODE_SIZE),
        }
      }),
  }
}
