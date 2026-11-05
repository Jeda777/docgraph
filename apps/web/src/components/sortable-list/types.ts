export type SortableItemBase = {
  id: string
  name: string
  createdAt: string | Date
  updatedAt: string | Date
  isArchived: boolean
}

export type SortableListAdditionalColumn<T extends SortableItemBase> = {
  key: keyof T
  label: string
  format?: (item: T) => string | number
  className?: string
}
