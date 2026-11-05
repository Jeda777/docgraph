import {
  AREA_NODE_TYPE,
  DATABASE_DIAGRAM_DEFAULT_EDGE_DATA,
  DATABASE_DIAGRAM_EDGE_TYPE,
  DATABASE_DIAGRAM_NODE_TYPE,
  type DatabaseDiagramEdgeData,
} from '@docgraph/common/schemas'
import type { CrdtEditorProps } from '../../lib/types'
import { AreaNode } from '../base/area-node'
import { DiagramCanvas } from '../base/diagram-canvas'
import { DatabaseEdge, type DatabaseEdge as DatabaseEdgeType } from './database-edge'
import { DatabaseNode, type DatabaseNode as DatabaseNodeType } from './database-node'
import { focusDiagramItem } from './focus'
import { DatabaseSidebar } from './sidebar/database-sidebar'

const nodeTypes = {
  [DATABASE_DIAGRAM_NODE_TYPE]: DatabaseNode,
  [AREA_NODE_TYPE]: AreaNode,
}

const edgeTypes = {
  [DATABASE_DIAGRAM_EDGE_TYPE]: DatabaseEdge,
}

const createEdgeData = (): DatabaseDiagramEdgeData => ({ ...DATABASE_DIAGRAM_DEFAULT_EDGE_DATA })

export const DatabaseDiagram = ({ connected, itemName }: CrdtEditorProps) => (
  <DiagramCanvas<DatabaseNodeType, DatabaseEdgeType>
    connected={connected}
    itemName={itemName}
    nodeTypes={nodeTypes}
    edgeTypes={edgeTypes}
    edgeType={DATABASE_DIAGRAM_EDGE_TYPE}
    createEdgeData={createEdgeData}
    onNodeDoubleClick={(node) =>
      focusDiagramItem({ kind: node.type === AREA_NODE_TYPE ? 'area' : 'table', id: node.id })
    }
    onEdgeDoubleClick={(edge) => focusDiagramItem({ kind: 'relation', id: edge.id })}
    renderSidebar={(collections, name) => <DatabaseSidebar {...collections} itemName={name} />}
  />
)
