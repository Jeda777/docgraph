import { ArrowRight, Trash } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SidebarRelationCardProps<Kind extends string> = {
  edgeId: string
  sourceLabel: string
  targetLabel: string
  onDelete: () => void
  /** Relationship kinds offered in the select; omit `kinds` to hide it. */
  kinds?: readonly Kind[]
  kind?: Kind
  onKindChange?: (kind: Kind) => void
  /** Extra controls rendered below the kind select. */
  children?: ReactNode
  readOnly?: boolean
}

/**
 * Sidebar card for a single edge, shared by every diagram: endpoint names,
 * delete action and an optional relationship-kind select.
 */
export const SidebarRelationCard = <Kind extends string>({
  edgeId,
  sourceLabel,
  targetLabel,
  onDelete,
  kinds,
  kind,
  onKindChange,
  children,
  readOnly,
}: SidebarRelationCardProps<Kind>) => (
  <Card className='shrink-0 rounded-lg p-0 shadow-none' id={`sidebar-edge-${edgeId}`}>
    <CardContent className='p-2 flex flex-col gap-2'>
      <div className='flex items-center gap-1 text-xs font-medium'>
        <span className='truncate'>{sourceLabel}</span>
        <ArrowRight className='size-3 shrink-0' />
        <span className='truncate'>{targetLabel}</span>
        <Button
          variant='destructive'
          size='icon-sm'
          className='ml-auto shrink-0'
          onClick={onDelete}
          disabled={readOnly}
        >
          <Trash />
        </Button>
      </div>

      {kinds && onKindChange && (
        <Select
          value={kind}
          onValueChange={(value) => {
            if (value) onKindChange(value as Kind)
          }}
        >
          <SelectTrigger className='w-full' disabled={readOnly}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {children}
    </CardContent>
  </Card>
)
