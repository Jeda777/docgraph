import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '../ui/button'
import { TableCell, TableRow } from '../ui/table'
import { ArchivedBadge } from './archived-badge'
import type { SortableItemBase, SortableListAdditionalColumn } from './types'

export type SortableListItemProps<T extends SortableItemBase> = {
  item: T
  additionalColumns?: SortableListAdditionalColumn<T>[]
  canEdit: boolean
  onEditClick: (itemId: string) => void
  linkToItem: (itemId: string) => string
  renderIcon?: (item: T) => ReactNode
}

/** A row of the table view. */
export const SortableListItem = <T extends SortableItemBase>({
  item,
  additionalColumns,
  canEdit,
  onEditClick,
  linkToItem,
  renderIcon,
}: SortableListItemProps<T>) => {
  return (
    <TableRow className='group relative border-border/70 hover:bg-accent/40'>
      <TableCell className='py-2.5 pl-4'>
        <div className={cn('flex items-center gap-3', item.isArchived && 'opacity-60')}>
          {renderIcon?.(item)}
          {/* Stretched link: whole row is clickable while staying a real anchor (Cmd/Ctrl+click works) */}
          <Link
            to={linkToItem(item.id)}
            className='truncate rounded-sm font-medium underline-offset-4 after:absolute after:inset-0 group-hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {item.name}
            {item.isArchived && <span className='sr-only'> (archived)</span>}
          </Link>
          {item.isArchived && <ArchivedBadge />}
        </div>
      </TableCell>
      {additionalColumns?.map((col) => (
        <TableCell key={`${item.id}-${col.key.toString()}`} className='text-muted-foreground'>
          {col.format ? col.format(item) : String(item[col.key])}
        </TableCell>
      ))}
      <TableCell className='hidden text-muted-foreground tabular-nums md:table-cell'>
        {formatDate(item.createdAt)}
      </TableCell>
      <TableCell className='text-muted-foreground tabular-nums'>
        {formatDate(item.updatedAt)}
      </TableCell>
      {canEdit && (
        <TableCell className='pr-3 text-right'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='Settings'
            className='relative z-10 text-muted-foreground'
            onClick={() => onEditClick(item.id)}
          >
            <Settings />
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}
