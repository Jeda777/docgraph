import { PARTICIPANT_LANE_END_INSET, PARTICIPANT_LANE_START_INSET } from '@docgraph/common/diagram'
import type { DiagramHandleId } from '@docgraph/common/schemas'
import {
  asRecord,
  type GraphConfig,
  type GraphEdge,
  type GraphNode,
  type Position,
  type Size,
  setSize,
  sizeOf,
} from './diagram-graph.model'

/** Automatic placement of nodes sent without a position, and of edge handles. */

const ROOT_ORIGIN = { x: 40, y: 40 }
const CHILD_PADDING = { x: 60, y: 40 }
const GAP_X = 80
const GAP_Y = 60
const CONTAINER_PADDING = 40
// Lanes start after the pool's label strip: on the left of horizontal pools, on top of
// vertical ones (see `layoutParticipantLanes`).
const POOL_LABEL = { x: 34, y: 28 }

/** Absolute top-left corner of a node, following its parent chain. */
const absolutePosition = (node: GraphNode, nodesById: Map<string, GraphNode>): Position => {
  let { x, y } = node.position
  const seen = new Set([node.id])
  let parent = node.parentId ? nodesById.get(node.parentId) : undefined
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id)
    x += parent.position.x
    y += parent.position.y
    parent = parent.parentId ? nodesById.get(parent.parentId) : undefined
  }
  return { x, y }
}

/** Connects the facing sides of two nodes: right → left for flows going right, and so on. */
export const pickHandles = (
  config: GraphConfig,
  edge: GraphEdge,
  nodesById: Map<string, GraphNode>,
): { sourceHandle: DiagramHandleId; targetHandle: DiagramHandleId } => {
  const source = nodesById.get(edge.source)
  const target = nodesById.get(edge.target)
  if (!source || !target) return { sourceHandle: 'right', targetHandle: 'left' }

  const center = (node: GraphNode) => {
    const position = absolutePosition(node, nodesById)
    const size = sizeOf(config, node)
    return { x: position.x + size.width / 2, y: position.y + size.height / 2 }
  }
  const from = center(source)
  const to = center(target)
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}

/** Column of each node in a left-to-right flow: the longest path reaching it. */
const rankNodes = (ids: string[], edges: GraphEdge[]) => {
  const idSet = new Set(ids)
  const inner = edges.filter(
    (edge) => idSet.has(edge.source) && idSet.has(edge.target) && edge.source !== edge.target,
  )
  const rank = new Map(ids.map((id) => [id, 0]))
  const incoming = new Map(ids.map((id) => [id, 0]))
  for (const edge of inner) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)

  const queue = ids.filter((id) => incoming.get(id) === 0)
  const visited = new Set<string>()
  while (queue.length) {
    const id = queue.shift() as string
    visited.add(id)
    for (const edge of inner.filter((entry) => entry.source === id)) {
      rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, (rank.get(id) ?? 0) + 1))
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) - 1)
      if (incoming.get(edge.target) === 0) queue.push(edge.target)
    }
  }

  // Nodes on a cycle never reach zero incoming edges, and neither do the nodes after one
  // (`entry → A ↔ B → exit` leaves A, B and exit unvisited). All of them share the column
  // after the acyclic part. Only visited nodes count: an unvisited node may already hold a
  // partial rank from an edge into the cycle, which would leave an empty column.
  const afterAcyclic = visited.size
    ? Math.max(...[...visited].map((id) => rank.get(id) ?? 0)) + 1
    : 0
  for (const id of ids) if (!visited.has(id)) rank.set(id, afterAcyclic)
  return rank
}

/**
 * Places nodes that came without a position: per container (top level, pool,
 * lane), new nodes form a left-to-right flow below what is already there, and
 * containers grow to fit their content.
 */
export const layoutNodes = (
  config: GraphConfig,
  nodes: GraphNode[],
  edges: GraphEdge[],
  autoPlaced: ReadonlySet<string>,
) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const childrenOf = new Map<string, GraphNode[]>()
  for (const node of nodes) {
    const key = node.parentId ?? ''
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), node])
  }

  for (const [parentKey, children] of childrenOf) {
    const auto = children.filter((node) => autoPlaced.has(node.id))
    if (!auto.length) continue
    const parent = parentKey ? nodesById.get(parentKey) : undefined

    // Boundary events go to the bottom border of their activity.
    const flow: GraphNode[] = []
    for (const node of auto) {
      if (parent && config.boundaryActivityId(node.data) === parent.id) {
        const activity = sizeOf(config, parent)
        const size = sizeOf(config, node)
        node.position = {
          x: (activity.width - size.width) / 2,
          y: activity.height - size.height / 2,
        }
      } else if (!config.isLane(node.data)) {
        flow.push(node)
      }
    }
    if (!flow.length) continue

    const placed = children.filter((node) => !autoPlaced.has(node.id))
    const origin = parent ? CHILD_PADDING : ROOT_ORIGIN
    const top = placed.length
      ? Math.max(...placed.map((node) => node.position.y + sizeOf(config, node).height)) + GAP_Y
      : origin.y
    const left =
      placed.length && !parent ? Math.min(...placed.map((node) => node.position.x)) : origin.x

    const sizes = new Map(flow.map((node) => [node.id, sizeOf(config, node)]))
    const columnWidth = Math.max(...[...sizes.values()].map((size) => size.width)) + GAP_X
    const rowHeight = Math.max(...[...sizes.values()].map((size) => size.height)) + GAP_Y
    const rank = rankNodes(
      flow.map((node) => node.id),
      edges,
    )
    const rowsUsed = new Map<number, number>()
    for (const node of flow) {
      const column = rank.get(node.id) ?? 0
      const row = rowsUsed.get(column) ?? 0
      rowsUsed.set(column, row + 1)
      const size = sizes.get(node.id) as Size
      node.position = {
        x: left + column * columnWidth + (columnWidth - GAP_X - size.width) / 2,
        y: top + row * rowHeight + (rowHeight - GAP_Y - size.height) / 2,
      }
    }
  }

  // Deepest containers first, so a lane has its final size before its pool grows around it.
  const depth = (node: GraphNode) => {
    let level = 0
    let current = node
    const seen = new Set([node.id])
    while (current.parentId && nodesById.has(current.parentId) && !seen.has(current.parentId)) {
      seen.add(current.parentId)
      current = nodesById.get(current.parentId) as GraphNode
      level++
    }
    return level
  }
  const containers = nodes
    .filter((node) => config.isContainer(node.data) && childrenOf.has(node.id))
    .sort((a, b) => depth(b) - depth(a))

  // Containers that grew, so their own container grows around them in turn.
  const resized = new Set<string>()
  for (const container of containers) {
    const children = childrenOf.get(container.id) ?? []
    const vertical = asRecord(container.data).orientation === 'vertical'
    const along = vertical ? 'x' : 'y'
    const across = vertical ? 'y' : 'x'
    const span = (node: GraphNode) => {
      const size = sizeOf(config, node)
      return vertical ? size.width : size.height
    }

    // New lanes are stacked after the existing ones.
    const lanes = children.filter((node) => config.isLane(node.data))
    let offset = Math.max(
      PARTICIPANT_LANE_START_INSET,
      ...lanes
        .filter((lane) => !autoPlaced.has(lane.id))
        .map((lane) => lane.position[along] + span(lane)),
    )
    for (const lane of lanes.filter((node) => autoPlaced.has(node.id))) {
      lane.position = {
        [along]: offset,
        [across]: vertical ? POOL_LABEL.y : POOL_LABEL.x,
      } as Position
      offset += span(lane)
    }

    const inner = children.filter((node) => config.boundaryActivityId(node.data) !== container.id)
    if (!inner.some((node) => autoPlaced.has(node.id) || resized.has(node.id))) continue
    const size = sizeOf(config, container)
    const content = inner.filter((node) => !config.isLane(node.data))
    const needed = {
      width: Math.max(
        size.width,
        ...content.map((node) => node.position.x + sizeOf(config, node).width + CONTAINER_PADDING),
      ),
      height: Math.max(
        size.height,
        ...content.map((node) => node.position.y + sizeOf(config, node).height + CONTAINER_PADDING),
      ),
    }
    if (lanes.length) {
      // Lanes fill the container one after another (see `layoutParticipantLanes`), so it must
      // hold all of them along its axis and the widest one across it.
      const sizes = lanes.map((lane) => sizeOf(config, lane))
      const total = sizes.reduce(
        (sum, laneSize) => sum + (vertical ? laneSize.width : laneSize.height),
        0,
      )
      const widest = Math.max(
        ...sizes.map((laneSize) => (vertical ? laneSize.height : laneSize.width)),
      )
      const alongSize = total + PARTICIPANT_LANE_START_INSET + PARTICIPANT_LANE_END_INSET
      const acrossSize =
        widest + (vertical ? POOL_LABEL.y : POOL_LABEL.x) + PARTICIPANT_LANE_END_INSET
      needed.width = Math.max(needed.width, vertical ? alongSize : acrossSize)
      needed.height = Math.max(needed.height, vertical ? acrossSize : alongSize)
    }
    if (needed.width !== size.width || needed.height !== size.height) {
      setSize(container, needed)
      resized.add(container.id)
    }
  }
}
