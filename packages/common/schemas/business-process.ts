import { z } from 'zod'
import {
  findAncestorPoolId,
  isValidBusinessProcessConnection,
} from '../diagram/business-process-rules'
import { areaNodeSchema } from './area-node'
import {
  baseEdgeSchema,
  baseNodeSchema,
  DIAGRAM_HANDLE_IDS,
  refineDiagramCollections,
} from './diagram'
import type { ItemType } from './item'

export const BUSINESS_PROCESS_NODE_TYPES = [
  'businessProcessActivityNode',
  'businessProcessEventNode',
  'businessProcessGatewayNode',
  'businessProcessParticipantNode',
  'businessProcessDataNode',
  'businessProcessArtifactNode',
  'businessProcessChoreographyNode',
  'businessProcessConversationNode',
] as const
export type BusinessProcessNodeType = (typeof BUSINESS_PROCESS_NODE_TYPES)[number]

export const BUSINESS_PROCESS_EDGE_TYPES = [
  'businessProcessSequenceFlowEdge',
  'businessProcessMessageFlowEdge',
  'businessProcessAssociationEdge',
  'businessProcessDataAssociationEdge',
  'businessProcessConversationLinkEdge',
] as const
export type BusinessProcessEdgeType = (typeof BUSINESS_PROCESS_EDGE_TYPES)[number]

export const BUSINESS_PROCESS_TASK_TYPES = [
  'task',
  'serviceTask',
  'sendTask',
  'receiveTask',
  'userTask',
  'manualTask',
  'businessRuleTask',
  'scriptTask',
  'callActivity',
  'embeddedSubProcess',
  'eventSubProcess',
  'transactionSubProcess',
  'adHocSubProcess',
] as const
export type BusinessProcessTaskType = (typeof BUSINESS_PROCESS_TASK_TYPES)[number]

export const BUSINESS_PROCESS_EVENT_CONTEXTS = [
  'start',
  'intermediateCatch',
  'boundary',
  'intermediateThrow',
  'end',
] as const
export type BusinessProcessEventContext = (typeof BUSINESS_PROCESS_EVENT_CONTEXTS)[number]

export const BUSINESS_PROCESS_EVENT_TYPES = [
  'none',
  'message',
  'timer',
  'conditional',
  'link',
  'signal',
  'multiple',
  'parallelMultiple',
  'escalation',
  'error',
  'cancel',
  'compensation',
  'terminate',
] as const
export type BusinessProcessEventType = (typeof BUSINESS_PROCESS_EVENT_TYPES)[number]

export const businessProcessEventTypesByContext: Record<
  BusinessProcessEventContext,
  readonly BusinessProcessEventType[]
> = {
  start: [
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
  ],
  intermediateCatch: [
    'message',
    'timer',
    'conditional',
    'link',
    'signal',
    'multiple',
    'parallelMultiple',
  ],
  boundary: [
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
  ],
  intermediateThrow: [
    'none',
    'message',
    'escalation',
    'link',
    'compensation',
    'signal',
    'multiple',
  ],
  end: [
    'none',
    'message',
    'escalation',
    'error',
    'cancel',
    'compensation',
    'signal',
    'terminate',
    'multiple',
  ],
}

export const BUSINESS_PROCESS_GATEWAY_TYPES = [
  'exclusive',
  'inclusive',
  'parallel',
  'complex',
  'exclusiveEventBased',
  'parallelEventBased',
  'instantiatingExclusiveEventBased',
  'instantiatingParallelEventBased',
] as const
export type BusinessProcessGatewayType = (typeof BUSINESS_PROCESS_GATEWAY_TYPES)[number]

export const BUSINESS_PROCESS_MARKERS = [
  'loop',
  'parallelMultiInstance',
  'sequentialMultiInstance',
  'compensation',
  'adhoc',
  'collapsed',
] as const

const text = z.string()
const nodeBase = baseNodeSchema.extend({
  parentId: z.string().min(1).optional(),
  extent: z.literal('parent').optional(),
  expandParent: z.boolean().optional(),
})

const activityDataSchema = z.strictObject({
  kind: z.literal('activity'),
  text,
  taskType: z.enum(BUSINESS_PROCESS_TASK_TYPES),
  markers: z.array(z.enum(BUSINESS_PROCESS_MARKERS)),
  calledElement: text.optional(),
  implementation: text.optional(),
  scriptFormat: text.optional(),
  script: text.optional(),
  completionCondition: text.optional(),
  loopCondition: text.optional(),
  instantiate: z.boolean().optional(),
  triggeredByEvent: z.boolean().optional(),
  isForCompensation: z.boolean().optional(),
})
export type BusinessProcessActivityData = z.infer<typeof activityDataSchema>

const eventDataSchema = z.strictObject({
  kind: z.literal('event'),
  text,
  context: z.enum(BUSINESS_PROCESS_EVENT_CONTEXTS),
  eventType: z.enum(BUSINESS_PROCESS_EVENT_TYPES),
  interrupting: z.boolean().optional(),
  messageRef: text.optional(),
  signalRef: text.optional(),
  errorRef: text.optional(),
  escalationRef: text.optional(),
  timerDefinition: text.optional(),
  condition: text.optional(),
  linkSource: text.optional(),
  linkTarget: text.optional(),
  compensationActivity: text.optional(),
  attachedToId: text.optional(),
})
export type BusinessProcessEventData = z.infer<typeof eventDataSchema>

const gatewayDataSchema = z.strictObject({
  kind: z.literal('gateway'),
  text,
  gatewayType: z.enum(BUSINESS_PROCESS_GATEWAY_TYPES),
  direction: z.enum(['unspecified', 'converging', 'diverging', 'mixed']),
  defaultFlowId: text.optional(),
  activationCondition: text.optional(),
})
export type BusinessProcessGatewayData = z.infer<typeof gatewayDataSchema>

const participantDataSchema = z.strictObject({
  kind: z.literal('participant'),
  text,
  participantType: z.enum(['pool', 'lane']),
  orientation: z.enum(['horizontal', 'vertical']),
  blackBox: z.boolean(),
  multiplicity: z.number().int().positive().optional(),
  processRef: text.optional(),
  laneSetId: text.optional(),
})
export type BusinessProcessParticipantData = z.infer<typeof participantDataSchema>

const dataDataSchema = z.strictObject({
  kind: z.literal('data'),
  text,
  dataType: z.enum(['object', 'objectReference', 'input', 'output', 'store', 'storeReference']),
  collection: z.boolean(),
  state: text.optional(),
  itemDefinitionRef: text.optional(),
})
export type BusinessProcessDataData = z.infer<typeof dataDataSchema>

const artifactDataSchema = z.strictObject({
  kind: z.literal('artifact'),
  text,
  artifactType: z.literal('textAnnotation'),
})
export type BusinessProcessArtifactData = z.infer<typeof artifactDataSchema>

const choreographyDataSchema = z.strictObject({
  kind: z.literal('choreography'),
  text,
  choreographyType: z.enum(['task', 'subChoreography', 'callChoreography']),
  initiatingParticipant: text.optional(),
  participantRefs: z.array(text),
  messageRefs: z.array(text),
})
export type BusinessProcessChoreographyData = z.infer<typeof choreographyDataSchema>

const conversationDataSchema = z.strictObject({
  kind: z.literal('conversation'),
  text,
  conversationType: z.enum(['conversation', 'subConversation', 'callConversation']),
  participantRefs: z.array(text),
  correlationKeys: z.array(text),
})
export type BusinessProcessConversationData = z.infer<typeof conversationDataSchema>

export const businessProcessNodeDataSchema = z.discriminatedUnion('kind', [
  activityDataSchema,
  eventDataSchema,
  gatewayDataSchema,
  participantDataSchema,
  dataDataSchema,
  artifactDataSchema,
  choreographyDataSchema,
  conversationDataSchema,
])
export type BusinessProcessNodeData = z.infer<typeof businessProcessNodeDataSchema>

const nodeSchema = <T extends BusinessProcessNodeType>(
  type: T,
  data: z.ZodType<BusinessProcessNodeData>,
) => nodeBase.extend({ type: z.literal(type), data })

export const businessProcessNodeSchema = z.discriminatedUnion('type', [
  nodeSchema('businessProcessActivityNode', activityDataSchema),
  nodeSchema('businessProcessEventNode', eventDataSchema),
  nodeSchema('businessProcessGatewayNode', gatewayDataSchema),
  nodeSchema('businessProcessParticipantNode', participantDataSchema),
  nodeSchema('businessProcessDataNode', dataDataSchema),
  nodeSchema('businessProcessArtifactNode', artifactDataSchema),
  nodeSchema('businessProcessChoreographyNode', choreographyDataSchema),
  nodeSchema('businessProcessConversationNode', conversationDataSchema),
])
export type BusinessProcessNode = z.infer<typeof businessProcessNodeSchema>

const sequenceFlowDataSchema = z.strictObject({
  kind: z.literal('sequenceFlow'),
  text,
  condition: text.optional(),
  isDefault: z.boolean(),
})
const messageFlowDataSchema = z.strictObject({
  kind: z.literal('messageFlow'),
  text,
  messageRef: text.optional(),
  initiating: z.boolean(),
})
const associationDataSchema = z.strictObject({
  kind: z.literal('association'),
  text,
  direction: z.enum(['none', 'oneWay', 'bidirectional']),
})
const dataAssociationDataSchema = z.strictObject({
  kind: z.literal('dataAssociation'),
  text,
  direction: z.enum(['input', 'output']),
  itemRef: text.optional(),
})
const conversationLinkDataSchema = z.strictObject({
  kind: z.literal('conversationLink'),
  text,
})

export type BusinessProcessEdgeData =
  | z.infer<typeof sequenceFlowDataSchema>
  | z.infer<typeof messageFlowDataSchema>
  | z.infer<typeof associationDataSchema>
  | z.infer<typeof dataAssociationDataSchema>
  | z.infer<typeof conversationLinkDataSchema>

export const businessProcessEdgeKindByType: Record<
  BusinessProcessEdgeType,
  BusinessProcessEdgeData['kind']
> = {
  businessProcessSequenceFlowEdge: 'sequenceFlow',
  businessProcessMessageFlowEdge: 'messageFlow',
  businessProcessAssociationEdge: 'association',
  businessProcessDataAssociationEdge: 'dataAssociation',
  businessProcessConversationLinkEdge: 'conversationLink',
}

const edgeSchema = <T extends BusinessProcessEdgeType>(
  type: T,
  data: z.ZodType<BusinessProcessEdgeData>,
) =>
  baseEdgeSchema.extend({
    type: z.literal(type),
    sourceHandle: z.enum(DIAGRAM_HANDLE_IDS),
    targetHandle: z.enum(DIAGRAM_HANDLE_IDS),
    data,
  })

export const businessProcessEdgeSchema = z.discriminatedUnion('type', [
  edgeSchema('businessProcessSequenceFlowEdge', sequenceFlowDataSchema),
  edgeSchema('businessProcessMessageFlowEdge', messageFlowDataSchema),
  edgeSchema('businessProcessAssociationEdge', associationDataSchema),
  edgeSchema('businessProcessDataAssociationEdge', dataAssociationDataSchema),
  edgeSchema('businessProcessConversationLinkEdge', conversationLinkDataSchema),
])
export type BusinessProcessEdge = z.infer<typeof businessProcessEdgeSchema>

export const businessProcessSchema = z
  .strictObject({
    type: z.literal('BUSINESS_PROCESS' satisfies ItemType),
    nodes: z.array(businessProcessNodeSchema),
    edges: z.array(businessProcessEdgeSchema),
    areas: z.array(areaNodeSchema),
  })
  .superRefine((document, context) => {
    refineDiagramCollections(document, context)

    const nodeIds = new Set(document.nodes.map((node) => node.id))
    const edgeIds = new Set(document.edges.map((edge) => edge.id))
    const nodeMap = new Map(document.nodes.map((node) => [node.id, node]))

    for (const [index, node] of document.nodes.entries()) {
      if (node.parentId && (!nodeIds.has(node.parentId) || node.parentId === node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'parentId'],
          message: 'Parent must reference another node.',
        })
      }
      const parent = node.parentId ? nodeMap.get(node.parentId) : undefined
      if (node.data.kind === 'participant' && node.data.participantType === 'pool') {
        if (node.parentId) {
          context.addIssue({
            code: 'custom',
            path: ['nodes', index, 'parentId'],
            message: 'Pools cannot be nested inside another node.',
          })
        }
      } else if (node.data.kind === 'participant' && node.data.participantType === 'lane') {
        const poolId =
          parent?.data.kind === 'participant' ? findAncestorPoolId(parent.id, nodeMap) : undefined
        const pool = poolId ? nodeMap.get(poolId) : undefined
        if (
          parent?.data.kind !== 'participant' ||
          node.data.blackBox ||
          pool?.data.kind !== 'participant' ||
          pool.data.participantType !== 'pool' ||
          pool.data.blackBox
        ) {
          context.addIssue({
            code: 'custom',
            path: ['nodes', index, 'parentId'],
            message: 'Lanes must be contained in a lane set inside a white-box pool.',
          })
        }
      } else if (parent?.data.kind === 'participant' && parent.data.blackBox) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'parentId'],
          message: 'Black-box pools cannot contain visible diagram elements.',
        })
      }
      if (node.data.kind === 'event' && node.data.context === 'boundary') {
        const attached = node.data.attachedToId ? nodeMap.get(node.data.attachedToId) : undefined
        if (attached?.data.kind !== 'activity') {
          context.addIssue({
            code: 'custom',
            path: ['nodes', index, 'data', 'attachedToId'],
            message: 'Boundary events must reference an attached activity.',
          })
        }
      }
      if (
        node.data.kind === 'event' &&
        !businessProcessEventTypesByContext[node.data.context].includes(node.data.eventType)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'data', 'eventType'],
          message: `${node.data.eventType} is not valid for a ${node.data.context} event.`,
        })
      }
      if (node.data.kind === 'choreography' || node.data.kind === 'conversation') {
        for (const [referenceIndex, reference] of node.data.participantRefs.entries()) {
          const participant = nodeMap.get(reference)
          if (participant?.data.kind !== 'participant') {
            context.addIssue({
              code: 'custom',
              path: ['nodes', index, 'data', 'participantRefs', referenceIndex],
              message: 'Participant references must point to participant nodes.',
            })
          }
        }
        if (node.data.kind === 'choreography' && node.data.initiatingParticipant) {
          const participant = nodeMap.get(node.data.initiatingParticipant)
          if (participant?.data.kind !== 'participant') {
            context.addIssue({
              code: 'custom',
              path: ['nodes', index, 'data', 'initiatingParticipant'],
              message: 'The initiating participant must reference a participant node.',
            })
          }
        }
      }
      if (
        node.data.kind === 'gateway' &&
        node.data.defaultFlowId &&
        !edgeIds.has(node.data.defaultFlowId)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'data', 'defaultFlowId'],
          message: 'Gateway default flow must reference an existing edge.',
        })
      }
    }

    for (const node of document.nodes) {
      const seen = new Set<string>()
      let currentId: string | undefined = node.id
      while (currentId) {
        if (seen.has(currentId)) {
          context.addIssue({
            code: 'custom',
            path: ['nodes'],
            message: 'Node containment cannot contain cycles.',
          })
          break
        }
        seen.add(currentId)
        currentId = nodeMap.get(currentId)?.parentId
      }
    }

    for (const [index, edge] of document.edges.entries()) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'Edge endpoints must reference nodes.',
        })
      }
      if (edge.data.kind === 'sequenceFlow' || edge.data.kind === 'messageFlow') {
        if (!isValidBusinessProcessConnection(edge, document.nodes, edge.data.kind)) {
          context.addIssue({
            code: 'custom',
            path: ['edges', index],
            message: `Invalid ${edge.data.kind} connection.`,
          })
        }
      }
    }
  })
export type BusinessProcess = z.infer<typeof businessProcessSchema>
