import { filterBySearch } from '../../../lib/palette-search.helpers'
import { PaletteToolbar } from '../../base/palette-toolbar'
import { ShapePaletteItem } from '../../base/shape-palette-item'
import { SidebarHint } from '../../base/sidebar-hint'
import type { BusinessProcessNode } from '../business-process-node'
import {
  type BusinessProcessNodeTool,
  businessProcessNodeToolRegistry,
} from '../business-process-tool-registry'

const CATEGORY_ORDER = [
  'Activities',
  'Events',
  'Gateways',
  'Participants',
  'Data',
  'Artifacts',
  'Advanced',
] as const

const isSelectedNodeTool = (tool: BusinessProcessNodeTool, node?: BusinessProcessNode) => {
  if (!node || tool.nodeType !== node.type) return false
  const { data } = node
  if (data.kind === 'activity') return tool.id === `activity:${data.taskType}`
  if (data.kind === 'event') return tool.id === `event:${data.context}:${data.eventType}`
  if (data.kind === 'gateway') return tool.id === `gateway:${data.gatewayType}`
  if (data.kind === 'participant') {
    return tool.id === `participant:${data.blackBox ? 'blackBox' : data.participantType}`
  }
  if (data.kind === 'data') return tool.id === `data:${data.dataType}`
  if (data.kind === 'artifact') return tool.id === 'artifact:annotation'
  if (data.kind === 'choreography')
    return tool.id === `advanced:choreography:${data.choreographyType}`
  return tool.id === `advanced:conversation:${data.conversationType}`
}

export type BusinessProcessPaletteProps = {
  /** Kept by the sidebar so the query survives switching tabs. */
  search: string
  onSearchChange: (search: string) => void
  selectedNode?: BusinessProcessNode
  canDuplicate: boolean
  onDuplicate: () => void
  onAdd: (tool: BusinessProcessNodeTool) => void
  readOnly?: boolean
}

/** Searchable, categorized element palette of the business process sidebar. */
export const BusinessProcessPalette = ({
  search,
  onSearchChange,
  selectedNode,
  canDuplicate,
  onDuplicate,
  onAdd,
  readOnly,
}: BusinessProcessPaletteProps) => {
  const filteredTools = filterBySearch(
    businessProcessNodeToolRegistry,
    search,
    (tool) => `${tool.label} ${tool.category}`,
  )

  return (
    <>
      <PaletteToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchLabel='Search business process elements'
        searchPlaceholder='Search elements'
        duplicateLabel='Duplicate selected element'
        canDuplicate={canDuplicate}
        onDuplicate={onDuplicate}
        readOnly={readOnly}
      />
      {!filteredTools.length && <SidebarHint>No matching elements.</SidebarHint>}
      {CATEGORY_ORDER.map((category) => {
        const tools = filteredTools.filter((tool) => tool.category === category)
        if (!tools.length) return null
        return (
          <section key={category}>
            <h3 className='px-1 py-1 text-xs font-semibold text-muted-foreground'>{category}</h3>
            <div className='grid grid-cols-4 gap-1'>
              {tools.map((tool) => (
                <ShapePaletteItem
                  key={tool.id}
                  label={tool.label}
                  preview={tool.preview()}
                  selected={isSelectedNodeTool(tool, selectedNode)}
                  disabled={readOnly}
                  className='aspect-square size-auto'
                  onSelect={() => onAdd(tool)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
