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
import { COLLECTION_WRITE_ORIGIN, useYjsCollection } from './use-yjs-collection'
import { useYjsUndo } from './use-yjs-undo'

const DIAGRAM_MAP_NAMES = Object.values(DIAGRAM_MAPS)

/** Nodes whose parent is not among `elementIds`, together with everything nested inside them. */
const findOrphanNodeIds = (nodes: readonly Node[], elementIds: ReadonlySet<string>) => {
  const orphanIds = new Set<string>()
  const isOrphan = ({ parentId }: Node) =>
    !!parentId && (!elementIds.has(parentId) || orphanIds.has(parentId))
  let previousSize = -1
  while (orphanIds.size !== previousSize) {
    previousSize = orphanIds.size
    for (const item of nodes) if (isOrphan(item)) orphanIds.add(item.id)
  }
  return orphanIds
}

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
  // A local edit must not write a reference to what a peer deleted before the edit was written.
  // The collections flush separately, so an edge can still be written before its new node is
  // rejected; `dropOrphans` then removes it.
  const nodeCollection = useYjsCollection<NodeType>(DIAGRAM_MAPS.nodes, {
    canWrite: (item) => hasParent(item),
    onRejected: () => dropOrphans(),
  })
  const edgeCollection = useYjsCollection<EdgeType>(DIAGRAM_MAPS.edges, {
    canWrite: (item) => elementExists(item.source) && elementExists(item.target),
  })
  const areaCollection = useYjsCollection<AreaNode>(DIAGRAM_MAPS.areas)
  /**
   * Whether a node or area is in the document, or was created here and can be written itself.
   * `visited` stops a parent cycle.
   */
  const elementExists = (id: string, visited = new Set<string>()): boolean => {
    const doc = provider.document
    if (doc.getMap(DIAGRAM_MAPS.nodes).has(id) || doc.getMap(DIAGRAM_MAPS.areas).has(id)) {
      return true
    }
    if (areaCollection.getUnwritten(id)) return true
    const unwritten = nodeCollection.getUnwritten(id)
    if (!unwritten || visited.has(id)) return false
    visited.add(id)
    return hasParent(unwritten, visited)
  }
  const hasParent = (item: NodeType, visited?: Set<string>): boolean =>
    !item.parentId || elementExists(item.parentId, visited)
  const { items: nodes, setItems: setRawNodes } = nodeCollection
  const { items: edges, setItems: setEdges } = edgeCollection
  const { items: areas, setItems: setAreas } = areaCollection
  // Every local node edit goes through `normalizeNodes`; remote updates and undo/redo bypass it.
  const setNodes: React.Dispatch<React.SetStateAction<NodeType[]>> = (action) =>
    setRawNodes((current) => {
      const next = typeof action === 'function' ? action(current) : action
      return normalizeNodes ? normalizeNodes(next) : next
    })

  /**
   * Undo can restore a node whose parent, or an edge whose node, a peer deleted in the meantime;
   * an edge can also be written just before its new node is rejected (`canWrite`). Such orphans are deleted again, as the peer's delete would have done, along with their edges
   * and references to them, outside the undo history.
   */
  const dropOrphans = (): void => {
    const doc = provider.document
    const storedNodes = Array.from(doc.getMap<NodeType>(DIAGRAM_MAPS.nodes).values())
    const elementIds = new Set([
      ...storedNodes.map((item) => item.id),
      ...doc.getMap(DIAGRAM_MAPS.areas).keys(),
    ])
    const orphanNodeIds = findOrphanNodeIds(storedNodes, elementIds)
    const isGone = (id: string) => !elementIds.has(id) || orphanNodeIds.has(id)
    const danglingEdgeIds = new Set(
      Array.from(doc.getMap<EdgeType>(DIAGRAM_MAPS.edges).values())
        .filter((edge) => isGone(edge.source) || isGone(edge.target))
        .map((edge) => edge.id),
    )
    if (!orphanNodeIds.size && !danglingEdgeIds.size) return
    edgeCollection.repairItems((current) => current.filter((edge) => !danglingEdgeIds.has(edge.id)))
    nodeCollection.repairItems((current) => {
      const remaining = current.filter((item) => !orphanNodeIds.has(item.id))
      return cleanDeletedReferences
        ? cleanDeletedReferences(remaining, orphanNodeIds, danglingEdgeIds)
        : remaining
    })
  }

  const collections = [nodeCollection, edgeCollection, areaCollection]
  const history = useYjsUndo(DIAGRAM_MAP_NAMES, {
    flushPending: () => {
      for (const collection of collections) collection.flush()
    },
    held: collections.some((collection) => collection.held),
    repair: dropOrphans,
  })

  const hold = (ids: string[]) => {
    nodeCollection.hold(ids)
    areaCollection.hold(ids)
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
      nodeCollection.replaceItems(normalizeNodes ? normalizeNodes(next.nodes) : next.nodes)
      edgeCollection.replaceItems(next.edges)
      areaCollection.replaceItems(next.areas)
    }, COLLECTION_WRITE_ORIGIN)
  }

  return {
    nodes,
    edges,
    areas,
    setNodes,
    repairNodes: nodeCollection.repairItems,
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
    history,
  }
}
