import type { ItemType } from '@docgraph/common/schemas'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { Plus } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { downloadDocgraph, IMAGE_FORMATS, type ImageFormat } from '../../lib/download.helpers'
import { type EditorExportFormat, EditorHeader } from './editor-header'

export type SidebarTabOption<Kind extends string> = {
  value: Kind
  label: string
  /** The "+" action of this tab; `label` names what it adds, e.g. "table". */
  add?: { label: string; onClick: () => void }
  fixedChildren?: ReactNode
  children: ReactNode
}

type SidebarShellProps<Kind extends string> = {
  itemName: string
  itemType: ItemType
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  onDownloadJson: () => void
  onDownloadImage: (format: ImageFormat) => void
  /** Diagram-specific formats, listed after JSON. */
  extraExportFormats?: EditorExportFormat[]
  tab: Kind
  onTabChange: (tab: Kind) => void
  tabs: SidebarTabOption<Kind>[]
  importAccept?: string
  readOnly?: boolean
  sidebarClassName?: string
}

/**
 * Layout shared by every diagram sidebar: the editor header (back, import/export, account),
 * a row of tabs with an optional "+" action for the active tab, and the scrollable card list.
 * Fixed tab content stays above that list for controls that must remain visible while
 * browsing tools.
 */
export const SidebarShell = <Kind extends string>({
  itemName,
  itemType,
  onImport,
  onDownloadJson,
  onDownloadImage,
  extraExportFormats = [],
  tab,
  onTabChange,
  tabs,
  importAccept = '.json,.docgraph',
  readOnly,
  sidebarClassName,
}: SidebarShellProps<Kind>) => {
  const provider = useHocuspocusProvider()
  const fileRef = useRef<HTMLInputElement>(null)
  const activeTab = tabs.find((option) => option.value === tab)
  const activeAdd = activeTab?.add

  return (
    <aside
      data-hide-cursor
      className={cn(
        'absolute top-0 left-0 z-10 flex h-screen w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        sidebarClassName,
      )}
    >
      <EditorHeader
        itemName={itemName}
        itemType={itemType}
        readOnly={readOnly}
        className='border-b border-sidebar-border'
        onImportClick={() => fileRef.current?.click()}
        exportFormats={[
          { label: 'DocGraph', onSelect: () => downloadDocgraph(provider.document, itemName) },
          { label: 'JSON', onSelect: onDownloadJson },
          ...extraExportFormats,
          ...IMAGE_FORMATS.map((format) => ({
            label: format.toUpperCase(),
            onSelect: () => onDownloadImage(format),
          })),
        ]}
      />
      <input
        ref={fileRef}
        type='file'
        accept={importAccept}
        className='hidden'
        onChange={onImport}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as Kind)}
        className='min-h-0 w-full flex-1 gap-0'
      >
        <div className='flex items-center gap-2 px-2.5 pt-3 pb-2.5'>
          <TabsList className='h-8 min-w-0 flex-1 bg-sidebar-accent/80 group-data-horizontal/tabs:h-8'>
            {tabs.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className='min-w-0 text-xs data-active:bg-card dark:data-active:bg-input/40'
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {!readOnly && activeAdd && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size='icon-sm'
                    type='button'
                    className='size-8 shrink-0'
                    aria-label='Add'
                    onClick={activeAdd.onClick}
                  />
                }
              >
                <Plus />
              </TooltipTrigger>
              <TooltipContent>Add {activeAdd.label}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {tabs.map((option) => (
          <TabsContent
            value={option.value}
            key={option.value}
            className='flex min-h-0 flex-1 flex-col overflow-hidden'
          >
            {option.fixedChildren}
            <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pt-1 pb-4 scrollbar-none'>
              {option.children}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  )
}
