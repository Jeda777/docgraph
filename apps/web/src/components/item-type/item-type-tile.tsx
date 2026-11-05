import type { ItemType } from '@docgraph/common/schemas'
import { cn } from '@/lib/utils'
import { ITEM_TYPES_CONFIG } from './item-types.config'

export type ItemTypeTileProps = {
  type: ItemType
  className?: string
}

/** Decorative icon tile of an item type, tinted with the type's color. */
export const ItemTypeTile = ({ type, className }: ItemTypeTileProps) => {
  const { Icon, tileClassName } = ITEM_TYPES_CONFIG[type]
  return (
    <span
      aria-hidden='true'
      className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tileClassName, className)}
    >
      <Icon className='size-4' />
    </span>
  )
}
