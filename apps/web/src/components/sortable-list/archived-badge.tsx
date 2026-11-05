import { Archive } from 'lucide-react'

/**
 * Visual "archived" marker. Hidden from assistive tech: the item's link carries the state
 * in its own text, so it is announced once, as part of the name.
 */
export const ArchivedBadge = () => (
  <span
    aria-hidden='true'
    className='inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground'
  >
    <Archive className='size-3' />
    Archived
  </span>
)
