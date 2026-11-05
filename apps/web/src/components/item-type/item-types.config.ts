import type { ItemType } from '@docgraph/common/schemas'
import { DatabaseIcon, FileText, type LucideIcon, Waypoints, Workflow } from 'lucide-react'

export type ItemTypeConfig = {
  label: string
  value: ItemType
  Icon: LucideIcon
  /** Classes of the type's icon tile: tinted background plus icon color (`--type-*` tokens). */
  tileClassName: string
}

export const ITEM_TYPES_CONFIG: Record<ItemType, ItemTypeConfig> = {
  DOCUMENT: {
    label: 'Document',
    value: 'DOCUMENT',
    Icon: FileText,
    tileClassName: 'bg-type-document/12 text-type-document',
  },
  BUSINESS_PROCESS: {
    label: 'Business Process',
    value: 'BUSINESS_PROCESS',
    Icon: Waypoints,
    tileClassName: 'bg-type-process/14 text-type-process',
  },
  DATABASE_DIAGRAM: {
    label: 'Database',
    value: 'DATABASE_DIAGRAM',
    Icon: DatabaseIcon,
    tileClassName: 'bg-type-database/12 text-type-database',
  },
  FLOWCHART: {
    label: 'Flowchart',
    value: 'FLOWCHART',
    Icon: Workflow,
    tileClassName: 'bg-type-flowchart/14 text-type-flowchart',
  },
}
