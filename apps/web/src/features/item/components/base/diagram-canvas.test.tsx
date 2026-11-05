import { AREA_NODE_TYPE } from '@docgraph/common/schemas'
import { cleanup, render } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaNode } from './area-node'
import {
  DiagramCanvas,
  type DiagramCanvasCollections,
  type DiagramCanvasProps,
} from './diagram-canvas'

type TestNode = Node<{ label: string; locked?: boolean }, 'test'>

/** The part of `useDiagramCollections` the canvas reads to build its nodes. */
type Collections = Pick<
  DiagramCanvasCollections<TestNode, Edge>,
  'nodes' | 'layeredAreas' | 'allNodes' | 'edges' | 'readOnly'
>

const state = vi.hoisted(() => ({
  collections: {} as Collections,
  flowNodes: [] as Node[],
}))

vi.mock('../../hooks/use-diagram-collections', () => ({
  useDiagramCollections: () => state.collections,
}))

// Captures the nodes the canvas hands to React Flow instead of rendering them.
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  ReactFlow: ({ nodes }: { nodes: Node[] }) => {
    state.flowNodes = nodes
    return null
  },
}))

vi.mock('./cursors', () => ({ Cursors: () => null }))

const node = (id: string, locked = false): TestNode => ({
  id,
  type: 'test',
  position: { x: 0, y: 0 },
  data: { label: id, locked },
})

const AREA: AreaNode = {
  id: 'area',
  type: AREA_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { name: 'area', color: '#3b82f6', alpha: 0.2, order: 0 },
}

const setCollections = (nodes: TestNode[], readOnly = false) => {
  state.collections = {
    nodes,
    layeredAreas: [AREA],
    allNodes: [AREA, ...nodes],
    edges: [],
    readOnly,
  }
}

const isNodeDraggable = (item: TestNode) => !item.data.locked
const getNodeZIndex = (item: TestNode) => (item.data.locked ? 5 : undefined)

type Props = Partial<DiagramCanvasProps<TestNode, Edge>>

const ui = (props: Props) => (
  <DiagramCanvas<TestNode, Edge>
    connected
    itemName='Diagram'
    nodeTypes={{}}
    edgeTypes={{}}
    edgeType='default'
    createEdgeData={() => ({})}
    renderSidebar={() => null}
    {...props}
  />
)

const renderCanvas = (props: Props = {}) => {
  const view = render(ui(props))
  return (next: Props = props) => view.rerender(ui(next))
}

const flowNode = (id: string) => state.flowNodes.find((item) => item.id === id)

afterEach(cleanup)

beforeEach(() => {
  setCollections([node('a'), node('b', true)])
})

describe('DiagramCanvas flow nodes', () => {
  it('passes the collection nodes through when nothing derives them', () => {
    renderCanvas()

    expect(state.flowNodes).toBe(state.collections.allNodes)
  })

  it('puts areas first and applies the drag and stacking policies to nodes', () => {
    renderCanvas({ isNodeDraggable, getNodeZIndex })

    expect(state.flowNodes.map((item) => item.id)).toEqual(['area', 'a', 'b'])
    expect(flowNode('area')).toBe(AREA)
    expect(flowNode('a')).toMatchObject({ draggable: true })
    expect(flowNode('a')).not.toHaveProperty('zIndex')
    expect(flowNode('b')).toMatchObject({ draggable: false, zIndex: 5 })
  })

  it('does not set draggable without a drag policy', () => {
    renderCanvas({ getNodeZIndex })

    expect(flowNode('a')).not.toHaveProperty('draggable')
  })

  it('makes no node draggable in a read-only document', () => {
    setCollections([node('a'), node('b', true)], true)
    renderCanvas({ isNodeDraggable })

    expect(flowNode('a')).toMatchObject({ draggable: false })
  })

  it('shows transformed nodes', () => {
    const transformNodes = (items: TestNode[]) =>
      items.map((item) => ({ ...item, data: { ...item.data, label: `${item.id}!` } }))
    renderCanvas({ transformNodes })

    expect(flowNode('a')?.data).toMatchObject({ label: 'a!' })
  })

  it('keeps the derived identity of unchanged nodes', () => {
    const rerender = renderCanvas({ isNodeDraggable, getNodeZIndex })
    const [a, b] = [flowNode('a'), flowNode('b')]

    const [unchanged] = state.collections.nodes
    setCollections([unchanged, { ...node('b', true), position: { x: 10, y: 0 } }])
    rerender()

    expect(flowNode('a')).toBe(a)
    expect(flowNode('b')).not.toBe(b)
    expect(flowNode('b')).toMatchObject({ position: { x: 10, y: 0 }, zIndex: 5 })
  })

  it('rederives every node when a policy changes', () => {
    const rerender = renderCanvas({ isNodeDraggable, getNodeZIndex })
    const a = flowNode('a')

    rerender({ isNodeDraggable: () => false, getNodeZIndex })

    expect(flowNode('a')).not.toBe(a)
    expect(flowNode('a')).toMatchObject({ draggable: false })
  })

  it('rederives every node when the document turns read-only', () => {
    const rerender = renderCanvas({ isNodeDraggable })
    expect(flowNode('a')).toMatchObject({ draggable: true })

    setCollections(state.collections.nodes, true)
    rerender()

    expect(flowNode('a')).toMatchObject({ draggable: false })
  })
})
