import {
  businessProcessNodeSize,
  type DiagramNodeSize,
  layoutParticipantLanes,
  MIN_PARTICIPANT_LANE_SIZE,
  minimumParticipantContainerSize,
  minimumParticipantNodeSize,
  orderParticipantLanes,
  resizeAdjacentParticipantLanes,
} from '@docgraph/common/diagram'
import type { BusinessProcessNodeData, BusinessProcessNodeType } from '@docgraph/common/schemas'
import {
  type Node,
  type NodeProps,
  NodeResizeControl,
  NodeResizer,
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  Position,
  ResizeControlVariant,
  type ShouldResize,
  useReactFlow,
} from '@xyflow/react'
import { type CSSProperties, memo, useCallback, useRef, useState } from 'react'
import {
  type BusinessProcessLaneNode,
  useBusinessProcessLanes,
} from '../../hooks/use-business-process-lanes'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { BaseNode } from '../base/base-node'
import { useDiagramMutationContext } from '../base/diagram-canvas'
import { EditableNodeText } from '../base/editable-node-text'
import { NodeHandle } from '../base/node-handle'
import { attachBoundaryEventToActivity } from './business-process-attachments'
import { businessProcessTextColor, renderBusinessProcessShape } from './business-process-shapes'

export type BusinessProcessNode = Node<BusinessProcessNodeData, BusinessProcessNodeType>
export type BusinessProcessNodeProps = NodeProps<BusinessProcessNode> & { style?: CSSProperties }
const LABELS: Record<BusinessProcessNodeType, string> = {
  businessProcessActivityNode: 'Activity',
  businessProcessEventNode: 'Event',
  businessProcessGatewayNode: 'Gateway',
  businessProcessParticipantNode: 'Participant',
  businessProcessDataNode: 'Data',
  businessProcessArtifactNode: 'Artifact',
  businessProcessChoreographyNode: 'Choreography',
  businessProcessConversationNode: 'Conversation',
}

const dimensionsFor = (type: BusinessProcessNodeType) => {
  if (type === 'businessProcessEventNode' || type === 'businessProcessGatewayNode') {
    return {
      defaultWidth: 72,
      defaultHeight: 72,
      minWidth: 48,
      minHeight: 48,
      preserveAspectRatio: true,
    }
  }
  if (type === 'businessProcessParticipantNode') {
    return { defaultWidth: 360, defaultHeight: 160, minWidth: 120, minHeight: 72 }
  }
  return { defaultWidth: 160, defaultHeight: 80, minWidth: 80, minHeight: 48 }
}

export const BusinessProcessNode = memo(
  ({ id, type, data, width, height, parentId, selected, style }: BusinessProcessNodeProps) => {
    const readOnly = useDocumentReadOnly()
    const [laneEditRequest, setLaneEditRequest] = useState(0)
    const flow = useReactFlow<BusinessProcessNode>()
    const {
      node: currentNode,
      lanes: participantLanes,
      laneMinimums,
      siblingLanes,
    } = useBusinessProcessLanes(id, data, parentId)
    const mutations = useDiagramMutationContext()
    const participantResize = useRef<{
      lanes: BusinessProcessLaneNode[]
      laneMinimums: DiagramNodeSize[]
    } | null>(null)
    const dividerResizeLanes = useRef<BusinessProcessLaneNode[] | null>(null)
    const dividerResizeMinimums = useRef(new Map<string, number>())
    const dimensions = dimensionsFor(type)
    const label = data.text ? `${LABELS[type]}: ${data.text}` : LABELS[type]
    const isVerticalParticipant = data.kind === 'participant' && data.orientation === 'vertical'
    const siblingIndex = siblingLanes.findIndex((lane) => lane.id === id)
    const hasDivider = siblingIndex >= 0 && siblingIndex < siblingLanes.length - 1
    const participantMinimum =
      data.kind === 'participant'
        ? minimumParticipantContainerSize(participantLanes.length, data.orientation, laneMinimums)
        : { width: dimensions.minWidth, height: dimensions.minHeight }
    const participantSize = currentNode
      ? businessProcessNodeSize(currentNode)
      : {
          width: Number(width ?? style?.width ?? dimensions.defaultWidth),
          height: Number(height ?? style?.height ?? dimensions.defaultHeight),
        }
    const nodeWidth =
      data.kind === 'participant'
        ? participantSize.width
        : Number(width ?? style?.width ?? dimensions.defaultWidth)
    const nodeHeight =
      data.kind === 'participant'
        ? participantSize.height
        : Number(height ?? style?.height ?? dimensions.defaultHeight)
    const resizeStateRef = useRef({ data, participantLanes, laneMinimums, siblingLanes })
    resizeStateRef.current = { data, participantLanes, laneMinimums, siblingLanes }

    const onParticipantResizeStart = useCallback<OnResizeStart>(() => {
      const { data, participantLanes, laneMinimums } = resizeStateRef.current
      participantResize.current =
        data.kind === 'participant' && data.participantType === 'pool'
          ? { lanes: participantLanes, laneMinimums }
          : null
    }, [])
    const onParticipantResize = useCallback<OnResize>(
      (_event, params) => {
        const { data } = resizeStateRef.current
        if (!mutations) return

        if (data.kind === 'activity') {
          const boundaryEvents = flow
            .getNodes()
            .filter(
              (node) =>
                node.data.kind === 'event' &&
                node.data.context === 'boundary' &&
                node.data.attachedToId === id,
            )
          if (!boundaryEvents.length) return

          const attachedEventsById = new Map(
            boundaryEvents.map((event) => [
              event.id,
              attachBoundaryEventToActivity(
                id,
                { width: params.width, height: params.height },
                businessProcessNodeSize(event),
              ),
            ]),
          )
          mutations.setNodes((nodes) =>
            nodes.map((node) => {
              const attachment = attachedEventsById.get(node.id)
              return attachment ? { ...node, ...attachment } : node
            }),
          )
          return
        }

        const { lanes = [], laneMinimums = [] } = participantResize.current ?? {}
        if (!lanes.length || data.kind !== 'participant' || data.participantType !== 'pool') return

        const laidOut = layoutParticipantLanes(
          lanes,
          { width: params.width, height: params.height },
          data.orientation,
          lanes.map(
            (lane) =>
              businessProcessNodeSize(lane)[data.orientation === 'horizontal' ? 'height' : 'width'],
          ),
          laneMinimums,
        )
        const lanesById = new Map(laidOut.map((lane) => [lane.id, lane]))
        mutations.setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id && node.data.kind === 'participant') {
              return {
                ...node,
                width: params.width,
                height: params.height,
                style: { ...node.style, width: params.width, height: params.height },
              }
            }
            return lanesById.get(node.id) ?? node
          }),
        )
      },
      [flow, id, mutations],
    )
    const onParticipantResizeEnd = useCallback<OnResizeEnd>(() => {
      participantResize.current = null
    }, [])

    const onDividerResizeStart = useCallback<OnResizeStart>(() => {
      const { data, siblingLanes } = resizeStateRef.current
      dividerResizeLanes.current = siblingLanes
      dividerResizeMinimums.current.clear()

      if (data.kind !== 'participant') return
      const axis = data.orientation === 'horizontal' ? 'height' : 'width'
      const currentNodes = flow.getNodes()
      for (const lane of siblingLanes) {
        dividerResizeMinimums.current.set(
          lane.id,
          Math.max(
            MIN_PARTICIPANT_LANE_SIZE,
            minimumParticipantNodeSize(lane, currentNodes, data.orientation)[axis],
          ),
        )
      }
    }, [flow])
    const shouldResizeDivider = useCallback<ShouldResize>(
      (_event, params) => {
        const lanes = dividerResizeLanes.current
        const { data } = resizeStateRef.current
        if (!lanes) return false
        const orderedLanes = orderParticipantLanes(
          lanes,
          data.kind === 'participant' ? data.orientation : 'horizontal',
        )
        const index = orderedLanes.findIndex((lane) => lane.id === id)
        if (index < 0 || index >= orderedLanes.length - 1) return false

        const axis =
          data.kind === 'participant' && data.orientation === 'horizontal' ? 'height' : 'width'
        const nextLane = orderedLanes[index + 1]
        const laneMinimum = (lane: BusinessProcessLaneNode) =>
          dividerResizeMinimums.current.get(lane.id) ?? MIN_PARTICIPANT_LANE_SIZE
        const combinedSize =
          businessProcessNodeSize(orderedLanes[index])[axis] +
          businessProcessNodeSize(nextLane)[axis]
        return (
          params[axis] >= laneMinimum(orderedLanes[index]) &&
          params[axis] <= combinedSize - laneMinimum(nextLane)
        )
      },
      [id],
    )
    const onDividerResize = useCallback<OnResize>(
      (_event, params) => {
        const lanes = dividerResizeLanes.current
        const { data } = resizeStateRef.current
        if (!mutations || !lanes || data.kind !== 'participant') return

        const resizedLanes = resizeAdjacentParticipantLanes(
          lanes,
          id,
          data.orientation === 'horizontal' ? params.height : params.width,
          data.orientation,
          orderParticipantLanes(lanes, data.orientation).map(
            (lane) => dividerResizeMinimums.current.get(lane.id) ?? MIN_PARTICIPANT_LANE_SIZE,
          ),
        )
        const lanesById = new Map(resizedLanes.map((lane) => [lane.id, lane]))
        mutations.setNodes((nodes) => nodes.map((node) => lanesById.get(node.id) ?? node))
      },
      [id, mutations],
    )
    const onDividerResizeEnd = useCallback<OnResizeEnd>(() => {
      dividerResizeLanes.current = null
      dividerResizeMinimums.current.clear()
    }, [])
    const participantLabelStyle: CSSProperties | undefined =
      data.kind !== 'participant'
        ? undefined
        : data.orientation === 'horizontal'
          ? {
              left: 17,
              top: '50%',
              width: Math.max(32, nodeHeight - 16),
              height: 32,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
            }
          : {
              left: '50%',
              top: 14,
              width: Math.max(32, nodeWidth - 16),
              height: 28,
              transform: 'translate(-50%, -50%)',
            }
    const isContainer =
      data.kind === 'participant' ||
      (data.kind === 'activity' && data.taskType.endsWith('SubProcess'))

    return (
      <BaseNode
        aria-label={label}
        className='group h-full w-full overflow-visible rounded-none border-0 bg-transparent shadow-none'
        onDoubleClickCapture={(event) => {
          if (data.kind !== 'participant' || data.participantType !== 'lane') return
          if (
            event.target instanceof Element &&
            (event.target.closest('.react-flow__resize-control') ||
              event.target.closest('textarea'))
          )
            return
          event.preventDefault()
          event.stopPropagation()
          setLaneEditRequest((request) => request + 1)
        }}
      >
        <NodeResizer
          minWidth={
            data.kind === 'participant' &&
            data.participantType === 'pool' &&
            participantLanes.length
              ? participantMinimum.width
              : isVerticalParticipant
                ? dimensions.minHeight
                : dimensions.minWidth
          }
          minHeight={
            data.kind === 'participant' &&
            data.participantType === 'pool' &&
            participantLanes.length
              ? participantMinimum.height
              : isVerticalParticipant
                ? dimensions.minWidth
                : dimensions.minHeight
          }
          keepAspectRatio={dimensions.preserveAspectRatio}
          isVisible={
            selected &&
            !readOnly &&
            (data.kind !== 'participant' || data.participantType === 'pool')
          }
          onResizeStart={onParticipantResizeStart}
          onResize={onParticipantResize}
          onResizeEnd={onParticipantResizeEnd}
        />
        <div className='relative h-full w-full'>
          <div className='pointer-events-none absolute inset-0 h-full w-full overflow-visible'>
            {renderBusinessProcessShape(data, nodeWidth, nodeHeight, label)}
          </div>
          <div
            className={
              participantLabelStyle
                ? 'absolute flex items-center justify-center'
                : data.kind === 'artifact'
                  ? 'absolute inset-0 flex items-center justify-center pl-3'
                  : 'absolute inset-0 flex items-center justify-center'
            }
            style={{ ...participantLabelStyle, color: businessProcessTextColor(data) }}
          >
            <EditableNodeText
              nodeId={id}
              value={data.text}
              label={label}
              readOnly={readOnly}
              autoSize={data.kind === 'participant' ? undefined : dimensions}
              activateRequest={
                data.kind === 'participant' && data.participantType === 'lane'
                  ? laneEditRequest
                  : undefined
              }
              className={isContainer ? 'font-semibold' : undefined}
            />
          </div>
          {(data.kind !== 'participant' || data.participantType === 'pool') && (
            <>
              <NodeHandle
                id='top'
                position={Position.Top}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='right'
                position={Position.Right}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='bottom'
                position={Position.Bottom}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
              <NodeHandle
                id='left'
                position={Position.Left}
                inset={4}
                className='opacity-0 transition-opacity group-hover:opacity-100 in-[.selected]:opacity-100'
              />
            </>
          )}
        </div>
        {data.kind === 'participant' &&
          data.participantType === 'lane' &&
          hasDivider &&
          !readOnly && (
            <NodeResizeControl
              variant={ResizeControlVariant.Line}
              position={data.orientation === 'horizontal' ? 'bottom' : 'right'}
              resizeDirection={data.orientation === 'horizontal' ? 'vertical' : 'horizontal'}
              minWidth={data.orientation === 'vertical' ? MIN_PARTICIPANT_LANE_SIZE : 1}
              minHeight={data.orientation === 'horizontal' ? MIN_PARTICIPANT_LANE_SIZE : 1}
              shouldResize={shouldResizeDivider}
              onResizeStart={onDividerResizeStart}
              onResize={onDividerResize}
              onResizeEnd={onDividerResizeEnd}
              style={
                data.orientation === 'horizontal'
                  ? {
                      height: 12,
                      top: 'calc(100% - 6px)',
                      borderBottomWidth: 2,
                      borderColor: 'var(--foreground)',
                      zIndex: 20,
                    }
                  : {
                      width: 12,
                      left: 'calc(100% - 6px)',
                      borderRightWidth: 2,
                      borderColor: 'var(--foreground)',
                      zIndex: 20,
                    }
              }
            >
              <span
                aria-hidden='true'
                className={
                  data.orientation === 'horizontal'
                    ? 'absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm'
                    : 'absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm'
                }
              />
            </NodeResizeControl>
          )}
      </BaseNode>
    )
  },
)
