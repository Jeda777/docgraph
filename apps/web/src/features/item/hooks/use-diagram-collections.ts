import { DIAGRAM_MAPS } from '@docgraph/common/schemas'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  reconnectEdge,
} from '@xyflow/react'
import type { AreaNode } from '../components/base/area-node'
import { useDocumentReadOnly } from './use-document-read-only'
import { useNodeDragPresence } from './use-node-drag-presence'
import { useYjsCollection } from './use-yjs-collection'

export type DiagramCollectionsOptions<NodeType extends Node, EdgeType extends Edge> = {
  /** React Flow edge type assigned to edges created by connecting handles. */
  edgeType: NonNullable<EdgeType['type']>
  /** Builds fresh data for each edge created by connecting handles. */
  createEdgeData: (edgeType: NonNullable<EdgeType['type']>) => NonNullable<EdgeType['data']>
  cleanDeletedReferences?: (
    nodes: NodeType[],
    deletedNodeIds: ReadonlySet<string>,
    deletedEdgeIds: ReadonlySet<string>,
  ) => NodeType[]
  /** Applied to every local node edit before it is written. Must be a stable reference. */
  normalizeNodes?: (nodes: NodeType[]) => NodeType[]
}

/**
 * Canvas wiring shared by every diagram type. Mirrors the `nodes`, `edges` and
 * `areas` Yjs maps into local state, routes React Flow changes back into the
 * right collection, layers areas behind the other nodes and announces
 * drag/resize presence to peers. Returns everything a `<ReactFlow>` canvas and
 * its sidebar need.
 */
export const useDiagramCollections = <NodeType extends Node, EdgeType extends Edge>({
  edgeType,
  createEdgeData,
  cleanDeletedReferences,
  normalizeNodes,
}: DiagramCollectionsOptions<NodeType, EdgeType>) => {
  const readOnly = useDocumentReadOnly()
  const provider = useHocuspocusProvider()
  const [nodes, setRawNodes, holdNodes, replaceNodes] = useYjsCollection<NodeType>(
    DIAGRAM_MAPS.nodes,
  )
  // Every local node edit goes through `normalizeNodes`; remote updates bypass it.
  const setNodes: React.Dispatch<React.SetStateAction<NodeType[]>> = (action) =>
    setRawNodes((current) => {
      const next = typeof action === 'function' ? action(current) : action
      return normalizeNodes ? normalizeNodes(next) : next
    })
  const [edges, setEdges, , replaceEdges] = useYjsCollection<EdgeType>(DIAGRAM_MAPS.edges)
  const [areas, setAreas, holdAreas, replaceAreas] = useYjsCollection<AreaNode>(DIAGRAM_MAPS.areas)

  const hold = (ids: string[]) => {
    holdNodes(ids)
    holdAreas(ids)
  }
  const { onNodeDragStart, onNodeDragStop, trackResize } = useNodeDragPresence(hold)

  const layeredAreas: AreaNode[] = [...areas]
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    .map((area, i, sorted) => ({
      ...area,
      // Integer layering: areas sit behind Pool containers (`-2`), lanes
      // (`-1`), and regular nodes (`0`).
      // CSS z-index accepts integers only, so no fractional values here.
      zIndex: i - sorted.length - 2,
      selectable: !area.data.locked,
      // An explicit `true` overrides `nodesDraggable={false}`, so gate on readOnly.
      draggable: !readOnly && !area.data.locked,
    }))

  const allNodes: (NodeType | AreaNode)[] = [...layeredAreas, ...nodes]

  // Changes arrive for both node sets; route each to its own collection.
  const onNodesChange = (changes: NodeChange<NodeType | AreaNode>[]) => {
    trackResize(changes)
    const areaIds = new Set(areas.map((a) => a.id))
    const isArea = (c: NodeChange<NodeType | AreaNode>) => 'id' in c && areaIds.has(c.id)
    const areaChanges = changes.filter(isArea)
    const nodeChanges = changes.filter((c) => !isArea(c))
    if (areaChanges.length) setAreas((a) => applyNodeChanges(areaChanges, a) as AreaNode[])
    if (nodeChanges.length) {
      const removedNodeIds = new Set(
        nodeChanges.filter((change) => change.type === 'remove').map((change) => change.id),
      )
      // Selection and measuring are not edits: normalizing on them would make every
      // client rewrite the document as soon as it opens it.
      const isEdit = nodeChanges.some(
        (change) => change.type !== 'select' && !(change.type === 'dimensions' && !change.resizing),
      )
      const write = isEdit ? setNodes : setRawNodes
      // React Flow sends the connected edge removals through `onEdgesChange`, which cleans
      // edge references, so only node references are cleaned here.
      write((current) => {
        const next = applyNodeChanges(nodeChanges, current) as NodeType[]
        return removedNodeIds.size && cleanDeletedReferences
          ? cleanDeletedReferences(next, removedNodeIds, new Set())
          : next
      })
      if (removedNodeIds.size) {
        setEdges((currentEdges) =>
          currentEdges.filter(
            (edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
          ),
        )
      }
    }
  }

  const onEdgesChange = (changes: EdgeChange<EdgeType>[]) => {
    const removedEdgeIds = new Set(
      changes.filter((change) => change.type === 'remove').map((change) => change.id),
    )
    setEdges((eds) => applyEdgeChanges(changes, eds))
    if (removedEdgeIds.size && cleanDeletedReferences) {
      setNodes((current) => cleanDeletedReferences(current, new Set(), removedEdgeIds))
    }
  }

  const onEdgeConnect = (connection: Connection) => {
    const edge = {
      ...connection,
      type: edgeType,
      data: createEdgeData(edgeType),
    } as EdgeType
    setEdges((oldEdges) => addEdge<EdgeType>(edge, oldEdges))
  }

  const onEdgeReconnect = (oldEdge: EdgeType, connection: Connection) => {
    setEdges((currentEdges) => reconnectEdge(oldEdge, connection, currentEdges))
  }

  const replaceDocument = (next: { nodes: NodeType[]; edges: EdgeType[]; areas: AreaNode[] }) => {
    provider.document.transact(() => {
      replaceNodes(normalizeNodes ? normalizeNodes(next.nodes) : next.nodes)
      replaceEdges(next.edges)
      replaceAreas(next.areas)
    })
  }

  return {
    nodes,
    edges,
    areas,
    setNodes,
    setEdges,
    setAreas,
    layeredAreas,
    allNodes,
    readOnly,
    onNodesChange,
    onEdgesChange,
    onEdgeConnect,
    onEdgeReconnect,
    onNodeDragStart,
    onNodeDragStop,
    replaceDocument,
  }
}
