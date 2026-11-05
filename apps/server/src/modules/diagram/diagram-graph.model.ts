import {
  businessProcessEdgeData,
  businessProcessNodeData,
  businessProcessNodeDefaultSize,
  clearDeletedBusinessProcessReferences,
  type DiagramNodeSize,
  FLOWCHART_NODE_SIZE,
  layoutAllParticipantLanes,
  type ParticipantLayoutNode,
} from '@docgraph/common/diagram'
import {
  type BaseEdge,
  type BaseNode,
  BUSINESS_PROCESS_EDGE_TYPES,
  BUSINESS_PROCESS_NODE_TYPES,
  type BusinessProcessEventContext,
  type BusinessProcessNodeData,
  type BusinessProcessTaskType,
  businessProcessSchema,
  type DiagramGraphType,
  FLOWCHART_EDGE_TYPES,
  FLOWCHART_NODE_TYPES,
  flowchartSchema,
} from '@docgraph/common/schemas'
import type { z } from 'zod'
import { BadRequestException } from '../../errors'

/**
 * Shared model of the diagram graph mapper: document types, the per-diagram-type
 * config and the type/size helpers used by conversion, layout and validation.
 */

export type Size = DiagramNodeSize
export type Position = { x: number; y: number }

export type GraphNode = BaseNode & {
  type?: string
  data?: unknown
  parentId?: string
  extent?: 'parent'
}
export type GraphEdge = BaseEdge & { type?: string; data?: unknown }
export type GraphArea = BaseNode & { type?: string; data?: unknown }

export type GraphDocument = { nodes: GraphNode[]; edges: GraphEdge[]; areas: GraphArea[] }

export type GraphApplySummary = {
  nodesCreated: string[]
  nodesUpdated: string[]
  nodesRemoved: string[]
  edgesCreated: string[]
  edgesUpdated: string[]
  edgesRemoved: string[]
}

export type DataRecord = Record<string, unknown>

export const asRecord = (value: unknown): DataRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as DataRecord) : {}

export const textOf = (data: unknown) => {
  const text = asRecord(data).text
  return typeof text === 'string' ? text : ''
}

/** Behavior that differs between diagram types. */
export type GraphConfig = {
  prefix: string
  nodeTypes: readonly string[]
  edgeTypes: readonly string[]
  defaultEdgeType: string
  supportsParents: boolean
  supportsData: boolean
  /** Data of a new node, or of an existing one whose type changed. */
  newNodeData: (shortType: string, input: DataRecord) => DataRecord
  /** Data of a new edge, or of an existing one whose type changed. */
  newEdgeData: (shortType: string) => DataRecord
  defaultSize: (data: DataRecord) => Size
  isLane: (data: unknown) => boolean
  isContainer: (data: unknown) => boolean
  /** Activity a boundary event is attached to, if the node is one. */
  boundaryActivityId: (data: unknown) => string | undefined
  cleanReferences: (
    nodes: GraphNode[],
    deletedNodeIds: ReadonlySet<string>,
    deletedEdgeIds: ReadonlySet<string>,
  ) => GraphNode[]
  /** Final lane geometry, computed exactly like the web editor does after every edit. */
  layoutLanes: (nodes: GraphNode[]) => GraphNode[]
  validate: (document: GraphDocument) => z.ZodSafeParseResult<unknown>
}

/** A string the agent sent, or `undefined` so the default applies. */
const stringField = <T extends string>(value: unknown) =>
  typeof value === 'string' ? (value as T) : undefined

/**
 * Data of a new business process node, as the web editor's palette creates it
 * (both use the shared defaults from `@docgraph/common/diagram`). Kind-specific
 * fields the agent sent pick the variant; schema validation rejects bad values later.
 */
const businessProcessNodeDefaults = (kind: string, input: DataRecord): DataRecord => {
  switch (kind) {
    case 'activity':
      return businessProcessNodeData.activity(stringField<BusinessProcessTaskType>(input.taskType))
    case 'event':
      return businessProcessNodeData.event(stringField<BusinessProcessEventContext>(input.context))
    case 'gateway':
      return businessProcessNodeData.gateway()
    case 'participant':
      return businessProcessNodeData.participant()
    case 'data':
      return businessProcessNodeData.data()
    case 'artifact':
      return businessProcessNodeData.artifact()
    case 'choreography':
      return businessProcessNodeData.choreography()
    case 'conversation':
      return businessProcessNodeData.conversation()
    default:
      return { kind }
  }
}

const businessProcessEdgeDefaults = (kind: string): DataRecord =>
  Object.hasOwn(businessProcessEdgeData, kind)
    ? businessProcessEdgeData[kind as keyof typeof businessProcessEdgeData]()
    : { kind }

const isParticipant = (data: unknown, participantType?: 'pool' | 'lane') => {
  const record = asRecord(data)
  return (
    record.kind === 'participant' &&
    (!participantType || record.participantType === participantType)
  )
}

export const CONFIGS: Record<DiagramGraphType, GraphConfig> = {
  FLOWCHART: {
    prefix: 'flowchart',
    nodeTypes: FLOWCHART_NODE_TYPES,
    edgeTypes: FLOWCHART_EDGE_TYPES,
    defaultEdgeType: 'flowchartFlowLineEdge',
    supportsParents: false,
    supportsData: false,
    newNodeData: () => ({}),
    newEdgeData: () => ({}),
    defaultSize: () => FLOWCHART_NODE_SIZE,
    isLane: () => false,
    isContainer: () => false,
    boundaryActivityId: () => undefined,
    cleanReferences: (nodes) => nodes,
    layoutLanes: (nodes) => nodes,
    validate: (document) => flowchartSchema.safeParse({ type: 'FLOWCHART', ...document }),
  },
  BUSINESS_PROCESS: {
    prefix: 'businessProcess',
    nodeTypes: BUSINESS_PROCESS_NODE_TYPES,
    edgeTypes: BUSINESS_PROCESS_EDGE_TYPES,
    defaultEdgeType: 'businessProcessSequenceFlowEdge',
    supportsParents: true,
    supportsData: true,
    newNodeData: businessProcessNodeDefaults,
    newEdgeData: businessProcessEdgeDefaults,
    defaultSize: businessProcessNodeDefaultSize,
    isLane: (data) => isParticipant(data, 'lane'),
    isContainer: (data) => isParticipant(data),
    boundaryActivityId: (data) => {
      const record = asRecord(data)
      return record.kind === 'event' &&
        record.context === 'boundary' &&
        typeof record.attachedToId === 'string'
        ? record.attachedToId
        : undefined
    },
    cleanReferences: (nodes, deletedNodeIds, deletedEdgeIds) =>
      clearDeletedBusinessProcessReferences(
        nodes as (GraphNode & { data: BusinessProcessNodeData })[],
        deletedNodeIds,
        deletedEdgeIds,
      ),
    layoutLanes: (nodes) =>
      layoutAllParticipantLanes(nodes as (GraphNode & ParticipantLayoutNode)[]),
    validate: (document) =>
      businessProcessSchema.safeParse({ type: 'BUSINESS_PROCESS', ...document }),
  },
}

/** `flowchartDecisionNode` → `decision`, `businessProcessSequenceFlowEdge` → `sequenceFlow`. */
export const toShortType = (config: GraphConfig, type: string) => {
  const name = type.slice(config.prefix.length).replace(/(Node|Edge)$/, '')
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export const toFullType = (
  config: GraphConfig,
  shortType: string,
  kind: 'Node' | 'Edge',
  owner: string,
): string => {
  const types = kind === 'Node' ? config.nodeTypes : config.edgeTypes
  const type = `${config.prefix}${shortType.charAt(0).toUpperCase()}${shortType.slice(1)}${kind}`
  if (!types.includes(type)) {
    const allowed = types.map((entry) => toShortType(config, entry)).join(', ')
    throw new BadRequestException(
      'BAD_REQUEST',
      `${owner}: unknown ${kind.toLowerCase()} type "${shortType}". Allowed: ${allowed}`,
    )
  }
  return type
}

/** Sets the size in the style, and in React Flow's own fields when the node has them. */
export const setSize = (node: GraphNode, size: Partial<Size>) => {
  node.style = { ...(node.style ?? {}), ...size }
  for (const dimension of ['width', 'height'] as const) {
    if (size[dimension] !== undefined && node[dimension] !== undefined) {
      node[dimension] = size[dimension]
    }
  }
}

/** Same precedence as the web editor: React Flow's own size, then the style, then the measured one. */
export const readSize = (node: BaseNode, fallback: Size): Size => {
  const pick = (dimension: 'width' | 'height') => {
    const value = Number(
      node[dimension] ?? node.style?.[dimension] ?? node.measured?.[dimension] ?? Number.NaN,
    )
    return Number.isFinite(value) && value > 0 ? value : fallback[dimension]
  }
  return { width: pick('width'), height: pick('height') }
}

export const sizeOf = (config: GraphConfig, node: GraphNode): Size =>
  readSize(node, config.defaultSize(asRecord(node.data)))
