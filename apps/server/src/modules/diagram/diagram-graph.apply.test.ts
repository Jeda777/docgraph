import type { DiagramGraphUpdate } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { applyDiagramGraph } from './diagram-graph.apply'
import type { GraphDocument } from './diagram-graph.model'

const EMPTY: GraphDocument = { nodes: [], edges: [], areas: [] }

const update = (partial: Partial<DiagramGraphUpdate>): DiagramGraphUpdate => ({
  nodes: [],
  edges: [],
  removeNodeIds: [],
  removeEdgeIds: [],
  ...partial,
})

const FLOW = update({
  nodes: [
    { id: 'start', type: 'terminator', text: 'Start' },
    { id: 'check', type: 'decision', text: 'Valid?' },
    { id: 'save', type: 'process', text: 'Save' },
  ],
  edges: [
    { source: 'start', target: 'check' },
    { source: 'check', target: 'save', text: 'yes' },
  ],
})

describe('applyDiagramGraph (FLOWCHART)', () => {
  it('creates React Flow nodes and edges with full type names', () => {
    const result = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    expect(result.nodes.map((node) => node.type)).toEqual([
      'flowchartTerminatorNode',
      'flowchartDecisionNode',
      'flowchartProcessNode',
    ])
    expect(result.nodes[0]).toMatchObject({
      data: { text: 'Start' },
      style: { width: 160, height: 80 },
    })
    expect(result.edges).toHaveLength(2)
    expect(result.edges[1]).toMatchObject({
      type: 'flowchartFlowLineEdge',
      data: { text: 'yes' },
    })
    expect(result.summary.nodesCreated).toEqual(['start', 'check', 'save'])
  })

  it('lays out new nodes left to right along the edges and picks facing handles', () => {
    const result = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    const [start, check, save] = result.nodes

    expect(start.position.x).toBeLessThan(check.position.x)
    expect(check.position.x).toBeLessThan(save.position.x)
    expect(start.position.y).toBe(check.position.y)
    expect(result.edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
  })

  it('keeps positions, sizes and other properties of existing nodes', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    current.nodes[0].position = { x: 500, y: 700 }
    current.nodes[0].style = { width: 300, height: 90 }

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ nodes: [{ id: 'start', text: 'Begin' }] }),
      'merge',
    )

    expect(result.nodes[0]).toMatchObject({
      type: 'flowchartTerminatorNode',
      position: { x: 500, y: 700 },
      style: { width: 300, height: 90 },
      data: { text: 'Begin' },
    })
    expect(result.nodes).toHaveLength(3)
    expect(result.summary.nodesUpdated).toEqual(['start'])
  })

  it('does not duplicate edges sent again without an id', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph('FLOWCHART', current, FLOW, 'merge')

    expect(result.edges.map((edge) => edge.id)).toEqual(current.edges.map((edge) => edge.id))
    expect(result.summary.edgesCreated).toEqual([])
  })

  it('removes nodes with their edges in merge mode', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ removeNodeIds: ['save'] }),
      'merge',
    )

    expect(result.nodes.map((node) => node.id)).toEqual(['start', 'check'])
    expect(result.edges).toHaveLength(1)
    expect(result.summary.nodesRemoved).toEqual(['save'])
  })

  it('drops everything not given in replace mode but keeps areas', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    const area = {
      id: 'area',
      type: 'areaNode',
      position: { x: 0, y: 0 },
      style: { width: 400, height: 300 },
      data: { name: 'Group', color: '#3b82f6', alpha: 0.2, order: 0 },
    }

    const result = applyDiagramGraph(
      'FLOWCHART',
      { ...current, areas: [area] },
      update({ nodes: [{ id: 'start' }] }),
      'replace',
    )

    expect(result.nodes.map((node) => node.id)).toEqual(['start'])
    expect(result.edges).toEqual([])
    expect(result.areas).toEqual([area])
  })

  it('rejects unknown types, missing endpoints and business process fields', () => {
    expect(() =>
      applyDiagramGraph(
        'FLOWCHART',
        EMPTY,
        update({ nodes: [{ id: 'a', type: 'task' }] }),
        'merge',
      ),
    ).toThrow(/unknown node type "task"\. Allowed: process, decision/)
    expect(() =>
      applyDiagramGraph('FLOWCHART', EMPTY, update({ nodes: [{ id: 'a' }] }), 'merge'),
    ).toThrow(/type is required/)
    expect(() =>
      applyDiagramGraph(
        'FLOWCHART',
        EMPTY,
        update({ edges: [{ source: 'a', target: 'b' }] }),
        'merge',
      ),
    ).toThrow(/node "a" does not exist/)
    expect(() =>
      applyDiagramGraph(
        'FLOWCHART',
        EMPTY,
        update({ nodes: [{ id: 'a', type: 'process', parentId: 'b' }] }),
        'merge',
      ),
    ).toThrow(/parentId is only supported/)
  })

  it('lists every node and edge id given more than once', () => {
    const duplicated = update({
      nodes: [
        { id: 'a', type: 'process' },
        { id: 'a', type: 'process' },
        { id: 'b', type: 'process' },
        { id: 'b', type: 'process' },
      ],
      edges: [
        { id: 'e', source: 'a', target: 'b' },
        { id: 'e', source: 'b', target: 'a' },
      ],
    })

    expect(() => applyDiagramGraph('FLOWCHART', EMPTY, duplicated, 'merge')).toThrow(
      'Duplicate nodes: a, b\nDuplicate edges: e',
    )
  })
})

const nodeById = (result: GraphDocument, id: string) => {
  const node = result.nodes.find((entry) => entry.id === id)
  if (!node) throw new Error(`Node "${id}" missing`)
  return node
}

const edgeBetween = (result: GraphDocument, source: string, target: string) =>
  result.edges.find((edge) => edge.source === source && edge.target === target)

describe('applyDiagramGraph automatic layout (FLOWCHART)', () => {
  it('places unconnected nodes in one column from the root origin', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: ['a', 'b', 'c'].map((id) => ({ id, type: 'process' })),
      }),
      'merge',
    )

    expect(result.nodes.map((node) => node.position)).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 180 },
      { x: 40, y: 320 },
    ])
  })

  it('stacks parallel branches in the same column', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: ['root', 'left', 'right'].map((id) => ({ id, type: 'process' })),
        edges: [
          { source: 'root', target: 'left' },
          { source: 'root', target: 'right' },
        ],
      }),
      'merge',
    )
    const [root, left, right] = ['root', 'left', 'right'].map((id) => nodeById(result, id))

    expect(left.position.x).toBe(right.position.x)
    expect(left.position.x).toBeGreaterThan(root.position.x)
    expect(right.position.y).toBeGreaterThan(left.position.y)
    // The lower branch is still further right than down, so it keeps horizontal handles.
    expect(edgeBetween(result, 'root', 'right')).toMatchObject({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })

  it('uses the longest path for a node reached by paths of different lengths', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: ['a', 'b', 'c'].map((id) => ({ id, type: 'process' })),
        edges: [
          { source: 'a', target: 'c' },
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
        ],
      }),
      'merge',
    )

    expect(nodeById(result, 'c').position.x).toBeGreaterThan(nodeById(result, 'b').position.x)
  })

  it('places nodes on a cycle after the acyclic part without hanging', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: ['entry', 'loopA', 'loopB'].map((id) => ({ id, type: 'process' })),
        edges: [
          { source: 'entry', target: 'loopA' },
          { source: 'loopA', target: 'loopB' },
          { source: 'loopB', target: 'loopA' },
        ],
      }),
      'merge',
    )
    const [entry, loopA, loopB] = ['entry', 'loopA', 'loopB'].map((id) => nodeById(result, id))

    expect(loopA.position.x).toBe(loopB.position.x)
    expect(loopA.position.x).toBeGreaterThan(entry.position.x)
    expect(loopB.position.y).toBeGreaterThan(loopA.position.y)
  })

  it('ignores self loops when ranking and still gives them handles', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: [{ id: 'retry', type: 'process' }],
        edges: [{ source: 'retry', target: 'retry' }],
      }),
      'merge',
    )

    expect(nodeById(result, 'retry').position).toEqual({ x: 40, y: 40 })
    expect(result.edges[0]).toMatchObject({ sourceHandle: 'right', targetHandle: 'left' })
  })

  it('keeps explicit positions and sizes and lays out only the rest', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: [
          {
            id: 'fixed',
            type: 'process',
            position: { x: 300, y: 500 },
            size: { width: 200, height: 120 },
          },
          { id: 'free', type: 'process' },
        ],
      }),
      'merge',
    )

    expect(nodeById(result, 'fixed')).toMatchObject({
      position: { x: 300, y: 500 },
      style: { width: 200, height: 120 },
    })
    // Placed below the fixed node, aligned with its left edge.
    expect(nodeById(result, 'free').position).toEqual({ x: 300, y: 680 })
  })

  it('places nodes added later below the existing content without moving it', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    const lowest = Math.max(
      ...current.nodes.map((node) => node.position.y + Number(node.style?.height)),
    )

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ nodes: [{ id: 'extra', type: 'process' }] }),
      'merge',
    )

    for (const node of current.nodes) {
      expect(nodeById(result, node.id).position).toEqual(node.position)
    }
    expect(nodeById(result, 'extra').position).toEqual({ x: 40, y: lowest + 60 })
  })

  it('picks vertical and backward handles from the node positions', () => {
    const result = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: [
          { id: 'top', type: 'process', position: { x: 0, y: 0 } },
          { id: 'bottom', type: 'process', position: { x: 0, y: 400 } },
          { id: 'west', type: 'process', position: { x: -600, y: 0 } },
        ],
        edges: [
          { source: 'top', target: 'bottom' },
          { source: 'bottom', target: 'top' },
          { source: 'top', target: 'west' },
        ],
      }),
      'merge',
    )

    expect(edgeBetween(result, 'top', 'bottom')).toMatchObject({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
    expect(edgeBetween(result, 'bottom', 'top')).toMatchObject({
      sourceHandle: 'top',
      targetHandle: 'bottom',
    })
    expect(edgeBetween(result, 'top', 'west')).toMatchObject({
      sourceHandle: 'left',
      targetHandle: 'right',
    })
  })

  it('keeps explicit handles and the handles of edges whose endpoints did not change', () => {
    const current = applyDiagramGraph(
      'FLOWCHART',
      EMPTY,
      update({
        nodes: FLOW.nodes,
        edges: [
          {
            id: 'e1',
            source: 'start',
            target: 'check',
            sourceHandle: 'bottom',
            targetHandle: 'top',
          },
        ],
      }),
      'merge',
    )
    expect(current.edges[0]).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })

    const relabeled = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ edges: [{ id: 'e1', source: 'start', target: 'check', text: 'go' }] }),
      'merge',
    )
    expect(relabeled.edges[0]).toMatchObject({ sourceHandle: 'bottom', targetHandle: 'top' })

    const rewired = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ edges: [{ id: 'e1', source: 'check', target: 'start' }] }),
      'merge',
    )
    // New endpoints: handles are picked again (check sits right of start).
    expect(rewired.edges[0]).toMatchObject({ sourceHandle: 'left', targetHandle: 'right' })
  })

  it('does not mutate the current document', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    const before = structuredClone(current)

    applyDiagramGraph(
      'FLOWCHART',
      current,
      update({
        nodes: [{ id: 'extra', type: 'process' }],
        edges: [{ source: 'save', target: 'extra' }],
        removeNodeIds: ['start'],
      }),
      'merge',
    )

    expect(current).toEqual(before)
  })
})

describe('applyDiagramGraph merge / replace (FLOWCHART)', () => {
  it('ignores removal of unknown ids', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ removeNodeIds: ['ghost'], removeEdgeIds: ['ghost-edge'] }),
      'merge',
    )

    expect(result.nodes).toEqual(current.nodes)
    expect(result.edges).toEqual(current.edges)
    expect(result.summary).toMatchObject({ nodesRemoved: [], edgesRemoved: [] })
  })

  it('keeps a node that is both given and listed for removal', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ nodes: [{ id: 'save', text: 'Store' }], removeNodeIds: ['save'] }),
      'merge',
    )

    expect(nodeById(result, 'save').data).toMatchObject({ text: 'Store' })
    expect(result.edges).toHaveLength(2)
    expect(result.summary).toMatchObject({ nodesUpdated: ['save'], nodesRemoved: [] })
  })

  it('removes a single edge in merge mode and keeps its nodes', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    const removed = current.edges[0].id

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ removeEdgeIds: [removed] }),
      'merge',
    )

    expect(result.nodes).toEqual(current.nodes)
    expect(result.edges.map((edge) => edge.id)).toEqual([current.edges[1].id])
    expect(result.summary.edgesRemoved).toEqual([removed])
  })

  it('creates a second edge between the same nodes when the type differs', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ edges: [{ source: 'start', target: 'check', type: 'bidirectionalFlowLine' }] }),
      'merge',
    )

    expect(result.edges).toHaveLength(3)
    expect(result.edges[2]).toMatchObject({ type: 'flowchartBidirectionalFlowLineEdge' })
    expect(result.summary.edgesCreated).toHaveLength(1)
  })

  it('replace with an empty update clears all nodes and edges', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph('FLOWCHART', current, update({}), 'replace')

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.summary.nodesRemoved).toEqual(['start', 'check', 'save'])
    expect(result.summary.edgesRemoved).toEqual(current.edges.map((edge) => edge.id))
  })

  it('replace keeps given edges matched by endpoints and drops the others', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ nodes: FLOW.nodes, edges: [{ source: 'check', target: 'save' }] }),
      'replace',
    )

    expect(result.edges.map((edge) => edge.id)).toEqual([current.edges[1].id])
    expect(result.edges[0].data).toMatchObject({ text: 'yes' })
    expect(result.summary).toMatchObject({
      edgesUpdated: [current.edges[1].id],
      edgesRemoved: [current.edges[0].id],
      edgesCreated: [],
    })
  })

  it('replace keeps existing nodes in place when they are given without a position', () => {
    const current = applyDiagramGraph('FLOWCHART', EMPTY, FLOW, 'merge')
    current.nodes[1].position = { x: 900, y: 900 }

    const result = applyDiagramGraph(
      'FLOWCHART',
      current,
      update({ nodes: [{ id: 'check' }, { id: 'new', type: 'process' }] }),
      'replace',
    )

    expect(nodeById(result, 'check').position).toEqual({ x: 900, y: 900 })
    // The new node goes below what is left, not below the removed nodes.
    expect(nodeById(result, 'new').position).toEqual({ x: 900, y: 1040 })
  })
})

const PROCESS = update({
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
      id: 'start',
      type: 'event',
      text: 'Order',
      parentId: 'sales',
      data: { eventType: 'message' },
    },
    {
      id: 'review',
      type: 'activity',
      text: 'Review',
      parentId: 'sales',
      data: { taskType: 'userTask' },
    },
    { id: 'approved', type: 'gateway', text: 'Approved?', parentId: 'sales' },
    { id: 'done', type: 'event', text: 'Done', parentId: 'sales', data: { context: 'end' } },
    {
      id: 'timeout',
      type: 'event',
      text: 'Timeout',
      data: { context: 'boundary', eventType: 'timer', attachedToId: 'review' },
    },
  ],
  edges: [
    { source: 'start', target: 'review' },
    { source: 'review', target: 'approved' },
    { id: 'yes', source: 'approved', target: 'done', text: 'yes' },
  ],
})

describe('applyDiagramGraph (BUSINESS_PROCESS)', () => {
  it('builds business process data from defaults and the given fields', () => {
    const result = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')
    const byId = new Map(result.nodes.map((node) => [node.id, node]))

    expect(byId.get('pool')?.data).toEqual({
      kind: 'participant',
      text: 'Shop',
      participantType: 'pool',
      orientation: 'horizontal',
      blackBox: false,
    })
    expect(byId.get('review')?.data).toEqual({
      kind: 'activity',
      text: 'Review',
      taskType: 'userTask',
      markers: [],
    })
    expect(byId.get('start')?.data).toMatchObject({
      kind: 'event',
      context: 'start',
      eventType: 'message',
    })
    expect(result.edges[2]).toMatchObject({
      id: 'yes',
      type: 'businessProcessSequenceFlowEdge',
      data: { kind: 'sequenceFlow', text: 'yes', isDefault: false },
    })
  })

  it('nests nodes in their containers and grows containers around new content', () => {
    const result = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')
    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const lane = byId.get('sales')
    const pool = byId.get('pool')

    expect(byId.get('review')).toMatchObject({ parentId: 'sales', extent: 'parent' })
    expect(lane).toMatchObject({ parentId: 'pool', position: { x: 34, y: 2 } })
    const done = byId.get('done')
    expect(Number(lane?.style?.width)).toBeGreaterThan(
      Number(done?.position.x) + Number(done?.style?.width),
    )
    expect(Number(pool?.style?.width)).toBeGreaterThanOrEqual(
      Number(lane?.position.x) + Number(lane?.style?.width),
    )
  })

  it('grows the pool and moves the lanes below when content is added to an existing lane', () => {
    const current = applyDiagramGraph(
      'BUSINESS_PROCESS',
      EMPTY,
      update({
        nodes: [
          { id: 'pool', type: 'participant', text: 'Shop' },
          ...['l1', 'l2'].map((id) => ({
            id,
            type: 'participant',
            parentId: 'pool',
            data: { participantType: 'lane' },
          })),
        ],
      }),
      'merge',
    )
    const steps = ['a1', 'a2', 'a3', 'a4', 'a5']

    const result = applyDiagramGraph(
      'BUSINESS_PROCESS',
      current,
      update({
        nodes: steps.map((id) => ({ id, type: 'activity', parentId: 'l1' })),
        edges: [
          { source: 'a1', target: 'a2' },
          { source: 'a2', target: 'a3' },
        ],
      }),
      'merge',
    )

    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const sizeOf = (id: string) => {
      const node = byId.get(id)
      return { width: Number(node?.style?.width), height: Number(node?.style?.height) }
    }
    const [pool, l1, l2] = ['pool', 'l1', 'l2'].map((id) => ({
      ...(byId.get(id)?.position as { x: number; y: number }),
      ...sizeOf(id),
    }))
    for (const id of steps) {
      const step = { ...(byId.get(id)?.position as { x: number; y: number }), ...sizeOf(id) }
      expect(step.x + step.width).toBeLessThanOrEqual(l1.width)
      expect(step.y + step.height).toBeLessThanOrEqual(l1.height)
    }
    expect(l2.y).toBe(l1.y + l1.height)
    expect(l2.width).toBe(l1.width)
    expect(pool.height).toBeGreaterThanOrEqual(l2.y + l2.height)
    expect(pool.width).toBeGreaterThanOrEqual(l1.x + l1.width)
  })

  it('attaches boundary events to the border of their activity', () => {
    const result = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')
    const timeout = result.nodes.find((node) => node.id === 'timeout')

    expect(timeout).toMatchObject({ parentId: 'review', position: { x: 44, y: 44 } })
    expect(timeout).not.toHaveProperty('extent')
  })

  it('reports business process rule violations with the node id', () => {
    const invalid = update({
      nodes: [
        { id: 'end', type: 'event', data: { context: 'end' } },
        { id: 'task', type: 'activity' },
      ],
      edges: [
        { source: 'task', target: 'end' },
        { source: 'end', target: 'task' },
      ],
    })

    expect(() => applyDiagramGraph('BUSINESS_PROCESS', EMPTY, invalid, 'merge')).toThrow(
      /Invalid sequenceFlow connection/,
    )
    expect(() =>
      applyDiagramGraph(
        'BUSINESS_PROCESS',
        EMPTY,
        update({ nodes: [{ id: 'task', type: 'activity', data: { taskType: 'nope' } }] }),
        'merge',
      ),
    ).toThrow(/node "task" \(data\.taskType\)/)
  })

  it('leaves the current document untouched when the result is invalid', () => {
    const current = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')
    const before = structuredClone(current)

    // The new activity grows its lane, but an end event cannot have outgoing flows.
    expect(() =>
      applyDiagramGraph(
        'BUSINESS_PROCESS',
        current,
        update({
          nodes: [{ id: 'extra', type: 'activity', text: 'Extra', parentId: 'sales' }],
          edges: [{ source: 'done', target: 'extra' }],
        }),
        'merge',
      ),
    ).toThrow(/not valid/)
    expect(current).toEqual(before)
  })

  it('removes a container with everything nested in it and their edges', () => {
    const current = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')

    const result = applyDiagramGraph(
      'BUSINESS_PROCESS',
      current,
      update({ removeNodeIds: ['pool'] }),
      'merge',
    )

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(new Set(result.summary.nodesRemoved)).toEqual(
      new Set(PROCESS.nodes.map((node) => node.id)),
    )
  })

  it('replace drops nested nodes that are not given', () => {
    const current = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')

    const result = applyDiagramGraph(
      'BUSINESS_PROCESS',
      current,
      update({ nodes: [{ id: 'pool' }, { id: 'sales' }, { id: 'review' }] }),
      'replace',
    )

    expect(result.nodes.map((node) => node.id)).toEqual(['pool', 'sales', 'review'])
    expect(result.edges).toEqual([])
    expect(result.summary.nodesRemoved).toContain('timeout')
  })

  it('lays out a node again when it moves to another container', () => {
    const current = applyDiagramGraph(
      'BUSINESS_PROCESS',
      EMPTY,
      update({
        nodes: [
          { id: 'pool', type: 'participant', text: 'Shop' },
          ...['l1', 'l2'].map((id) => ({
            id,
            type: 'participant',
            parentId: 'pool',
            data: { participantType: 'lane' },
          })),
          { id: 'task', type: 'activity', parentId: 'l1' },
        ],
      }),
      'merge',
    )
    current.nodes[3].position = { x: 400, y: 70 }

    const moved = applyDiagramGraph(
      'BUSINESS_PROCESS',
      current,
      update({ nodes: [{ id: 'task', parentId: 'l2' }] }),
      'merge',
    )

    // Back to the first slot of the new lane instead of keeping the old offset.
    expect(nodeById(moved, 'task')).toMatchObject({
      parentId: 'l2',
      extent: 'parent',
      position: { x: 60, y: 40 },
    })
  })

  it('detaches a node from its container with parentId null', () => {
    const current = applyDiagramGraph('BUSINESS_PROCESS', EMPTY, PROCESS, 'merge')

    const result = applyDiagramGraph(
      'BUSINESS_PROCESS',
      current,
      update({ nodes: [{ id: 'review', parentId: null }] }),
      'merge',
    )

    const review = nodeById(result, 'review')
    expect(review).not.toHaveProperty('parentId')
    expect(review).not.toHaveProperty('extent')
  })

  it('clears references to removed edges', () => {
    const withDefault = applyDiagramGraph(
      'BUSINESS_PROCESS',
      EMPTY,
      update({
        ...PROCESS,
        nodes: PROCESS.nodes.map((node) =>
          node.id === 'approved' ? { ...node, data: { defaultFlowId: 'yes' } } : node,
        ),
      }),
      'merge',
    )

    const result = applyDiagramGraph(
      'BUSINESS_PROCESS',
      withDefault,
      update({ removeEdgeIds: ['yes'] }),
      'merge',
    )

    expect(result.nodes.find((node) => node.id === 'approved')?.data).not.toHaveProperty(
      'defaultFlowId',
    )
  })
})
