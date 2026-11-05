import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import type { SortDirection, SortState } from './use-url-table-state'

export type SortMenuProps<By extends string> = {
  options: { by: By; label: string }[]
  sort: SortState<By>
  onSortChange: (sort: SortState<By>) => void
}

/** Sort control for views without sortable column headers (the grid). */
export const SortMenu = <By extends string>({ options, sort, onSortChange }: SortMenuProps<By>) => {
  const activeLabel = options.find((option) => option.by === sort.by)?.label ?? ''
  const DirectionIcon = sort.direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant='outline' className='h-9 bg-card' aria-label={`Sort by ${activeLabel}`} />
        }
      >
        <DirectionIcon className='text-muted-foreground' />
        <span className='hidden sm:inline'>{activeLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-44'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort.by}
            onValueChange={(by: By) => onSortChange({ by, direction: sort.direction })}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.by} value={option.by}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Order</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sort.direction}
            onValueChange={(direction: SortDirection) => onSortChange({ by: sort.by, direction })}
          >
            <DropdownMenuRadioItem value='asc'>Ascending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value='desc'>Descending</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
