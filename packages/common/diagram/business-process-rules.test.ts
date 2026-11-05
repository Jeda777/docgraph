import { describe, expect, it } from 'vitest'
import businessProcessFixture from '../fixtures/business-process.json'
import { businessProcessSchema } from '../schemas'
import {
  clearDeletedBusinessProcessReferences,
  isValidBusinessProcessConnection,
} from './business-process-rules'

const fixture = businessProcessSchema.parse(businessProcessFixture)

describe('isValidBusinessProcessConnection', () => {
  it('validates a reconnection using the existing edge kind and supports pool message flows', () => {
    const acrossPools = { source: 'start-order', target: 'pool-payment' }
    expect(isValidBusinessProcessConnection(acrossPools, fixture.nodes, 'sequenceFlow')).toBe(false)
    expect(isValidBusinessProcessConnection(acrossPools, fixture.nodes, 'messageFlow')).toBe(true)

    const betweenPools = { source: 'pool-order', target: 'pool-payment' }
    expect(isValidBusinessProcessConnection(betweenPools, fixture.nodes, 'messageFlow')).toBe(true)
    expect(isValidBusinessProcessConnection(betweenPools, fixture.nodes, 'sequenceFlow')).toBe(
      false,
    )
  })

  it('rejects sequence flows to data, annotations, and conversations', () => {
    for (const target of ['order-data', 'order-note', 'conversation-payment']) {
      const connection = { source: 'start-order', target }
      expect(isValidBusinessProcessConnection(connection, fixture.nodes, 'sequenceFlow')).toBe(
        false,
      )
    }
  })

  it('allows sequence flows through choreography tasks between events', () => {
    const intoChoreography = { source: 'start-order', target: 'choreography-payment' }
    const fromChoreography = { source: 'choreography-payment', target: 'end-order' }
    expect(isValidBusinessProcessConnection(intoChoreography, fixture.nodes, 'sequenceFlow')).toBe(
      true,
    )
    expect(isValidBusinessProcessConnection(fromChoreography, fixture.nodes, 'sequenceFlow')).toBe(
      true,
    )
  })
})

describe('clearDeletedBusinessProcessReferences', () => {
  it('clears semantic references when their participant or edge is deleted', () => {
    const document = businessProcessSchema.parse(businessProcessFixture)
    const gateway = document.nodes.find((node) => node.id === 'decision-order')
    if (gateway?.data.kind !== 'gateway') throw new Error('Fixture gateway missing')
    gateway.data.defaultFlowId = 'sequence-end'

    const deletedNodeIds = new Set(['pool-payment'])
    const deletedEdgeIds = new Set(['message-payment', 'sequence-end'])
    document.nodes = clearDeletedBusinessProcessReferences(
      document.nodes,
      deletedNodeIds,
      deletedEdgeIds,
    ).filter((node) => !deletedNodeIds.has(node.id))
    document.edges = document.edges.filter((edge) => !deletedEdgeIds.has(edge.id))

    const choreography = document.nodes.find((node) => node.id === 'choreography-payment')
    const conversation = document.nodes.find((node) => node.id === 'conversation-payment')
    const cleanedGateway = document.nodes.find((node) => node.id === 'decision-order')
    if (choreography?.data.kind !== 'choreography') throw new Error('Fixture choreography missing')
    if (conversation?.data.kind !== 'conversation') throw new Error('Fixture conversation missing')
    if (cleanedGateway?.data.kind !== 'gateway') throw new Error('Fixture gateway missing')
    expect(choreography.data.participantRefs).toEqual(['pool-order'])
    expect(choreography.data.initiatingParticipant).toBe('pool-order')
    expect(conversation.data.participantRefs).toEqual(['pool-order'])
    expect('defaultFlowId' in cleanedGateway.data).toBe(false)
    // The cleaned document must remain a valid import.
    expect(businessProcessSchema.safeParse(document).success).toBe(true)
  })
})
