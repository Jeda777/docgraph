import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortState } from './use-url-table-state'

export type SortableTableHeadProps<By extends string> = {
  by: By
  sort: SortState<By>
  onSort: (by: By) => void
  children: ReactNode
  className?: string
  buttonClassName?: string
}

export const SortableTableHead = <By extends string>({
  by,
  sort,
  onSort,
  children,
  className,
  buttonClassName,
}: SortableTableHeadProps<By>) => {
  const isActive = sort.by === by

  return (
    <TableHead
      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={className}
    >
      <button
        type='button'
        onClick={() => onSort(by)}
        className={cn(
          'flex h-6 cursor-pointer items-center gap-1 rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          buttonClassName,
        )}
      >
        {children}
        {isActive && (
          <span aria-hidden='true'>
            {sort.direction === 'asc' ? (
              <ArrowUp className='size-3' />
            ) : (
              <ArrowDown className='size-3' />
            )}
          </span>
        )}
      </button>
    </TableHead>
  )
}
