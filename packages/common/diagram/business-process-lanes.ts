import type { BusinessProcessNodeData } from '../schemas/business-process'
import { businessProcessNodeDefaultSize, type DiagramNodeSize } from './diagram-defaults'

/**
 * Lane layout of business process pools and lanes, shared by the web editor
 * (which runs it after every local edit) and the server (MCP writes), so both
 * produce the same geometry.
 */

/** The node fields the lane layout reads; React Flow nodes and stored nodes both fit. */
export type ParticipantLayoutNode = {
  id: string
  parentId?: string
  position: { x: number; y: number }
  width?: number
  height?: number
  measured?: { width?: number; height?: number }
  style?: { width?: unknown; height?: unknown }
  extent?: unknown
  data: BusinessProcessNodeData
}

export const MIN_PARTICIPANT_LANE_SIZE = 72
export const PARTICIPANT_LANE_START_INSET = 2
export const PARTICIPANT_LANE_END_INSET = 2

const participantLabelInset = (
  containerSize: DiagramNodeSize,
  orientation: 'horizontal' | 'vertical',
) =>
  orientation === 'horizontal'
    ? Math.min(34, containerSize.width * 0.2)
    : Math.min(28, containerSize.height * 0.24)

const laneAxis = (orientation: 'horizontal' | 'vertical') =>
  orientation === 'horizontal' ? 'height' : 'width'

const lanePositionAxis = (orientation: 'horizontal' | 'vertical') =>
  (orientation === 'horizontal' ? 'y' : 'x') as 'x' | 'y'

/** Stored size of a node, falling back to the default size of a new node of its kind. */
export const businessProcessNodeSize = (node: ParticipantLayoutNode): DiagramNodeSize => {
  const fallback = businessProcessNodeDefaultSize(node.data)
  const size = (dimension: 'width' | 'height') => {
    const value = Number(node[dimension] ?? node.style?.[dimension] ?? node.measured?.[dimension])
    return Number.isFinite(value) && value > 0 ? value : fallback[dimension]
  }
  return { width: size('width'), height: size('height') }
}

const isLaneNode = (node: ParticipantLayoutNode) =>
  node.data.kind === 'participant' && node.data.participantType === 'lane'

type ParticipantNodeIndex = {
  childrenByParentId: Map<string, ParticipantLayoutNode[]>
}

// Lane layout runs on every local edit (drag frames included) and asks for many minimums over
// the same node array, so the parent → children index is built once per array.
const participantNodeIndexCache = new WeakMap<
  readonly ParticipantLayoutNode[],
  ParticipantNodeIndex
>()

const participantNodeIndex = (nodes: readonly ParticipantLayoutNode[]) => {
  const cached = participantNodeIndexCache.get(nodes)
  if (cached) return cached

  const childrenByParentId = new Map<string, ParticipantLayoutNode[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const siblings = childrenByParentId.get(node.parentId)
    if (siblings) siblings.push(node)
    else childrenByParentId.set(node.parentId, [node])
  }
  const index = { childrenByParentId }
  participantNodeIndexCache.set(nodes, index)
  return index
}

/**
 * Smallest size that fits the container's own content. Content of nested lanes is left out:
 * those lanes report their own minimums.
 */
const descendantContentMinimum = (
  container: ParticipantLayoutNode,
  nodes: readonly ParticipantLayoutNode[],
): DiagramNodeSize => {
  const { childrenByParentId } = participantNodeIndex(nodes)
  let width = MIN_PARTICIPANT_LANE_SIZE
  let height = MIN_PARTICIPANT_LANE_SIZE
  const visited = new Set([container.id])
  const pending: { node: ParticipantLayoutNode; x: number; y: number }[] = (
    childrenByParentId.get(container.id) ?? []
  ).map((node) => ({ node, x: node.position.x, y: node.position.y }))

  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    const { node, x, y } = entry
    if (visited.has(node.id) || isLaneNode(node)) continue
    visited.add(node.id)

    const size = businessProcessNodeSize(node)
    width = Math.max(width, x + size.width)
    height = Math.max(height, y + size.height)
    for (const child of childrenByParentId.get(node.id) ?? []) {
      pending.push({ node: child, x: x + child.position.x, y: y + child.position.y })
    }
  }

  return { width, height }
}

export const minimumParticipantNodeSize = (
  node: ParticipantLayoutNode,
  nodes: readonly ParticipantLayoutNode[],
  orientation = node.data.kind === 'participant' ? node.data.orientation : 'horizontal',
  ancestors = new Set<string>(),
): DiagramNodeSize => {
  if (ancestors.has(node.id)) {
    return { width: MIN_PARTICIPANT_LANE_SIZE, height: MIN_PARTICIPANT_LANE_SIZE }
  }

  const contentMinimum = descendantContentMinimum(node, nodes)
  const lanes = (participantNodeIndex(nodes).childrenByParentId.get(node.id) ?? []).filter(
    isLaneNode,
  )
  if (!lanes.length) return contentMinimum

  const nextAncestors = new Set(ancestors).add(node.id)
  const laneMinimums = lanes.map((lane) =>
    minimumParticipantNodeSize(lane, nodes, orientation, nextAncestors),
  )
  const laneMinimum = minimumParticipantContainerSize(lanes.length, orientation, laneMinimums)
  return {
    width: Math.max(contentMinimum.width, laneMinimum.width),
    height: Math.max(contentMinimum.height, laneMinimum.height),
  }
}

export const businessProcessNodeZIndex = (node: ParticipantLayoutNode) =>
  node.data.kind === 'participant' ? (node.data.participantType === 'pool' ? -2 : -1) : undefined

export const orderParticipantLanes = <T extends ParticipantLayoutNode>(
  lanes: T[],
  orientation: 'horizontal' | 'vertical',
): T[] =>
  [...lanes].sort((left, right) =>
    orientation === 'horizontal'
      ? left.position.y - right.position.y
      : left.position.x - right.position.x,
  )

export const sizeParticipantContainerForLanes = (
  size: DiagramNodeSize,
  laneCount: number,
  orientation: 'horizontal' | 'vertical',
  laneMinimums?: DiagramNodeSize[],
): DiagramNodeSize => {
  const minimum = minimumParticipantContainerSize(laneCount, orientation, laneMinimums)
  return {
    width: Math.max(size.width, minimum.width),
    height: Math.max(size.height, minimum.height),
  }
}

export const minimumParticipantContainerSize = (
  laneCount: number,
  orientation: 'horizontal' | 'vertical',
  laneMinimums: DiagramNodeSize[] = [],
): DiagramNodeSize => {
  const axis = laneAxis(orientation)
  const crossAxis = axis === 'height' ? 'width' : 'height'
  const minLaneSpan = Array.from({ length: laneCount }, (_, index) =>
    Math.max(MIN_PARTICIPANT_LANE_SIZE, laneMinimums[index]?.[axis] ?? 0),
  ).reduce((sum, size) => sum + size, 0)
  const minCrossSpan = laneCount
    ? Math.max(MIN_PARTICIPANT_LANE_SIZE, ...laneMinimums.map((minimum) => minimum[crossAxis]))
    : 0
  const axisInsets = PARTICIPANT_LANE_START_INSET + PARTICIPANT_LANE_END_INSET

  return orientation === 'horizontal'
    ? {
        width: minCrossSpan + 34 + PARTICIPANT_LANE_END_INSET,
        height: minLaneSpan + axisInsets,
      }
    : {
        width: minLaneSpan + axisInsets,
        height: minCrossSpan + 28 + PARTICIPANT_LANE_END_INSET,
      }
}

const distributeSizes = (available: number, weights: number[], minimums: number[]) => {
  const sizes = [...minimums]
  let remaining = Math.max(
    available,
    minimums.reduce((sum, size) => sum + size, 0),
  )
  let active = weights.map((_, index) => index)

  while (active.length) {
    const totalWeight = active.reduce((sum, index) => sum + Math.max(1, weights[index]), 0)
    const belowMinimum = active.filter(
      (index) => (remaining * Math.max(1, weights[index])) / totalWeight < minimums[index],
    )

    if (!belowMinimum.length) {
      for (const index of active) {
        sizes[index] = (remaining * Math.max(1, weights[index])) / totalWeight
      }
      break
    }

    for (const index of belowMinimum) {
      sizes[index] = minimums[index]
      remaining -= minimums[index]
    }
    active = active.filter((index) => !belowMinimum.includes(index))
  }

  return sizes
}

export const layoutParticipantLanes = <T extends ParticipantLayoutNode>(
  lanes: T[],
  containerSize: DiagramNodeSize,
  orientation: 'horizontal' | 'vertical',
  weights = lanes.map((lane) => businessProcessNodeSize(lane)[laneAxis(orientation)]),
  laneMinimums: DiagramNodeSize[] = [],
) => {
  if (!lanes.length) return []

  const axis = laneAxis(orientation)
  const crossAxis = axis === 'height' ? 'width' : 'height'
  const crossInset = participantLabelInset(containerSize, orientation)
  const minimumSizes = lanes.map((_, index) =>
    Math.max(MIN_PARTICIPANT_LANE_SIZE, laneMinimums[index]?.[axis] ?? 0),
  )
  const available = containerSize[axis] - PARTICIPANT_LANE_START_INSET - PARTICIPANT_LANE_END_INSET
  const sizes = distributeSizes(available, weights, minimumSizes)
  const minimumCrossSize = lanes.length
    ? Math.max(MIN_PARTICIPANT_LANE_SIZE, ...laneMinimums.map((minimum) => minimum[crossAxis]))
    : MIN_PARTICIPANT_LANE_SIZE
  const crossSize = Math.max(
    minimumCrossSize,
    containerSize[crossAxis] - crossInset - PARTICIPANT_LANE_END_INSET,
  )
  let offset = PARTICIPANT_LANE_START_INSET

  return lanes.map((lane, index) => {
    const size = sizes[index]
    const laneWithoutExtent = { ...lane }
    delete laneWithoutExtent.extent
    const nextLane = {
      ...laneWithoutExtent,
      width: axis === 'width' ? size : crossSize,
      height: axis === 'height' ? size : crossSize,
      position:
        orientation === 'horizontal' ? { x: crossInset, y: offset } : { x: offset, y: crossInset },
      style: {
        ...lane.style,
        width: axis === 'width' ? size : crossSize,
        height: axis === 'height' ? size : crossSize,
      },
      data: lane.data.kind === 'participant' ? { ...lane.data, orientation } : lane.data,
    }
    offset += size
    return nextLane
  })
}

export const resizeAdjacentParticipantLanes = <T extends ParticipantLayoutNode>(
  lanes: T[],
  laneId: string,
  requestedSize: number,
  orientation: 'horizontal' | 'vertical',
  minimumSizes: number[] = [],
) => {
  const ordered = orderParticipantLanes(lanes, orientation)
  const laneIndex = ordered.findIndex((lane) => lane.id === laneId)
  const nextLaneIndex = laneIndex + 1
  if (laneIndex < 0 || nextLaneIndex >= ordered.length) return ordered

  const axis = laneAxis(orientation)
  const positionAxis = lanePositionAxis(orientation)
  const lane = ordered[laneIndex]
  const nextLane = ordered[nextLaneIndex]
  const laneSize = businessProcessNodeSize(lane)[axis]
  const nextLaneSize = businessProcessNodeSize(nextLane)[axis]
  const totalSize = laneSize + nextLaneSize
  const laneMinimum = Math.max(MIN_PARTICIPANT_LANE_SIZE, minimumSizes[laneIndex] ?? 0)
  const nextLaneMinimum = Math.max(MIN_PARTICIPANT_LANE_SIZE, minimumSizes[nextLaneIndex] ?? 0)
  const nextSize = Math.min(totalSize - nextLaneMinimum, Math.max(laneMinimum, requestedSize))
  const resizedNext = {
    ...nextLane,
    width: axis === 'width' ? totalSize - nextSize : businessProcessNodeSize(nextLane).width,
    height: axis === 'height' ? totalSize - nextSize : businessProcessNodeSize(nextLane).height,
    position: {
      ...nextLane.position,
      [positionAxis]: lane.position[positionAxis] + nextSize,
    },
    style: {
      ...nextLane.style,
      [axis]: totalSize - nextSize,
    },
  }
  const resizedLane = {
    ...lane,
    width: axis === 'width' ? nextSize : businessProcessNodeSize(lane).width,
    height: axis === 'height' ? nextSize : businessProcessNodeSize(lane).height,
    style: {
      ...lane.style,
      [axis]: nextSize,
    },
  }

  return ordered.map((entry, index) =>
    index === laneIndex ? resizedLane : index === nextLaneIndex ? resizedNext : entry,
  )
}

/**
 * Lays out the lanes of every participant that has them: grows each container to fit its
 * lanes' content and stacks the lanes inside it. Outer participants go first, so nested
 * lanes are laid out in their final size. Returns `nodes` itself when nothing changes.
 */
export const layoutAllParticipantLanes = <T extends ParticipantLayoutNode>(nodes: T[]): T[] => {
  const containerIds = new Set<string>()
  for (const node of nodes) {
    if (node.parentId && isLaneNode(node)) containerIds.add(node.parentId)
  }
  if (!containerIds.size) return nodes

  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]))
  const depth = (id: string) => {
    let count = 0
    const visited = new Set<string>()
    for (let parent = parentById.get(id); parent && !visited.has(parent); count++) {
      visited.add(parent)
      parent = parentById.get(parent)
    }
    return count
  }
  const orderedContainerIds = [...containerIds].sort((left, right) => depth(left) - depth(right))

  let next = nodes
  for (const containerId of orderedContainerIds) {
    const container = next.find((node) => node.id === containerId)
    if (container?.data.kind !== 'participant') continue

    const { orientation } = container.data
    const lanes = orderParticipantLanes(
      (participantNodeIndex(next).childrenByParentId.get(containerId) ?? []).filter(
        isLaneNode,
      ) as T[],
      orientation,
    )
    const laneMinimums = lanes.map((lane) => minimumParticipantNodeSize(lane, next, orientation))
    const size = businessProcessNodeSize(container)
    const nextSize = sizeParticipantContainerForLanes(size, lanes.length, orientation, laneMinimums)
    const laidOut = layoutParticipantLanes(lanes, nextSize, orientation, undefined, laneMinimums)
    const containerChanged = size.width !== nextSize.width || size.height !== nextSize.height
    const changedLanes = new Map(
      laidOut
        .filter((lane, index) => {
          const current = lanes[index]
          const currentSize = businessProcessNodeSize(current)
          const laneSize = businessProcessNodeSize(lane)
          return (
            current.position.x !== lane.position.x ||
            current.position.y !== lane.position.y ||
            currentSize.width !== laneSize.width ||
            currentSize.height !== laneSize.height ||
            current.data.kind !== 'participant' ||
            current.data.orientation !== orientation ||
            current.extent !== undefined
          )
        })
        .map((lane) => [lane.id, lane]),
    )
    if (!containerChanged && !changedLanes.size) continue

    next = next.map((node) => {
      if (node.id === containerId && containerChanged) {
        return {
          ...node,
          width: nextSize.width,
          height: nextSize.height,
          style: { ...node.style, ...nextSize },
        } as T
      }
      return changedLanes.get(node.id) ?? node
    })
  }
  return next
}
