import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ListView } from './use-url-table-state'

const VIEWS: { value: ListView; label: string; Icon: typeof List }[] = [
  { value: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { value: 'table', label: 'List view', Icon: List },
]

export type ViewToggleProps = {
  view: ListView
  onViewChange: (view: ListView) => void
}

export const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => (
  <div className='flex h-9 shrink-0 items-center gap-0.5 rounded-lg border bg-card p-0.5'>
    {VIEWS.map(({ value, label, Icon }) => (
      <button
        key={value}
        type='button'
        aria-label={label}
        aria-pressed={view === value}
        title={label}
        onClick={() => onViewChange(value)}
        className={cn(
          'grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          view === value && 'bg-accent text-accent-foreground shadow-xs',
        )}
      >
        <Icon className='size-4' />
      </button>
    ))}
  </div>
)
