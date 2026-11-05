import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ShapePaletteItemProps = {
  label: string
  preview: ReactNode
  selected?: boolean
  disabled?: boolean
  className?: string
  onSelect: () => void
}

export const ShapePaletteItem = ({
  label,
  preview,
  selected = false,
  disabled = false,
  className,
  onSelect,
}: ShapePaletteItemProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          type='button'
          variant='ghost'
          size='icon'
          title={label}
          aria-label={label}
          aria-pressed={selected}
          disabled={disabled}
          onClick={onSelect}
          className={cn(
            'size-11 rounded-md border border-transparent p-1.5 hover:bg-sidebar-accent',
            className,
            selected && 'border-primary/60 bg-accent text-accent-foreground hover:bg-accent',
          )}
        />
      }
    >
      {preview}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)
