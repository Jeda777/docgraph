import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const BaseNode = ({ className, ...props }: ComponentProps<'div'>) => {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground relative rounded-md border',
        'hover:ring-1',
        // React Flow marks the wrapping `.react-flow__node` as `.selected`.
        'in-[.selected]:border-muted-foreground',
        'in-[.selected]:shadow-lg',
        className,
      )}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: React Flow UI default, nodes must be keyboard-focusable
      tabIndex={0}
      {...props}
    />
  )
}

/** Header layout for the inside of a `<BaseNode />`. */
export const BaseNodeHeader = ({ className, ...props }: ComponentProps<'header'>) => {
  return (
    <header
      {...props}
      className={cn(
        'mx-0 my-0 -mb-1 flex flex-row items-center justify-between gap-2 px-3 py-2',
        className,
      )}
    />
  )
}

/** Node title; not selectable, to keep the native application feel. */
export const BaseNodeHeaderTitle = ({ className, ...props }: ComponentProps<'h3'>) => {
  return (
    <h3
      data-slot='base-node-title'
      className={cn('user-select-none flex-1 font-semibold', className)}
      {...props}
    />
  )
}

export const BaseNodeContent = ({ className, ...props }: ComponentProps<'div'>) => {
  return (
    <div
      data-slot='base-node-content'
      className={cn('flex flex-col gap-y-2 p-3', className)}
      {...props}
    />
  )
}
