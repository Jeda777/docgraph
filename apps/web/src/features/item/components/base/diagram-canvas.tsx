import type { Connection, Edge, EdgeTypes, Node, NodeTypes, ZIndexMode } from '@xyflow/react'
import {
  Background,
  ConnectionMode,
  ControlButton,
  Controls,
  Panel,
  ReactFlow,
} from '@xyflow/react'
import { Redo2, Undo2 } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from 'react'
import { PageSpinner } from '@/components/page-spinner'
import { useDiagramCollections } from '../../hooks/use-diagram-collections'
import { useUndoShortcuts } from '../../hooks/use-undo-shortcuts'
import { getUndoShortcutLabels } from '../../lib/undo-shortcuts.helpers'
import type { AreaNode } from './area-node'
import './controls.css'
import { Cursors } from './cursors'

const UNDO_SHORTCUT_LABELS = getUndoShortcutLabels()

export type DiagramCanvasCollections<N extends Node, E extends Edge> = ReturnType<
  typeof useDiagramCollections<N, E>
>

export type DiagramMutationContextValue = {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  /** For derived fixes every client applies on its own; they stay out of the undo history. */
  repairNodes: (update: (nodes: Node[]) => Node[]) => void
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
}

export const DiagramMutationContext = createContext<DiagramMutationContextValue | null>(null)

export const useDiagramMutationContext = () => useContext(DiagramMutationContext)

export type DiagramCanvasProps<N extends Node, E extends Edge> = {
  connected: boolean
  itemName: string
  nodeTypes: NodeTypes
  edgeTypes: EdgeTypes
  /** React Flow edge type assigned to edges created by connecting handles. */
  edgeType: NonNullable<E['type']>
  /** Builds fresh data for each edge created by connecting handles. */
  createEdgeData: (edgeType: NonNullable<E['type']>) => NonNullable<E['data']>
  /** Canvas -> sidebar focus signal; receives the double-clicked element. */
  onNodeDoubleClick?: (node: N | AreaNode) => void
  onEdgeDoubleClick?: (edge: E) => void
  /** Per-node drag policy for diagram-specific non-draggable containers. */
  isNodeDraggable?: (node: N) => boolean
  /** Per-node stacking level, used with manual z-index mode. */
  getNodeZIndex?: (node: N) => number | undefined
  /** Display-only node transform; transformed nodes are not written to the document. */
  transformNodes?: (nodes: N[]) => N[]
  /**
   * Applied to every local node edit before it is written to the document. Opening a
   * document and remote updates never run it, so peers don't rewrite each other's data.
   */
  normalizeNodes?: (nodes: N[]) => N[]
  /** Removes diagram-specific semantic references to deleted nodes or edges. */
  cleanDeletedReferences?: (
    nodes: N[],
    deletedNodeIds: ReadonlySet<string>,
    deletedEdgeIds: ReadonlySet<string>,
  ) => N[]
  zIndexMode?: ZIndexMode
  isValidConnection?: (
    connection: Connection,
    nodes: N[],
    edges: E[],
    reconnectingEdge?: E,
  ) => boolean
  /** Sidebar factory — receives the live collections and the item name. */
  renderSidebar: (collections: DiagramCanvasCollections<N, E>, itemName: string) => ReactNode
}

/**
 * Canvas wiring shared by every diagram type: collaborative collections,
 * remote cursors, controls and the sidebar panel. Diagram-specific parts are
 * injected via node/edge types and the double-click handlers.
 */
export const DiagramCanvas = <N extends Node, E extends Edge>({
  connected,
  itemName,
  nodeTypes,
  edgeTypes,
  edgeType,
  createEdgeData,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  isNodeDraggable,
  getNodeZIndex,
  transformNodes,
  normalizeNodes,
  cleanDeletedReferences,
  zIndexMode,
  isValidConnection,
  renderSidebar,
}: DiagramCanvasProps<N, E>) => {
  const collections = useDiagramCollections<N, E>({
    edgeType,
    createEdgeData,
    cleanDeletedReferences,
    normalizeNodes,
  })
  const reconnectingEdge = useRef<E | null>(null)
  const {
    allNodes,
    edges,
    setNodes,
    repairNodes,
    setEdges,
    readOnly,
    onNodesChange,
    onEdgesChange,
    onEdgeConnect,
    onEdgeReconnect,
    onNodeDragStart,
    onNodeDragStop,
    history,
  } = collections
  useUndoShortcuts({ undo: history.undo, redo: history.redo, enabled: connected && !readOnly })
  const mutationContext = useMemo<DiagramMutationContextValue>(
    () => ({
      setNodes: setNodes as React.Dispatch<React.SetStateAction<Node[]>>,
      repairNodes: (update) => repairNodes((nodes) => update(nodes) as N[]),
      setEdges: setEdges as React.Dispatch<React.SetStateAction<Edge[]>>,
    }),
    [repairNodes, setEdges, setNodes],
  )
  // Derived nodes are cached per source node so unchanged nodes keep their identity and
  // React Flow can skip them. `isNodeDraggable` and `getNodeZIndex` must only read the node
  // itself; the cache resets when they or `readOnly` change.
  const derivedNodeCache = useRef<{ inputs: readonly unknown[]; nodes: WeakMap<N, N> }>({
    inputs: [],
    nodes: new WeakMap(),
  })
  const flowNodes = useMemo(() => {
    if (!isNodeDraggable && !getNodeZIndex && !transformNodes) return allNodes
    const inputs = [isNodeDraggable, getNodeZIndex, readOnly]
    if (inputs.some((input, index) => input !== derivedNodeCache.current.inputs[index])) {
      derivedNodeCache.current = { inputs, nodes: new WeakMap() }
    }
    const cache = derivedNodeCache.current.nodes
    const displayNodes = transformNodes?.(collections.nodes) ?? collections.nodes
    return [
      ...collections.layeredAreas,
      ...displayNodes.map((node) => {
        const cached = cache.get(node)
        if (cached) return cached
        const zIndex = getNodeZIndex?.(node)
        const derived = {
          ...node,
          ...(isNodeDraggable ? { draggable: !readOnly && isNodeDraggable(node) } : {}),
          ...(zIndex === undefined ? {} : { zIndex }),
        }
        cache.set(node, derived)
        return derived
      }),
    ]
  }, [
    allNodes,
    collections.layeredAreas,
    collections.nodes,
    getNodeZIndex,
    isNodeDraggable,
    readOnly,
    transformNodes,
  ])

  // Handlers read the latest collections through a ref so they stay referentially stable.
  const latest = useRef({ nodes: collections.nodes, edges: collections.edges, isValidConnection })
  latest.current = { nodes: collections.nodes, edges: collections.edges, isValidConnection }
  const handleIsValidConnection = useCallback(
    (connection: Connection | E) =>
      latest.current.isValidConnection?.(
        connection as Connection,
        latest.current.nodes,
        latest.current.edges,
        reconnectingEdge.current ?? undefined,
      ) ?? true,
    [],
  )
  const handleReconnect = useCallback(
    (edge: E, connection: Connection) => {
      const { isValidConnection: validate, nodes, edges: currentEdges } = latest.current
      if (validate?.(connection, nodes, currentEdges, edge) === false) return
      onEdgeReconnect(edge, connection)
    },
    [onEdgeReconnect],
  )

  if (!connected) return <PageSpinner fullScreen />

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DiagramMutationContext.Provider value={mutationContext}>
        <ReactFlow
          nodes={flowNodes}
          edges={edges}
          zIndexMode={zIndexMode}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          edgesReconnectable={!readOnly}
          deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onEdgeConnect}
          isValidConnection={handleIsValidConnection}
          onReconnectStart={(_, edge) => {
            reconnectingEdge.current = edge as E
          }}
          onReconnect={(edge, connection) => handleReconnect(edge as E, connection)}
          onReconnectEnd={() => {
            reconnectingEdge.current = null
          }}
          onNodeDoubleClick={(_, node) => onNodeDoubleClick?.(node as N | AreaNode)}
          onEdgeDoubleClick={(_, edge) => onEdgeDoubleClick?.(edge as E)}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          elevateNodesOnSelect={false}
          onlyRenderVisibleElements
          fitView
          maxZoom={5}
        >
          <Background />

          <Cursors />

          <Panel style={{ margin: 0 }} position='top-left'>
            {renderSidebar(collections, itemName)}
          </Panel>
          <Controls position='bottom-right'>
            {!readOnly && (
              <>
                <ControlButton
                  title={`Undo (${UNDO_SHORTCUT_LABELS.undo})`}
                  aria-label='Undo'
                  disabled={!history.canUndo}
                  onClick={history.undo}
                >
                  <Undo2 />
                </ControlButton>
                <ControlButton
                  title={`Redo (${UNDO_SHORTCUT_LABELS.redo})`}
                  aria-label='Redo'
                  disabled={!history.canRedo}
                  onClick={history.redo}
                >
                  <Redo2 />
                </ControlButton>
              </>
            )}
          </Controls>
        </ReactFlow>
      </DiagramMutationContext.Provider>
    </div>
  )
}
