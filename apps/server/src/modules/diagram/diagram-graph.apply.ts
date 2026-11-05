import { randomUUID } from 'node:crypto'
import type {
  DiagramGraphEdge,
  DiagramGraphNode,
  DiagramGraphType,
  DiagramGraphUpdate,
  SchemaApplyMode,
} from '@docgraph/common/schemas'
import { BadRequestException } from '../../errors'
import { layoutNodes, pickHandles } from './diagram-graph.layout'
import {
  asRecord,
  CONFIGS,
  type DataRecord,
  type GraphApplySummary,
  type GraphConfig,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  setSize,
  textOf,
  toFullType,
  toShortType,
} from './diagram-graph.model'
import { assertUniqueIds, assertValidDocument } from './diagram-graph.validate'

/** Ids of the given nodes plus every node nested inside them. */
const withDescendants = (nodes: GraphNode[], ids: ReadonlySet<string>) => {
  const result = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id)
        grew = true
      }
    }
  }
  return result
}

const buildNode = (
  config: GraphConfig,
  input: DiagramGraphNode,
  previous: GraphNode | undefined,
): GraphNode => {
  const owner = `Node "${input.id}"`
  if (!config.supportsParents && input.parentId) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `${owner}: parentId is only supported in business processes`,
    )
  }
  if (!config.supportsData && input.data) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `${owner}: data is only supported in business processes`,
    )
  }

  const type = input.type ? toFullType(config, input.type, 'Node', owner) : previous?.type
  if (!type)
    throw new BadRequestException('BAD_REQUEST', `${owner}: type is required for new nodes`)

  const shortType = toShortType(config, type)
  const inputData = input.data ?? {}
  const base =
    previous && previous.type === type
      ? asRecord(previous.data)
      : config.newNodeData(shortType, inputData)
  const data: DataRecord = {
    ...base,
    ...inputData,
    ...(config.supportsData ? { kind: shortType } : {}),
    text: input.text ?? textOf(previous?.data),
  }

  const node: GraphNode = {
    ...(previous ?? {}),
    id: input.id,
    type,
    position: input.position ?? previous?.position ?? { x: 0, y: 0 },
    data,
  }

  if (input.size) setSize(node, input.size)
  else if (!previous) setSize(node, config.defaultSize(data))

  const boundaryActivity = config.boundaryActivityId(data)
  const parentId =
    input.parentId === null
      ? undefined
      : (input.parentId ?? (previous ? previous.parentId : undefined) ?? boundaryActivity)
  if (parentId) {
    node.parentId = parentId
    // Boundary events sit on their activity's border, so they must not be clamped inside it.
    if (boundaryActivity === parentId) delete node.extent
    else node.extent = 'parent'
  } else {
    delete node.parentId
    delete node.extent
  }
  return node
}

const buildEdge = (
  config: GraphConfig,
  input: DiagramGraphEdge,
  previous: GraphEdge | undefined,
  id: string,
): GraphEdge => {
  const owner = `Edge "${input.id ?? `${input.source} -> ${input.target}`}"`
  if (!config.supportsData && input.data) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `${owner}: data is only supported in business processes`,
    )
  }

  const type = input.type
    ? toFullType(config, input.type, 'Edge', owner)
    : (previous?.type ?? config.defaultEdgeType)
  const shortType = toShortType(config, type)
  const base =
    previous && previous.type === type ? asRecord(previous.data) : config.newEdgeData(shortType)

  const sameEndpoints = previous?.source === input.source && previous?.target === input.target
  return {
    ...(previous ?? {}),
    id,
    type,
    source: input.source,
    target: input.target,
    // Placeholders until the layout is known; see `pickHandles`.
    sourceHandle: input.sourceHandle ?? (sameEndpoints ? previous.sourceHandle : ''),
    targetHandle: input.targetHandle ?? (sameEndpoints ? previous.targetHandle : ''),
    data: { ...base, ...(input.data ?? {}), text: input.text ?? textOf(previous?.data) },
  }
}

/**
 * Graph → diagram. `merge` updates the given nodes and edges and keeps the
 * others; `replace` removes nodes and edges that are not given. Existing
 * elements are matched by id, so positions, sizes and other properties chosen
 * in the editor are kept. Areas are never touched.
 */
export const applyDiagramGraph = (
  type: DiagramGraphType,
  currentDocument: GraphDocument,
  update: DiagramGraphUpdate,
  mode: SchemaApplyMode,
) => {
  const config = CONFIGS[type]
  // Yjs maps hand out their internal objects, and the layout below mutates
  // nodes in place, so work on a copy to never touch the document directly.
  const current = structuredClone(currentDocument)

  assertUniqueIds(update)

  const currentNodes = new Map(current.nodes.map((node) => [node.id, node]))
  const givenNodeIds = new Set(update.nodes.map((node) => node.id))

  const removedNodeIds = withDescendants(
    current.nodes,
    new Set([
      ...update.removeNodeIds.filter((id) => currentNodes.has(id)),
      ...(mode === 'replace'
        ? current.nodes.filter((node) => !givenNodeIds.has(node.id)).map((node) => node.id)
        : []),
    ]),
  )
  for (const id of givenNodeIds) removedNodeIds.delete(id)

  // Nodes: given ones are created or updated, the rest kept unless removed.
  const autoPlaced = new Set<string>()
  const builtNodes = new Map<string, GraphNode>()
  for (const input of update.nodes) {
    const previous = currentNodes.get(input.id)
    const node = buildNode(config, input, previous)
    const parentChanged = previous && previous.parentId !== node.parentId
    if (!input.position && (!previous || parentChanged)) autoPlaced.add(node.id)
    builtNodes.set(node.id, node)
  }
  let nodes = [
    ...current.nodes
      .filter((node) => !removedNodeIds.has(node.id))
      .map((node) => builtNodes.get(node.id) ?? node),
    ...update.nodes
      .filter((input) => !currentNodes.has(input.id))
      .map((input) => builtNodes.get(input.id) as GraphNode),
  ]
  const nodeIds = new Set(nodes.map((node) => node.id))

  // Edges: matched by id, or — when no id is given — by endpoints and type, so
  // sending the same graph twice does not duplicate them.
  const currentEdges = new Map(current.edges.map((edge) => [edge.id, edge]))
  const givenEdgeIds = new Set<string>()
  const builtEdges = new Map<string, GraphEdge>()
  const pendingHandles = new Set<string>()
  for (const input of update.edges) {
    const owner = `Edge "${input.id ?? `${input.source} -> ${input.target}`}"`
    for (const endpoint of [input.source, input.target]) {
      if (!nodeIds.has(endpoint)) {
        throw new BadRequestException('BAD_REQUEST', `${owner}: node "${endpoint}" does not exist`)
      }
    }
    const fullType = input.type ? toFullType(config, input.type, 'Edge', owner) : undefined
    const previous = input.id
      ? currentEdges.get(input.id)
      : current.edges.find(
          (edge) =>
            !givenEdgeIds.has(edge.id) &&
            edge.source === input.source &&
            edge.target === input.target &&
            edge.type === (fullType ?? config.defaultEdgeType),
        )
    const id = input.id ?? previous?.id ?? randomUUID()
    const edge = buildEdge(config, input, previous, id)
    if (!edge.sourceHandle || !edge.targetHandle) pendingHandles.add(id)
    givenEdgeIds.add(id)
    builtEdges.set(id, edge)
  }

  const removedEdgeIds = new Set(
    current.edges
      .filter(
        (edge) =>
          !givenEdgeIds.has(edge.id) &&
          (update.removeEdgeIds.includes(edge.id) ||
            mode === 'replace' ||
            removedNodeIds.has(edge.source) ||
            removedNodeIds.has(edge.target)),
      )
      .map((edge) => edge.id),
  )
  const edges = [
    ...current.edges
      .filter((edge) => !removedEdgeIds.has(edge.id))
      .map((edge) => builtEdges.get(edge.id) ?? edge),
    ...[...builtEdges.values()].filter((edge) => !currentEdges.has(edge.id)),
  ]

  layoutNodes(config, nodes, edges, autoPlaced)
  nodes = config.layoutLanes(config.cleanReferences(nodes, removedNodeIds, removedEdgeIds))

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  for (const edge of edges) {
    if (!pendingHandles.has(edge.id)) continue
    const handles = pickHandles(config, edge, nodesById)
    edge.sourceHandle ||= handles.sourceHandle
    edge.targetHandle ||= handles.targetHandle
  }

  const document: GraphDocument = { nodes, edges, areas: current.areas }
  assertValidDocument(config, document)

  const summary: GraphApplySummary = {
    nodesCreated: update.nodes.filter((node) => !currentNodes.has(node.id)).map((node) => node.id),
    nodesUpdated: update.nodes.filter((node) => currentNodes.has(node.id)).map((node) => node.id),
    nodesRemoved: [...removedNodeIds],
    edgesCreated: [...builtEdges.keys()].filter((id) => !currentEdges.has(id)),
    edgesUpdated: [...builtEdges.keys()].filter((id) => currentEdges.has(id)),
    edgesRemoved: [...removedEdgeIds],
  }
  return { ...document, summary }
}
