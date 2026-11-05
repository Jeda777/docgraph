import { Copy, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type PaletteToolbarProps = {
  search: string
  onSearchChange: (search: string) => void
  searchLabel: string
  searchPlaceholder: string
  duplicateLabel: string
  canDuplicate: boolean
  onDuplicate: () => void
  readOnly?: boolean
}

/** Duplicate button and search field above a diagram's tool palette. */
export const PaletteToolbar = ({
  search,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  duplicateLabel,
  canDuplicate,
  onDuplicate,
  readOnly,
}: PaletteToolbarProps) => (
  <>
    <div className='flex justify-end'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        aria-label={duplicateLabel}
        disabled={readOnly || !canDuplicate}
        onClick={onDuplicate}
      >
        <Copy /> Duplicate
      </Button>
    </div>
    <div className='relative'>
      <Search aria-hidden='true' className='absolute top-2 left-2.5 size-4 text-muted-foreground' />
      <Input
        aria-label={searchLabel}
        className='h-8 pl-8'
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  </>
)
