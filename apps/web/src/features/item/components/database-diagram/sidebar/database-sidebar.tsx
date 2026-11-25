import {
  DATABASE_DIAGRAM_NODE_TYPE,
  type DatabaseDiagramEnum,
  databaseDiagramSchema,
  nodeColorAt,
} from '@docgraph/common/schemas'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useEffect, useState } from 'react'
import { useAreaTab } from '../../../hooks/use-area-tab'
import { type DatabaseDocument, useDbmlIo } from '../../../hooks/use-dbml-io'
import { useDiagramIo } from '../../../hooks/use-diagram-io'
import { useFlowCenter } from '../../../hooks/use-flow-center'
import { COLLECTION_WRITE_ORIGIN } from '../../../hooks/use-yjs-collection'
import { revealSidebarCard } from '../../../lib/diagram-focus'
import type { AreaNode as AreaNodeType } from '../../base/area-node'
import { SidebarHint } from '../../base/sidebar-hint'
import { SidebarShell, type SidebarTabOption } from '../../base/sidebar-shell'
import type { DatabaseEdge as DatabaseEdgeType } from '../database-edge'
import type { DatabaseNode as DatabaseNodeType } from '../database-node'
import { type DatabaseTabKind, onDiagramFocus } from '../focus'
import { SidebarEnum } from './sidebar-enum'
import { SidebarRelation } from './sidebar-relation'
import { SidebarTable } from './sidebar-table'

const CARD_PREFIXES: Record<DatabaseTabKind, string> = {
  table: 'node',
  relation: 'edge',
  area: 'area',
  enum: 'enum',
}

export type DatabaseSidebarProps = {
  nodes: DatabaseNodeType[]
  edges: DatabaseEdgeType[]
  areas: AreaNodeType[]
  enums: DatabaseDiagramEnum[]
  setNodes: React.Dispatch<React.SetStateAction<DatabaseNodeType[]>>
  setEdges: React.Dispatch<React.SetStateAction<DatabaseEdgeType[]>>
  setAreas: React.Dispatch<React.SetStateAction<AreaNodeType[]>>
  setEnums: React.Dispatch<React.SetStateAction<DatabaseDiagramEnum[]>>
  replaceEnums: (enums: DatabaseDiagramEnum[]) => void
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
  enums,
  setNodes,
  setEdges,
  setAreas,
  setEnums,
  replaceEnums,
  replaceDocument,
  itemName,
  readOnly,
}: DatabaseSidebarProps) => {
  const provider = useHocuspocusProvider()
  const flowCenter = useFlowCenter()
  const [tab, setTab] = useState<DatabaseTabKind>('table')

  useEffect(
    () =>
      onDiagramFocus(({ kind, id }) => {
        setTab(kind)
        revealSidebarCard(CARD_PREFIXES[kind], id)
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

  const enumTypes = enums.map((item) => item.name.trim()).filter(Boolean)

  const handleEnumAdd = () =>
    setEnums((state) => [
      ...state,
      {
        id: crypto.randomUUID(),
        name: 'new_enum',
        values: [{ id: crypto.randomUUID(), name: '' }],
      },
    ])

  /** Canvas and enums are replaced in one transaction, so an import is one undo step. */
  const replaceDiagram = (document: DatabaseDocument) =>
    provider.document.transact(() => {
      replaceDocument(document)
      replaceEnums(document.enums)
    }, COLLECTION_WRITE_ORIGIN)

  const { handleImport, handleDownloadJson, handleDownloadImage } = useDiagramIo<
    DatabaseNodeType,
    DatabaseEdgeType,
    AreaNodeType,
    DatabaseDocument
  >({
    itemType: 'DATABASE_DIAGRAM',
    schema: databaseDiagramSchema,
    nodes,
    edges,
    areas,
    extra: { enums },
    itemName,
    replaceDocument: replaceDiagram,
  })

  const { handleImportDbml, handleDownloadDbml } = useDbmlIo({
    nodes,
    edges,
    areas,
    enums,
    itemName,
    replaceDocument: replaceDiagram,
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
          enumTypes={enumTypes}
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
    {
      value: 'enum',
      label: 'Enums',
      add: { label: 'enum', onClick: handleEnumAdd },
      children:
        enums.length === 0 ? (
          <SidebarHint>Name an enum as a column type to use it.</SidebarHint>
        ) : (
          enums.map((item) => (
            <SidebarEnum key={item.id} item={item} setEnums={setEnums} readOnly={readOnly} />
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
