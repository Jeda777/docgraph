import type { FlowchartEdgeType, FlowchartNodeType } from '@docgraph/common/schemas'
import { filterBySearch } from '../../../lib/palette-search.helpers'
import { PaletteToolbar } from '../../base/palette-toolbar'
import { ShapePaletteItem } from '../../base/shape-palette-item'
import { SidebarHint } from '../../base/sidebar-hint'
import { type FlowchartTool, flowchartToolRegistry } from '../flowchart-tool-registry'

const paletteTools: readonly FlowchartTool[] = flowchartToolRegistry

export type ShapePaletteProps = {
  /** Kept by the sidebar so the query survives switching tabs. */
  search: string
  onSearchChange: (search: string) => void
  selectedNodeTypes?: readonly FlowchartNodeType[]
  activeEdgeType: FlowchartEdgeType
  canDuplicate: boolean
  onDuplicate: () => void
  onNodeAdd: (type: FlowchartNodeType) => void
  onEdgeTypeChange: (type: FlowchartEdgeType) => void
  readOnly?: boolean
}

export const ShapePalette = ({
  search,
  onSearchChange,
  selectedNodeTypes = [],
  activeEdgeType,
  canDuplicate,
  onDuplicate,
  onNodeAdd,
  onEdgeTypeChange,
  readOnly = false,
}: ShapePaletteProps) => {
  const filteredTools = filterBySearch(paletteTools, search, (tool) => tool.label)

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <PaletteToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchLabel='Search flowchart shapes'
        searchPlaceholder='Search shapes'
        duplicateLabel='Duplicate selected node'
        canDuplicate={canDuplicate}
        onDuplicate={onDuplicate}
        readOnly={readOnly}
      />
      <div className='grid min-h-0 flex-1 grid-cols-4 content-start gap-1 overflow-y-auto py-1 scrollbar-none'>
        {filteredTools.map((tool) => {
          const selected =
            tool.kind === 'node'
              ? selectedNodeTypes.includes(tool.type)
              : activeEdgeType === tool.type

          return (
            <ShapePaletteItem
              key={tool.type}
              label={tool.label}
              preview={tool.preview()}
              selected={selected}
              disabled={readOnly}
              className='aspect-square size-auto'
              onSelect={() => {
                if (tool.kind === 'node') onNodeAdd(tool.type)
                else onEdgeTypeChange(tool.type)
              }}
            />
          )
        })}
        {!filteredTools.length && (
          <div className='col-span-full'>
            <SidebarHint>No matching shapes.</SidebarHint>
          </div>
        )}
      </div>
    </div>
  )
}
