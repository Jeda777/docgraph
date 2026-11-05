import type { BusinessProcessEdgeType } from '@docgraph/common/schemas'
import { type SetStateAction, useState } from 'react'
import type { z } from 'zod'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { useAreaTab } from '../../../hooks/use-area-tab'
import { useDiagramIo } from '../../../hooks/use-diagram-io'
import { useFlowCenter } from '../../../hooks/use-flow-center'
import type { AreaNode } from '../../base/area-node'
import { SidebarShell, type SidebarTabOption } from '../../base/sidebar-shell'
import { normalizeBoundaryEventAttachments } from '../business-process-attachments'
import {
  addBusinessProcessNode,
  attachBusinessProcessBoundaryEvent,
  type BusinessProcessCommandResult,
  canDuplicateBusinessProcessNode,
  changeBusinessProcessEventContext,
  changeBusinessProcessEventDefinition,
  changeBusinessProcessParticipantOrientation,
  duplicateBusinessProcessNode,
  hasInvalidBusinessProcessConnections,
  updateBusinessProcessEdgeData,
  updateBusinessProcessNodeData,
} from '../business-process-commands'
import type { BusinessProcessEdge } from '../business-process-edge'
import { businessProcessImportSchema } from '../business-process-import'
import type { BusinessProcessNode } from '../business-process-node'
import {
  type BusinessProcessNodeTool,
  businessProcessEdgeToolRegistry,
} from '../business-process-tool-registry'
import { BusinessProcessPalette } from './business-process-palette'
import { BusinessProcessProperties } from './business-process-properties'

type BusinessProcessDocument = {
  nodes: BusinessProcessNode[]
  edges: BusinessProcessEdge[]
  areas: AreaNode[]
}

export type BusinessProcessSidebarProps = BusinessProcessDocument & {
  setNodes: React.Dispatch<React.SetStateAction<BusinessProcessNode[]>>
  setEdges: React.Dispatch<React.SetStateAction<BusinessProcessEdge[]>>
  setAreas: React.Dispatch<React.SetStateAction<AreaNode[]>>
  replaceDocument: (document: BusinessProcessDocument) => void
  itemName: string
  activeEdgeType: BusinessProcessEdgeType
  onEdgeTypeChange: (type: BusinessProcessEdgeType) => void
  readOnly?: boolean
}

type BusinessProcessTab = 'palette' | 'properties' | 'area'

export const BusinessProcessSidebar = ({
  nodes,
  edges,
  areas,
  setNodes,
  setEdges,
  setAreas,
  replaceDocument,
  itemName,
  activeEdgeType,
  onEdgeTypeChange,
  readOnly,
}: BusinessProcessSidebarProps) => {
  const flowCenter = useFlowCenter()
  const [tab, setTab] = useState<BusinessProcessTab>('palette')
  const [search, setSearch] = useState('')
  const selectedNode = nodes.find((node) => node.selected)
  const selectedEdge = edges.find((edge) => edge.selected)
  const activeEdgeLabel =
    businessProcessEdgeToolRegistry.find((tool) => tool.edgeType === activeEdgeType)?.label ??
    activeEdgeType

  // The canvas snaps boundary events for display only; sidebar actions persist the snapped
  // position so the stored document stays consistent without every peer rewriting it.
  const writeNodes = (update: SetStateAction<BusinessProcessNode[]>) =>
    setNodes((current) =>
      normalizeBoundaryEventAttachments(typeof update === 'function' ? update(current) : update),
    )

  /**
   * Runs `command` on the latest nodes, so a collaborator's edit made since this render is kept.
   * A rejected command, or one that breaks existing connections when `invalidConnectionsMessage`
   * is given, leaves the nodes unchanged and shows a warning instead.
   */
  const runCommand = (
    command: (current: BusinessProcessNode[]) => BusinessProcessCommandResult,
    invalidConnectionsMessage?: string,
  ) => {
    if (readOnly) return
    let warning: string | undefined
    writeNodes((current) => {
      const next = command(current)
      if (typeof next === 'string') {
        warning = next
        return current
      }
      // `edges` is this render's snapshot: the latest edges live inside the collection hook,
      // out of reach here. An edge a collaborator adds after this render is not checked, but
      // the canvas `isValidConnection` already rejects invalid new connections at creation.
      if (invalidConnectionsMessage && hasInvalidBusinessProcessConnections(edges, next)) {
        warning = invalidConnectionsMessage
        return current
      }
      return next
    })
    if (warning) toast.add({ type: 'warning', title: warning })
  }

  const addNode = (tool: BusinessProcessNodeTool) => {
    const id = crypto.randomUUID()
    const center = flowCenter()
    runCommand((current) =>
      addBusinessProcessNode(current, { id, tool, selectedNodeId: selectedNode?.id, center }),
    )
  }

  const runOnSelectedNode = (
    command: (current: BusinessProcessNode[], nodeId: string) => BusinessProcessCommandResult,
    invalidConnectionsMessage?: string,
  ) => {
    if (!selectedNode) return
    const nodeId = selectedNode.id
    runCommand((current) => command(current, nodeId), invalidConnectionsMessage)
  }

  const { handleImport, handleDownloadJson, handleDownloadImage } = useDiagramIo<
    BusinessProcessNode,
    BusinessProcessEdge,
    AreaNode
  >({
    itemType: 'BUSINESS_PROCESS',
    schema: businessProcessImportSchema as z.ZodType<BusinessProcessDocument>,
    nodes,
    edges,
    areas,
    itemName,
    replaceDocument,
  })

  const areaTab = useAreaTab({ areas, setAreas, readOnly })
  const tabs: SidebarTabOption<BusinessProcessTab>[] = [
    {
      value: 'palette',
      label: 'Elements',
      fixedChildren: (
        <div className='shrink-0 border-b border-sidebar-border px-2.5 pb-3'>
          <Label className='flex-col items-stretch gap-1.5 text-xs font-semibold text-muted-foreground'>
            Active connection
            <Select
              disabled={readOnly}
              value={activeEdgeType}
              onValueChange={(value) => {
                if (value) onEdgeTypeChange(value as BusinessProcessEdgeType)
              }}
            >
              <SelectTrigger className='w-full'>
                <SelectValue>{activeEdgeLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {businessProcessEdgeToolRegistry.map((tool) => (
                  <SelectItem key={tool.edgeType} value={tool.edgeType}>
                    {tool.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        </div>
      ),
      children: (
        <BusinessProcessPalette
          search={search}
          onSearchChange={setSearch}
          selectedNode={selectedNode}
          canDuplicate={canDuplicateBusinessProcessNode(selectedNode)}
          onDuplicate={() => runOnSelectedNode(duplicateBusinessProcessNode)}
          onAdd={addNode}
          readOnly={readOnly}
        />
      ),
    },
    {
      value: 'properties',
      label: 'Properties',
      children: (
        <BusinessProcessProperties
          nodes={nodes}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onNodeDataChange={(updater) =>
            runOnSelectedNode((current, nodeId) =>
              updateBusinessProcessNodeData(current, nodeId, updater),
            )
          }
          onEdgeTextChange={(text) => {
            if (!selectedEdge?.data || readOnly) return
            const edgeId = selectedEdge.id
            setEdges((current) =>
              updateBusinessProcessEdgeData(current, edgeId, (data) => ({ ...data, text })),
            )
          }}
          onEventContextChange={(context) =>
            runOnSelectedNode(
              (current, nodeId) => changeBusinessProcessEventContext(current, nodeId, context),
              'This event context is incompatible with its existing connections.',
            )
          }
          onEventDefinitionChange={(eventType) =>
            runOnSelectedNode(
              (current, nodeId) => changeBusinessProcessEventDefinition(current, nodeId, eventType),
              'This event definition is incompatible with its existing connections.',
            )
          }
          onBoundaryAttachmentChange={(activityId) =>
            runOnSelectedNode(
              (current, nodeId) => attachBusinessProcessBoundaryEvent(current, nodeId, activityId),
              'This activity is incompatible with the boundary event connections.',
            )
          }
          onParticipantOrientationChange={(orientation) =>
            runOnSelectedNode((current, nodeId) =>
              changeBusinessProcessParticipantOrientation(current, nodeId, orientation),
            )
          }
          readOnly={readOnly}
        />
      ),
    },
    areaTab,
  ]

  return (
    <SidebarShell
      itemName={itemName}
      itemType='BUSINESS_PROCESS'
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
      onImport={handleImport}
      onDownloadJson={handleDownloadJson}
      onDownloadImage={handleDownloadImage}
      readOnly={readOnly}
      sidebarClassName='w-78'
    />
  )
}
