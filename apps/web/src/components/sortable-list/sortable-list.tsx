import { Plus, Search, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn, compareNames } from '@/lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../ui/table'
import { EmptyTableRow } from './empty-table-row'
import { SortMenu } from './sort-menu'
import { SortableListCard } from './sortable-list-card'
import { SortableListItem } from './sortable-list-item'
import { SortableTableHead } from './sortable-table-head'
import type { SortableItemBase, SortableListAdditionalColumn } from './types'
import { type ListView, useUrlTableState } from './use-url-table-state'
import { ViewToggle } from './view-toggle'

export type SortableListProps<T extends SortableItemBase> = {
  title: ReactNode
  /** Small line above the title, e.g. a breadcrumb back to the parent page. */
  breadcrumb?: ReactNode
  /** Short line under the title. */
  description?: ReactNode
  isLoading: boolean
  items: T[]
  additionalColumns?: SortableListAdditionalColumn<T>[]
  canAdd: boolean
  addButtonLabel: string
  /** Call to action of the empty grid, named apart from the header button, e.g. "Create your first project". */
  emptyAddButtonLabel: string
  onAddClick: () => void
  canEdit: boolean
  onEditClick: (itemId: string) => void
  linkToItem: (itemId: string) => string
  /** Leading visual of each item (icon tile, mark). */
  renderIcon?: (item: T) => ReactNode
  defaultView?: ListView
  /** What the list holds when it has nothing yet, e.g. "No projects yet". */
  emptyText: string
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

export const SortableList = <T extends SortableItemBase>({
  title,
  breadcrumb,
  description,
  isLoading,
  items,
  additionalColumns,
  canAdd,
  addButtonLabel,
  emptyAddButtonLabel,
  onAddClick,
  canEdit,
  onEditClick,
  linkToItem,
  renderIcon,
  defaultView = 'table',
  emptyText,
}: SortableListProps<T>) => {
  const { search, setSearch, sort, handleSort, setSort, view, setView } = useUrlTableState({
    sortKeys: [
      'name',
      'createdAt',
      'updatedAt',
      ...(additionalColumns?.map((col) => col.key.toString()) || []),
    ] as const,
    defaultSortBy: 'updatedAt',
    defaultView,
  })

  const filteredItems = search
    ? items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : items

  const sortedItems = [...filteredItems].sort((a, b) => {
    const aValue = a[sort.by as keyof T]
    const bValue = b[sort.by as keyof T]
    // Text sorts with the same rules as the sidebar (case-insensitive, "2" before "10").
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const order = compareNames(aValue, bValue)
      return sort.direction === 'asc' ? order : -order
    }
    if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
    return 0
  })

  const sortOptions = [
    { by: 'name', label: 'Name' },
    ...(additionalColumns?.map((col) => ({ by: col.key.toString(), label: col.label })) ?? []),
    { by: 'updatedAt', label: 'Last updated' },
    { by: 'createdAt', label: 'Created' },
  ]

  const emptyMessage = search ? 'Nothing matches your search.' : emptyText

  return (
    <>
      <header className='flex flex-wrap items-end justify-between gap-x-6 gap-y-4'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          {breadcrumb}
          <h1 className='text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]'>
            {title}
          </h1>
          {description && <p className='text-sm text-muted-foreground'>{description}</p>}
        </div>

        {canAdd && (
          <Button size='lg' className='h-9 px-3.5 shadow-card' onClick={onAddClick}>
            <Plus /> {addButtonLabel}
          </Button>
        )}
      </header>

      <div className='flex items-center gap-2'>
        <div className='relative min-w-0 flex-1 sm:max-w-80'>
          <Search className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by name…'
            aria-label='Search by name'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='h-9 bg-card pl-9'
          />
        </div>

        <div className='ml-auto flex items-center gap-2'>
          {view === 'grid' && <SortMenu options={sortOptions} sort={sort} onSortChange={setSort} />}
          <ViewToggle view={view} onViewChange={setView} />
        </div>
      </div>

      {isLoading ? (
        // The placeholder takes the shape of the chosen view, so nothing jumps once data arrives.
        view === 'grid' ? (
          <ul aria-busy='true' aria-label='Loading' className={GRID_CLASS_NAME}>
            {SKELETON_KEYS.map((key) => (
              <li key={key} className='h-36 animate-pulse rounded-xl border bg-card/60' />
            ))}
          </ul>
        ) : (
          <ul
            aria-busy='true'
            aria-label='Loading'
            className='divide-y overflow-hidden rounded-xl border bg-card'
          >
            {SKELETON_KEYS.map((key) => (
              <li key={key} className='flex h-14 items-center gap-3 px-4'>
                <span className='size-8 shrink-0 animate-pulse rounded-lg bg-muted' />
                <span className='h-3 w-48 max-w-1/2 animate-pulse rounded bg-muted' />
              </li>
            ))}
          </ul>
        )
      ) : view === 'grid' ? (
        sortedItems.length > 0 ? (
          <ul className={GRID_CLASS_NAME}>
            {sortedItems.map((item) => (
              <SortableListCard
                key={item.id}
                item={item}
                additionalColumns={additionalColumns}
                canEdit={canEdit}
                onEditClick={onEditClick}
                linkToItem={linkToItem}
                renderIcon={renderIcon}
              />
            ))}
          </ul>
        ) : (
          <div className='flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center'>
            {search && <SearchX className='size-6 text-muted-foreground' />}
            <p className='text-sm text-muted-foreground'>{emptyMessage}</p>
            {canAdd && !search && (
              <Button variant='outline' onClick={onAddClick}>
                <Plus /> {emptyAddButtonLabel}
              </Button>
            )}
          </div>
        )
      ) : (
        <div className='overflow-hidden rounded-xl border bg-card'>
          <Table>
            <TableHeader className='bg-muted/50'>
              <TableRow className='hover:bg-transparent'>
                <SortableTableHead
                  by='name'
                  sort={sort}
                  onSort={handleSort}
                  className={headClassName('pl-4')}
                >
                  Name
                </SortableTableHead>
                {additionalColumns?.map((col) => (
                  <SortableTableHead
                    key={col.key.toString()}
                    by={col.key.toString()}
                    sort={sort}
                    onSort={handleSort}
                    className={headClassName(col.className)}
                  >
                    {col.label}
                  </SortableTableHead>
                ))}
                <SortableTableHead
                  by='createdAt'
                  sort={sort}
                  onSort={handleSort}
                  className={headClassName('hidden w-44 md:table-cell')}
                >
                  Created
                </SortableTableHead>
                <SortableTableHead
                  by='updatedAt'
                  sort={sort}
                  onSort={handleSort}
                  className={headClassName('w-44')}
                >
                  Last updated
                </SortableTableHead>
                {canEdit && (
                  <TableHead className={headClassName('w-14 pr-3 text-right')}>
                    <span className='sr-only'>Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <SortableListItem
                  key={item.id}
                  item={item}
                  additionalColumns={additionalColumns}
                  canEdit={canEdit}
                  onEditClick={onEditClick}
                  linkToItem={linkToItem}
                  renderIcon={renderIcon}
                />
              ))}
              {sortedItems.length === 0 && (
                <EmptyTableRow
                  colSpan={3 + (canEdit ? 1 : 0) + (additionalColumns?.length || 0)}
                  text={emptyMessage}
                />
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

const GRID_CLASS_NAME = 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3'

const headClassName = (className?: string) =>
  cn('h-9 text-xs font-medium text-muted-foreground', className)
