import {
  DATABASE_DIAGRAM_NODE_TYPE,
  databaseDiagramSchema,
  nodeColorAt,
} from '@docgraph/common/schemas'
import { useEffect, useState } from 'react'
import { useAreaTab } from '../../../hooks/use-area-tab'
import { useDbmlIo } from '../../../hooks/use-dbml-io'
import { useDiagramIo } from '../../../hooks/use-diagram-io'
import { useFlowCenter } from '../../../hooks/use-flow-center'
import { revealSidebarCard } from '../../../lib/diagram-focus'
import type { AreaNode as AreaNodeType } from '../../base/area-node'
import { SidebarHint } from '../../base/sidebar-hint'
import { SidebarShell, type SidebarTabOption } from '../../base/sidebar-shell'
import type { DatabaseEdge as DatabaseEdgeType } from '../database-edge'
import type { DatabaseNode as DatabaseNodeType } from '../database-node'
import { type DatabaseTabKind, onDiagramFocus } from '../focus'
import { SidebarRelation } from './sidebar-relation'
import { SidebarTable } from './sidebar-table'

export type DatabaseSidebarProps = {
  nodes: DatabaseNodeType[]
  edges: DatabaseEdgeType[]
  areas: AreaNodeType[]
  setNodes: React.Dispatch<React.SetStateAction<DatabaseNodeType[]>>
  setEdges: React.Dispatch<React.SetStateAction<DatabaseEdgeType[]>>
  setAreas: React.Dispatch<React.SetStateAction<AreaNodeType[]>>
  replaceDocument: (document: {
    nodes: DatabaseNodeType[]
    edges: DatabaseEdgeType[]
    areas: AreaNodeType[]
  }) => void
  itemName: string
  readOnly?: boolean
}

export const DatabaseSidebar = ({
  nodes,
  edges,
  areas,
  setNodes,
  setEdges,
  setAreas,
  replaceDocument,
  itemName,
  readOnly,
}: DatabaseSidebarProps) => {
  const flowCenter = useFlowCenter()
  const [tab, setTab] = useState<DatabaseTabKind>('table')

  useEffect(
    () =>
      onDiagramFocus(({ kind, id }) => {
        setTab(kind)
        revealSidebarCard(kind === 'relation' ? 'edge' : kind === 'table' ? 'node' : 'area', id)
      }),
    [],
  )

  const handleTableAdd = () =>
    setNodes((state) => [
      ...state,
      {
        data: {
          values: [
            {
              id: crypto.randomUUID(),
              name: 'id',
              value: 'int',
              primaryKey: true,
              foreignKey: false,
              index: false,
              unique: false,
              nullable: false,
            },
          ],
          color: nodeColorAt(state.length + 1),
          name: 'new_table',
        },
        position: flowCenter(),
        id: crypto.randomUUID(),
        type: DATABASE_DIAGRAM_NODE_TYPE,
      },
    ])

  const { handleImport, handleDownloadJson, handleDownloadImage } = useDiagramIo<
    DatabaseNodeType,
    DatabaseEdgeType,
    AreaNodeType
  >({
    itemType: 'DATABASE_DIAGRAM',
    schema: databaseDiagramSchema,
    nodes,
    edges,
    areas,
    itemName,
    replaceDocument,
  })

  const { handleImportDbml, handleDownloadDbml } = useDbmlIo({
    nodes,
    edges,
    areas,
    itemName,
    replaceDocument,
  })

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file?.name.endsWith('.dbml')) return handleImport(event)
    event.target.value = ''
    await handleImportDbml(file)
  }

  const areaTab = useAreaTab({
    areas,
    setAreas,
    readOnly,
  })

  const tabs: SidebarTabOption<DatabaseTabKind>[] = [
    {
      value: 'table',
      label: 'Tables',
      add: { label: 'table', onClick: handleTableAdd },
      children: nodes.map((node) => (
        <SidebarTable
          key={node.id}
          nodeId={node.id}
          data={node.data}
          setNodes={setNodes}
          readOnly={readOnly}
        />
      )),
    },
    {
      value: 'relation',
      label: 'Relations',
      children:
        edges.length === 0 ? (
          <SidebarHint>Drag between columns to create a relation.</SidebarHint>
        ) : (
          edges.map((edge) => (
            <SidebarRelation
              key={edge.id}
              edge={edge}
              nodes={nodes}
              setEdges={setEdges}
              readOnly={readOnly}
            />
          ))
        ),
    },
    areaTab,
  ]

  return (
    <SidebarShell
      itemName={itemName}
      itemType='DATABASE_DIAGRAM'
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
      onImport={handleImportFile}
      importAccept='.json,.docgraph,.dbml'
      onDownloadJson={handleDownloadJson}
      onDownloadImage={handleDownloadImage}
      extraExportFormats={[{ label: 'DBML', onSelect: handleDownloadDbml }]}
      readOnly={readOnly}
    />
  )
}
