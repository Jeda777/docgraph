import { describe, expect, it } from 'vitest'
import { layoutNodes, pickHandles } from './diagram-graph.layout'
import { CONFIGS, type GraphEdge, type GraphNode } from './diagram-graph.model'

const FLOWCHART = CONFIGS.FLOWCHART
const BUSINESS_PROCESS = CONFIGS.BUSINESS_PROCESS

// Explicit sizes keep the expected coordinates independent of the default node sizes.
const node = (id: string, overrides: Partial<GraphNode> = {}): GraphNode => ({
  id,
  position: { x: 0, y: 0 },
  style: { width: 100, height: 50 },
  ...overrides,
})

const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
})

const byId = (nodes: GraphNode[]) => new Map(nodes.map((entry) => [entry.id, entry]))

const find = (nodes: GraphNode[], id: string) => {
  const found = nodes.find((entry) => entry.id === id)
  if (!found) throw new Error(`Node "${id}" missing`)
  return found
}

const POOL = { kind: 'participant', participantType: 'pool', orientation: 'horizontal' }
const VERTICAL_POOL = { ...POOL, orientation: 'vertical' }
const LANE = { kind: 'participant', participantType: 'lane' }
const ACTIVITY = { kind: 'activity' }

describe('pickHandles', () => {
  const handlesBetween = (source: GraphNode, target: GraphNode, extra: GraphNode[] = []) =>
    pickHandles(FLOWCHART, edge(source.id, target.id), byId([source, target, ...extra]))

  it('connects right to left when the target is to the right, and back when it is to the left', () => {
    const a = node('a', { position: { x: 0, y: 0 } })
    const b = node('b', { position: { x: 300, y: 40 } })

    expect(handlesBetween(a, b)).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
    expect(handlesBetween(b, a)).toEqual({ sourceHandle: 'left', targetHandle: 'right' })
  })

  it('connects bottom to top when the target is below, and back when it is above', () => {
    const a = node('a', { position: { x: 0, y: 0 } })
    const b = node('b', { position: { x: 40, y: 300 } })

    expect(handlesBetween(a, b)).toEqual({ sourceHandle: 'bottom', targetHandle: 'top' })
    expect(handlesBetween(b, a)).toEqual({ sourceHandle: 'top', targetHandle: 'bottom' })
  })

  it('prefers horizontal handles on an exact diagonal', () => {
    const a = node('a', { position: { x: 0, y: 0 } })
    const b = node('b', { position: { x: 200, y: 200 } })

    expect(handlesBetween(a, b)).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
  })

  it('compares node centers, not top-left corners', () => {
    // Corners are on a diagonal (horizontal), but the centers are straight above each other.
    const wide = node('wide', { position: { x: 0, y: 0 }, style: { width: 400, height: 40 } })
    const narrow = node('narrow', { position: { x: 150, y: 150 } })

    expect(handlesBetween(wide, narrow)).toEqual({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  it('uses absolute positions of nested nodes', () => {
    const upper = node('upper', { position: { x: 0, y: 0 }, style: { width: 600, height: 200 } })
    const lower = node('lower', { position: { x: 0, y: 500 }, style: { width: 600, height: 200 } })
    // Same relative position, so only the parents tell them apart.
    const a = node('a', { parentId: 'upper', position: { x: 20, y: 20 } })
    const b = node('b', { parentId: 'lower', position: { x: 20, y: 20 } })

    expect(handlesBetween(a, b, [upper, lower])).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('adds each parent once on a parent cycle instead of hanging', () => {
    const a = node('a', { parentId: 'b', position: { x: 0, y: 0 } })
    const b = node('b', { parentId: 'a', position: { x: 300, y: 0 } })
    const target = node('target', { position: { x: 300, y: 200 } })

    // `a` sits at 300 (its own 0 + parent 300), straight above the target. Ignoring the
    // parent would give right → left, adding it twice would give left → right.
    expect(handlesBetween(a, target, [b])).toEqual({ sourceHandle: 'bottom', targetHandle: 'top' })
  })

  it('falls back to right → left when an endpoint is missing', () => {
    const a = node('a', { position: { x: 500, y: 500 } })

    expect(pickHandles(FLOWCHART, edge('a', 'ghost'), byId([a]))).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
    expect(pickHandles(FLOWCHART, edge('ghost', 'a'), byId([a]))).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })
})

describe('layoutNodes (top level)', () => {
  it('leaves every node alone when nothing is auto-placed', () => {
    const nodes = [node('a', { position: { x: 7, y: 9 } }), node('b')]
    const before = structuredClone(nodes)

    layoutNodes(FLOWCHART, nodes, [edge('a', 'b')], new Set())

    expect(nodes).toEqual(before)
  })

  it('puts a chain in consecutive columns from the root origin', () => {
    const nodes = ['a', 'b', 'c'].map((id) => node(id))

    layoutNodes(FLOWCHART, nodes, [edge('a', 'b'), edge('b', 'c')], new Set(['a', 'b', 'c']))

    // Column width: widest node (100) + 80 gap.
    expect(nodes.map((entry) => entry.position)).toEqual([
      { x: 40, y: 40 },
      { x: 220, y: 40 },
      { x: 400, y: 40 },
    ])
  })

  it('stacks nodes of one column in rows and centers smaller nodes in their cell', () => {
    const nodes = [node('small'), node('big', { style: { width: 200, height: 100 } })]

    layoutNodes(FLOWCHART, nodes, [], new Set(['small', 'big']))

    // Cell: 200 × 100 plus gaps (80 × 60); the small node sits in the middle of the first one.
    expect(find(nodes, 'small').position).toEqual({ x: 90, y: 65 })
    expect(find(nodes, 'big').position).toEqual({ x: 40, y: 200 })
  })

  it('ranks by the longest path and ignores self loops', () => {
    const nodes = ['a', 'b', 'c'].map((id) => node(id))

    layoutNodes(
      FLOWCHART,
      nodes,
      [edge('a', 'c'), edge('a', 'b'), edge('b', 'c'), edge('c', 'c')],
      new Set(['a', 'b', 'c']),
    )

    expect(nodes.map((entry) => entry.position.x)).toEqual([40, 220, 400])
  })

  it('puts nodes on a cycle in one column after the acyclic part', () => {
    const nodes = ['entry', 'loopA', 'loopB'].map((id) => node(id))

    layoutNodes(
      FLOWCHART,
      nodes,
      [edge('entry', 'loopA'), edge('loopA', 'loopB'), edge('loopB', 'loopA')],
      new Set(['entry', 'loopA', 'loopB']),
    )

    // The very next column: no empty one between the acyclic part and the cycle.
    expect(find(nodes, 'entry').position).toEqual({ x: 40, y: 40 })
    expect(find(nodes, 'loopA').position).toEqual({ x: 220, y: 40 })
    expect(find(nodes, 'loopB').position).toEqual({ x: 220, y: 150 })
  })

  it('puts nodes after a cycle in the same column as the cycle', () => {
    const nodes = ['entry', 'loopA', 'loopB', 'exit'].map((id) => node(id))

    layoutNodes(
      FLOWCHART,
      nodes,
      [
        edge('entry', 'loopA'),
        edge('loopA', 'loopB'),
        edge('loopB', 'loopA'),
        edge('loopB', 'exit'),
      ],
      new Set(['entry', 'loopA', 'loopB', 'exit']),
    )

    // `exit` is never reached by the ranking either, so it is stacked under the cycle.
    expect(nodes.map((entry) => entry.position)).toEqual([
      { x: 40, y: 40 },
      { x: 220, y: 40 },
      { x: 220, y: 150 },
      { x: 220, y: 260 },
    ])
  })

  it('puts a graph that is only a cycle in the first column', () => {
    const nodes = ['loopA', 'loopB'].map((id) => node(id))

    layoutNodes(
      FLOWCHART,
      nodes,
      [edge('loopA', 'loopB'), edge('loopB', 'loopA')],
      new Set(['loopA', 'loopB']),
    )

    expect(nodes.map((entry) => entry.position)).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 150 },
    ])
  })

  it('places new nodes below the existing ones, aligned with the leftmost', () => {
    const nodes = [
      node('p1', { position: { x: 300, y: 100 } }),
      node('p2', { position: { x: 500, y: 20 }, style: { width: 100, height: 200 } }),
      node('new'),
    ]

    layoutNodes(FLOWCHART, nodes, [], new Set(['new']))

    // Lowest bottom edge is 220 (p2), plus the 60 row gap.
    expect(find(nodes, 'new').position).toEqual({ x: 300, y: 280 })
    expect(find(nodes, 'p1').position).toEqual({ x: 300, y: 100 })
    expect(find(nodes, 'p2').position).toEqual({ x: 500, y: 20 })
  })

  it('ranks new nodes only by edges between new nodes', () => {
    const nodes = [node('old', { position: { x: 40, y: 40 } }), node('new')]

    layoutNodes(FLOWCHART, nodes, [edge('old', 'new')], new Set(['new']))

    // The edge from an existing node does not push the new one to a later column.
    expect(find(nodes, 'new').position).toEqual({ x: 40, y: 150 })
  })
})

describe('layoutNodes (containers)', () => {
  it('lays out children from the container padding, below placed siblings', () => {
    const nodes = [
      node('pool', { data: POOL, style: { width: 1000, height: 1000 } }),
      node('placed', { parentId: 'pool', position: { x: 400, y: 30 } }),
      node('a', { parentId: 'pool' }),
      node('b', { parentId: 'pool' }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [edge('a', 'b')], new Set(['a', 'b']))

    // Inside a container the flow starts at the padding (60), not at the placed sibling's x.
    expect(find(nodes, 'a').position).toEqual({ x: 60, y: 140 })
    expect(find(nodes, 'b').position).toEqual({ x: 240, y: 140 })
  })

  it('attaches boundary events to the middle of the bottom border of their activity', () => {
    const nodes = [
      node('task', {
        data: ACTIVITY,
        position: { x: 200, y: 200 },
        style: { width: 160, height: 80 },
      }),
      node('timer', {
        parentId: 'task',
        data: { kind: 'event', context: 'boundary', attachedToId: 'task' },
        style: { width: 36, height: 36 },
      }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['timer']))

    expect(find(nodes, 'timer').position).toEqual({ x: 62, y: 62 })
    expect(find(nodes, 'task')).toMatchObject({
      position: { x: 200, y: 200 },
      style: { width: 160, height: 80 },
    })
  })

  it('stacks new lanes of a horizontal pool after the existing ones', () => {
    const nodes = [
      node('pool', { data: POOL, style: { width: 1000, height: 1000 } }),
      node('old', {
        parentId: 'pool',
        data: LANE,
        position: { x: 34, y: 2 },
        style: { width: 900, height: 150 },
      }),
      node('l1', { parentId: 'pool', data: LANE, style: { width: 900, height: 100 } }),
      node('l2', { parentId: 'pool', data: LANE, style: { width: 900, height: 120 } }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['l1', 'l2']))

    expect(find(nodes, 'old').position).toEqual({ x: 34, y: 2 })
    expect(find(nodes, 'l1').position).toEqual({ x: 34, y: 152 })
    expect(find(nodes, 'l2').position).toEqual({ x: 34, y: 252 })
  })

  it('stacks lanes of a vertical pool left to right below its label', () => {
    const nodes = [
      node('pool', { data: VERTICAL_POOL, style: { width: 1000, height: 1000 } }),
      node('l1', { parentId: 'pool', data: LANE, style: { width: 200, height: 900 } }),
      node('l2', { parentId: 'pool', data: LANE, style: { width: 250, height: 900 } }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['l1', 'l2']))

    expect(find(nodes, 'l1').position).toEqual({ x: 2, y: 28 })
    expect(find(nodes, 'l2').position).toEqual({ x: 202, y: 28 })
  })

  it('grows a lane around new content and its pool around the lane', () => {
    const nodes = [
      node('pool', { data: POOL, style: { width: 300, height: 100 } }),
      node('lane', {
        parentId: 'pool',
        data: LANE,
        position: { x: 34, y: 2 },
        style: { width: 300, height: 100 },
      }),
      node('task', { parentId: 'lane', data: ACTIVITY }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['task']))

    expect(find(nodes, 'task').position).toEqual({ x: 60, y: 40 })
    // Lane: task bottom (40 + 50) + 40 padding; the width already fits.
    expect(find(nodes, 'lane').style).toEqual({ width: 300, height: 130 })
    // Pool: lanes + 2 + 2 along, widest lane + 34 label + 2 across.
    expect(find(nodes, 'pool').style).toEqual({ width: 336, height: 134 })
  })

  it('updates React Flow width and height fields together with the style', () => {
    const nodes = [
      node('pool', { data: POOL, style: { width: 100, height: 100 }, width: 100, height: 100 }),
      node('task', { parentId: 'pool', data: ACTIVITY }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['task']))

    expect(find(nodes, 'pool')).toMatchObject({
      width: 200,
      height: 130,
      style: { width: 200, height: 130 },
    })
  })

  it('never shrinks a container and leaves it alone when nothing inside was placed', () => {
    const big = node('big', { data: POOL, style: { width: 2000, height: 2000 } })
    const untouched = node('untouched', {
      data: POOL,
      position: { x: 0, y: 3000 },
      style: { width: 100, height: 100 },
    })
    const nodes = [
      big,
      node('task', { parentId: 'big', data: ACTIVITY }),
      untouched,
      // Sticks out of its pool, but was not placed now, so the pool is not resized.
      node('outside', { parentId: 'untouched', data: ACTIVITY, position: { x: 500, y: 500 } }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['task']))

    expect(big.style).toEqual({ width: 2000, height: 2000 })
    expect(untouched.style).toEqual({ width: 100, height: 100 })
  })

  it('does not grow a container around a boundary event attached to it', () => {
    const nodes = [
      node('pool', { data: POOL, style: { width: 1000, height: 1000 } }),
      node('timer', {
        parentId: 'pool',
        data: { kind: 'event', context: 'boundary', attachedToId: 'pool' },
        style: { width: 36, height: 36 },
      }),
    ]

    layoutNodes(BUSINESS_PROCESS, nodes, [], new Set(['timer']))

    expect(find(nodes, 'pool').style).toEqual({ width: 1000, height: 1000 })
  })
})
