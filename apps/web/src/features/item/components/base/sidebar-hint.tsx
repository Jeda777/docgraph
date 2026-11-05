import type { ReactNode } from 'react'

export type SidebarHintProps = {
  children: ReactNode
}

/** Empty-state hint shown in a sidebar tab with no cards yet. */
export const SidebarHint = ({ children }: SidebarHintProps) => (
  <p className='rounded-lg border border-dashed border-sidebar-border px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground'>
    {children}
  </p>
)
