import type { ItemType } from '@docgraph/common/schemas'
import { ChevronLeft, Download, Ellipsis, Lock, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { AccountMenu } from '@/components/account-menu'
import { ItemTypeTile } from '@/components/item-type/item-type-tile'
import { ITEM_TYPES_CONFIG } from '@/components/item-type/item-types.config'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type EditorExportFormat = {
  label: string
  onSelect: () => void
}

export type EditorHeaderProps = {
  itemName: string
  itemType: ItemType
  exportFormats: EditorExportFormat[]
  /** Opens the import file picker; omitted when the item can't be edited. */
  onImportClick?: () => void
  readOnly?: boolean
  /** Extra content between the title and the menu, e.g. presence. */
  children?: ReactNode
  className?: string
}

/**
 * Header shared by every editor: back to where the user came from, the item's name and type,
 * the import/export menu and the account menu.
 */
export const EditorHeader = ({
  itemName,
  itemType,
  exportFormats,
  onImportClick,
  readOnly,
  children,
  className,
}: EditorHeaderProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  // A direct visit has no in-app history entry to return to, so it goes home instead.
  const handleBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))
  const canExport = exportFormats.length > 0
  const canImport = !readOnly && !!onImportClick

  return (
    <header className={cn('flex h-14 shrink-0 items-center gap-2 px-2.5', className)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='Back'
              className='text-muted-foreground'
              onClick={handleBack}
            />
          }
        >
          <ChevronLeft />
        </TooltipTrigger>
        <TooltipContent>Back</TooltipContent>
      </Tooltip>

      <ItemTypeTile type={itemType} className='size-7 rounded-md' />

      <div className='flex min-w-0 flex-1 flex-col leading-tight'>
        <span className='truncate text-sm font-semibold tracking-tight'>{itemName}</span>
        {readOnly ? (
          <span className='flex items-center gap-1 text-xs font-medium text-muted-foreground'>
            <Lock className='size-3' /> Read-only
          </span>
        ) : (
          <span className='truncate text-xs text-muted-foreground'>
            {ITEM_TYPES_CONFIG[itemType].label}
          </span>
        )}
      </div>

      {children}

      {(canExport || canImport) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='Menu'
                className='text-muted-foreground'
              />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>

          <DropdownMenuContent align='end' className='min-w-44'>
            {canExport && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download /> Export
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {exportFormats.map((format) => (
                      <DropdownMenuItem key={format.label} onClick={format.onSelect}>
                        {format.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}

            {canImport && (
              <DropdownMenuItem onClick={onImportClick}>
                <Upload /> Import
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AccountMenu />
    </header>
  )
}
