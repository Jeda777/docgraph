import type { FlowchartEdgeType, FlowchartNodeType } from '@docgraph/common/schemas'
import { flowchartSchema } from '@docgraph/common/schemas'
import { useState } from 'react'
import { useAreaTab } from '../../../hooks/use-area-tab'
import { useDiagramIo } from '../../../hooks/use-diagram-io'
import { useFlowCenter } from '../../../hooks/use-flow-center'
import { duplicateNode } from '../../../lib/duplicate-node.helpers'
import type { AreaNode } from '../../base/area-node'
import { SidebarShell, type SidebarTabOption } from '../../base/sidebar-shell'
import type { FlowchartEdge } from '../flowchart-edge'
import type { FlowchartNode } from '../flowchart-node'
import { getFlowchartTool } from '../flowchart-tool-registry'
import { ShapePalette } from './shape-palette'

export type FlowchartSidebarProps = {
  nodes: FlowchartNode[]
  edges: FlowchartEdge[]
  areas: AreaNode[]
  setNodes: React.Dispatch<React.SetStateAction<FlowchartNode[]>>
  setAreas: React.Dispatch<React.SetStateAction<AreaNode[]>>
  replaceDocument: (document: {
    nodes: FlowchartNode[]
    edges: FlowchartEdge[]
    areas: AreaNode[]
  }) => void
  itemName: string
  activeEdgeType: FlowchartEdgeType
  onEdgeTypeChange: (type: FlowchartEdgeType) => void
  readOnly?: boolean
}

type FlowchartSidebarTab = 'shapes' | 'area'

export const FlowchartSidebar = ({
  nodes,
  edges,
  areas,
  setNodes,
  setAreas,
  replaceDocument,
  itemName,
  activeEdgeType,
  onEdgeTypeChange,
  readOnly,
}: FlowchartSidebarProps) => {
  const flowCenter = useFlowCenter()
  const [tab, setTab] = useState<FlowchartSidebarTab>('shapes')
  const [search, setSearch] = useState('')

  const handleNodeAdd = (type: FlowchartNodeType) =>
    setNodes((state) => {
      const tool = getFlowchartTool(type)
      return [
        ...state,
        {
          id: crypto.randomUUID(),
          type,
          position: flowCenter(),
          style: { width: tool.width, height: tool.height },
          data: { text: '' },
        },
      ]
    })

  const { handleImport, handleDownloadJson, handleDownloadImage } = useDiagramIo<
    FlowchartNode,
    FlowchartEdge,
    AreaNode
  >({
    itemType: 'FLOWCHART',
    schema: flowchartSchema,
    nodes,
    edges,
    areas,
    itemName,
    replaceDocument,
  })

  const areaTab = useAreaTab({ areas, setAreas, readOnly })
  const selectedNode = nodes.find((node) => node.selected)
  const selectedNodeTypes = nodes.flatMap((node) => (node.selected && node.type ? [node.type] : []))

  const handleDuplicate = () => {
    if (!selectedNode) return
    setNodes((state) => duplicateNode(state, selectedNode.id))
  }

  const tabs: SidebarTabOption<FlowchartSidebarTab>[] = [
    {
      value: 'shapes',
      label: 'Shapes',
      children: (
        <ShapePalette
          search={search}
          onSearchChange={setSearch}
          selectedNodeTypes={selectedNodeTypes}
          activeEdgeType={activeEdgeType}
          canDuplicate={!!selectedNode}
          onDuplicate={handleDuplicate}
          onNodeAdd={handleNodeAdd}
          onEdgeTypeChange={onEdgeTypeChange}
          readOnly={readOnly}
        />
      ),
    },
    areaTab,
  ]

  return (
    <SidebarShell
      itemName={itemName}
      itemType='FLOWCHART'
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
      onImport={handleImport}
      onDownloadJson={handleDownloadJson}
      onDownloadImage={handleDownloadImage}
      readOnly={readOnly}
      sidebarClassName='w-66'
    />
  )
}
