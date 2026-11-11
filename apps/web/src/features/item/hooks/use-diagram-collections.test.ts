import { AREA_NODE_TYPE, DIAGRAM_MAPS } from '@docgraph/common/schemas'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { Edge, Node, NodeChange } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import type { AreaNode } from '../components/base/area-node'
import { type DiagramCollectionsOptions, useDiagramCollections } from './use-diagram-collections'

type TestNode = Node<{ label: string; refs?: string[] }, 'test'>
type TestEdge = Edge<{ kind: string }, 'flow' | 'message'>
type Options = DiagramCollectionsOptions<TestNode, TestEdge>

// A real Y.Doc behind a minimal provider, so the real `useYjsCollection` runs underneath.
const provider = vi.hoisted(() => ({
  document: null as unknown as Y.Doc,
  authorizedScope: undefined as string | undefined,
  awareness: { setLocalStateField: (_field: string, _value: unknown) => {} },
  on: () => {},
  off: () => {},
}))

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

const node = (id: string, x = 0, refs?: string[]): TestNode => ({
  id,
  type: 'test',
  position: { x, y: 0 },
  data: { label: id, ...(refs ? { refs } : {}) },
})

const edge = (id: string, source: string, target: string): TestEdge => ({
  id,
  source,
  target,
  type: 'flow',
  data: { kind: 'default' },
})

const area = (id: string, data: Partial<AreaNode['data']> = {}): AreaNode => ({
  id,
  type: AREA_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { name: id, color: '#3b82f6', alpha: 0.2, order: 0, ...data },
})

const docMap = <T>(name: string) => provider.document.getMap<T>(name)

const stored = (name: string) => Object.fromEntries(docMap(name).entries())

const seed = ({
  nodes = [],
  edges = [],
  areas = [],
}: {
  nodes?: TestNode[]
  edges?: TestEdge[]
  areas?: AreaNode[]
}) => {
  for (const item of nodes) docMap(DIAGRAM_MAPS.nodes).set(item.id, item)
  for (const item of edges) docMap(DIAGRAM_MAPS.edges).set(item.id, item)
  for (const item of areas) docMap(DIAGRAM_MAPS.areas).set(item.id, item)
}

const renderCollections = (options: Partial<Options> = {}) =>
  renderHook((props: Options) => useDiagramCollections<TestNode, TestEdge>(props), {
    initialProps: { edgeType: 'flow', createEdgeData: () => ({ kind: 'default' }), ...options },
  })

const flush = () => act(() => vi.runAllTimers())

/** Apply an edit made by a peer: a second doc whose update arrives as non-local. */
const remote = (edit: (peer: Y.Doc) => void) => {
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
  const before = Y.encodeStateVector(peer)
  peer.transact(() => edit(peer))
  act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))
}

/** Drops the React Flow UI state the hook keeps locally, for comparing ids only. */
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id)

describe('useDiagramCollections', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    provider.document = new Y.Doc()
    provider.authorizedScope = undefined
    provider.awareness.setLocalStateField = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('collections', () => {
    it('mirrors the nodes, edges and areas maps', () => {
      seed({ nodes: [node('a')], edges: [edge('e', 'a', 'a')], areas: [area('z')] })

      const { result } = renderCollections()

      expect(result.current.nodes).toEqual([node('a')])
      expect(result.current.edges).toEqual([edge('e', 'a', 'a')])
      expect(result.current.areas).toEqual([area('z')])
      expect(result.current.readOnly).toBe(false)
    })

    it('reports a read-only document', () => {
      provider.authorizedScope = 'readonly'
      const { result } = renderCollections()

      expect(result.current.readOnly).toBe(true)
    })
  })

  describe('layeredAreas', () => {
    it('sorts areas by order and stacks them behind pools, lanes and nodes', () => {
      seed({
        areas: [
          area('top', { order: 2 }),
          area('bottom', { order: 0 }),
          area('middle', { order: 1 }),
        ],
      })

      const { result } = renderCollections()
      const layered = result.current.layeredAreas

      expect(ids(layered)).toEqual(['bottom', 'middle', 'top'])
      expect(layered.map((item) => item.zIndex)).toEqual([-5, -4, -3])
      for (const item of layered) expect(Number.isInteger(item.zIndex)).toBe(true)
    })

    it('makes locked areas neither selectable nor draggable', () => {
      seed({ areas: [area('free'), area('locked', { locked: true })] })

      const { result } = renderCollections()
      const [free, locked] = result.current.layeredAreas

      expect(free).toMatchObject({ selectable: true, draggable: true })
      expect(locked).toMatchObject({ selectable: false, draggable: false })
    })

    it('never makes areas draggable in a read-only document', () => {
      provider.authorizedScope = 'readonly'
      seed({ areas: [area('free')] })

      const { result } = renderCollections()

      expect(result.current.layeredAreas[0]).toMatchObject({ selectable: true, draggable: false })
    })

    it('puts the areas before the other nodes in allNodes', () => {
      seed({ nodes: [node('a')], areas: [area('z')] })

      const { result } = renderCollections()

      expect(ids(result.current.allNodes)).toEqual(['z', 'a'])
    })
  })

  describe('onNodesChange', () => {
    it('routes area changes to areas and node changes to nodes', () => {
      seed({ nodes: [node('a')], areas: [area('z')] })
      const { result } = renderCollections()

      act(() =>
        result.current.onNodesChange([
          { type: 'position', id: 'a', position: { x: 10, y: 20 } },
          { type: 'position', id: 'z', position: { x: 30, y: 40 } },
        ]),
      )
      flush()

      expect(result.current.nodes[0].position).toEqual({ x: 10, y: 20 })
      expect(result.current.areas[0].position).toEqual({ x: 30, y: 40 })
      expect(stored(DIAGRAM_MAPS.nodes).a).toMatchObject({ position: { x: 10, y: 20 } })
      expect(stored(DIAGRAM_MAPS.areas).z).toMatchObject({ position: { x: 30, y: 40 } })
    })

    it('removes a node with its connected edges and cleans node references', () => {
      seed({
        nodes: [node('a'), node('b'), node('c', 0, ['b'])],
        edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ac', 'a', 'c')],
      })
      const cleanDeletedReferences = vi.fn<NonNullable<Options['cleanDeletedReferences']>>(
        (nodes, deletedNodeIds) =>
          nodes.map((item) => ({
            ...item,
            data: { ...item.data, refs: item.data.refs?.filter((ref) => !deletedNodeIds.has(ref)) },
          })),
      )
      const { result } = renderCollections({ cleanDeletedReferences })

      act(() => result.current.onNodesChange([{ type: 'remove', id: 'b' }]))
      flush()

      expect(ids(result.current.nodes)).toEqual(['a', 'c'])
      expect(ids(result.current.edges)).toEqual(['ac'])
      expect(result.current.nodes[1].data.refs).toEqual([])
      expect(cleanDeletedReferences).toHaveBeenCalledWith(
        expect.any(Array),
        new Set(['b']),
        new Set(),
      )
      expect(Object.keys(stored(DIAGRAM_MAPS.edges))).toEqual(['ac'])
    })

    it('does not clean references when no node was removed', () => {
      seed({ nodes: [node('a')] })
      const cleanDeletedReferences = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ cleanDeletedReferences })

      act(() =>
        result.current.onNodesChange([{ type: 'position', id: 'a', position: { x: 1, y: 1 } }]),
      )

      expect(cleanDeletedReferences).not.toHaveBeenCalled()
    })

    it('normalizes node edits but not selection or measuring', () => {
      seed({ nodes: [node('a')] })
      const normalizeNodes = vi.fn((nodes: TestNode[]) =>
        nodes.map((item) => ({ ...item, data: { ...item.data, label: 'normalized' } })),
      )
      const { result } = renderCollections({ normalizeNodes })

      act(() =>
        result.current.onNodesChange([
          { type: 'select', id: 'a', selected: true },
          { type: 'dimensions', id: 'a', dimensions: { width: 10, height: 10 } },
        ]),
      )
      expect(normalizeNodes).not.toHaveBeenCalled()
      expect(result.current.nodes[0].data.label).toBe('a')

      act(() =>
        result.current.onNodesChange([{ type: 'position', id: 'a', position: { x: 5, y: 5 } }]),
      )
      expect(normalizeNodes).toHaveBeenCalledTimes(1)
      expect(result.current.nodes[0].data.label).toBe('normalized')
    })

    it('treats a resize as an edit', () => {
      seed({ nodes: [node('a')] })
      const normalizeNodes = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ normalizeNodes })

      act(() =>
        result.current.onNodesChange([
          {
            type: 'dimensions',
            id: 'a',
            dimensions: { width: 10, height: 10 },
            resizing: true,
            setAttributes: true,
          },
        ]),
      )

      expect(normalizeNodes).toHaveBeenCalledTimes(1)
    })

    it('holds a resized node and announces it until the resize ends', () => {
      seed({ nodes: [node('a')] })
      const { result } = renderCollections()
      const resize = (resizing: boolean, width: number): NodeChange<TestNode | AreaNode> => ({
        type: 'dimensions',
        id: 'a',
        dimensions: { width, height: 10 },
        resizing,
        setAttributes: true,
      })

      act(() => result.current.onNodesChange([resize(true, 50)]))
      flush()

      expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('draggingNodeId', 'a')
      expect(stored(DIAGRAM_MAPS.nodes).a).not.toHaveProperty('width')

      act(() => result.current.onNodesChange([resize(false, 80)]))
      flush()

      expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('draggingNodeId', null)
      expect(stored(DIAGRAM_MAPS.nodes).a).toMatchObject({ width: 80 })
    })
  })

  describe('onEdgesChange', () => {
    it('applies edge changes and cleans edge references on removal', () => {
      seed({ nodes: [node('a'), node('b')], edges: [edge('ab', 'a', 'b'), edge('ba', 'b', 'a')] })
      const cleanDeletedReferences = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ cleanDeletedReferences })

      act(() => result.current.onEdgesChange([{ type: 'remove', id: 'ab' }]))
      flush()

      expect(ids(result.current.edges)).toEqual(['ba'])
      expect(Object.keys(stored(DIAGRAM_MAPS.edges))).toEqual(['ba'])
      expect(cleanDeletedReferences).toHaveBeenCalledWith(
        expect.any(Array),
        new Set(),
        new Set(['ab']),
      )
    })

    it('does not touch the nodes for changes other than removals', () => {
      seed({ edges: [edge('ab', 'a', 'b')] })
      const cleanDeletedReferences = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ cleanDeletedReferences })

      act(() => result.current.onEdgesChange([{ type: 'select', id: 'ab', selected: true }]))

      expect(result.current.edges[0].selected).toBe(true)
      expect(cleanDeletedReferences).not.toHaveBeenCalled()
    })
  })

  describe('connecting edges', () => {
    const connection = { source: 'a', target: 'b', sourceHandle: null, targetHandle: null }

    beforeEach(() => seed({ nodes: [node('a'), node('b'), node('c')] }))

    it('creates an edge of the configured type with data from createEdgeData', () => {
      const createEdgeData = vi.fn((type: string) => ({ kind: `created-${type}` }))
      const { result } = renderCollections({ edgeType: 'message', createEdgeData })

      act(() => result.current.onEdgeConnect(connection))

      expect(createEdgeData).toHaveBeenCalledWith('message')
      expect(result.current.edges[0]).toMatchObject({
        source: 'a',
        target: 'b',
        type: 'message',
        data: { kind: 'created-message' },
      })
      expect(Object.values(stored(DIAGRAM_MAPS.edges))).toHaveLength(1)
    })

    it('does not duplicate an existing connection', () => {
      const { result } = renderCollections()

      act(() => result.current.onEdgeConnect(connection))
      act(() => result.current.onEdgeConnect(connection))

      expect(result.current.edges).toHaveLength(1)
    })

    it('reconnects an edge to a new target', () => {
      seed({ edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()

      act(() =>
        result.current.onEdgeReconnect(result.current.edges[0], { ...connection, target: 'c' }),
      )

      expect(result.current.edges).toHaveLength(1)
      expect(result.current.edges[0]).toMatchObject({ source: 'a', target: 'c', type: 'flow' })
    })
  })

  describe('dragging', () => {
    it('holds node and area writes while dragging and flushes on drop', () => {
      seed({ nodes: [node('a')], areas: [area('z')] })
      const { result } = renderCollections()

      act(() => result.current.onNodeDragStart(undefined, { id: 'a' }))
      act(() =>
        result.current.onNodesChange([
          { type: 'position', id: 'a', position: { x: 10, y: 0 } },
          { type: 'position', id: 'z', position: { x: 20, y: 0 } },
        ]),
      )
      flush()

      expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('draggingNodeId', 'a')
      expect(stored(DIAGRAM_MAPS.nodes).a).toMatchObject({ position: { x: 0, y: 0 } })
      expect(stored(DIAGRAM_MAPS.areas).z).toMatchObject({ position: { x: 0, y: 0 } })

      act(() => result.current.onNodeDragStop())

      expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('draggingNodeId', null)
      expect(stored(DIAGRAM_MAPS.nodes).a).toMatchObject({ position: { x: 10, y: 0 } })
      expect(stored(DIAGRAM_MAPS.areas).z).toMatchObject({ position: { x: 20, y: 0 } })
    })
  })

  describe('local edits not written yet during a peer update', () => {
    it('drops a new edge to a node the peer deleted', () => {
      seed({ nodes: [node('a'), node('b'), node('x')], edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()
      // The first write goes out at once; the next one waits for the throttle window
      act(() => result.current.setEdges((current) => [...current, edge('bx', 'b', 'x')]))
      act(() => result.current.setEdges((current) => [...current, edge('ax', 'a', 'x')]))

      remote((peer) => {
        peer.getMap(DIAGRAM_MAPS.nodes).delete('x')
        peer.getMap(DIAGRAM_MAPS.edges).delete('bx')
      })
      flush()

      expect(ids(result.current.edges)).toEqual(['ab'])
      expect(Object.keys(stored(DIAGRAM_MAPS.edges))).toEqual(['ab'])
    })

    it('reverts an edge reconnected to a node the peer deleted', () => {
      seed({ nodes: [node('a'), node('b'), node('x')], edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()
      act(() => result.current.setEdges((current) => [...current, edge('ba', 'b', 'a')]))
      act(() =>
        result.current.setEdges((current) =>
          current.map((item) => (item.id === 'ab' ? { ...item, target: 'x' } : item)),
        ),
      )

      remote((peer) => peer.getMap(DIAGRAM_MAPS.nodes).delete('x'))
      flush()

      expect(stored(DIAGRAM_MAPS.edges).ab).toMatchObject({ source: 'a', target: 'b' })
      expect(result.current.edges.find((item) => item.id === 'ab')).toMatchObject({ target: 'b' })
    })

    it('drops a new child of a parent the peer deleted', () => {
      seed({ nodes: [node('a'), node('pool')] })
      const { result } = renderCollections()
      act(() => result.current.setNodes((current) => [...current, node('b')]))
      act(() =>
        result.current.setNodes((current) => [...current, { ...node('child'), parentId: 'pool' }]),
      )

      remote((peer) => peer.getMap(DIAGRAM_MAPS.nodes).delete('pool'))
      flush()

      expect(ids(result.current.nodes)).toEqual(['a', 'b'])
      expect(Object.keys(stored(DIAGRAM_MAPS.nodes)).sort()).toEqual(['a', 'b'])
    })

    it('keeps a new edge to a node created here and not written yet', () => {
      seed({ nodes: [node('a'), node('b')], edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()
      act(() => result.current.setNodes((current) => [...current, node('c')]))
      act(() => result.current.setEdges((current) => [...current, edge('bc', 'b', 'c')]))
      act(() => result.current.setNodes((current) => [...current, node('n')]))
      act(() => result.current.setEdges((current) => [...current, edge('an', 'a', 'n')]))

      remote((peer) => {
        peer.getMap<TestNode>(DIAGRAM_MAPS.nodes).set('a', node('a', 5))
        peer.getMap<TestEdge>(DIAGRAM_MAPS.edges).set('ab', { ...edge('ab', 'a', 'b'), label: 'x' })
      })
      flush()

      expect(Object.keys(stored(DIAGRAM_MAPS.nodes)).sort()).toEqual(['a', 'b', 'c', 'n'])
      expect(Object.keys(stored(DIAGRAM_MAPS.edges)).sort()).toEqual(['ab', 'an', 'bc'])
    })
  })

  describe('replaceDocument', () => {
    it('replaces all three collections in one normalized transaction', () => {
      seed({
        nodes: [node('old')],
        edges: [edge('old-edge', 'old', 'old')],
        areas: [area('old-area')],
      })
      const normalizeNodes = vi.fn((nodes: TestNode[]) =>
        nodes.map((item) => ({ ...item, data: { ...item.data, label: 'normalized' } })),
      )
      const { result } = renderCollections({ normalizeNodes })
      let transactions = 0
      provider.document.on('afterTransaction', () => {
        transactions++
      })

      act(() =>
        result.current.replaceDocument({
          nodes: [node('a')],
          edges: [edge('e', 'a', 'a')],
          areas: [area('z')],
        }),
      )

      expect(transactions).toBe(1)
      expect(ids(result.current.nodes)).toEqual(['a'])
      expect(result.current.nodes[0].data.label).toBe('normalized')
      expect(Object.keys(stored(DIAGRAM_MAPS.nodes))).toEqual(['a'])
      expect(Object.keys(stored(DIAGRAM_MAPS.edges))).toEqual(['e'])
      expect(Object.keys(stored(DIAGRAM_MAPS.areas))).toEqual(['z'])
    })
  })

  describe('history', () => {
    it('undoes a node removal and its connected edges in one step', () => {
      seed({ nodes: [node('a'), node('b')], edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()

      act(() => result.current.onNodesChange([{ type: 'remove', id: 'b' }]))
      act(() => result.current.history.undo())

      expect(ids(result.current.nodes)).toEqual(['a', 'b'])
      expect(ids(result.current.edges)).toEqual(['ab'])
      expect(result.current.history.canUndo).toBe(false)
    })

    it('drops an edge undo restores after a peer deleted its node, keeping the redo', () => {
      seed({ nodes: [node('a'), node('b')], edges: [edge('ab', 'a', 'b')] })
      const { result } = renderCollections()
      act(() =>
        result.current.setEdges((current) =>
          current.map((item) => ({ ...item, data: { kind: 'renamed' } })),
        ),
      )

      const peer = new Y.Doc()
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.transact(() => {
        peer.getMap(DIAGRAM_MAPS.nodes).delete('b')
        peer.getMap(DIAGRAM_MAPS.edges).delete('ab')
      })
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))

      act(() => result.current.history.undo())

      expect(stored(DIAGRAM_MAPS.edges)).toEqual({})
      expect(result.current.edges).toEqual([])
      expect(result.current.history.canRedo).toBe(true)
    })

    it('cleans node references to an edge it drops after an undo', () => {
      seed({ nodes: [node('a', 0, ['ab']), node('b')], edges: [edge('ab', 'a', 'b')] })
      const cleanDeletedReferences = (
        nodes: TestNode[],
        _deletedNodeIds: ReadonlySet<string>,
        deletedEdgeIds: ReadonlySet<string>,
      ) =>
        nodes.map((item) => ({
          ...item,
          data: { ...item.data, refs: item.data.refs?.filter((ref) => !deletedEdgeIds.has(ref)) },
        }))
      const { result } = renderCollections({ cleanDeletedReferences })
      act(() => result.current.onEdgesChange([{ type: 'remove', id: 'ab' }]))

      const peer = new Y.Doc()
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.getMap(DIAGRAM_MAPS.nodes).delete('b')
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))

      act(() => result.current.history.undo())

      expect(stored(DIAGRAM_MAPS.edges)).toEqual({})
      expect(docMap<TestNode>(DIAGRAM_MAPS.nodes).get('a')?.data.refs).toEqual([])
      expect(result.current.nodes[0].data.refs).toEqual([])
    })

    it('drops nodes undo restores after a peer deleted their parent, with their edges', () => {
      seed({
        nodes: [
          node('pool'),
          { ...node('lane'), parentId: 'pool' },
          { ...node('task'), parentId: 'lane' },
          node('x'),
        ],
        edges: [edge('tx', 'task', 'x')],
      })
      const cleanDeletedReferences = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ cleanDeletedReferences })
      act(() => {
        result.current.setNodes((current) =>
          current.map((item) =>
            item.id === 'lane' || item.id === 'task'
              ? { ...item, position: { x: 10, y: 0 } }
              : item,
          ),
        )
        result.current.setEdges((current) =>
          current.map((item) => ({ ...item, data: { kind: 'renamed' } })),
        )
      })
      flush()

      const peer = new Y.Doc()
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.transact(() => {
        for (const id of ['pool', 'lane', 'task']) peer.getMap(DIAGRAM_MAPS.nodes).delete(id)
        peer.getMap(DIAGRAM_MAPS.edges).delete('tx')
      })
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))

      act(() => result.current.history.undo())

      expect(Object.keys(stored(DIAGRAM_MAPS.nodes))).toEqual(['x'])
      expect(stored(DIAGRAM_MAPS.edges)).toEqual({})
      expect(ids(result.current.nodes)).toEqual(['x'])
      expect(result.current.edges).toEqual([])
      expect(cleanDeletedReferences).toHaveBeenLastCalledWith(
        expect.any(Array),
        new Set(['lane', 'task']),
        new Set(['tx']),
      )
    })

    it("keeps a node repair after a peer's text change out of the undo history", () => {
      seed({ nodes: [node('a')] })
      const { result } = renderCollections()

      const peer = new Y.Doc()
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.getMap<TestNode>(DIAGRAM_MAPS.nodes).set('a', { ...node('a'), data: { label: 'long' } })
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))
      act(() =>
        result.current.repairNodes((current) =>
          current.map((item) => ({ ...item, style: { width: 300 } })),
        ),
      )

      expect(stored(DIAGRAM_MAPS.nodes).a).toMatchObject({ style: { width: 300 } })
      expect(result.current.history.canUndo).toBe(false)
    })

    it('undoes and redoes a fix normalizeNodes makes to a local edit', () => {
      seed({ nodes: [{ ...node('a'), width: 200 }] })
      const atLeast100 = (nodes: TestNode[]) =>
        nodes.map((item) => ({ ...item, width: Math.max(item.width ?? 0, 100) }))
      const { result } = renderCollections({ normalizeNodes: atLeast100 })
      const storedWidth = () => docMap<TestNode>(DIAGRAM_MAPS.nodes).get('a')?.width

      act(() =>
        result.current.setNodes((current) => current.map((item) => ({ ...item, width: 50 }))),
      )
      expect(storedWidth()).toBe(100)

      act(() => result.current.history.undo())
      expect(storedWidth()).toBe(200)

      act(() => result.current.history.redo())
      expect(storedWidth()).toBe(100)
    })

    it('undoes an import across all three collections', () => {
      seed({ nodes: [node('a')], edges: [edge('e', 'a', 'a')], areas: [area('z')] })
      const { result } = renderCollections()

      act(() => result.current.replaceDocument({ nodes: [node('n')], edges: [], areas: [] }))
      act(() => result.current.history.undo())

      expect(ids(result.current.nodes)).toEqual(['a'])
      expect(ids(result.current.edges)).toEqual(['e'])
      expect(ids(result.current.areas)).toEqual(['z'])
    })
  })

  describe('remote updates', () => {
    it('are not normalized', () => {
      const normalizeNodes = vi.fn((nodes: TestNode[]) => nodes)
      const { result } = renderCollections({ normalizeNodes })

      const peer = new Y.Doc()
      peer.getMap<TestNode>(DIAGRAM_MAPS.nodes).set('a', node('a'))
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer)))

      expect(ids(result.current.nodes)).toEqual(['a'])
      expect(normalizeNodes).not.toHaveBeenCalled()
    })
  })
})
