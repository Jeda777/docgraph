import {
  BUSINESS_PROCESS_NODE_SIZES,
  businessProcessEdgeData,
  businessProcessNodeData,
  type DiagramNodeSize,
} from '@docgraph/common/diagram'
import {
  BUSINESS_PROCESS_EDGE_TYPES,
  type BUSINESS_PROCESS_EVENT_TYPES,
  BUSINESS_PROCESS_GATEWAY_TYPES,
  type BUSINESS_PROCESS_TASK_TYPES,
  type BusinessProcessEdgeData,
  type BusinessProcessEdgeType,
  type BusinessProcessNodeData,
  type BusinessProcessNodeType,
} from '@docgraph/common/schemas'
import type { ReactNode } from 'react'
import {
  renderBusinessProcessEdgePreview,
  renderBusinessProcessShape,
} from './business-process-shapes'

export type BusinessProcessToolCategory =
  | 'Activities'
  | 'Events'
  | 'Gateways'
  | 'Participants'
  | 'Data'
  | 'Artifacts'
  | 'Advanced'
  | 'Connections'

export type BusinessProcessNodeTool = {
  kind: 'node'
  id: string
  label: string
  category: Exclude<BusinessProcessToolCategory, 'Connections'>
  nodeType: BusinessProcessNodeType
  width: number
  height: number
  minWidth: number
  minHeight: number
  createData: () => BusinessProcessNodeData
  preview: () => ReactNode
}

export type BusinessProcessEdgeTool = {
  kind: 'edge'
  id: string
  label: string
  category: 'Connections'
  edgeType: BusinessProcessEdgeType
  createData: () => BusinessProcessEdgeData
  preview: () => ReactNode
}

export type BusinessProcessTool = BusinessProcessNodeTool | BusinessProcessEdgeTool

const nodeTool = (
  id: string,
  label: string,
  category: BusinessProcessNodeTool['category'],
  nodeType: BusinessProcessNodeType,
  createData: () => BusinessProcessNodeData,
  size: DiagramNodeSize = BUSINESS_PROCESS_NODE_SIZES.activity,
): BusinessProcessNodeTool => ({
  kind: 'node',
  id,
  label,
  category,
  nodeType,
  width: size.width,
  height: size.height,
  minWidth: nodeType === 'businessProcessEventNode' ? 48 : 80,
  minHeight: 48,
  createData,
  preview: () => {
    const previewIsRound =
      nodeType === 'businessProcessEventNode' || nodeType === 'businessProcessGatewayNode'
    const previewIsAdvanced =
      nodeType === 'businessProcessChoreographyNode' ||
      nodeType === 'businessProcessConversationNode'
    const previewWidth = previewIsRound ? 36 : 52
    const previewHeight = previewIsRound ? 36 : previewIsAdvanced ? 44 : 34
    return renderBusinessProcessShape(createData(), previewWidth, previewHeight, label, 'size-12')
  },
})

const activity = (
  taskType: (typeof BUSINESS_PROCESS_TASK_TYPES)[number],
  label: string,
): BusinessProcessNodeTool =>
  nodeTool(`activity:${taskType}`, label, 'Activities', 'businessProcessActivityNode', () =>
    businessProcessNodeData.activity(taskType),
  )

const event = (
  context: 'start' | 'intermediateCatch' | 'boundary' | 'intermediateThrow' | 'end',
  eventType: (typeof BUSINESS_PROCESS_EVENT_TYPES)[number],
  label: string,
): BusinessProcessNodeTool =>
  nodeTool(
    `event:${context}:${eventType}`,
    label,
    'Events',
    'businessProcessEventNode',
    () => businessProcessNodeData.event(context, eventType),
    BUSINESS_PROCESS_NODE_SIZES.event,
  )

const nodeTools: BusinessProcessNodeTool[] = [
  activity('task', 'Task'),
  activity('serviceTask', 'Service Task'),
  activity('sendTask', 'Send Task'),
  activity('receiveTask', 'Receive Task'),
  activity('userTask', 'User Task'),
  activity('manualTask', 'Manual Task'),
  activity('businessRuleTask', 'Business Rule Task'),
  activity('scriptTask', 'Script Task'),
  activity('embeddedSubProcess', 'Embedded Sub-Process'),
  activity('eventSubProcess', 'Event Sub-Process'),
  activity('transactionSubProcess', 'Transaction Sub-Process'),
  activity('adHocSubProcess', 'Ad-Hoc Sub-Process'),
  activity('callActivity', 'Call Activity'),
  ...[
    'none',
    'message',
    'timer',
    'conditional',
    'signal',
    'multiple',
    'parallelMultiple',
    'escalation',
    'error',
    'compensation',
  ].map((eventType) =>
    event(
      'start',
      eventType as (typeof BUSINESS_PROCESS_EVENT_TYPES)[number],
      `Start: ${eventType}`,
    ),
  ),
  ...['message', 'timer', 'conditional', 'link', 'signal', 'multiple', 'parallelMultiple'].map(
    (eventType) =>
      event(
        'intermediateCatch',
        eventType as (typeof BUSINESS_PROCESS_EVENT_TYPES)[number],
        `Catch: ${eventType}`,
      ),
  ),
  ...[
    'message',
    'timer',
    'escalation',
    'conditional',
    'error',
    'cancel',
    'signal',
    'compensation',
    'multiple',
    'parallelMultiple',
  ].map((eventType) =>
    event(
      'boundary',
      eventType as (typeof BUSINESS_PROCESS_EVENT_TYPES)[number],
      `Boundary: ${eventType}`,
    ),
  ),
  ...['none', 'message', 'escalation', 'link', 'compensation', 'signal', 'multiple'].map(
    (eventType) =>
      event(
        'intermediateThrow',
        eventType as (typeof BUSINESS_PROCESS_EVENT_TYPES)[number],
        `Throw: ${eventType}`,
      ),
  ),
  ...[
    'none',
    'message',
    'escalation',
    'error',
    'cancel',
    'compensation',
    'signal',
    'terminate',
    'multiple',
  ].map((eventType) =>
    event('end', eventType as (typeof BUSINESS_PROCESS_EVENT_TYPES)[number], `End: ${eventType}`),
  ),
  ...BUSINESS_PROCESS_GATEWAY_TYPES.map((gatewayType) =>
    nodeTool(
      `gateway:${gatewayType}`,
      `${gatewayType} Gateway`,
      'Gateways',
      'businessProcessGatewayNode',
      () => businessProcessNodeData.gateway(gatewayType),
      BUSINESS_PROCESS_NODE_SIZES.gateway,
    ),
  ),
  nodeTool(
    'participant:pool',
    'Pool / Participant',
    'Participants',
    'businessProcessParticipantNode',
    () => businessProcessNodeData.participant('pool'),
    BUSINESS_PROCESS_NODE_SIZES.pool,
  ),
  nodeTool(
    'participant:blackBox',
    'Black-box Participant',
    'Participants',
    'businessProcessParticipantNode',
    () => businessProcessNodeData.participant('pool', true),
    BUSINESS_PROCESS_NODE_SIZES.blackBoxPool,
  ),
  nodeTool(
    'participant:lane',
    'Lane',
    'Participants',
    'businessProcessParticipantNode',
    () => businessProcessNodeData.participant('lane'),
    BUSINESS_PROCESS_NODE_SIZES.lane,
  ),
  nodeTool(
    'data:object',
    'Data Object',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('object'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'data:input',
    'Data Input',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('input'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'data:output',
    'Data Output',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('output'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'data:store',
    'Data Store',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('store'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'data:objectReference',
    'Data Object Reference',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('objectReference'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'data:storeReference',
    'Data Store Reference',
    'Data',
    'businessProcessDataNode',
    () => businessProcessNodeData.data('storeReference'),
    BUSINESS_PROCESS_NODE_SIZES.data,
  ),
  nodeTool(
    'artifact:annotation',
    'Text Annotation',
    'Artifacts',
    'businessProcessArtifactNode',
    () => businessProcessNodeData.artifact(),
    BUSINESS_PROCESS_NODE_SIZES.artifact,
  ),
  ...(['task', 'subChoreography', 'callChoreography'] as const).map((choreographyType) => {
    const label =
      choreographyType === 'task'
        ? 'Choreography Task'
        : choreographyType === 'subChoreography'
          ? 'Sub-Choreography'
          : 'Call Choreography'
    return nodeTool(
      `advanced:choreography:${choreographyType}`,
      label,
      'Advanced',
      'businessProcessChoreographyNode',
      () => businessProcessNodeData.choreography(choreographyType),
      BUSINESS_PROCESS_NODE_SIZES.choreography,
    )
  }),
  ...(['conversation', 'subConversation', 'callConversation'] as const).map((conversationType) => {
    const label =
      conversationType === 'conversation'
        ? 'Conversation'
        : conversationType === 'subConversation'
          ? 'Sub-Conversation'
          : 'Call Conversation'
    return nodeTool(
      `advanced:conversation:${conversationType}`,
      label,
      'Advanced',
      'businessProcessConversationNode',
      () => businessProcessNodeData.conversation(conversationType),
      BUSINESS_PROCESS_NODE_SIZES.conversation,
    )
  }),
]

const edgeTool = (
  id: string,
  label: string,
  edgeType: BusinessProcessEdgeType,
  createData: () => BusinessProcessEdgeData,
): BusinessProcessEdgeTool => ({
  kind: 'edge',
  id,
  label,
  category: 'Connections',
  edgeType,
  createData,
  preview: () => renderBusinessProcessEdgePreview(edgeType, id, label),
})

const edgeTools: BusinessProcessEdgeTool[] = [
  edgeTool(
    'edge:sequence',
    'Sequence Flow',
    BUSINESS_PROCESS_EDGE_TYPES[0],
    businessProcessEdgeData.sequenceFlow,
  ),
  edgeTool(
    'edge:message',
    'Message Flow',
    BUSINESS_PROCESS_EDGE_TYPES[1],
    businessProcessEdgeData.messageFlow,
  ),
  edgeTool(
    'edge:association',
    'Association',
    BUSINESS_PROCESS_EDGE_TYPES[2],
    businessProcessEdgeData.association,
  ),
  edgeTool(
    'edge:data',
    'Data Association',
    BUSINESS_PROCESS_EDGE_TYPES[3],
    businessProcessEdgeData.dataAssociation,
  ),
  edgeTool(
    'edge:conversation',
    'Conversation Link',
    BUSINESS_PROCESS_EDGE_TYPES[4],
    businessProcessEdgeData.conversationLink,
  ),
]

export const businessProcessNodeToolRegistry = nodeTools as readonly BusinessProcessNodeTool[]
export const businessProcessEdgeToolRegistry = edgeTools as readonly BusinessProcessEdgeTool[]
export const businessProcessToolRegistry = [
  ...nodeTools,
  ...edgeTools,
] as readonly BusinessProcessTool[]

export const getBusinessProcessTool = (id: string) => {
  const tool = businessProcessToolRegistry.find((entry) => entry.id === id)
  if (!tool) throw new Error(`Unknown business process tool: ${id}`)
  return tool
}
