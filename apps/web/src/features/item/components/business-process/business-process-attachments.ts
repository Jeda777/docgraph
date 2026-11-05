import { businessProcessNodeSize, type DiagramNodeSize } from '@docgraph/common/diagram'
import type { BusinessProcessNode } from './business-process-node'

export const attachBoundaryEventToActivity = (
  activityId: string,
  activitySize: DiagramNodeSize,
  eventSize: DiagramNodeSize,
) => ({
  parentId: activityId,
  extent: undefined,
  position: {
    x: (activitySize.width - eventSize.width) / 2,
    y: activitySize.height - eventSize.height / 2,
  },
})

export const detachBoundaryEventPosition = (
  activityPosition: { x: number; y: number },
  eventPosition: { x: number; y: number },
) => ({
  x: activityPosition.x + eventPosition.x,
  y: activityPosition.y + eventPosition.y,
})

export const detachBoundaryEventFromActivity = <Extent>(
  activity: {
    parentId?: string
    extent?: Extent
    position: { x: number; y: number }
  },
  eventPosition: { x: number; y: number },
) => ({
  parentId: activity.parentId,
  extent: activity.parentId ? activity.extent : undefined,
  position: detachBoundaryEventPosition(activity.position, eventPosition),
})

export const normalizeBoundaryEventAttachments = (nodes: BusinessProcessNode[]) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  let changed = false
  const normalized = nodes.map((node) => {
    if (node.data.kind !== 'event' || node.data.context !== 'boundary' || !node.data.attachedToId)
      return node

    const activity = nodesById.get(node.data.attachedToId)
    if (activity?.data.kind !== 'activity') return node

    const activitySize = businessProcessNodeSize(activity)
    const eventSize = businessProcessNodeSize(node)
    const centerX = node.position.x + eventSize.width / 2
    const centerY = node.position.y + eventSize.height / 2
    const within = (value: number, min: number, max: number) => value >= min - 1 && value <= max + 1
    const isOnActivityBoundary =
      (Math.abs(centerY) < 1 && within(centerX, 0, activitySize.width)) ||
      (Math.abs(centerY - activitySize.height) < 1 && within(centerX, 0, activitySize.width)) ||
      (Math.abs(centerX) < 1 && within(centerY, 0, activitySize.height)) ||
      (Math.abs(centerX - activitySize.width) < 1 && within(centerY, 0, activitySize.height))

    if (node.parentId === activity.id && node.extent === undefined && isOnActivityBoundary) {
      return node
    }

    changed = true
    return {
      ...node,
      ...attachBoundaryEventToActivity(activity.id, activitySize, eventSize),
    }
  })

  return changed ? normalized : nodes
}
