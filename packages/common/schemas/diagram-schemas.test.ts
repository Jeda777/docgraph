import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import businessProcessFixture from '../fixtures/business-process.json'
import businessProcessEmptyFixture from '../fixtures/business-process-empty.json'
import databaseFixture from '../fixtures/database-diagram.json'
import flowchartFixture from '../fixtures/flowchart.json'
import {
  AREA_NODE_TYPE,
  BUSINESS_PROCESS_EDGE_TYPES,
  BUSINESS_PROCESS_NODE_TYPES,
  businessProcessEdgeKindByType,
  businessProcessSchema,
  DATABASE_DIAGRAM_EDGE_TYPE,
  DATABASE_DIAGRAM_NODE_TYPE,
  databaseDiagramSchema,
  FLOWCHART_EDGE_TYPES,
  FLOWCHART_NODE_TYPES,
  flowchartSchema,
} from './index'

type FixtureDocument = {
  nodes: { type: string }[]
  edges: { type: string }[]
  areas: { type: string }[]
}

/** Parses the fixture and fails with a readable diff when the schema rejects it. */
const parseFixture = <Schema extends z.ZodType>(schema: Schema, fixture: unknown) => {
  const result = schema.safeParse(fixture)
  if (!result.success) throw new Error(z.prettifyError(result.error))
  return result.data
}

const database = parseFixture(databaseDiagramSchema, databaseFixture)
const flowchart = parseFixture(flowchartSchema, flowchartFixture)
const businessProcess = parseFixture(businessProcessSchema, businessProcessFixture)

/**
 * Simulates the import -> export -> import cycle of `useDiagramIo`: whatever
 * the schema produces must serialize back to exactly the imported document.
 * Catches regressions that silently drop or rename fields on refactor.
 */
const expectLosslessRoundTrip = (schema: z.ZodTypeAny, fixture: unknown) => {
  const parsed = parseFixture(schema, fixture)
  const exported = JSON.parse(JSON.stringify(parsed))
  expect(exported).toEqual(fixture)

  // The exported document must still be a valid import.
  expect(schema.safeParse(exported).success).toBe(true)
}

/**
 * The golden fixture is the regression baseline: it must contain every node
 * type of its diagram (including the shared area node) plus the edge type.
 * Adding a new node/edge type without extending the fixture fails this test.
 */
const expectFixtureCoversAllTypes = (
  fixture: FixtureDocument,
  nodeTypes: readonly string[],
  edgeType: string,
) => {
  const presentTypes = [...fixture.nodes, ...fixture.areas].map((node) => node.type)
  for (const type of [...nodeTypes, AREA_NODE_TYPE]) {
    expect(presentTypes).toContain(type)
  }
  expect(fixture.edges.map((edge) => edge.type)).toContain(edgeType)
}

describe('database diagram schema', () => {
  it('accepts the golden fixture', () => {
    expect(databaseDiagramSchema.safeParse(databaseFixture).success).toBe(true)
  })

  it('round-trips import -> export without data loss', () => {
    expectLosslessRoundTrip(databaseDiagramSchema, databaseFixture)
  })

  it('golden fixture covers every node and edge type', () => {
    expectFixtureCoversAllTypes(database, [DATABASE_DIAGRAM_NODE_TYPE], DATABASE_DIAGRAM_EDGE_TYPE)
  })

  it('rejects an unsupported table color', () => {
    const invalid = JSON.parse(JSON.stringify(databaseFixture)) as typeof databaseFixture
    invalid.nodes[0].data.color = 'chartreuse'
    expect(databaseDiagramSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects a column missing flag fields', () => {
    const invalid = JSON.parse(JSON.stringify(databaseFixture)) as typeof databaseFixture
    delete (invalid.nodes[0].data.values[0] as Record<string, unknown>).primaryKey
    expect(databaseDiagramSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('flowchart schema', () => {
  it('accepts the golden fixture', () => {
    expect(flowchartSchema.safeParse(flowchartFixture).success).toBe(true)
  })

  it('round-trips import -> export without data loss', () => {
    expectLosslessRoundTrip(flowchartSchema, flowchartFixture)
  })

  it('golden fixture covers every node and edge type', () => {
    expectFixtureCoversAllTypes(flowchart, FLOWCHART_NODE_TYPES, FLOWCHART_EDGE_TYPES[0])
    expect(flowchartFixture.edges.map((edge) => edge.type)).toContain(FLOWCHART_EDGE_TYPES[1])
  })

  it('rejects an incorrect root type', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.type = 'DATABASE_DIAGRAM'
    expect(flowchartSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects an unknown node type', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.nodes[0].type = 'flowchartUnknownNode'
    expect(flowchartSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects orphan edges', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.edges[0].source = 'missing-node'
    expect(flowchartSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects an unregistered handle', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.edges[0].sourceHandle = 'source-bottom'

    const result = flowchartSchema.safeParse(invalid)

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([
      'edges',
      0,
      'sourceHandle',
    ])
  })

  it('rejects an area as an edge endpoint', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.edges[0].target = invalid.areas[0].id

    const result = flowchartSchema.safeParse(invalid)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual({
      code: 'custom',
      path: ['edges', 0, 'target'],
      message: 'Edge target must reference a flowchart node.',
    })
  })

  it('rejects negative node dimensions', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    ;(invalid.nodes[0] as { style?: { width: number } }).style = { width: -1 }

    const result = flowchartSchema.safeParse(invalid)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual({
      code: 'custom',
      path: ['nodes', 0, 'style'],
      message: 'Node dimensions cannot be negative.',
    })
  })

  it('rejects an area id that collides with a node id', () => {
    const invalid = JSON.parse(JSON.stringify(flowchartFixture)) as typeof flowchartFixture
    invalid.areas[0].id = invalid.nodes[0].id

    const result = flowchartSchema.safeParse(invalid)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual({
        code: 'custom',
        path: ['areas', 0, 'id'],
        message: 'Collection ids must be unique.',
      })
    }
  })
})

describe('business process schema', () => {
  it('accepts an empty business process document', () => {
    expect(businessProcessSchema.safeParse(businessProcessEmptyFixture).success).toBe(true)
  })

  it('accepts the comprehensive fixture', () => {
    expect(businessProcessSchema.safeParse(businessProcessFixture).success).toBe(true)
  })

  it('requires lanes inside white-box pools and permits nested lanes', () => {
    const standaloneLane = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const laneWithoutPool = standaloneLane.nodes.find((node) => node.id === 'lane-sales')
    if (!laneWithoutPool) throw new Error('Fixture lane missing')
    delete laneWithoutPool.parentId
    expect(businessProcessSchema.safeParse(standaloneLane).success).toBe(false)

    const nestedLane = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const parentLane = nestedLane.nodes.find((node) => node.id === 'lane-sales')
    if (parentLane?.data.kind !== 'participant') throw new Error('Fixture lane missing')
    nestedLane.nodes.push({
      ...parentLane,
      id: 'lane-refunds',
      parentId: parentLane.id,
      position: { x: 24, y: 24 },
      data: { ...parentLane.data, text: 'Refunds' },
    } as (typeof nestedLane.nodes)[number])
    expect(businessProcessSchema.safeParse(nestedLane).success).toBe(true)

    const blackBoxLane = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const laneInBlackBox = blackBoxLane.nodes.find((node) => node.id === 'lane-sales')
    if (!laneInBlackBox) throw new Error('Fixture lane missing')
    laneInBlackBox.parentId = 'pool-payment'
    blackBoxLane.edges = []
    expect(businessProcessSchema.safeParse(blackBoxLane).success).toBe(false)
  })

  it('round-trips import -> export without data loss', () => {
    expectLosslessRoundTrip(businessProcessSchema, businessProcessFixture)
  })

  it('covers every supported node and edge family', () => {
    expectFixtureCoversAllTypes(
      businessProcess,
      BUSINESS_PROCESS_NODE_TYPES,
      BUSINESS_PROCESS_EDGE_TYPES[0],
    )
    expect(businessProcessFixture.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining([...BUSINESS_PROCESS_EDGE_TYPES]),
    )
  })

  it('rejects an unknown root type and orphan edge', () => {
    const invalid = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    invalid.type = 'FLOWCHART'
    expect(businessProcessSchema.safeParse(invalid).success).toBe(false)

    invalid.type = 'BUSINESS_PROCESS'
    invalid.edges[0].source = 'missing-node'
    expect(businessProcessSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects duplicate ids, invalid handles, and broken boundary attachments', () => {
    const duplicate = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    duplicate.nodes[1].id = duplicate.nodes[0].id
    expect(businessProcessSchema.safeParse(duplicate).success).toBe(false)

    const invalidHandle = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    invalidHandle.edges[0].sourceHandle = 'diagonal'
    expect(businessProcessSchema.safeParse(invalidHandle).success).toBe(false)

    const invalidBoundary = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const boundary = invalidBoundary.nodes.find((node) => node.id === 'boundary-timeout')
    if (boundary?.data.kind !== 'event') throw new Error('Fixture boundary event missing')
    boundary.data.attachedToId = 'missing-activity'
    expect(businessProcessSchema.safeParse(invalidBoundary).success).toBe(false)
  })

  it('rejects event definitions that are invalid for their context and sequence flows across pools', () => {
    const invalidEvent = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const start = invalidEvent.nodes.find((node) => node.id === 'start-order')
    if (start?.data.kind !== 'event') throw new Error('Fixture start event missing')
    start.data.eventType = 'terminate'
    expect(businessProcessSchema.safeParse(invalidEvent).success).toBe(false)

    const invalidConnection = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    invalidConnection.edges[0].target = 'pool-payment'
    expect(businessProcessSchema.safeParse(invalidConnection).success).toBe(false)

    const invalidCycle = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    invalidCycle.nodes[0].parentId = 'pool-payment'
    invalidCycle.nodes[1].parentId = 'pool-order'
    expect(businessProcessSchema.safeParse(invalidCycle).success).toBe(false)
  })

  it('allows message flows to message start events and from message end events', () => {
    const inbound = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const inboundFlow = inbound.edges.find((edge) => edge.id === 'message-payment')
    if (!inboundFlow) throw new Error('Fixture message flow missing')
    inboundFlow.source = 'pool-payment'
    inboundFlow.target = 'start-order'
    expect(businessProcessSchema.safeParse(inbound).success).toBe(true)

    const outbound = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const outboundFlow = outbound.edges.find((edge) => edge.id === 'message-payment')
    const end = outbound.nodes.find((node) => node.id === 'end-order')
    if (!outboundFlow || end?.data.kind !== 'event') throw new Error('Fixture end event missing')
    outboundFlow.source = 'end-order'
    outboundFlow.target = 'pool-payment'
    end.data.eventType = 'message'
    expect(businessProcessSchema.safeParse(outbound).success).toBe(true)
  })

  it('rejects a sequence flow to a participant', () => {
    const sequenceToParticipant = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const sequence = sequenceToParticipant.edges.find((edge) => edge.id === 'sequence-start')
    if (!sequence) throw new Error('Fixture sequence flow missing')
    sequence.target = 'pool-order'
    expect(businessProcessSchema.safeParse(sequenceToParticipant).success).toBe(false)
  })

  it('rejects sequence flows to data, annotations, and conversations', () => {
    for (const target of ['order-data', 'order-note', 'conversation-payment']) {
      const invalid = JSON.parse(
        JSON.stringify(businessProcessFixture),
      ) as typeof businessProcessFixture
      const sequence = invalid.edges.find((edge) => edge.id === 'sequence-start')
      if (!sequence) throw new Error('Fixture sequence flow missing')
      sequence.target = target
      expect(businessProcessSchema.safeParse(invalid).success).toBe(false)
    }
  })

  it('allows sequence flows through choreography tasks between events', () => {
    const document = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const intoChoreography = document.edges.find((edge) => edge.id === 'sequence-start')
    if (!intoChoreography) throw new Error('Fixture sequence flow missing')
    intoChoreography.target = 'choreography-payment'
    document.edges.push({
      id: 'sequence-choreography-end',
      source: 'choreography-payment',
      sourceHandle: 'right',
      target: 'end-order',
      targetHandle: 'left',
      type: 'businessProcessSequenceFlowEdge',
      data: { kind: 'sequenceFlow', text: '', isDefault: false },
    })

    expect(businessProcessSchema.safeParse(document).success).toBe(true)
  })

  it('maps every edge type to its matching business process kind', () => {
    expect(businessProcessEdgeKindByType).toEqual({
      businessProcessSequenceFlowEdge: 'sequenceFlow',
      businessProcessMessageFlowEdge: 'messageFlow',
      businessProcessAssociationEdge: 'association',
      businessProcessDataAssociationEdge: 'dataAssociation',
      businessProcessConversationLinkEdge: 'conversationLink',
    })
  })

  it('allows associations to connect to start and end events', () => {
    const associationToStart = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const association = associationToStart.edges.find((edge) => edge.id === 'association-note')
    if (!association) throw new Error('Fixture association missing')
    association.target = 'start-order'
    expect(businessProcessSchema.safeParse(associationToStart).success).toBe(true)

    const dataAssociationFromEnd = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const dataAssociation = dataAssociationFromEnd.edges.find((edge) => edge.id === 'data-order')
    if (!dataAssociation) throw new Error('Fixture data association missing')
    dataAssociation.source = 'end-order'
    dataAssociation.target = 'order-data'
    expect(businessProcessSchema.safeParse(dataAssociationFromEnd).success).toBe(true)
  })

  it('rejects non-message events and sequence flows in forbidden directions', () => {
    const nonMessageStart = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const inboundFlow = nonMessageStart.edges.find((edge) => edge.id === 'message-payment')
    const start = nonMessageStart.nodes.find((node) => node.id === 'start-order')
    if (!inboundFlow || start?.data.kind !== 'event') throw new Error('Fixture start event missing')
    inboundFlow.source = 'pool-payment'
    inboundFlow.target = 'start-order'
    start.data.eventType = 'none'
    expect(businessProcessSchema.safeParse(nonMessageStart).success).toBe(false)

    const nonMessageEnd = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const outboundFlow = nonMessageEnd.edges.find((edge) => edge.id === 'message-payment')
    if (!outboundFlow) throw new Error('Fixture message flow missing')
    outboundFlow.source = 'end-order'
    outboundFlow.target = 'pool-payment'
    expect(businessProcessSchema.safeParse(nonMessageEnd).success).toBe(false)

    const toMessageStart = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const sequenceToStart = toMessageStart.edges.find((edge) => edge.id === 'sequence-start')
    if (!sequenceToStart) throw new Error('Fixture sequence flow missing')
    sequenceToStart.source = 'validate-order'
    sequenceToStart.target = 'start-order'
    expect(businessProcessSchema.safeParse(toMessageStart).success).toBe(false)

    const fromMessageEnd = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const sequenceFromEnd = fromMessageEnd.edges.find((edge) => edge.id === 'sequence-end')
    if (!sequenceFromEnd) throw new Error('Fixture sequence flow missing')
    sequenceFromEnd.source = 'end-order'
    sequenceFromEnd.target = 'decision-order'
    expect(businessProcessSchema.safeParse(fromMessageEnd).success).toBe(false)
  })
})
