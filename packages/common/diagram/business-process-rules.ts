import type { BusinessProcessNodeData } from '../schemas/business-process'

/**
 * Semantic rules of business process diagrams, shared by the schema validation,
 * the web editor (connection checks, deletes) and the server (MCP writes).
 */

export type BusinessProcessNodeLike = {
  id: string
  parentId?: string
  data: BusinessProcessNodeData
}

export type BusinessProcessConnection = {
  source: string | null
  target: string | null
}

/** Id of the pool that contains the node (directly or through lanes), if any. */
export const findAncestorPoolId = (
  id: string,
  nodes: ReadonlyMap<string, BusinessProcessNodeLike>,
) => {
  let current = nodes.get(id)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.data.kind === 'participant' && current.data.participantType === 'pool')
      return current.id
    current = current.parentId ? nodes.get(current.parentId) : undefined
  }
  return undefined
}

/** Whether an edge of the given kind may connect these nodes under the business process rules. */
export const isValidBusinessProcessConnection = (
  connection: BusinessProcessConnection,
  nodes: readonly BusinessProcessNodeLike[],
  edgeKind = 'sequenceFlow',
) => {
  if (!connection.source || !connection.target || connection.source === connection.target)
    return false
  const nodeMap = new Map<string, BusinessProcessNodeLike>(nodes.map((node) => [node.id, node]))
  const source = nodeMap.get(connection.source)
  const target = nodeMap.get(connection.target)
  if (!source || !target) return false
  if (
    edgeKind === 'sequenceFlow' &&
    source.data.kind === 'event' &&
    source.data.context === 'end'
  ) {
    return false
  }
  if (
    edgeKind === 'messageFlow' &&
    source.data.kind === 'event' &&
    source.data.context === 'end' &&
    source.data.eventType !== 'message'
  ) {
    return false
  }
  if (
    edgeKind === 'sequenceFlow' &&
    target.data.kind === 'event' &&
    target.data.context === 'start'
  ) {
    return false
  }
  if (
    edgeKind === 'messageFlow' &&
    target.data.kind === 'event' &&
    target.data.context === 'start' &&
    target.data.eventType !== 'message'
  ) {
    return false
  }

  const sourcePool = findAncestorPoolId(source.id, nodeMap)
  const targetPool = findAncestorPoolId(target.id, nodeMap)
  if (edgeKind === 'sequenceFlow') {
    const sequenceFlowEndpointKinds = ['activity', 'event', 'gateway', 'choreography']
    return (
      sequenceFlowEndpointKinds.includes(source.data.kind) &&
      sequenceFlowEndpointKinds.includes(target.data.kind) &&
      (!sourcePool || !targetPool || sourcePool === targetPool)
    )
  }
  if (edgeKind === 'messageFlow') {
    if (
      (source.data.kind === 'participant' && source.data.participantType !== 'pool') ||
      (target.data.kind === 'participant' && target.data.participantType !== 'pool')
    ) {
      return false
    }
    return Boolean(sourcePool && targetPool && sourcePool !== targetPool)
  }
  return true
}

/** Drops references to deleted nodes and edges so the document stays valid. */
export const clearDeletedBusinessProcessReferences = <NodeType extends BusinessProcessNodeLike>(
  nodes: NodeType[],
  deletedNodeIds: ReadonlySet<string>,
  deletedEdgeIds: ReadonlySet<string>,
): NodeType[] =>
  nodes.map((node) => {
    if (
      node.data.kind === 'gateway' &&
      node.data.defaultFlowId &&
      deletedEdgeIds.has(node.data.defaultFlowId)
    ) {
      const data = { ...node.data }
      delete data.defaultFlowId
      return { ...node, data } as NodeType
    }
    if (node.data.kind === 'choreography') {
      const participantRefs = node.data.participantRefs.filter((id) => !deletedNodeIds.has(id))
      const removeInitiator = Boolean(
        node.data.initiatingParticipant && deletedNodeIds.has(node.data.initiatingParticipant),
      )
      if (participantRefs.length === node.data.participantRefs.length && !removeInitiator) {
        return node
      }
      const data = { ...node.data, participantRefs }
      if (removeInitiator) delete data.initiatingParticipant
      return { ...node, data } as NodeType
    }
    if (node.data.kind === 'conversation') {
      const participantRefs = node.data.participantRefs.filter((id) => !deletedNodeIds.has(id))
      return participantRefs.length === node.data.participantRefs.length
        ? node
        : ({ ...node, data: { ...node.data, participantRefs } } as NodeType)
    }
    return node
  })
