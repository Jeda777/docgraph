import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { Button } from '../ui/button'
import { ArchivedBadge } from './archived-badge'
import type { SortableItemBase, SortableListAdditionalColumn } from './types'

export type SortableListCardProps<T extends SortableItemBase> = {
  item: T
  additionalColumns?: SortableListAdditionalColumn<T>[]
  canEdit: boolean
  onEditClick: (itemId: string) => void
  linkToItem: (itemId: string) => string
  renderIcon?: (item: T) => ReactNode
}

/** A tile of the grid view; the whole card is the item's link. */
export const SortableListCard = <T extends SortableItemBase>({
  item,
  additionalColumns,
  canEdit,
  onEditClick,
  linkToItem,
  renderIcon,
}: SortableListCardProps<T>) => {
  return (
    <li
      className={cn(
        'group relative flex min-h-32 flex-col sm:min-h-36 gap-4 rounded-xl border bg-card p-4 transition-[box-shadow,translate,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift',
        'has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/40',
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className={cn(item.isArchived && 'opacity-60 grayscale')}>{renderIcon?.(item)}</div>
        {canEdit && (
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='Settings'
            className='relative z-10 -mt-1 -mr-1 text-muted-foreground transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:aria-expanded:opacity-100'
            onClick={() => onEditClick(item.id)}
          >
            <Settings />
          </Button>
        )}
      </div>

      <div className='mt-auto flex flex-col gap-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <Link
            to={linkToItem(item.id)}
            className='truncate text-[0.9375rem] font-semibold tracking-tight outline-none after:absolute after:inset-0 after:rounded-xl'
          >
            {item.name}
            {item.isArchived && (
              <>
                {' '}
                <span className='sr-only'>(archived)</span>
              </>
            )}
          </Link>
          {item.isArchived && <ArchivedBadge />}
        </div>
        <p className='flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground'>
          {additionalColumns?.map((col) => (
            <span key={col.key.toString()} className='contents'>
              <span>{col.format ? col.format(item) : String(item[col.key])}</span>
              <span aria-hidden='true'>·</span>
            </span>
          ))}
          <span>
            Updated{' '}
            <time
              dateTime={new Date(item.updatedAt).toISOString()}
              title={formatDate(item.updatedAt)}
            >
              {formatRelativeDate(item.updatedAt)}
            </time>
          </span>
        </p>
      </div>
    </li>
  )
}
