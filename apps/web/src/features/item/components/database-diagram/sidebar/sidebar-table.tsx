import { Copy, KeyRound, Plus, Trash } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useEditingPresence } from '../../../hooks/use-editing-presence'
import { duplicateNode } from '../../../lib/duplicate-node.helpers'
import { colorClasses } from '../../../lib/node-color.helpers'
import type { DatabaseNode as DatabaseNodeType } from '../database-node'
import { SidebarTableColumn } from './table-column'

export type SidebarTableProps = {
  nodeId: string
  data: DatabaseNodeType['data']
  setNodes: React.Dispatch<React.SetStateAction<DatabaseNodeType[]>>
  readOnly?: boolean
}

export const SidebarTable = memo(({ nodeId, data, setNodes, readOnly }: SidebarTableProps) => {
  const { startEditing, stopEditing } = useEditingPresence()

  const updateData = (fn: (data: DatabaseNodeType['data']) => DatabaseNodeType['data']) =>
    setNodes((state) => state.map((n) => (n.id === nodeId ? { ...n, data: fn(n.data) } : n)))

  const patchData = (patch: Partial<DatabaseNodeType['data']>) =>
    updateData((data) => ({ ...data, ...patch }))

  const handleDeleteNode = () => setNodes((state) => state.filter((n) => n.id !== nodeId))

  /** Columns, constraints and checks are copied under fresh ids, keeping their links. */
  const handleDuplicateNode = () =>
    setNodes((state) =>
      duplicateNode(state, nodeId, (data) => {
        const idMap = new Map(data.values.map((v) => [v.id, crypto.randomUUID()]))
        return {
          ...data,
          name: `${data.name}_copy`,
          values: data.values.map((v) => ({ ...v, id: idMap.get(v.id) ?? crypto.randomUUID() })),
          constraints: data.constraints?.map((c) => ({
            ...c,
            id: crypto.randomUUID(),
            columns: c.columns.flatMap((id) => {
              const mapped = idMap.get(id)
              return mapped ? [mapped] : []
            }),
          })),
          checks: data.checks?.map((check) => ({ ...check, id: crypto.randomUUID() })),
        }
      }),
    )

  const handleConstraintAdd = (type: 'unique' | 'index') =>
    updateData((data) => ({
      ...data,
      constraints: [...(data.constraints ?? []), { id: crypto.randomUUID(), type, columns: [] }],
    }))

  const handleConstraintDelete = (constraintId: string) =>
    updateData((data) => ({
      ...data,
      constraints: data.constraints?.filter((c) => c.id !== constraintId),
    }))

  const handleConstraintToggleColumn = (constraintId: string, columnId: string) =>
    updateData((data) => ({
      ...data,
      constraints: data.constraints?.map((c) =>
        c.id === constraintId
          ? {
              ...c,
              columns: c.columns.includes(columnId)
                ? c.columns.filter((id) => id !== columnId)
                : [...c.columns, columnId],
            }
          : c,
      ),
    }))

  const updateExpressions = (constraintId: string, fn: (expressions: string[]) => string[]) =>
    updateData((data) => ({
      ...data,
      constraints: data.constraints?.map((c) =>
        c.id === constraintId ? { ...c, expressions: fn(c.expressions ?? []) } : c,
      ),
    }))

  const handleExpressionAdd = (constraintId: string) =>
    updateExpressions(constraintId, (expressions) => [...expressions, ''])

  const handleExpressionChange = (constraintId: string, index: number, expression: string) =>
    updateExpressions(constraintId, (expressions) =>
      expressions.map((previous, i) => (i === index ? expression : previous)),
    )

  const handleExpressionDelete = (constraintId: string, index: number) =>
    updateExpressions(constraintId, (expressions) => expressions.filter((_, i) => i !== index))

  const handleCheckAdd = () =>
    updateData((data) => ({
      ...data,
      checks: [...(data.checks ?? []), { id: crypto.randomUUID(), expression: '' }],
    }))

  const handleCheckChange = (checkId: string, expression: string) =>
    updateData((data) => ({
      ...data,
      checks: data.checks?.map((check) =>
        check.id === checkId ? { ...check, expression } : check,
      ),
    }))

  const handleCheckDelete = (checkId: string) =>
    updateData((data) => ({
      ...data,
      checks: data.checks?.filter((check) => check.id !== checkId),
    }))

  const handleValueAdd = () =>
    updateData((data) => ({
      ...data,
      values: [
        ...data.values,
        {
          id: crypto.randomUUID(),
          name: 'name',
          value: 'varchar',
          primaryKey: false,
          foreignKey: false,
          index: false,
          unique: false,
          nullable: false,
        },
      ],
    }))

  return (
    <Card className='shrink-0 rounded-lg p-0 shadow-none' id={`sidebar-node-${nodeId}`}>
      <CardContent className='p-0 flex'>
        <div className={`${colorClasses[data.color]} w-1 shrink-0 self-stretch`} />
        <div className='flex min-w-0 flex-1 flex-col gap-2 p-2.5'>
          <div className='flex justify-between items-center gap-2'>
            <Input
              type='text'
              aria-label='Table name'
              value={data.name}
              onChange={(e) => patchData({ name: e.target.value })}
              onFocus={() => startEditing(nodeId, 'name')}
              onBlur={stopEditing}
              disabled={readOnly}
            />

            <Button
              variant='ghost'
              aria-label='Add column'
              onClick={handleValueAdd}
              disabled={readOnly}
            >
              <Plus />
            </Button>
          </div>

          <Textarea
            value={data.description || ''}
            onChange={(e) => patchData({ description: e.target.value })}
            onFocus={() => startEditing(nodeId, 'description')}
            onBlur={stopEditing}
            placeholder='Description'
            disabled={readOnly}
          />

          {data.constraints?.map((c) => {
            const columnNames = data.values
              .filter((v) => c.columns.includes(v.id))
              .map((v) => v.name)
              .join(', ')
            const parts = [columnNames, ...(c.expressions ?? [])].filter(Boolean).join(', ')
            return (
              <div key={c.id} className='flex flex-col gap-1'>
                <div className='flex items-center gap-1'>
                  <span className='text-xs font-semibold uppercase w-12 shrink-0'>{c.type}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant='outline'
                          size='sm'
                          className='flex-1 justify-start font-normal truncate'
                          disabled={readOnly}
                        />
                      }
                    >
                      {columnNames || 'columns'}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {data.values.map((v) => (
                        <DropdownMenuCheckboxItem
                          key={v.id}
                          checked={c.columns.includes(v.id)}
                          closeOnClick={false}
                          onCheckedChange={() => handleConstraintToggleColumn(c.id, v.id)}
                        >
                          {v.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExpressionAdd(c.id)}>
                        Add expression
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    // Names the parts so screen readers can tell same-type constraints apart.
                    aria-label={`Delete ${c.type} constraint${parts ? ` (${parts})` : ''}`}
                    onClick={() => handleConstraintDelete(c.id)}
                    disabled={readOnly}
                  >
                    <Trash />
                  </Button>
                </div>
                {c.expressions?.map((expression, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: expressions have no ids and may repeat
                  <div key={i} className='flex items-center gap-1 pl-13'>
                    <Input
                      type='text'
                      aria-label='Index expression'
                      placeholder='e.g. lower(email)'
                      value={expression}
                      onChange={(e) => handleExpressionChange(c.id, i, e.target.value)}
                      onFocus={() => startEditing(nodeId, `constraint:${c.id}`)}
                      onBlur={stopEditing}
                      disabled={readOnly}
                    />
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={`Delete expression${expression ? ` (${expression})` : ''}`}
                      onClick={() => handleExpressionDelete(c.id, i)}
                      disabled={readOnly}
                    >
                      <Trash />
                    </Button>
                  </div>
                ))}
              </div>
            )
          })}

          {data.checks?.map((check) => (
            <div key={check.id} className='flex items-center gap-1'>
              <span className='text-xs font-semibold uppercase w-12 shrink-0'>Check</span>
              <Input
                type='text'
                aria-label='Check expression'
                placeholder='e.g. price > 0'
                title={check.name}
                value={check.expression}
                onChange={(e) => handleCheckChange(check.id, e.target.value)}
                onFocus={() => startEditing(nodeId, `check:${check.id}`)}
                onBlur={stopEditing}
                disabled={readOnly}
              />
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label={`Delete check${check.expression ? ` (${check.expression})` : ''}`}
                onClick={() => handleCheckDelete(check.id)}
                disabled={readOnly}
              >
                <Trash />
              </Button>
            </div>
          ))}

          {data.values?.map((x, i) => (
            <SidebarTableColumn
              key={x.id}
              value={x}
              setNodes={setNodes}
              nodeId={nodeId}
              index={i}
              total={data.values.length}
              readOnly={readOnly}
            />
          ))}
          <div className='flex justify-end gap-1'>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Add constraint'
                    disabled={readOnly}
                  />
                }
              >
                <KeyRound />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  className='cursor-pointer'
                  onClick={() => handleConstraintAdd('unique')}
                >
                  <Plus /> Unique
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='cursor-pointer'
                  onClick={() => handleConstraintAdd('index')}
                >
                  <Plus /> Index
                </DropdownMenuItem>
                <DropdownMenuItem className='cursor-pointer' onClick={handleCheckAdd}>
                  <Plus /> Check
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='Duplicate table'
              onClick={handleDuplicateNode}
              disabled={readOnly}
            >
              <Copy />
            </Button>
            <Button
              variant='destructive'
              size='icon-sm'
              aria-label='Delete table'
              onClick={handleDeleteNode}
              disabled={readOnly}
            >
              <Trash />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
