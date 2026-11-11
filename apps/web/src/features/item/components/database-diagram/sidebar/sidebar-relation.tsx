import {
  columnIdFromHandleId,
  DATABASE_DIAGRAM_DEFAULT_EDGE_DATA,
  REFERENTIAL_ACTIONS,
  RELATION_TYPES,
  type ReferentialAction,
} from '@docgraph/common/schemas'
import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { edgeMutations } from '../../../lib/edge-mutations.helpers'
import { SidebarRelationCard } from '../../base/sidebar-relation-card'
import type { DatabaseEdge as DatabaseEdgeType } from '../database-edge'
import type { DatabaseNode as DatabaseNodeType } from '../database-node'

export type SidebarRelationProps = {
  edge: DatabaseEdgeType
  nodes: DatabaseNodeType[]
  setEdges: React.Dispatch<React.SetStateAction<DatabaseEdgeType[]>>
  readOnly?: boolean
}

const columnId = (handle?: string | null) => (handle ? columnIdFromHandleId(handle) : undefined)

const endpointLabel = (nodes: DatabaseNodeType[], nodeId: string, handle?: string | null) => {
  const node = nodes.find((n) => n.id === nodeId)
  const column = node?.data.values.find((v) => v.id === columnId(handle))
  return `${node?.data.name ?? '?'}.${column?.name ?? '?'}`
}

export const SidebarRelation = ({ edge, nodes, setEdges, readOnly }: SidebarRelationProps) => {
  const { data, update, handleDelete } = edgeMutations(
    edge,
    setEdges,
    DATABASE_DIAGRAM_DEFAULT_EDGE_DATA,
  )
  const selectId = useId()

  return (
    <SidebarRelationCard
      edgeId={edge.id}
      sourceLabel={endpointLabel(nodes, edge.source, edge.sourceHandle)}
      targetLabel={endpointLabel(nodes, edge.target, edge.targetHandle)}
      onDelete={handleDelete}
      kinds={RELATION_TYPES}
      kind={data.relation}
      onKindChange={(relation) => update({ relation })}
      readOnly={readOnly}
    >
      <div className='grid grid-cols-2 gap-2'>
        {(['onDelete', 'onUpdate'] as const).map((field) => {
          const id = `${selectId}-${field}`
          return (
            <div key={field} className='flex flex-col gap-1'>
              <Label htmlFor={id} className='text-xs text-muted-foreground'>
                {field === 'onDelete' ? 'On delete' : 'On update'}
              </Label>
              <Select
                value={data[field]}
                onValueChange={(v) => update({ [field]: v as ReferentialAction })}
              >
                <SelectTrigger id={id} className='w-full' disabled={readOnly}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERENTIAL_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      <Label className='flex items-center gap-2 text-xs'>
        <Checkbox
          checked={data.nullable}
          onCheckedChange={(checked) => update({ nullable: checked === true })}
          disabled={readOnly}
        />
        Nullable
      </Label>
    </SidebarRelationCard>
  )
}
