import type {
  BusinessProcessActivityData,
  BusinessProcessArtifactData,
  BusinessProcessChoreographyData,
  BusinessProcessConversationData,
  BusinessProcessDataData,
  BusinessProcessEdgeData,
  BusinessProcessEventContext,
  BusinessProcessEventData,
  BusinessProcessEventType,
  BusinessProcessGatewayData,
  BusinessProcessGatewayType,
  BusinessProcessNodeData,
  BusinessProcessParticipantData,
  BusinessProcessTaskType,
} from '../schemas/business-process'

/**
 * Defaults of new diagram elements, shared by the web editor (palette tools, new areas)
 * and the server (nodes created by MCP agents), so both create identical elements.
 */

export type DiagramNodeSize = { width: number; height: number }

export const AREA_NODE_SIZE: DiagramNodeSize = { width: 320, height: 220 }

export const FLOWCHART_NODE_SIZE: DiagramNodeSize = { width: 160, height: 80 }

/** Sizes of new business process nodes; also the fallback for nodes not measured yet. */
export const BUSINESS_PROCESS_NODE_SIZES = {
  activity: { width: 160, height: 80 },
  event: { width: 72, height: 72 },
  gateway: { width: 72, height: 72 },
  pool: { width: 420, height: 180 },
  blackBoxPool: { width: 420, height: 120 },
  lane: { width: 360, height: 120 },
  data: { width: 120, height: 72 },
  artifact: { width: 180, height: 96 },
  choreography: { width: 220, height: 100 },
  conversation: { width: 220, height: 100 },
} as const satisfies Record<string, DiagramNodeSize>

/** Default size of a new business process node with the given data. */
export const businessProcessNodeDefaultSize = (
  data: Partial<Pick<BusinessProcessParticipantData, 'participantType' | 'blackBox'>> & {
    kind?: unknown
  },
): DiagramNodeSize => {
  if (data.kind === 'participant') {
    if (data.participantType === 'lane') return BUSINESS_PROCESS_NODE_SIZES.lane
    return data.blackBox
      ? BUSINESS_PROCESS_NODE_SIZES.blackBoxPool
      : BUSINESS_PROCESS_NODE_SIZES.pool
  }
  const kind = String(data.kind)
  return Object.hasOwn(BUSINESS_PROCESS_NODE_SIZES, kind)
    ? BUSINESS_PROCESS_NODE_SIZES[kind as keyof typeof BUSINESS_PROCESS_NODE_SIZES]
    : BUSINESS_PROCESS_NODE_SIZES.activity
}

/**
 * Estimated height of a database table's header, used to lay out tables created on the
 * server before the editor measures them. Keep in sync with the table node in the web
 * editor (`database-node.tsx`), which renders the real height.
 */
export const TABLE_HEADER_HEIGHT = 60

/** Estimated height of one column row of a database table; see `TABLE_HEADER_HEIGHT`. */
export const TABLE_ROW_HEIGHT = 32

/** Data of new business process nodes, one factory per kind. */
export const businessProcessNodeData = {
  activity: (taskType: BusinessProcessTaskType = 'task'): BusinessProcessActivityData => ({
    kind: 'activity',
    text: '',
    taskType,
    markers: taskType.includes('SubProcess') ? ['collapsed'] : [],
  }),
  event: (
    context: BusinessProcessEventContext = 'start',
    eventType: BusinessProcessEventType = 'none',
  ): BusinessProcessEventData => ({
    kind: 'event',
    text: '',
    context,
    eventType,
    interrupting: context !== 'intermediateThrow',
  }),
  gateway: (gatewayType: BusinessProcessGatewayType = 'exclusive'): BusinessProcessGatewayData => ({
    kind: 'gateway',
    text: '',
    gatewayType,
    direction: 'unspecified',
  }),
  participant: (
    participantType: BusinessProcessParticipantData['participantType'] = 'pool',
    blackBox = false,
  ): BusinessProcessParticipantData => ({
    kind: 'participant',
    text: '',
    participantType,
    orientation: 'horizontal',
    blackBox,
  }),
  data: (dataType: BusinessProcessDataData['dataType'] = 'object'): BusinessProcessDataData => ({
    kind: 'data',
    text: '',
    dataType,
    collection: false,
  }),
  artifact: (): BusinessProcessArtifactData => ({
    kind: 'artifact',
    text: '',
    artifactType: 'textAnnotation',
  }),
  choreography: (
    choreographyType: BusinessProcessChoreographyData['choreographyType'] = 'task',
  ): BusinessProcessChoreographyData => ({
    kind: 'choreography',
    text: '',
    choreographyType,
    participantRefs: [],
    messageRefs: [],
  }),
  conversation: (
    conversationType: BusinessProcessConversationData['conversationType'] = 'conversation',
  ): BusinessProcessConversationData => ({
    kind: 'conversation',
    text: '',
    conversationType,
    participantRefs: [],
    correlationKeys: [],
  }),
} satisfies {
  [Kind in BusinessProcessNodeData['kind']]: (
    ...args: never[]
  ) => Extract<BusinessProcessNodeData, { kind: Kind }>
}

type EdgeData<Kind extends BusinessProcessEdgeData['kind']> = Extract<
  BusinessProcessEdgeData,
  { kind: Kind }
>

/** Data of new business process edges, by kind. */
export const businessProcessEdgeData: {
  [Kind in BusinessProcessEdgeData['kind']]: () => EdgeData<Kind>
} = {
  sequenceFlow: () => ({ kind: 'sequenceFlow', text: '', isDefault: false }),
  messageFlow: () => ({ kind: 'messageFlow', text: '', initiating: true }),
  association: () => ({ kind: 'association', text: '', direction: 'none' }),
  dataAssociation: () => ({ kind: 'dataAssociation', text: '', direction: 'output' }),
  conversationLink: () => ({ kind: 'conversationLink', text: '' }),
}
