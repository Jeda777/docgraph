import {
  type DiagramNodeSize,
  minimumParticipantNodeSize,
  orderParticipantLanes,
} from '@docgraph/common/diagram'
import type { BusinessProcessNodeData } from '@docgraph/common/schemas'
import { type ReactFlowState, useStore } from '@xyflow/react'
import { useRef } from 'react'
import type { BusinessProcessNode } from '../components/business-process/business-process-node'

export type BusinessProcessLaneNode = BusinessProcessNode & {
  data: Extract<BusinessProcessNodeData, { kind: 'participant' }> & { participantType: 'lane' }
}

export type BusinessProcessLaneState = {
  /** The participant node itself, so its size stays in sync with the store. */
  node: BusinessProcessNode | undefined
  /** Child lanes, ordered along the participant orientation. */
  lanes: BusinessProcessLaneNode[]
  /** Minimum size of each entry in `lanes`, derived from the lane content. */
  laneMinimums: DiagramNodeSize[]
  /** Lanes sharing this lane's parent, ordered; empty for pools. */
  siblingLanes: BusinessProcessLaneNode[]
}

const EMPTY_LANE_STATE: BusinessProcessLaneState = {
  node: undefined,
  lanes: [],
  laneMinimums: [],
  siblingLanes: [],
}

const isBusinessProcessLane = (node: BusinessProcessNode): node is BusinessProcessLaneNode =>
  node.data.kind === 'participant' && node.data.participantType === 'lane'

const sameItems = <T>(left: readonly T[], right: readonly T[]) =>
  left.length === right.length && left.every((item, index) => item === right[index])

const sameSizes = (left: readonly DiagramNodeSize[], right: readonly DiagramNodeSize[]) =>
  left.length === right.length &&
  left.every(
    (size, index) => size.width === right[index].width && size.height === right[index].height,
  )

const isSameLaneState = (left: BusinessProcessLaneState, right: BusinessProcessLaneState) =>
  left === right ||
  (left.node === right.node &&
    sameItems(left.lanes, right.lanes) &&
    sameItems(left.siblingLanes, right.siblingLanes) &&
    sameSizes(left.laneMinimums, right.laneMinimums))

/**
 * Lane layout state for a business process participant. Non-participants get a shared empty
 * state, so they never re-render on unrelated node changes; participants
 * re-render only when their own lanes, siblings or lane minimums change.
 */
export const useBusinessProcessLanes = (
  id: string,
  data: BusinessProcessNodeData,
  parentId: string | undefined,
): BusinessProcessLaneState => {
  const orientation = data.kind === 'participant' ? data.orientation : undefined
  const isLane = data.kind === 'participant' && data.participantType === 'lane'
  // The store also changes on viewport moves; skip the lane walk when nodes did not change.
  const cache = useRef<{
    nodes: unknown
    key: string
    state: BusinessProcessLaneState
  } | null>(null)

  const selector = (state: ReactFlowState) => {
    if (!orientation) return EMPTY_LANE_STATE
    const key = `${id}|${parentId}|${orientation}|${isLane}`
    if (cache.current?.nodes === state.nodes && cache.current.key === key) {
      return cache.current.state
    }

    const nodes = state.nodes as BusinessProcessNode[]
    const lanes = orderParticipantLanes(
      nodes.filter(
        (node): node is BusinessProcessLaneNode =>
          node.parentId === id && isBusinessProcessLane(node),
      ),
      orientation,
    )
    const laneState: BusinessProcessLaneState = {
      node: state.nodeLookup.get(id)?.internals.userNode as BusinessProcessNode | undefined,
      lanes,
      laneMinimums: lanes.map((lane) => minimumParticipantNodeSize(lane, nodes, orientation)),
      siblingLanes:
        isLane && parentId
          ? orderParticipantLanes(
              nodes.filter(
                (node): node is BusinessProcessLaneNode =>
                  node.parentId === parentId && isBusinessProcessLane(node),
              ),
              orientation,
            )
          : [],
    }
    cache.current = { nodes: state.nodes, key, state: laneState }
    return laneState
  }

  return useStore(selector, isSameLaneState)
}
