import type { DatabaseDiagramEnum } from '@docgraph/common/schemas'
import { Plus, Trash } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type SidebarEnumProps = {
  item: DatabaseDiagramEnum
  setEnums: React.Dispatch<React.SetStateAction<DatabaseDiagramEnum[]>>
  readOnly?: boolean
}

export const SidebarEnum = memo(({ item, setEnums, readOnly }: SidebarEnumProps) => {
  const update = (fn: (item: DatabaseDiagramEnum) => DatabaseDiagramEnum) =>
    setEnums((state) => state.map((current) => (current.id === item.id ? fn(current) : current)))

  const handleValueAdd = () =>
    update((current) => ({
      ...current,
      values: [...current.values, { id: crypto.randomUUID(), name: '' }],
    }))

  const handleValueChange = (valueId: string, name: string) =>
    update((current) => ({
      ...current,
      values: current.values.map((value) => (value.id === valueId ? { ...value, name } : value)),
    }))

  const handleValueDelete = (valueId: string) =>
    update((current) => ({
      ...current,
      values: current.values.filter((value) => value.id !== valueId),
    }))

  const handleDelete = () => setEnums((state) => state.filter((current) => current.id !== item.id))

  return (
    <Card className='shrink-0 rounded-lg p-0 shadow-none' id={`sidebar-enum-${item.id}`}>
      <CardContent className='p-2.5 flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Input
            type='text'
            aria-label='Enum name'
            value={item.name}
            onChange={(e) => update((current) => ({ ...current, name: e.target.value }))}
            disabled={readOnly}
          />
          <Button
            variant='ghost'
            aria-label='Add value'
            onClick={handleValueAdd}
            disabled={readOnly}
          >
            <Plus />
          </Button>
        </div>

        {item.values.map((value) => (
          <div key={value.id} className='flex items-center gap-1'>
            <Input
              type='text'
              aria-label='Enum value'
              placeholder='value'
              title={value.note}
              value={value.name}
              onChange={(e) => handleValueChange(value.id, e.target.value)}
              disabled={readOnly}
            />
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={`Delete value${value.name ? ` (${value.name})` : ''}`}
              onClick={() => handleValueDelete(value.id)}
              disabled={readOnly}
            >
              <Trash />
            </Button>
          </div>
        ))}

        <div className='flex justify-end'>
          <Button
            variant='destructive'
            size='icon-sm'
            aria-label='Delete enum'
            onClick={handleDelete}
            disabled={readOnly}
          >
            <Trash />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
