import type { DiagramGraphUpdate } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { applyDiagramGraph } from './diagram-graph.apply'
import { diagramGraphTypeNames, toDiagramGraph } from './diagram-graph.mapper'
import type { GraphDocument } from './diagram-graph.model'

const EMPTY: GraphDocument = { nodes: [], edges: [], areas: [] }

const update = (partial: Partial<DiagramGraphUpdate>): DiagramGraphUpdate => ({
  nodes: [],
  edges: [],
  removeNodeIds: [],
  removeEdgeIds: [],
  ...partial,
})

describe('toDiagramGraph', () => {
  it('returns short types, labels and the extra business process fields', () => {
    // Built through applyDiagramGraph so the stored document matches what the editor writes.
    const document = applyDiagramGraph(
      'BUSINESS_PROCESS',
      EMPTY,
      update({
        nodes: [
          { id: 'pool', type: 'participant', text: 'Shop' },
          {
            id: 'sales',
            type: 'participant',
            text: 'Sales',
            parentId: 'pool',
            data: { participantType: 'lane' },
          },
          {
            id: 'review',
            type: 'activity',
            text: 'Review',
            parentId: 'sales',
            data: { taskType: 'userTask' },
          },
          { id: 'done', type: 'event', text: 'Done', parentId: 'sales', data: { context: 'end' } },
        ],
        edges: [{ id: 'yes', source: 'review', target: 'done', text: 'yes' }],
      }),
      'merge',
    )

    const graph = toDiagramGraph('BUSINESS_PROCESS', document)

    expect(graph.nodes.find((node) => node.id === 'review')).toMatchObject({
      type: 'activity',
      text: 'Review',
      parentId: 'sales',
      size: { width: 160, height: 80 },
      data: { taskType: 'userTask', markers: [] },
    })
    expect(graph.edges.find((edge) => edge.id === 'yes')).toMatchObject({
      type: 'sequenceFlow',
      text: 'yes',
      data: { isDefault: false },
    })
  })

  it('round-trips: applying the read graph again changes nothing', () => {
    const document = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: [
          { id: 'start', type: 'terminator', text: 'Start' },
          { id: 'check', type: 'decision', text: 'Valid?' },
          { id: 'save', type: 'process', text: 'Save' },
        ],
        edges: [
          { source: 'start', target: 'check' },
          { source: 'check', target: 'save', text: 'yes' },
        ],
      }),
      'merge',
    )
    const graph = toDiagramGraph('FLOWCHART', document)

    const result = applyDiagramGraph(
      'FLOWCHART',
      document,
      update({ nodes: graph.nodes, edges: graph.edges }),
      'replace',
    )

    expect(result.nodes).toEqual(document.nodes)
    expect(result.edges).toEqual(document.edges)
  })
})

describe('diagramGraphTypeNames', () => {
  it('lists short type names', () => {
    expect(diagramGraphTypeNames('FLOWCHART')).toMatchObject({
      edges: ['flowLine', 'bidirectionalFlowLine'],
      defaultEdge: 'flowLine',
    })
    expect(diagramGraphTypeNames('BUSINESS_PROCESS').nodes).toContain('activity')
  })
})
